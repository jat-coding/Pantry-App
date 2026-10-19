// Which ingredients a Cook Mode step calls for, by name: an ingredient matches when
// its name (minus anything after a comma or in brackets, e.g. "butter, softened")
// appears in the step's text as whole words (a plural s/es allowed), case-insensitive.
// There is no step-to-ingredient data model, so this is the whole link.
// Longer names claim their words first, so "flaky sea salt" in a step doesn't also
// count as "salt", and "brown sugar" doesn't also count as "sugar".
// Returns indexes into `ingredients`, in recipe order.

function matchName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .trim()
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function stepIngredientIndexes(step, ingredients) {
  let text = ` ${(step || '').toLowerCase()} `
  const candidates = ingredients
    .map((ing, i) => ({ i, name: matchName(ing?.name) }))
    .filter((c) => c.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length)
  const hits = []
  for (const c of candidates) {
    const re = new RegExp(`(^|[^a-z0-9])${escape(c.name)}(?:e?s)?(?=$|[^a-z0-9])`, 'g')
    if (!re.test(text)) continue
    hits.push(c.i)
    text = text.replace(re, (m, lead) => lead + ' '.repeat(m.length - lead.length))
  }
  return hits.sort((a, b) => a - b)
}
