import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ShareIcon } from './icons.jsx'
import { useToast } from './Toast.jsx'
import { useScrollLock } from '../lib/useScrollLock.js'
import { useStandaloneBottomGap } from '../lib/useStandaloneBottomGap.js'

// Full-screen look at a recipe PDF before it goes anywhere. Shows each page as the
// exact image that was put into the PDF (an <iframe> of the PDF only ever shows page
// one on iOS and can't be scrolled), and its Share button is a fresh tap, so iOS
// lets it open the share sheet even when building the PDF took a while.
// size / onSizeChange: the Full page vs Index card choice; `building` is the size
// being built right now (the current pages stay up, dimmed, until it's ready).
// aspect: the pages' width / height, e.g. '816 / 1056'.
const SIZES = [['page', 'Full page'], ['card', 'Index card']]

export default function PdfPreview({ file, pages, title, size, aspect, building, onSizeChange, onClose }) {
  useScrollLock()
  const bottomGap = useStandaloneBottomGap()
  const toast = useToast()

  async function share() {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title })
        onClose()
      } catch (err) {
        if (err?.name === 'AbortError') return // closed the share sheet; keep the preview
        if (err?.name === 'NotAllowedError') return toast('Tap Share again')
        toast('Could not share the PDF')
      }
      return
    }
    // No file sharing here (desktop, older Safari): just download it.
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // Portaled to <body>, like the friend overlay: a `fixed` element nested in the page
  // would be sized by any ancestor transform (the page's fade-in has one) instead of
  // the screen. `bottom` reaches over the strip iOS home-screen apps leave under
  // fixed overlays (see useStandaloneBottomGap), so the button bar sits on the real
  // bottom edge.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-eggshell animate-fadein" style={{ bottom: -bottomGap }}
      role="dialog" aria-modal="true" aria-label="PDF preview">
      <div className="flex items-center justify-between gap-3 border-b border-warm/10 bg-white/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-warm-soft">PDF preview</p>
          <p className="truncate font-bold">{title}</p>
        </div>
        <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-warm-soft" aria-label="Close preview">
          <X className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="border-b border-warm/10 bg-white/95 px-4 py-2">
        <div className="mx-auto flex max-w-2xl rounded-2xl bg-eggshell p-1" role="group" aria-label="PDF size">
          {SIZES.map(([s, label]) => {
            const on = (building || size) === s
            return (
              <button key={s} type="button" aria-pressed={on} disabled={!!building} onClick={() => s !== size && onSizeChange(s)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-bold ${on ? 'bg-peach text-warm' : 'text-warm-soft'}`}>
                {building === s && <span className="h-4 w-4 animate-spin rounded-full border-2 border-warm/20 border-t-peach-dark" aria-hidden="true" />}
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className={`mx-auto flex max-w-2xl flex-col gap-4 transition-opacity ${building ? 'opacity-40' : ''}`} data-pdf-size={size}>
          {pages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={pages.length > 1 ? `Page ${i + 1} of ${pages.length}` : 'Recipe PDF'}
              className="w-full rounded-lg bg-white shadow-card"
              style={{ aspectRatio: aspect }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-3 border-t border-warm/10 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
        <button onClick={onClose} className="btn-ghost flex-1">Close</button>
        <button onClick={share} className="btn-peach flex-1"><ShareIcon className="h-5 w-5" />Share</button>
      </div>
    </div>,
    document.body,
  )
}
