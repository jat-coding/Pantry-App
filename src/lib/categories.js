export const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snacks', 'Drinks', 'Sauces & Dressings']

export const CATEGORY_EMOJI = {
  Breakfast: '🍳',
  Lunch: '🥪',
  Dinner: '🍝',
  Dessert: '🍪',
  Snacks: '🥨',
  Drinks: '🥤',
  'Sauces & Dressings': '🥫',
}

// Best-effort grocery aisle grouping by ingredient keyword.
const GROUPS = {
  Produce: ['lettuce', 'greens', 'tomato', 'onion', 'garlic', 'cucumber', 'pepper', 'carrot',
    'potato', 'lemon', 'lime', 'apple', 'banana', 'herb', 'parsley', 'cilantro', 'spinach',
    'avocado', 'broccoli', 'mushroom', 'ginger', 'celery', 'berry', 'fruit', 'vegetable'],
  Dairy: ['milk', 'butter', 'cheese', 'cream', 'yogurt', 'egg', 'parmesan', 'buttermilk'],
  Meat: ['chicken', 'beef', 'pork', 'bacon', 'sausage', 'turkey', 'fish', 'salmon', 'shrimp', 'meat'],
  Bakery: ['bread', 'bun', 'tortilla', 'bagel', 'roll', 'baguette'],
  Pantry: ['flour', 'sugar', 'oil', 'salt', 'pepper', 'rice', 'pasta', 'spaghetti', 'sauce',
    'vinegar', 'baking', 'vanilla', 'chocolate', 'broth', 'stock', 'bean', 'spice', 'honey',
    'syrup', 'oats', 'cocoa', 'yeast', 'cornstarch'],
}

export function aisleFor(name) {
  const n = (name || '').toLowerCase()
  for (const [aisle, words] of Object.entries(GROUPS)) {
    if (words.some((w) => n.includes(w))) return aisle
  }
  return 'Other'
}

export const AISLE_ORDER = ['Produce', 'Dairy', 'Meat', 'Bakery', 'Pantry', 'Other']
