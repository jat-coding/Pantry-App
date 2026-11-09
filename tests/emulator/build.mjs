// Bundles the real src/lib/firestore.js with src/firebase.js swapped for shim.js (emulator,
// one signed-in user per import). Firebase itself stays external, shared from node_modules.
import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../../src')
await esbuild.build({
  entryPoints: [SRC + '/lib/firestore.js'], bundle: true, format: 'esm', platform: 'node',
  outfile: here + '/.out/bundle.mjs', external: ['firebase/*', '@firebase/*'],
  plugins: [{ name: 'shim', setup(b) {
    b.onResolve({ filter: /firebase\.js$/ }, (a) =>
      path.resolve(a.resolveDir, a.path) === SRC + '/firebase.js' ? { path: here + '/shim.js' } : undefined)
  } }],
  define: { 'import.meta.env': '{}' }, logLevel: 'warning',
})
