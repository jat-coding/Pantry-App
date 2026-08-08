// Read a YouTube video's title and description, server-side.
//
// Why not the spoken transcript? YouTube's caption URLs (`/api/timedtext`) now
// require a proof-of-origin token bound to a real browser session: fetched from
// a server they return HTTP 200 with an empty body. The internal player API is
// closed too — its Android/iOS clients 400, and its web clients report
// UNPLAYABLE with no caption tracks. So captions are not obtainable for free;
// reaching them needs a paid transcript service. What we can still read
// reliably is the video's own metadata, which is where most cooking channels
// write the recipe anyway.
//
// This is a big step up from scraping the rendered page: `shortDescription` is
// the exact description text, with no navigation, comments, or sidebar noise
// competing with it for the model's attention.

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 15000

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function isYouTubeUrl(url) {
  return /(^|\.)(youtube\.com|youtu\.be)$/i.test(hostOf(url))
}

// Accepts watch?v=, youtu.be/<id>, /shorts/<id>, /embed/<id>, /live/<id>.
export function youtubeVideoId(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const valid = (v) => (/^[\w-]{11}$/.test(v || '') ? v : null)

  if (/(^|\.)youtu\.be$/i.test(u.hostname)) return valid(u.pathname.split('/')[1])
  if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return null
  if (u.pathname === '/watch') return valid(u.searchParams.get('v'))
  const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/)
  return m ? valid(m[2]) : null
}

async function fetchText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        // Skips the EU cookie-consent interstitial, which otherwise replaces
        // the watch page with a wall containing no player response.
        Cookie: 'CONSENT=YES+cb',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// Read the JSON object literal that follows `marker`, by brace-matching. It's
// embedded in a <script>, so the page isn't parseable as JSON and a greedy
// regex would run past the end of the object.
function jsonAfter(html, marker) {
  const at = html.indexOf(marker)
  if (at === -1) return null
  const start = html.indexOf('{', at + marker.length)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const c = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

// Returns { title, description, hasCaptions }. `hasCaptions` lets the caller
// tell someone their video *does* have a transcript they can copy from
// YouTube's own UI, even though we can't fetch it ourselves.
export async function getYouTubeMeta(url) {
  if (!youtubeVideoId(url)) throw new Error('That does not look like a YouTube video link.')

  const html = await fetchText(`https://www.youtube.com/watch?v=${youtubeVideoId(url)}&hl=en`)
  const player =
    jsonAfter(html, 'ytInitialPlayerResponse =') || jsonAfter(html, 'ytInitialPlayerResponse":')

  const details = player?.videoDetails || {}
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []

  // No title means we never got a real player response — private, age-gated,
  // region-blocked, removed, or a bad ID. Say so, rather than letting the
  // caller report an empty description as "no recipe in the description".
  if (!details.title) {
    const reason = player?.playabilityStatus?.reason
    throw new Error(
      reason
        ? `YouTube wouldn't open that video: ${reason}`
        : "Couldn't open that video — it may be private, age-restricted, or removed.",
    )
  }

  return {
    title: details.title || '',
    description: details.shortDescription || '',
    hasCaptions: tracks.length > 0,
  }
}
