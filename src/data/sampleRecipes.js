// Starter recipes seeded into a new user's library on first sign-in,
// and shown to guests (read-only). Quantities use numeric qty for scaling.

export const sampleRecipes = [
  {
    title: 'Fluffy Buttermilk Pancakes',
    category: 'Breakfast',
    imageUrl:
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80',
    prepTime: { value: 10, unit: 'min' },
    cookTime: { value: 15, unit: 'min' },
    servings: 4,
    isPublic: true,
    ingredients: [
      { qty: 2, unit: 'cups', name: 'all-purpose flour' },
      { qty: 2, unit: 'tbsp', name: 'sugar' },
      { qty: 2, unit: 'tsp', name: 'baking powder' },
      { qty: 0.5, unit: 'tsp', name: 'salt' },
      { qty: 2, unit: '', name: 'eggs' },
      { qty: 1.75, unit: 'cups', name: 'buttermilk' },
      { qty: 3, unit: 'tbsp', name: 'butter, melted' },
    ],
    instructions: [
      'Whisk together flour, sugar, baking powder, and salt.',
      'In another bowl, beat eggs with buttermilk and melted butter.',
      'Fold wet into dry until just combined — lumps are fine.',
      'Cook 1/4-cup portions on a buttered griddle until bubbles form, then flip.',
      'Serve warm with maple syrup.',
    ],
  },
  {
    title: 'Weeknight Garlic Butter Pasta',
    category: 'Dinner',
    imageUrl:
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
    prepTime: { value: 5, unit: 'min' },
    cookTime: { value: 15, unit: 'min' },
    servings: 2,
    isPublic: true,
    ingredients: [
      { qty: 8, unit: 'oz', name: 'spaghetti' },
      { qty: 4, unit: 'tbsp', name: 'butter' },
      { qty: 4, unit: 'cloves', name: 'garlic, minced' },
      { qty: 0.5, unit: 'tsp', name: 'red pepper flakes' },
      { qty: 0.5, unit: 'cup', name: 'parmesan, grated' },
      { qty: 2, unit: 'tbsp', name: 'parsley, chopped' },
    ],
    instructions: [
      'Cook spaghetti in salted water until al dente; reserve 1/2 cup pasta water.',
      'Melt butter, add garlic and pepper flakes, cook until fragrant.',
      'Toss pasta in the butter with a splash of pasta water.',
      'Off heat, stir in parmesan and parsley. Season and serve.',
    ],
  },
  {
    title: 'Brown Butter Chocolate Chip Cookies',
    category: 'Dessert',
    imageUrl:
      'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&q=80',
    prepTime: { value: 20, unit: 'min' },
    cookTime: { value: 12, unit: 'min' },
    servings: 24,
    isPublic: true,
    ingredients: [
      { qty: 1, unit: 'cup', name: 'butter' },
      { qty: 1, unit: 'cup', name: 'brown sugar' },
      { qty: 0.5, unit: 'cup', name: 'white sugar' },
      { qty: 2, unit: '', name: 'eggs' },
      { qty: 2, unit: 'tsp', name: 'vanilla extract' },
      { qty: 2.25, unit: 'cups', name: 'flour' },
      { qty: 1, unit: 'tsp', name: 'baking soda' },
      { qty: 2, unit: 'cups', name: 'chocolate chips' },
    ],
    instructions: [
      'Brown the butter in a saucepan until nutty and amber; cool slightly.',
      'Whisk in both sugars, then eggs and vanilla.',
      'Stir in flour and baking soda, then the chocolate chips.',
      'Chill dough 30 minutes. Scoop onto trays.',
      'Bake at 350°F (175°C) for 11–13 minutes until edges set.',
    ],
  },
  {
    title: 'Crisp Green Salad with Lemon',
    category: 'Lunch',
    imageUrl:
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    prepTime: { value: 10, unit: 'min' },
    cookTime: { value: 0, unit: 'min' },
    servings: 2,
    isPublic: true,
    ingredients: [
      { qty: 5, unit: 'cups', name: 'mixed greens' },
      { qty: 1, unit: '', name: 'cucumber, sliced' },
      { qty: 0.25, unit: 'cup', name: 'olive oil' },
      { qty: 2, unit: 'tbsp', name: 'lemon juice' },
      { qty: 1, unit: 'tsp', name: 'dijon mustard' },
      { qty: 0.5, unit: 'tsp', name: 'salt' },
    ],
    instructions: [
      'Whisk olive oil, lemon juice, dijon, and salt into a dressing.',
      'Toss greens and cucumber with dressing just before serving.',
    ],
  },
]
