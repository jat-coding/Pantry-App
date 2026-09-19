// Vercel serverless function: GET /api/image-fetch?url=<image url>
// Fetches a remote recipe image server-side (browsers can't read cross-origin image
// bytes) so the client can save its own copy to Firebase Storage. Image content
// types only, size-capped, and refuses private/loopback/link-local targets
// (checked on the resolved IP, and again on every redirect hop).
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const config = { maxDuration: 20 }

const MAX_BYTES = 4 * 1024 * 1024 // Vercel's response cap is 4.5 MB
const MAX_HOPS = 3

function isPrivateIp(ip) {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')) return true
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return m ? isPrivateIp(m[1]) : false
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function assertPublic(u) {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Unsupported protocol')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Blocked address')
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    let u = new URL(String(req.query.url || ''))
    let resp
    for (let hop = 0; ; hop++) {
      await assertPublic(u)
      resp = await fetch(u, {
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; PantryImageSnapshot/1.0)', accept: 'image/*' },
      })
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
        if (hop >= MAX_HOPS) throw new Error('Too many redirects')
        u = new URL(resp.headers.get('location'), u)
        continue
      }
      break
    }
    if (!resp.ok) throw new Error(`Source returned ${resp.status}`)
    const type = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!type.startsWith('image/') || type === 'image/svg+xml') throw new Error('Not an image')
    const declared = Number(resp.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) throw new Error('Image too large')

    const chunks = []
    let total = 0
    for await (const chunk of resp.body) {
      total += chunk.length
      if (total > MAX_BYTES) throw new Error('Image too large')
      chunks.push(chunk)
    }
    res.setHeader('content-type', type)
    res.setHeader('cache-control', 'no-store')
    res.status(200).send(Buffer.concat(chunks))
  } catch (err) {
    res.status(422).json({ error: err?.message || 'Could not fetch image' })
  }
}
