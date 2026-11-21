// directFetch.js -- fetch a recipe page straight from the Vercel function.
//
// Why this exists (2026-11-21): every URL import used to go Vercel -> Tailscale Funnel ->
// the home desktop bridge. Any blip on that path (Wi-Fi roam, Windows reboot, bridge
// restart) took import down for everyone. This is the fallback used when the bridge
// can't be reached: same job (get the page's HTML), no home machine involved.
//
// Error strings deliberately match the bridge's page-fetch.js ("HTTP 403",
// "page too large", "timed out", "...can’t fetch from") so the client's friendly
// message mapping (src/lib/anthropic.js explainPageFetchError) works for both paths.
//
// SSRF guard: only http/https on the default ports, every DNS answer must be a public
// address, and redirects are followed by hand so each hop is re-checked.
// Residual risk (documented, accepted): fetch() resolves the name again after our check,
// so a DNS-rebinding attacker could in theory swap the answer in between. A Vercel
// function has no private network of its own to reach, which is why this is acceptable.

import { lookup as dnsLookupReal } from 'node:dns/promises'
import net from 'node:net'

export const MAX_BYTES = 3 * 1024 * 1024
export const DEFAULT_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 5
export const BLOCKED_ERROR = 'that link points somewhere this can’t fetch from'

const HEADERS = {
  // Same browser UA as the bridge: a bot-looking UA gets 403 from some recipe sites.
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

let dnsLookup = dnsLookupReal
let fetchImpl = (...a) => fetch(...a)
export function _setLookupForTest(fn) { dnsLookup = fn || dnsLookupReal }
export function _setFetchForTest(fn) { fetchImpl = fn || ((...a) => fetch(...a)) }

export function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT, includes Tailscale 100.x
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved + broadcast
  return false
}

export function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase().split('%')[0]
  if (lower === '::1' || lower === '::') return true
  if (/^fe[89ab][0-9a-f]?:/.test(lower)) return true // link-local fe80::/10
  if (/^f[cd][0-9a-f]{0,2}:/.test(lower)) return true // unique-local fc00::/7
  if (/^ff[0-9a-f]{0,2}:/.test(lower)) return true // multicast
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return isPrivateIPv4(dotted[1])
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16)
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  if (/^64:ff9b::/.test(lower)) return true // NAT64, could wrap a private v4
  return false
}

function isPrivateAddress(addr) {
  if (net.isIPv4(addr)) return isPrivateIPv4(addr)
  if (net.isIPv6(addr)) return isPrivateIPv6(addr)
  return true
}

// Returns true only when the URL is http(s) on a normal port and EVERY address the
// name resolves to is public.
export async function isSafePublicUrl(raw) {
  let u
  try { u = new URL(raw) } catch { return false }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.username || u.password) return false
  if (u.port && u.port !== '80' && u.port !== '443') return false
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.ts.net')) return false
  if (net.isIP(host)) return !isPrivateAddress(host)
  let answers
  try {
    answers = await dnsLookup(host, { all: true, verbatim: true })
  } catch {
    return false
  }
  if (!Array.isArray(answers) || answers.length === 0) return false
  return answers.every((a) => !isPrivateAddress(a.address))
}

async function readCapped(res, controller) {
  const len = Number(res.headers.get('content-length') || 0)
  if (len > MAX_BYTES) { controller.abort(); return { ok: false, error: 'page too large' } }
  const reader = res.body?.getReader?.()
  if (!reader) {
    const text = await res.text()
    if (Buffer.byteLength(text) > MAX_BYTES) return { ok: false, error: 'page too large' }
    return { ok: true, html: text }
  }
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES) { controller.abort(); return { ok: false, error: 'page too large' } }
    chunks.push(Buffer.from(value))
  }
  return { ok: true, html: Buffer.concat(chunks).toString('utf8') }
}

// One attempt. Returns { ok, html } or { ok:false, error, status?, retryable }.
export async function fetchPageDirectOnce(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isSafePublicUrl(current))) return { ok: false, error: BLOCKED_ERROR, retryable: false }
      const res = await fetchImpl(current, { headers: HEADERS, redirect: 'manual', signal: controller.signal })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        current = new URL(res.headers.get('location'), current).toString()
        continue
      }
      if (!res.ok) {
        // A 5xx from the site might be a blip worth one retry; a 4xx is the site's answer.
        return { ok: false, error: `HTTP ${res.status}`, status: res.status, retryable: res.status >= 500 }
      }
      const body = await readCapped(res, controller)
      return body.ok ? body : { ...body, retryable: false }
    }
    return { ok: false, error: 'too many redirects', retryable: false }
  } catch (e) {
    const timedOut = e?.name === 'AbortError' || controller.signal.aborted
    return { ok: false, error: timedOut ? 'timed out' : (e?.message || String(e)), retryable: true }
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Fetch with one retry after a short backoff, bounded by an overall deadline so it
// always fits inside the Vercel function's maxDuration.
export async function fetchPageDirect(url, { deadlineMs = 16_000, backoffMs = 600, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const until = Date.now() + deadlineMs
  const first = await fetchPageDirectOnce(url, { timeoutMs: Math.min(timeoutMs, deadlineMs) })
  if (first.ok || !first.retryable) return { ...first, attempts: 1 }
  const left = until - Date.now() - backoffMs
  if (left < 1_500) return { ...first, attempts: 1 }
  await sleep(backoffMs)
  const second = await fetchPageDirectOnce(url, { timeoutMs: Math.min(timeoutMs, left) })
  return { ...second, attempts: 2 }
}
