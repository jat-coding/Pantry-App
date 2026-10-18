import { X } from 'lucide-react'
import { ShareIcon } from './icons.jsx'
import { useToast } from './Toast.jsx'
import { useScrollLock } from '../lib/useScrollLock.js'

// Full-screen look at a recipe PDF before it goes anywhere. Shows each page as the
// exact image that was put into the PDF (an <iframe> of the PDF only ever shows page
// one on iOS and can't be scrolled), and its Share button is a fresh tap, so iOS
// lets it open the share sheet even when building the PDF took a while.
export default function PdfPreview({ file, pages, title, onClose }) {
  useScrollLock()
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

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-eggshell animate-fadein" role="dialog" aria-modal="true" aria-label="PDF preview">
      <div className="flex items-center justify-between gap-3 border-b border-warm/10 bg-white/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-warm-soft">PDF preview</p>
          <p className="truncate font-bold">{title}</p>
        </div>
        <button onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-warm-soft" aria-label="Close preview">
          <X className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {pages.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={pages.length > 1 ? `Page ${i + 1} of ${pages.length}` : 'Recipe PDF'}
              className="w-full rounded-lg bg-white shadow-card"
              style={{ aspectRatio: '816 / 1056' }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-3 border-t border-warm/10 bg-white/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
        <button onClick={onClose} className="btn-ghost flex-1">Close</button>
        <button onClick={share} className="btn-peach flex-1"><ShareIcon className="h-5 w-5" />Share</button>
      </div>
    </div>
  )
}
