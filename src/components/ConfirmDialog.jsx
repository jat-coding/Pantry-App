// On-brand replacement for window.confirm() -- the native browser dialog
// can't be restyled at all (it's OS chrome, not part of the page), so every
// confirm prompt in the app renders this instead. Matches AddToPantryPrompt's
// card shape/spacing so every popup in the app reads as the same component.
export default function ConfirmDialog({ message, confirmLabel = 'OK', danger = false, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-warm/40 p-6" onClick={onCancel}>
      <div className="card w-full max-w-xs space-y-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-5 py-3 font-bold shadow-card transition active:scale-95 ${
              danger ? 'bg-red-600 text-white' : 'bg-cta text-white'
            }`}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
