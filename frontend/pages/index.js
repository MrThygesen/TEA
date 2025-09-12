'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'

/* ---------------------------
   Helpers: Auth persistence
---------------------------- */
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('edgy_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}
function saveAuth(user) {
  try { localStorage.setItem('edgy_auth_user', JSON.stringify(user)) } catch (_) {}
}
function clearAuth() {
  try { localStorage.removeItem('edgy_auth_user') } catch (_) {}
}

/* ---------------------------
   Simple Modal Component
---------------------------- */
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 rounded-lg w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-blue-400">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✖</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------
   Main Home Component
---------------------------- */
export default function Home() {
  const { isConnected, address } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)
  useEffect(() => {
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  // --- State Hooks ---
  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)

  // NEW: Auth
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [coupons, setCoupons] = useState([])
  const [prebookings, setPrebookings] = useState([])

  // --- Fetch events ---
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // --- Load user menu data ---
  useEffect(() => {
    if (!authUser) return
    setProfileName(authUser.username || '')
    setProfileEmail(authUser.email || '')
    fetch('/api/user/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.username) setProfileName(d.username)
        if (d?.email) setProfileEmail(d.email)
      })
      .catch(() => {})
    fetch('/api/user/coupons', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { coupons: [] })
      .then(d => setCoupons(d.coupons || []))
    fetch('/api/user/prebookings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setPrebookings(d.items || []))
  }, [authUser])

  // --- Auth handlers ---
  function handleLogout() {
    clearAuth()
    setAuthUser(null)
    setShowAccountModal(false)
  }
  async function saveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profileName, email: profileEmail }),
        credentials: 'include'
      })
      if (res.ok) {
        const updated = { ...authUser, username: profileName, email: profileEmail }
        setAuthUser(updated)
        saveAuth(updated)
      }
    } catch (_) {}
    setSavingProfile(false)
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">
        {/* ---------------- HEADER ---------------- */}
        <header className="bg-zinc-900 rounded-3xl p-8 text-center">
          <h1 className="text-4xl font-bold text-blue-400">EDGY EVENT PLATFORM</h1>
          <p className="text-gray-400 mb-6">Our event platform and network ...</p>

          <div className="flex gap-3 justify-center">
            {!authUser ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">Create account</button>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600">Log in</button>
              </>
            ) : (
              <button onClick={() => setShowAccountModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600">
                Your Account ({authUser.username})
              </button>
            )}
          </div>
        </header>

        {/* ---------------- SBT Section ---------------- */}
        {isAdmin && <AdminSBTManager darkMode={true} />}

        {/* ---------------- Events Section ---------------- */}
        <section className="bg-zinc-900 rounded-3xl p-8">
          <h2 className="text-2xl font-semibold text-blue-400 mb-4">Explore Events</h2>
          {/* ... existing filters and event grid/list ... */}
        </section>

        {/* ---------------- FOOTER ---------------- */}
        <footer className="bg-zinc-900 rounded-3xl p-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-gray-400">Admin</span>
            <ConnectButton />
            {isAdmin && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                📧 Email Notifications
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* ---------------- ACCOUNT MODAL ---------------- */}
      <Modal open={showAccountModal} onClose={() => setShowAccountModal(false)} title="Your Account">
        <form onSubmit={saveProfile} className="space-y-3 mb-6">
          <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full p-2 rounded text-black" placeholder="Your name" />
          <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full p-2 rounded text-black" placeholder="you@example.com" />
          <button disabled={savingProfile} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60">Save</button>
        </form>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Paid Coupons</h3>
          {coupons.length ? coupons.map(c => (
            <p key={c.id}>{c.event_name} — {new Date(c.event_datetime).toLocaleString()}</p>
          )) : <p className="text-gray-400 text-sm">No coupons yet.</p>}
        </div>

        <div className="mb-6">
          <h3 className="font-semibold mb-2">Prebookings</h3>
          {prebookings.length ? prebookings.map(p => (
            <p key={p.id}>{p.event_name} — {new Date(p.event_datetime).toLocaleString()}</p>
          )) : <p className="text-gray-400 text-sm">No prebookings yet.</p>}
        </div>

        <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700">Log out</button>
      </Modal>
    </main>
  )
}

