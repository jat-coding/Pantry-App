#!/usr/bin/env bash
# Friend-request dedup against the real firestore.rules in the Firestore emulator (needs
# Java; fetches firebase-tools via npx on first run). Not part of `npm test`.
#   tests/emulator/friend-requests.sh
set -euo pipefail
cd "$(dirname "$0")"
node build.mjs
cp ../../firestore.rules firebase.json .out/
exec ${FIREBASE_BIN:-npx --yes firebase-tools@13} emulators:exec --config .out/firebase.json --only firestore \
  --project demo-pantry "node $(pwd)/run.mjs"
