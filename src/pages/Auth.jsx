import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { PantryIcon } from '../components/icons.jsx'

export default function Auth() {
  const { signup, login, browseAsGuest } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) throw new Error('Please enter a display name.')
        await signup(email.trim(), password, displayName.trim())
      } else {
        await login(email.trim(), password)
      }
    } catch (err) {
      setError(prettyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-peach text-zinc-800 shadow-card">
          <PantryIcon className="h-9 w-9" />
        </div>
        <h1 className="text-3xl font-extrabold">Pantry</h1>
        <p className="mt-1 text-warm-soft">Collect the recipes you love.</p>
      </div>

      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-3 p-6">
        <div className="mb-2 flex rounded-2xl bg-eggshell p-1">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 rounded-xl py-2 text-sm font-bold capitalize transition ${
                mode === m ? 'bg-white text-warm shadow-sm' : 'text-warm-soft'
              }`}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <input
            className="input"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          required
        />

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        <button className="btn-peach w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>

      <button
        onClick={browseAsGuest}
        className="mt-4 text-sm font-bold text-warm-soft underline-offset-4 hover:underline"
      >
        Browse as Guest →
      </button>
      <p className="mt-1 text-xs text-warm-soft/70">Guests can browse but can't save or add friends.</p>
    </div>
  )
}

function prettyError(err) {
  const code = err?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password'))
    return 'Incorrect email or password.'
  if (code.includes('email-already-in-use')) return 'That email is already registered.'
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.'
  if (code.includes('invalid-email')) return 'Please enter a valid email.'
  return err?.message || 'Something went wrong.'
}
