'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'

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
   Dynamic Event Card Component
---------------------------- */
function DynamicEventCard({ event }) {
  const [showModal, setShowModal] = useState(false)
  const telegramLink = `https://t.me/TeaIsHereBot?start=${event.id}`

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow flex flex-col justify-between">
        <img
          src={event.image_url || '/default-event.jpg'}
          alt={event.name}
          className="w-full h-40 object-cover rounded mb-3"
        />
        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">
          {event.description?.split(' ').slice(0, 30).join(' ')}...
        </p>
        <div className="flex flex-wrap gap-1 mb-2">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">{tag}</span>
          ))}
        </div>

        <div className="flex justify-between items-center mt-auto mb-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-400 hover:underline text-sm"
          >
            Preview
          </button>
          {(event.registered_users || 0) < event.min_attendees ? (
            <button
              onClick={() => window.open(telegramLink, '_blank')}
              className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
            >
              Prebook
            </button>
          ) : (
            <button
              onClick={() => window.open(`https://t.me/TeaIsHereBot?start=buy_${event.id}`, '_blank')}
              className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
            >
              Book
            </button>
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 {event.registered_users || 0} Users</span>
        </div>
      </div>

      {/* Preview Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{event.name}</h2>
            <img
              src={event.image_url || '/default-event.jpg'}
              alt={event.name}
              className="w-full h-56 object-contain rounded mb-4"
            />
            <p className="mb-2 text-sm text-gray-400">
              {new Date(event.datetime).toLocaleString()} @ {event.venue} ({event.venue_type || 'N/A'})
            </p>
            <p className="mb-4">{event.details}</p>

            {event.basic_perk && (
              <p className="text-sm text-gray-300">
                <strong>Basic Perk:</strong> {event.basic_perk}
              </p>
            )}
            {event.paid_count >= 10 && event.advanced_perk && (
              <p className="text-sm text-gray-300">
                <strong>Advanced Perk:</strong> {event.advanced_perk}
              </p>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------------------
   Event List Row (1-line view)
---------------------------- */
function EventListRow({ event, onPreview }) {
  return (
    <div className="grid grid-cols-5 gap-2 items-center py-2 px-3 border-b border-zinc-700 text-sm">
      <span className="truncate">{event.venue_type || '—'}</span>
      <span className="truncate">{new Date(event.datetime).toLocaleDateString()}</span>
      <span className="truncate">{event.name}</span>
      <span className="truncate">{event.city}</span>
      <button onClick={onPreview} className="justify-self-end text-blue-400 hover:underline">Preview</button>
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
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)

  // --- NEW: User Auth ---
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
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

  // --- Admin Email fetch ---
  useEffect(() => {
    if (isAdmin && address) {
      fetch(`/api/email-optin?wallet=${address}`)
        .then(res => res.json())
        .then(data => { if (data.email) setEmail(data.email) })
        .catch(() => {})
    } else {
      setEmail('')
      setEmailStatus('')
    }
  }, [isAdmin, address])

  // --- Load user menu data when logged in ---
  useEffect(() => {
    if (!authUser) return
    setProfileName(authUser.username || '')
    setProfileEmail(authUser.email || '')

    fetch('/api/user/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return
        if (d.username) setProfileName(d.username)
        if (d.email) setProfileEmail(d.email)
      })
      .catch(() => {})

    fetch('/api/user/coupons', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { coupons: [] })
      .then(d => setCoupons(d.coupons || []))
      .catch(() => setCoupons([]))

    fetch('/api/user/prebookings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setPrebookings(d.items || []))
      .catch(() => setPrebookings([]))
  }, [authUser])

  /* ---------------------------
     NEW: Auth Handlers
  ---------------------------- */
  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const username = form.get('username')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!username || !password) return setAuthError('Please enter username and password.')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        return setAuthError(j.error || 'Login failed')
      }
      const user = await res.json()
      setAuthUser(user)
      saveAuth(user)
      setShowLoginModal(false)
    } catch (err) {
      setAuthError('Network error')
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const username = form.get('username')?.toString().trim()
    const email = form.get('email')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!username || !email || !password) return setAuthError('All fields are required.')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        return setAuthError(j.error || 'Sign up failed')
      }
      const user = await res.json()
      setAuthUser(user)
      saveAuth(user)
      setShowSignupModal(false)
    } catch (err) {
      setAuthError('Network error')
    }
  }

  function handleLogout() {
    clearAuth()
    setAuthUser(null)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profileName, email: profileEmail })
      })
      if (res.ok) alert('Profile updated!')
    } catch (_) {}
    setSavingProfile(false)
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* ------------------ INTRO TEXT ------------------ */}
      <section className="text-center py-12 px-4">
        <h1 className="text-4xl font-bold mb-4">Welcome to TEA Events</h1>
        <p className="text-lg max-w-xl mx-auto text-gray-300">
          Discover unique events, secure your prebookings, and join our community. Everything you need in one place.
        </p>
      </section>

      {/* ------------------ CONCEPT BOXES ------------------ */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
        <div className="bg-zinc-800 rounded-lg p-6 shadow">
          <h3 className="font-bold text-xl mb-2">Connect</h3>
          <p className="text-gray-300 text-sm">Join events and meet people who share your interests.</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-6 shadow">
          <h3 className="font-bold text-xl mb-2">Book</h3>
          <p className="text-gray-300 text-sm">Secure your spots before everyone else with prebooking options.</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-6 shadow">
          <h3 className="font-bold text-xl mb-2">Enjoy</h3>
          <p className="text-gray-300 text-sm">Attend events hassle-free and unlock perks and rewards.</p>
        </div>
      </section>

      {/* ------------------ EVENT FILTERS ------------------ */}
      <section className="p-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            placeholder="Filter by tag"
            className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          />
          <input
            type="text"
            placeholder="Filter by city"
            className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          />
          <input
            type="text"
            placeholder="Filter by venue type"
            className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
            value={selectedVenueType}
            onChange={(e) => setSelectedVenueType(e.target.value)}
          />
          <select
            className="px-3 py-1 rounded bg-zinc-700 text-white text-sm"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="grid">Grid</option>
            <option value="list">List</option>
          </select>
        </div>

        {/* ------------------ EVENTS ------------------ */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events
              .filter((e) => (!selectedTag || [e.tag1, e.tag2, e.tag3].includes(selectedTag)))
              .filter((e) => !selectedCity || e.city === selectedCity)
              .filter((e) => !selectedVenueType || e.venue_type === selectedVenueType)
              .map((event) => (
                <DynamicEventCard key={event.id} event={event} />
              ))}
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-700 rounded-lg">
            <div className="grid grid-cols-5 gap-2 p-3 font-semibold border-b border-zinc-600">
              <span>Type</span>
              <span>Date</span>
              <span>Name</span>
              <span>City</span>
              <span>Action</span>
            </div>
            {events.map((event) => (
              <EventListRow
                key={event.id}
                event={event}
                onPreview={() => alert(`Preview for ${event.name}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------ ADMIN SBT ------------------ */}
      {isAdmin && (
        <section className="p-6 border-t border-zinc-700">
          <h2 className="text-xl font-bold mb-3">Admin SBT Management</h2>
          <AdminSBTManager />
        </section>
      )}

      {/* ------------------ YOUR ACCOUNT MODAL ------------------ */}
      {authUser && (
        <div className="fixed bottom-6 right-6">
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded shadow"
            onClick={() => setShowEmailModal(true)}
          >
            Your Account
          </button>
        </div>
      )}

      {showEmailModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-md w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Your Account</h2>

            <form onSubmit={saveProfile} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Username</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-1 rounded bg-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-1 rounded bg-zinc-700 text-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </form>

            <div className="mt-6">
              <h3 className="font-bold mb-2">Your Coupons</h3>
              {coupons.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-300">
                  {coupons.map((c) => (
                    <li key={c.id}>{c.name} - {c.discount || '—'}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No coupons available</p>
              )}
            </div>

            <div className="mt-6">
              <h3 className="font-bold mb-2">Your Prebookings</h3>
              {prebookings.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-gray-300">
                  {prebookings.map((p) => (
                    <li key={p.id}>{p.event_name} ({new Date(p.date).toLocaleDateString()})</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No prebookings</p>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
            >
              Logout
            </button>

            <button
              onClick={() => setShowEmailModal(false)}
              className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ------------------ FOOTER ------------------ */}
      <footer className="p-6 border-t border-zinc-700 text-center">
        <p className="text-gray-400 mb-2">© 2025 TEA Events</p>
        <div className="flex justify-center">
          <ConnectButton showBalance={false} chainStatus="none" />
        </div>
      </footer>
    </div>
  )
}

