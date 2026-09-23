import { useState } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { useToast } from '../components/Toast.jsx'
import { updateProfileDoc } from '../lib/firestore.js'
import { exportRecipesToExcel } from '../lib/exportExcel.js'
import { uploadImage } from '../lib/storage.js'
import { APP_VERSION, CHANGELOG } from '../lib/version.js'
import { ProfileIcon, CameraIcon } from '../components/icons.jsx'
import { useGoBack } from '../lib/useGoBack.js'
import { NAV_STYLES, readNavStyle, writeNavStyle } from '../lib/navStyle.js'
import { tap } from '../lib/haptics.js'

export default function Profile() {
  const { user, profile, guest, logout } = useAuth()
  const { recipes, pantryRecipes } = useData()
  const toast = useToast()
  const goBack = useGoBack()
  const [editing, setEditing] = useState(false)
  const [bio, setBio] = useState(profile?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function handleAvatarFile(file) {
    if (!file) return
    setUploadingAvatar(true)
    try {
      const url = await uploadImage(file, `avatars/${user.uid}`)
      setAvatarUrl(url)
    } catch (err) {
      // Surface the specific reason (too large, timed out, unreadable) — a
      // generic message leaves people retrying the same photo forever.
      toast(err?.message || 'Could not load that photo')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (guest || !user) {
    return (
      <div className="card mt-10 px-6 py-16 text-center">
        <div className="mb-3 flex justify-center text-warm-soft"><ProfileIcon className="h-12 w-12" /></div>
        <p className="font-bold">You're browsing as a guest</p>
        <p className="mb-4 text-sm text-warm-soft">Log in to save recipes, build your pantry, and add friends.</p>
        <button className="btn-peach" onClick={logout}>Go to login</button>
        <div className="mt-6 text-left"><TabBarCard /></div>
      </div>
    )
  }

  async function save() {
    await updateProfileDoc(user.uid, { bio, avatarUrl })
    setEditing(false)
    toast('Profile updated')
  }

  async function exportExcel() {
    if (!recipes.length) return toast('No recipes to export yet')
    try {
      await exportRecipesToExcel(recipes, 'pantry-recipes.xlsx')
      toast('Exported your recipes')
    } catch {
      toast('Export failed')
    }
  }

  return (
    <div className="animate-fadein space-y-6">
      <header className="flex items-center gap-3">
        {/* Profile is opened from the Friends screen — this returns you there (or to
            wherever you actually came from) instead of leaving only the tab bar. */}
        <button
          onClick={() => goBack('/friends')}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-warm shadow-card transition active:scale-90"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <h1 className="text-3xl font-extrabold">Profile</h1>
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
            <label className="btn-ghost w-full cursor-pointer">
              <CameraIcon className="h-5 w-5 text-zinc-800" />
              {uploadingAvatar ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Choose from camera roll'}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingAvatar}
                onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
            </label>
            <input className="input" placeholder="…or paste an avatar image URL"
              value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
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

      <TabBarCard />

      {/* Export */}
      <div className="card p-5">
        <h2 className="text-lg font-extrabold">Your data</h2>
        <p className="mb-3 text-sm text-warm-soft">
          Download every recipe in your library as a formatted Excel spreadsheet
          (title, category, times, ingredients, and steps).
        </p>
        <button className="btn-peach w-full" onClick={exportExcel} disabled={!recipes.length}>
          Export recipes to Excel
        </button>
      </div>

      <button className="btn-ghost w-full" onClick={logout}>Log out</button>

      {/* Version + changelog */}
      <section className="pt-2 text-center">
        <p className="text-xs font-bold text-warm-soft">Pantry v{APP_VERSION}</p>
        <details className="mx-auto mt-2 max-w-md text-left">
          <summary className="cursor-pointer text-center text-xs font-bold text-warm-soft">
            What's new
          </summary>
          <div className="mt-3 space-y-4">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="card p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-extrabold">v{entry.version}</span>
                  <span className="text-xs text-warm-soft">{entry.date}</span>
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-warm">
                  {entry.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  )
}

// A 56x28 thumbnail of the bar in that look, so the difference is visible without
// scrolling down to the real thing.
function NavStyleSwatch({ style }) {
  const dot = style.dark ? 'bg-eggshell/70' : 'bg-warm/35'
  return (
    <span className="flex h-11 w-16 shrink-0 items-end justify-center rounded-xl bg-eggshell p-1">
      <span className={`flex h-5 w-full items-center justify-center gap-1 px-1 ${style.bar}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="h-2.5 w-2.5 rounded-full bg-peach" />
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
    </span>
  )
}

// The bottom bar's look. Device-local, so guests can set it too.
function TabBarCard() {
  const [navStyle, setNavStyle] = useState(readNavStyle)
  // Changing it restyles the real bar behind this page immediately, so the picker
  // is its own preview.
  return (
    <div className="card p-5">
      <h2 className="text-lg font-extrabold">Tab bar</h2>
      <p className="mb-3 text-sm text-warm-soft">
        Pick how the bar at the bottom of the screen looks — it changes the moment
        you tap, so watch the real bar while you choose. Saved on this device.
      </p>
      <div className="space-y-2">
        {NAV_STYLES.map((s) => (
          <button
            key={s.id}
            onClick={() => { tap(); setNavStyle(s.id); writeNavStyle(s.id) }}
            aria-pressed={navStyle === s.id}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
              navStyle === s.id ? 'border-peach-dark bg-peach' : 'border-warm/15 bg-white hover:bg-eggshell'
            }`}
          >
            <NavStyleSwatch style={s} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{s.label}</span>
              <span className="block text-xs text-warm-soft">{s.hint}</span>
            </span>
            {navStyle === s.id && <Check className="h-5 w-5 shrink-0 text-warm" strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  )
}
