#!/usr/bin/env bash
# Post delete + likes against the real firestore.rules in the Firestore emulator (needs
# Java; fetches firebase-tools via npx on first run). Not part of `npm test`.
#   tests/emulator/posts.sh
set -euo pipefail
cd "$(dirname "$0")"
node build.mjs
cp ../../firestore.rules firebase.json .out/
exec ${FIREBASE_BIN:-npx --yes firebase-tools@13} emulators:exec --config .out/firebase.json --only firestore \
  --project demo-pantry "node $(pwd)/posts.mjs"
