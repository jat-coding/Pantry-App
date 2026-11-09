import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
const uid = globalThis.__UID
export const app = initializeApp({ projectId: 'demo-pantry', apiKey: 'x' }, uid)
export const auth = getAuth(app)
export const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8089, { mockUserToken: { sub: uid, user_id: uid } })
