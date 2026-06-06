import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { updateProfileDoc } from '../lib/firestore.js'

export default function Profile() {
  const { user, profile, guest, logout } = useAuth()
  const { recipes, pantryRecipes } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState(profile?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')

  if (guest || !user) {
    return (
      <div className="card mt-10 px-6 py-16 text-center">
        <div className="mb-2 text-5xl">👤</div>
        <p className="font-bold">You're browsing as a guest</p>
        <p className="mb-4 text-sm text-warm-soft">Log in to save recipes, build your pantry, and add friends.</p>
        <button className="btn-peach" onClick={logout}>Go to login</button>
      </div>
    )
  }

  async function save() {
    await updateProfileDoc(user.uid, { bio, avatarUrl })
    setEditing(false)
    toast('Profile updated')
  }

  return (
    <div className="animate-fadein space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Profile 👤</h1>
      </header>

      <div className="card flex flex-col items-center gap-3 p-6 text-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-peach text-4xl font-extrabold text-warm">
            {(profile?.displayName || user.displayName || '?')[0].toUpperCase()}
          </span>
        )}
        <h2 className="text-xl font-extrabold">{profile?.displayName || user.displayName}</h2>
        <p className="text-sm text-warm-soft">{user.email}</p>
        {!editing && profile?.bio && <p className="max-w-sm text-warm">{profile.bio}</p>}

        {editing ? (
          <div className="w-full max-w-sm space-y-2 text-left">
            <input className="input" placeholder="Avatar image URL" value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)} />
            <textarea className="input" placeholder="Short bio" value={bio}
              onChange={(e) => setBio(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-peach flex-1" onClick={save}>Save</button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setEditing(true)}>Edit profile</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col items-center py-4">
          <span className="text-2xl font-extrabold">{recipes.length}</span>
          <span className="text-sm text-warm-soft">Recipes</span>
        </div>
        <div className="card flex flex-col items-center py-4">
          <span className="text-2xl font-extrabold">{pantryRecipes.length}</span>
          <span className="text-sm text-warm-soft">In Pantry</span>
        </div>
      </div>

      <button className="btn-ghost w-full" onClick={logout}>Log out</button>
    </div>
  )
}
