import { useEffect, useState } from 'react'

// <img> that survives bad/blocked/odd-format image URLs: sends no referrer (many
// recipe sites block hotlinking by Referer), retries once over https if the URL
// was http, and swaps to `fallback` instead of leaving a blank box on failure.
export default function SafeImage({ src, alt = '', className, fallback = null, ...rest }) {
  const [url, setUrl] = useState(src)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setUrl(src); setFailed(false) }, [src])

  if (!url || failed) return fallback
  return (
    <img
      {...rest}
      src={url}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (url.startsWith('http://')) setUrl('https://' + url.slice(7))
        else setFailed(true)
      }}
    />
  )
}
