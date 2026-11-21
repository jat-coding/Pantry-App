import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchPageViaBridge, isSiteVerdict, isServiceUnreachable } from '../src/lib/anthropic.js'

function fake({ start, status = [], direct }) {
  const calls = []
  let i = 0
  return {
    calls,
    sleep: async () => {},
    post: async (u, b) => {
      calls.push(u)
      const v = u.endsWith('recipe-proxy-start') ? start : direct
      if (v instanceof Error) throw v
      return typeof v === 'function' ? v(b) : v
    },
    get: async (u) => {
      calls.push(u)
      const v = status[Math.min(i++, status.length - 1)]
      if (v instanceof Error) throw v
      return v
    },
  }
}

test('bridge path: start -> poll -> html', async () => {
  const f = fake({ start: { jobId: 'j', via: 'bridge' }, status: [{ state: 'running' }, { state: 'done', html: 'B' }] })
  assert.equal(await fetchPageViaBridge('https://x.com', { fetchImpl: f }), 'B')
  assert.ok(!f.calls.includes('/api/recipe-fetch-direct'))
})

test('server-side fallback: start returns html inline', async () => {
  const f = fake({ start: { html: 'D', via: 'direct' } })
  assert.equal(await fetchPageViaBridge('https://x.com', { fetchImpl: f }), 'D')
})

test('start fails with a bridge error -> client direct fetch', async () => {
  const f = fake({ start: new Error('Could not reach the fetch service (timed out).'), direct: { html: 'D2' } })
  assert.equal(await fetchPageViaBridge('https://x.com', { fetchImpl: f }), 'D2')
})

test('bridge drops mid-job -> client direct fetch', async () => {
  const f = fake({
    start: { jobId: 'j' },
    status: [{ state: 'running' }, { state: 'error', error: 'Could not reach the fetch service (fetch failed).' }],
    direct: { html: 'D3' },
  })
  assert.equal(await fetchPageViaBridge('https://x.com', { fetchImpl: f }), 'D3')
})

test('status call throws (network) -> client direct fetch', async () => {
  const f = fake({ start: { jobId: 'j' }, status: [new Error('Network error')], direct: { html: 'D4' } })
  assert.equal(await fetchPageViaBridge('https://x.com', { fetchImpl: f }), 'D4')
})

test('a site verdict is not retried and gets the friendly message', async () => {
  const f = fake({ start: { jobId: 'j' }, status: [{ state: 'error', error: 'HTTP 403' }], direct: { html: 'never' } })
  await assert.rejects(fetchPageViaBridge('https://x.com', { fetchImpl: f }), /blocked the automatic import/)
  assert.ok(!f.calls.includes('/api/recipe-fetch-direct'))
})

test('both paths down -> clear error, not a hang', async () => {
  const f = fake({ start: new Error('Could not reach the fetch service (fetch failed).'), direct: new Error('timed out') })
  await assert.rejects(fetchPageViaBridge('https://x.com', { fetchImpl: f }), /took too long/)
})

test('classifiers', () => {
  assert.equal(isSiteVerdict('HTTP 404'), true)
  assert.equal(isSiteVerdict('Could not reach the fetch service (timed out).'), false)
  assert.equal(isServiceUnreachable('Could not reach the transcription service (fetch failed).'), true)
  assert.equal(isServiceUnreachable('Could not start reading that video (502).'), true)
  assert.equal(isServiceUnreachable('This video is private'), false)
})
