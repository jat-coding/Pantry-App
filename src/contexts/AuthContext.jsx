import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // firebase user (or null)
  const [profile, setProfile] = useState(null) // users/{uid} doc
  const [guest, setGuest] = useState(false)     // browse-as-guest mode
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = null
    // Session persists across refreshes (Firebase default = local persistence).
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (unsubProfile) { unsubProfile(); unsubProfile = null }
      if (u) {
        setGuest(false)
        // Live-subscribe to the profile doc so pantryIds/friendIds stay current.
        unsubProfile = onSnapshot(
          doc(db, 'users', u.uid),
          (snap) => {
            setProfile(snap.exists() ? { id: u.uid, ...snap.data() } : null)
            setLoading(false)
          },
          () => setLoading(false),
        )
      } else {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => {
      if (unsubProfile) unsubProfile()
      unsub()
    }
  }, [])

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    // Create the users/{uid} profile document.
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      avatarUrl: '',
      bio: '',
      friendIds: [],
      pantryIds: [],
      createdAt: serverTimestamp(),
    })
    return cred.user
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    setGuest(false)
    await signOut(auth)
  }

  function browseAsGuest() {
    setGuest(true)
    setLoading(false)
  }

  const value = {
    user,
    profile,
    setProfile,
    guest,
    loading,
    isAuthed: !!user,
    signup,
    login,
    logout,
    browseAsGuest,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
