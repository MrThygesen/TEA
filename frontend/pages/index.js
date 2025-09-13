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

  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [emailFormStatus, setEmailFormStatus] = useState(null)

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

  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

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

  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return tagMatch && cityMatch && venueMatch
  })

  /* ---------------------------
     Auth Handlers
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profileName, email: profileEmail }),
        credentials: 'include'
      })
      if (res.ok) {
        setAuthUser(prev => ({ ...prev, username: profileName, email: profileEmail }))
        saveAuth({ ...authUser, username: profileName, email: profileEmail })
      }
    } finally { setSavingProfile(false) }
  }

  /* ---------------------------
     Tags/Cities/Venue Options
  ---------------------------- */
  const allTags = Array.from(new Set(events.flatMap(e => [e.tag1, e.tag2, e.tag3].filter(Boolean))))
  const allCities = Array.from(new Set(events.map(e => e.city))).filter(Boolean)
  const allVenueTypes = Array.from(new Set(events.map(e => e.venue_type))).filter(Boolean)

  /* ---------------------------
     Main Render
  ---------------------------- */
  return (
    <div className="text-white min-h-screen bg-zinc-900">

      {/* -------------------
         Intro Section
      ------------------- */}
      <section className="px-6 py-12 text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to TEA Events</h1>
        <p className="max-w-2xl mx-auto text-lg text-gray-300">
          Explore curated events, book your spot, and enjoy exclusive perks.
        </p>
      </section>

      {/* -------------------
         Concept Boxes (3 boxes)
      ------------------- */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-12">
        <div className="bg-zinc-800 rounded-xl p-6 text-center shadow">
          <h3 className="text-xl font-semibold mb-2">Discover Events</h3>
          <p className="text-gray-400">Find curated events for networking and business.</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-6 text-center shadow">
          <h3 className="text-xl font-semibold mb-2">Prebook Easily</h3>
          <p className="text-gray-400">Reserve your spot on the web or telegram.</p>
        </div>
        <div className="bg-zinc-800 rounded-xl p-6 text-center shadow">
          <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
          <p className="text-gray-400">Access perks as part of the event.</p>
        </div>
      </section>

      {/* -------------------
         Tags/Filters
      ------------------- */}
      <section className="px-6 py-6 flex flex-wrap gap-2 items-center">
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-sm"
        >
          <option value="">All Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-sm"
        >
          <option value="">All Cities</option>
          {allCities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={selectedVenueType}
          onChange={(e) => setSelectedVenueType(e.target.value)}
          className="bg-zinc-800 p-2 rounded text-sm"
        >
          <option value="">All Venue Types</option>
          {allVenueTypes.map(v => <option key={v} value={v}>{v}</option>)}
        </select>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 rounded ${viewMode==='grid'?'bg-blue-600':'bg-zinc-700'}`}
          >Grid</button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded ${viewMode==='list'?'bg-blue-600':'bg-zinc-700'}`}
          >List</button>
        </div>
      </section>

      {/* -------------------
         Dynamic Event Cards / List
      ------------------- */}
      <section className="px-6 py-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {viewMode === 'grid'
          ? filteredEvents.map((e) => <DynamicEventCard key={e.id} event={e} />)
          : filteredEvents.map((e) => (
              <EventListRow key={e.id} event={e} onPreview={() => alert('Preview modal')} />
            ))}
      </section>

      {/* -------------------
         Admin SBT Manager
      ------------------- */}
      {isAdmin && <AdminSBTManager />}

      {/* -------------------
         User WebAccessSBT Section
      ------------------- */}
      {isConnected && <WebAccessSBT />}

      {/* -------------------
         Footer + Wallet Connect
      ------------------- */}
      <footer className="px-6 py-8 border-t border-zinc-700 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
        <div>© 2025 TEA Events</div>
        <div className="flex gap-4 items-center">
          <ConnectButton showBalance={false} chainStatus="none" />
          {authUser && (
            <button
              onClick={() => setShowAccountModal(true)}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-semibold transition"
            >
              Your Account
            </button>
          )}
        </div>
      </footer>

      {/* -------------------
         Your Account Modal
      ------------------- */}
      {showAccountModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAccountModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-3xl max-w-2xl w-full p-8 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">Your Account</h2>

            <form onSubmit={saveProfile} className="space-y-3 mb-8">
              <div>
                <label className="block text-sm mb-1">User name</label>
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full p-2 rounded text-black"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full p-2 rounded text-black"
                  placeholder="you@example.com"
                />
              </div>
              <button
                disabled={savingProfile}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
              >
                Save changes
              </button>
            </form>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">Paid event coupons</h3>
              {coupons?.length ? (
                <ul className="space-y-2 text-sm">
                  {coupons.map(c => (
                    <li key={c.id} className="flex justify-between items-center border border-zinc-700 rounded p-3">
                      <span className="truncate">{c.event_name} — {new Date(c.event_datetime).toLocaleString()}</span>
                      <span className="text-green-400 font-medium">Paid</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-400 text-sm">No paid coupons yet.</p>}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Prebooked events</h3>
              {prebookings?.length ? (
                <ul className="space-y-2 text-sm">
                  {prebookings.map(p => (
                    <li key={p.id} className="flex justify-between items-center border border-zinc-700 rounded p-3">
                      <span className="truncate">{p.event_name} — {new Date(p.event_datetime).toLocaleString()}</span>
                      <span className={
                        'text-xs px-2 py-1 rounded ' + (p.is_confirmed ? 'bg-green-700' : 'bg-zinc-700')
                      }>
                        {p.is_confirmed ? 'confirmed' : 'idle'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-gray-400 text-sm">No prebooked events yet.</p>}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAccountModal(false)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

