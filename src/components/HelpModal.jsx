import { GroceryIcon, RecipesIcon, PantryIcon, FriendsIcon, LinkIcon, MealIcon, PlusIcon } from './icons.jsx'

const STEPS = [
  { Icon: PantryIcon, title: 'Your Pantry', body: 'Tap the heart on any recipe to save it to My Pantry — your home for the recipes you love.' },
  { Icon: PlusIcon, title: 'Add a recipe', body: 'Tap the big + in the middle of the bottom bar (on any screen) to create one from scratch or import.' },
  { Icon: LinkIcon, title: 'Import from anywhere', body: 'Paste a recipe link or text, snap a photo, open a PDF or Word doc, or share an Instagram/TikTok post — Pantry turns it into a recipe. (Works when the recipe is written in the caption.)' },
  { Icon: GroceryIcon, title: 'Grocery list', body: 'Send a recipe’s ingredients to your grocery list, or use “What Can I Make?” to cook with what you already have.' },
  { Icon: FriendsIcon, title: 'Friends', body: 'Add friends to browse their pantry and copy their recipes into yours.' },
  { Icon: MealIcon, title: 'Cook Mode', body: 'Open a recipe and switch on Cook Mode for big, step-by-step instructions that keep your screen awake.' },
]

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-warm/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md animate-fadein overflow-y-auto rounded-t-3xl bg-eggshell p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-2xl font-extrabold">Welcome to Pantry</h2>
          <button onClick={onClose} className="text-2xl text-warm-soft" aria-label="Close">×</button>
        </div>
        <p className="mb-5 text-warm-soft">A quick tour of how everything works.</p>
        <ul className="space-y-4">
          {STEPS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-peach text-warm">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-warm-soft">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="btn-peach mt-6 w-full">Got it</button>
      </div>
    </div>
  )
}
