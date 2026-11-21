// Repair saved recipes with the same cleanup the importers now apply (audit 2026-11-20).
//
//   node scripts/recipe-repair.mjs <recipes.json> <log.json> [--write]
//
// <recipes.json> is an array of plain recipe objects ({ id, updateTime, ingredients,
// instructions, stepIngredientLinks }) exported from Firestore. Without --write it only
// reports. With --write each changed recipe is PATCHed through scripts/broker/firebase-api
// (only ingredients / instructions / stepIngredientLinks, and only if the doc's
// updateTime still matches the export, so a recipe edited since is skipped, not
// overwritten). Running it twice changes nothing the second time.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isIngredientHeading } from '../api/_lib/ingredientHeading.js'
import { blankZeroQty, cleanIngredientName, cleanStep, isStepHeading, liftAmountFromName } from '../api/_lib/recipeText.js'
import { cleanStepLinks, remapStepLinks } from '../src/lib/stepLinks.js'

export function repairRecipe(r) {
  const rawIngs = Array.isArray(r.ingredients) ? r.ingredients : []
  const rawSteps = Array.isArray(r.instructions) ? r.instructions.map((s) => String(s ?? '')) : []

  // Ingredients: same per-row cleanup as import; heading and blank rows dropped.
  const ingMap = []
  const ingredients = []
  for (const ing of rawIngs) {
    const o = ing && typeof ing === 'object' ? ing : { name: String(ing ?? '') }
    const qty = o.qty === '' || o.qty == null ? '' : Number(o.qty)
    const row = liftAmountFromName({
      qty: Number.isFinite(qty) ? blankZeroQty(qty) : '',
      unit: typeof o.unit === 'string' ? o.unit : '',
      name: cleanIngredientName(o.name),
    })
    if (!row.name || isIngredientHeading(row)) { ingMap.push(-1); continue }
    ingMap.push(ingredients.length)
    ingredients.push(row)
  }

  // Steps: a step holding several blank-line-separated paragraphs becomes several
  // steps; headings and empty steps are dropped. A link on an old step stays on the
  // first step it became.
  const stepMap = []
  const instructions = []
  for (const step of rawSteps) {
    const pieces = step.split(/\n\s*\n/).map((p) => cleanStep(p).replace(/\s+/g, ' ').trim())
      .filter((p) => p && !isStepHeading(p))
    stepMap.push(pieces.length ? instructions.length : -1)
    instructions.push(...pieces)
  }

  const stepIngredientLinks = remapStepLinks(
    cleanStepLinks(r.stepIngredientLinks, rawSteps.length, rawIngs.length), stepMap, ingMap)
  return { ingredients, instructions, stepIngredientLinks }
}

const norm = (r) => JSON.stringify({
  ingredients: (r.ingredients || []).map((i) => ({ qty: i.qty === 0 ? 0 : i.qty ?? '', unit: i.unit ?? '', name: i.name ?? '' })),
  instructions: r.instructions || [],
  stepIngredientLinks: Object.fromEntries(Object.entries(r.stepIngredientLinks || {}).map(([k, v]) => [String(k), v])),
})

export function needsRepair(r) {
  return norm(r) !== norm(repairRecipe(r))
}

// ---- Firestore REST encoding ----
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } }
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'boolean') return { booleanValue: v }
  return { stringValue: String(v) }
}

function patch(broker, project, r, fixed) {
  const fields = { ingredients: enc(fixed.ingredients), instructions: enc(fixed.instructions), stepIngredientLinks: enc(fixed.stepIngredientLinks) }
  const path = `/v1/projects/${project}/databases/(default)/documents/recipes/${r.id}` +
    '?updateMask.fieldPaths=ingredients&updateMask.fieldPaths=instructions&updateMask.fieldPaths=stepIngredientLinks' +
    `&currentDocument.updateTime=${encodeURIComponent(r.updateTime)}`
  const out = execFileSync(broker, ['PATCH', path, JSON.stringify({ fields })], { encoding: 'utf8', maxBuffer: 64 << 20 })
  const status = Number((out.match(/<<HTTP (\d+)>>\s*$/) || [])[1])
  return { status, body: status === 200 ? '' : out.slice(0, 400) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, logPath] = process.argv.slice(2)
  const write = process.argv.includes('--write')
  const broker = process.env.FIREBASE_BROKER || '/home/roni/agent/scripts/broker/firebase-api'
  const project = process.env.FIREBASE_PROJECT || 'recipe-app-920c3'
  const recipes = JSON.parse(readFileSync(input, 'utf8'))
  const log = []
  for (const r of recipes) {
    const fixed = repairRecipe(r)
    if (!needsRepair(r)) { log.push({ id: r.id, title: r.title, changed: false }); continue }
    const entry = {
      id: r.id, title: r.title, changed: true,
      before: { ingredients: r.ingredients, instructions: r.instructions, stepIngredientLinks: r.stepIngredientLinks ?? null },
      after: fixed,
    }
    if (write) entry.write = patch(broker, project, r, fixed)
    log.push(entry)
    console.log(`${entry.write ? `HTTP ${entry.write.status}` : 'dry-run'}  ${r.id}  ${r.title}`)
  }
  writeFileSync(logPath, JSON.stringify(log, null, 1))
  console.log(`${log.filter((e) => e.changed).length} of ${log.length} recipes need repair${write ? ' (written)' : ''}`)
}
