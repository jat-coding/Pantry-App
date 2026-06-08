import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import * as fs from '../lib/firestore.js'

// Route: /invite/:inviterId — when a logged-in user opens a friend's invite
// link, they become mutual friends with the inviter.
export default function InviteAccept() {
  const { inviterId } = useParams()
  const { user, profile, guest, logout } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState('working') // working | done | self | already | needauth | error
  const [inviter, setInviter] = useState(null)

  useEffect(() => {
    let active = true
    async function run() {
      const u = await fs.getUserById(inviterId).catch(() => null)
      if (!active) return
      setInviter(u)

      if (guest || !user) { setState('needauth'); return }
      if (user.uid === inviterId) { setState('self'); return }
      if (profile?.friendIds?.includes(inviterId)) { setState('already'); return }
      try {
        await fs.acceptInvite(user.uid, inviterId)
        if (active) setState('done')
      } catch {
        if (active) setState('error')
      }
    }
    run()
    return () => { active = false }
    // Intentionally run once per identity change — not on every friendIds update
    // (which would flip "now friends" → "already friends" right after accepting).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviterId, user?.uid, guest])

  const name = inviter?.displayName || 'your friend'

  const messages = {
    working: { emoji: '⏳', title: 'Adding your friend…', body: 'One moment.' },
    done: { emoji: '🎉', title: `You and ${name} are now friends!`, body: 'Find them under Friends.' },
    already: { emoji: '✅', title: `You're already friends with ${name}.`, body: '' },
    self: { emoji: '🙂', title: 'This is your own invite link.', body: 'Share it with a friend to connect.' },
    needauth: { emoji: '🔐', title: 'Log in to add your friend', body: `Sign in to accept ${name}'s invite.` },
    error: { emoji: '⚠️', title: 'Could not add friend', body: 'The link may be invalid or expired.' },
  }
  const m = messages[state]

  return (
    <div className="animate-fadein mx-auto max-w-md">
      <div className="card mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="text-5xl">{m.emoji}</div>
        <h1 className="text-xl font-extrabold">{m.title}</h1>
        {m.body && <p className="text-sm text-warm-soft">{m.body}</p>}
        <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
          {state === 'needauth' ? (
            <button className="btn-peach" onClick={logout}>Go to login</button>
          ) : (
            <button className="btn-peach" onClick={() => navigate('/friends')}>Go to Friends</button>
          )}
          <button className="btn-ghost" onClick={() => navigate('/')}>Back to Pantry</button>
        </div>
      </div>
    </div>
  )
}
