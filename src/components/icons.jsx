// Icons — Lucide (lucide-react), no emojis. All render via currentColor so
// callers control color with Tailwind text-* classes; strokeWidth matched to
// the app's previous hand-drawn weight (1.8) for visual consistency.
import {
  ShoppingCart, BookOpen, Users, User, LayoutGrid, List, Plus,
  HelpCircle, Search, UtensilsCrossed, Pencil, Trash2, Video, Camera, Link as LinkIconBase,
  Egg, Sandwich, ChefHat, Cookie, Popcorn, CupSoda, Droplet, Heart as HeartIconBase,
} from 'lucide-react'

const STROKE_WIDTH = 1.8

export function GroceryIcon({ className = 'h-6 w-6' }) {
  return <ShoppingCart className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function RecipesIcon({ className = 'h-6 w-6' }) {
  return <BookOpen className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

// Line-art version of the app icon (cabinet: three top cubbies, split doors, handles).
export function PantryIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.3" y="2" width="15.4" height="20" rx="1.6" />
      <path d="M4.3 8.7h15.4M12 8.7V22M8.9 14.5v2.9M15.1 14.5v2.9" />
      <rect x="6" y="4.2" width="2.7" height="3.2" rx="0.5" />
      <rect x="10.65" y="4.2" width="2.7" height="3.2" rx="0.5" />
      <rect x="15.3" y="4.2" width="2.7" height="3.2" rx="0.5" />
    </svg>
  )
}

export function FriendsIcon({ className = 'h-6 w-6' }) {
  return <Users className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function ProfileIcon({ className = 'h-6 w-6' }) {
  return <User className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function GridIcon({ className = 'h-5 w-5' }) {
  return <LayoutGrid className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function ListIcon({ className = 'h-5 w-5' }) {
  return <List className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function PlusIcon({ className = 'h-6 w-6' }) {
  return <Plus className={className} strokeWidth={2.4} aria-hidden="true" />
}

export function HelpIcon({ className = 'h-5 w-5' }) {
  return <HelpCircle className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function SearchIcon({ className = 'h-5 w-5' }) {
  return <Search className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function MealIcon({ className = 'h-6 w-6' }) {
  // Fork + knife — placeholder when a recipe has no photo.
  return <UtensilsCrossed className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function EditIcon({ className = 'h-5 w-5' }) {
  return <Pencil className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function TrashIcon({ className = 'h-5 w-5' }) {
  return <Trash2 className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function VideoIcon({ className = 'h-5 w-5' }) {
  return <Video className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function CameraIcon({ className = 'h-5 w-5' }) {
  return <Camera className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function LinkIcon({ className = 'h-5 w-5' }) {
  return <LinkIconBase className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

// Per-category food icons used as the no-photo placeholder (replaces emoji).
const CATEGORY_ICON = {
  Breakfast: Egg,
  Lunch: Sandwich,
  Dinner: ChefHat,
  Dessert: Cookie,
  Snacks: Popcorn,
  Drinks: CupSoda,
  'Sauces & Dressings': Droplet,
}

export function CategoryIcon({ category, className = 'h-6 w-6' }) {
  const Icon = CATEGORY_ICON[category] || UtensilsCrossed
  return <Icon className={className} strokeWidth={STROKE_WIDTH} aria-hidden="true" />
}

export function HeartIcon({ filled, className = 'h-5 w-5' }) {
  // Filled uses the warm peach accent, matching the previous hand-drawn heart.
  return (
    <HeartIconBase
      className={className}
      aria-hidden="true"
      strokeWidth={1.8}
      fill={filled ? '#FFCBA4' : 'none'}
      stroke={filled ? '#F2A977' : 'currentColor'}
    />
  )
}
