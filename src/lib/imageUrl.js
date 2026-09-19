// Turns whatever a recipe page put in its `image` field (string, ImageObject,
// array of either, protocol-relative or relative URL, http://) into one URL a
// browser on our https origin can actually load. Returns '' if nothing usable.
export function normalizeImageUrl(raw, base) {
  const pick = (v) => {
    if (!v) return ''
    if (typeof v === 'string') return v
    if (Array.isArray(v)) {
      for (const item of v) { const r = pick(item); if (r) return r }
      return ''
    }
    if (typeof v === 'object') return pick(v.url) || pick(v.contentUrl) || pick(v['@id']) || pick(v.src)
    return ''
  }
  let s = pick(raw).trim()
  if (!s || s.startsWith('data:')) return s
  // srcset-style "url 1x, url2 2x" -> first URL
  if (/\s/.test(s)) s = s.split(/[\s,]+/)[0]
  try {
    const u = new URL(s, base || undefined)
    if (u.protocol === 'http:') u.protocol = 'https:'
    return u.protocol === 'https:' ? u.toString() : ''
  } catch {
    return ''
  }
}
