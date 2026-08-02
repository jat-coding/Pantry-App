// Pull the plain text out of a .docx file, in the browser, with no dependency.
//
// A .docx is a ZIP archive whose `word/document.xml` entry holds the body text.
// We read the ZIP directory ourselves and inflate that one entry with the
// platform's DecompressionStream, then strip the XML down to readable lines —
// enough for Claude to parse a recipe out of. Formatting, images, and tracked
// changes are all discarded on purpose.

const DOC_ENTRY = 'word/document.xml'

// --- tiny ZIP reader -------------------------------------------------------
// Only what we need: locate one entry by name and return its bytes.

function findEndOfCentralDirectory(view, bytes) {
  // The EOCD record is at the end, but a trailing comment can push it back by
  // up to 64 KB — scan backwards for its signature.
  const min = Math.max(0, bytes.length - 66000)
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i
  }
  return -1
}

function findEntry(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(view, bytes)
  if (eocd === -1) throw new Error('not a zip')

  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true) // offset of central directory

  const decoder = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break // central file header
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const entryName = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen))

    if (entryName === name) {
      // The local header repeats the name/extra fields with its own lengths;
      // the data starts after them.
      const localNameLen = view.getUint16(localOffset + 26, true)
      const localExtraLen = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLen + localExtraLen
      return { method, data: bytes.subarray(start, start + compressedSize) }
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// --- XML -> text -----------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&') // last, so "&amp;lt;" doesn't become "<"
}

// Word wraps every run of text in <w:t>. Paragraph and row ends become line
// breaks, tabs become spaces, so an ingredient list stays one-per-line.
export function documentXmlToText(xml) {
  const lines = []
  let line = ''
  // `<w:t...>` must only match the text tag itself — `(?:\s[^>]*)?` stops it
  // from also matching siblings like `<w:tab/>`, which would otherwise swallow
  // the markup up to the next `</w:t>` as if it were text.
  const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s[^>]*)?\/?>|<w:br(?:\s[^>]*)?\/?>|<\/w:p>|<\/w:tr>/g
  let m
  while ((m = token.exec(xml))) {
    if (m[1] !== undefined) line += decodeEntities(m[1])
    else if (m[0].startsWith('<w:tab')) line += ' '
    else { lines.push(line.trim()); line = '' }
  }
  lines.push(line.trim())
  return lines.filter(Boolean).join('\n')
}

// Read a user-chosen .docx File and return its text. Throws a user-facing
// message when the file isn't a readable Word document.
export async function docxToText(file) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error("This browser can't read Word files — try the Paste tab instead.")
  }
  const bytes = new Uint8Array(await file.arrayBuffer())

  let entry
  try {
    entry = findEntry(bytes, DOC_ENTRY)
  } catch {
    throw new Error("That doesn't look like a Word document (.docx).")
  }
  if (!entry) {
    // .doc (the pre-2007 binary format) isn't a ZIP and lands here too.
    throw new Error('Could not read that Word file. Save it as .docx and try again.')
  }

  const xml = new TextDecoder().decode(
    entry.method === 0 ? entry.data : await inflateRaw(entry.data),
  )
  const text = documentXmlToText(xml)
  if (!text.trim()) throw new Error('That Word document appears to be empty.')
  return text
}
