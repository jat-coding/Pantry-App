import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSafePublicUrl, isPrivateIPv4, isPrivateIPv6, fetchPageDirect, fetchPageDirectOnce,
  _setLookupForTest, _setFetchForTest, BLOCKED_ERROR, MAX_BYTES,
} from '../api/_lib/directFetch.js'
import { startOnBridge } from '../api/recipe-proxy-start.js'

const publicDns = async () => [{ address: '93.184.215.14', family: 4 }]
const htmlRes = (body, init = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init })

test('private and special IPv4 ranges are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '100.101.102.103', '0.0.0.0', '224.0.0.1', '255.255.255.255', '1.2.3']) {
    assert.equal(isPrivateIPv4(ip), true, ip)
  }
  for (const ip of ['8.8.8.8', '93.184.215.14', '172.32.0.1', '100.128.0.1']) assert.equal(isPrivateIPv4(ip), false, ip)
})

test('private IPv6 forms are refused, including IPv4-mapped', () => {
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1', '64:ff9b::a00:1']) {
    assert.equal(isPrivateIPv6(ip), true, ip)
  }
  assert.equal(isPrivateIPv6('2606:4700::6810:84e5'), false)
})

test('isSafePublicUrl: scheme, port, host and every DNS answer are checked', async () => {
  _setLookupForTest(publicDns)
  assert.equal(await isSafePublicUrl('https://example.com/recipe'), true)
  assert.equal(await isSafePublicUrl('file:///etc/passwd'), false)
  assert.equal(await isSafePublicUrl('ftp://example.com'), false)
  assert.equal(await isSafePublicUrl('http://example.com:8080/'), false)
  assert.equal(await isSafePublicUrl('http://user:pw@example.com/'), false)
  assert.equal(await isSafePublicUrl('http://localhost/'), false)
  assert.equal(await isSafePublicUrl('http://127.0.0.1/'), false)
  assert.equal(await isSafePublicUrl('http://[::1]/'), false)
  assert.equal(await isSafePublicUrl('http://169.254.169.254/latest/meta-data'), false)
  assert.equal(await isSafePublicUrl('https://desktop.tail1234.ts.net/'), false)
  assert.equal(await isSafePublicUrl('not a url'), false)
  // one public + one private answer (rebinding-style) -> refused
  _setLookupForTest(async () => [{ address: '93.184.215.14', family: 4 }, { address: '10.0.0.5', family: 4 }])
  assert.equal(await isSafePublicUrl('https://evil.example/'), false)
  _setLookupForTest(async () => { throw new Error('ENOTFOUND') })
  assert.equal(await isSafePublicUrl('https://nope.example/'), false)
  _setLookupForTest(null)
})

test('a redirect to a private address is refused at the hop', async () => {
  _setLookupForTest(async (host) => host === 'internal.example' ? [{ address: '192.168.0.10', family: 4 }] : await publicDns())
  let calls = 0
  _setFetchForTest(async () => { calls++; return new Response('', { status: 302, headers: { location: 'http://internal.example/admin' } }) })
  const r = await fetchPageDirectOnce('https://example.com/r')
  assert.equal(r.ok, false)
  assert.equal(r.error, BLOCKED_ERROR)
  assert.equal(calls, 1)
  _setFetchForTest(null); _setLookupForTest(null)
})

test('size cap: oversized body is refused', async () => {
  _setLookupForTest(publicDns)
  _setFetchForTest(async () => htmlRes('x'.repeat(MAX_BYTES + 10)))
  const r = await fetchPageDirectOnce('https://example.com/')
  assert.deepEqual([r.ok, r.error], [false, 'page too large'])
  _setFetchForTest(async () => htmlRes('small', { headers: { 'content-length': String(MAX_BYTES + 1) } }))
  const r2 = await fetchPageDirectOnce('https://example.com/')
  assert.equal(r2.error, 'page too large')
  _setFetchForTest(null); _setLookupForTest(null)
})

test('retries once after a network failure, then succeeds', async () => {
  _setLookupForTest(publicDns)
  let calls = 0
  _setFetchForTest(async () => { calls++; if (calls === 1) throw new TypeError('fetch failed'); return htmlRes('<html>ok</html>') })
  const r = await fetchPageDirect('https://example.com/', { backoffMs: 10 })
  assert.equal(r.ok, true)
  assert.equal(r.attempts, 2)
  assert.equal(r.html, '<html>ok</html>')
  _setFetchForTest(null); _setLookupForTest(null)
})

test('a 403 from the site is final (no retry) and keeps the bridge error shape', async () => {
  _setLookupForTest(publicDns)
  let calls = 0
  _setFetchForTest(async () => { calls++; return new Response('no', { status: 403 }) })
  const r = await fetchPageDirect('https://example.com/', { backoffMs: 10 })
  assert.deepEqual([r.ok, r.error, calls], [false, 'HTTP 403', 1])
  _setFetchForTest(null); _setLookupForTest(null)
})

test('timeout is enforced', async () => {
  _setLookupForTest(publicDns)
  _setFetchForTest((u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
  const t0 = Date.now()
  const r = await fetchPageDirect('https://example.com/', { timeoutMs: 100, deadlineMs: 100, backoffMs: 10 })
  assert.equal(r.error, 'timed out')
  assert.ok(Date.now() - t0 < 2000)
  _setFetchForTest(null); _setLookupForTest(null)
})

test('startOnBridge: retries once, then reports the bridge as unavailable', async () => {
  let calls = 0
  const fetchImpl = async () => { calls++; throw new TypeError('fetch failed') }
  const r = await startOnBridge('https://example.com', { bridgeUrl: 'https://bad.invalid', bridgeSecret: 's', fetchImpl })
  assert.equal(calls, 2)
  assert.match(r.error, /fetch failed/)
  const r2 = await startOnBridge('https://example.com', { bridgeUrl: '', bridgeSecret: '' })
  assert.equal(r2.error, 'bridge not configured')
})

test('startOnBridge: a Funnel 502 then success uses the retry', async () => {
  let calls = 0
  const fetchImpl = async () => {
    calls++
    return calls === 1 ? new Response('bad gateway', { status: 502 }) : Response.json({ ok: true, jobId: 'j1' })
  }
  const r = await startOnBridge('https://example.com', { bridgeUrl: 'https://b', bridgeSecret: 's', fetchImpl })
  assert.deepEqual(r, { jobId: 'j1' })
})
