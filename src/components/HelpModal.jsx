import { GroceryIcon, RecipesIcon, PantryIcon, FriendsIcon, LinkIcon, MealIcon, PlusIcon } from './icons.jsx'
import { X } from 'lucide-react'
import { useScrollLock } from '../lib/useScrollLock.js'

const STEPS = [
  { Icon: PantryIcon, title: 'Your Pantry', body: 'Tap the heart on any recipe to save it to My Pantry.' },
  { Icon: PlusIcon, title: 'Add a recipe', body: 'Tap the + in the bottom bar to create or import one.' },
  { Icon: LinkIcon, title: 'Import from anywhere', body: 'Link, text, photo, PDF/Word, or an Instagram/TikTok post.' },
  { Icon: GroceryIcon, title: 'Grocery list', body: 'Send ingredients to your list, or try “What Can I Make?”.' },
  { Icon: FriendsIcon, title: 'Friends', body: 'Browse friends’ pantries and copy their recipes.' },
  { Icon: MealIcon, title: 'Cook Mode', body: 'Big step-by-step instructions that keep your screen awake.' },
]

export default function HelpModal({ onClose }) {
  useScrollLock()
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-warm/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}>
      <div className="w-full max-w-md animate-fadein rounded-t-3xl bg-eggshell p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Welcome to Pantry</h2>
          <button onClick={onClose} className="text-2xl text-warm-soft" aria-label="Close"><X className="h-6 w-6" strokeWidth={2} aria-hidden="true" /></button>
        </div>
        <p className="mb-3 text-sm text-warm-soft">A quick tour of how everything works.</p>
        <ul className="space-y-2.5">
          {STEPS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-warm">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="text-xs leading-snug text-warm-soft">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="btn-peach mt-4 w-full">Got it</button>
      </div>
    </div>
  )
}
