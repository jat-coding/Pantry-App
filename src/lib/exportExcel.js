// Export the user's recipes to a clean, well-spaced .xlsx workbook.
// xlsx is imported dynamically so its ~300KB only loads when the user exports.

function fmtTime(t) {
  return t && t.value ? `${t.value} ${t.unit}` : ''
}

function totalTime(recipe) {
  const toMin = (t) => (t ? (t.unit === 'hr' ? t.value * 60 : t.value) : 0)
  const mins = toMin(recipe.prepTime) + toMin(recipe.cookTime)
  if (!mins) return ''
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function ingredientLine(i) {
  return [i.qty ? String(i.qty) : '', i.unit || '', i.name || ''].filter(Boolean).join(' ').trim()
}

// recipes: array of recipe objects. Triggers a browser download.
export async function exportRecipesToExcel(recipes, filename = 'pantry-recipes.xlsx') {
  const XLSX = await import('xlsx')

  const rows = (recipes || []).map((r) => ({
    Title: r.title || 'Untitled',
    Category: r.category || '',
    Servings: r.servings ?? '',
    'Prep Time': fmtTime(r.prepTime),
    'Cook Time': fmtTime(r.cookTime),
    'Total Time': totalTime(r),
    Ingredients: (r.ingredients || []).map(ingredientLine).join('\n'),
    Instructions: (r.instructions || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    Source: r.pocketedFromName ? `Pocketed from ${r.pocketedFromName}` : (r.authorName || ''),
    Public: r.isPublic ? 'Yes' : 'No',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths (characters) for readability.
  ws['!cols'] = [
    { wch: 28 }, // Title
    { wch: 12 }, // Category
    { wch: 9 },  // Servings
    { wch: 11 }, // Prep
    { wch: 11 }, // Cook
    { wch: 11 }, // Total
    { wch: 48 }, // Ingredients
    { wch: 64 }, // Instructions
    { wch: 22 }, // Source
    { wch: 8 },  // Public
  ]
  // Freeze the header row so it stays visible while scrolling.
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Recipes')
  XLSX.writeFile(wb, filename)
}
