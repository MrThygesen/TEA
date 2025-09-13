//index.js
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

/* ---------------------------½
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

            {/* Always show basic perk */}
            {event.basic_perk && (
              <p className="text-sm text-gray-300">
                <strong>Basic Perk:</strong> {event.basic_perk}
              </p>
            )}
            {/* Advanced perk only if paid_count >= 10 */}
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
    // Cache admin env once on client to avoid repeated lookups
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  // --- State Hooks ---
  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'

  // Email (admin-only legacy)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)

  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [emailFormStatus, setEmailFormStatus] = useState(null)

  // --- NEW: User Auth (email/password) ---
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [authError, setAuthError] = useState('')

  // --- NEW: User Menu state ---
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [coupons, setCoupons] = useState([]) // paid event coupons
  const [prebookings, setPrebookings] = useState([]) // prebooked events

  // --- Fetch events ---
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // --- Admin-only legacy email by wallet ---
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
    // Prefill profile (optimistic)
    setProfileName(authUser.username || '')
    setProfileEmail(authUser.email || '')

    // Fetch latest from API if available
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

  // --- Filtered Events ---
  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return tagMatch && cityMatch && venueMatch
  })

  // --- Admin Email Handlers (unchanged) ---
  const handleSaveEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch('/api/email-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet: address }),
      })
      setEmailStatus(res.ok ? 'Saved' : 'Error saving email')
    } catch {
      setEmailStatus('Error saving email')
    }
    setIsLoadingEmail(false)
  }
  const handleDeleteEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch(`/api/email-optin?wallet=${address}`, { method: 'DELETE' })
      if (res.ok) {
        setEmail('')
        setEmailStatus('Deleted')
      }
    } catch {
      setEmailStatus('Error deleting email')
    }
    setIsLoadingEmail(false)
  }

  // --- Contact form (unchanged) ---
  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailFormStatus('loading')
    const formData = new FormData(e.target)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          message: formData.get('message'),
        }),
      })
      setEmailFormStatus(res.ok ? 'success' : 'error')
      if (res.ok) e.target.reset()
    } catch {
      setEmailFormStatus('error')
    }
  }

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
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-3xl space-y-10">

        {/* ---------------- HEADER ---------------- */}
        <header className="relative bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 -z-10 opacity-10 animate-spin-slow pointer-events-none select-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="hexagonPattern" x="0" y="0" width="10" height="8.66" patternUnits="userSpaceOnUse">
                  <polygon points="5,0 10,2.89 10,7.77 5,10.66 0,7.77 0,2.89" fill="#ffffff" fillOpacity="0.05" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hexagonPattern)" />
            </svg>
          </div>

 {/*         <img src="/new.png" alt="EDGE Project Logo" className="w-24 h-24 object-contain" /> */}
          <h1 className="text-4xl font-bold text-blue-400 text-left">EDGY EVENT PLATFORM</h1>

          <p className="text-left text-gray-400 mb-6">
Our event platform and network is the spot where people, venues, and opportunities meet. Our guests receive curated experiences that blend business with social connections. We are happy to help you expanding your network and meet new connections in real life. </p>

          <p className="text-left text-gray-400 mb-6">
Register an account here, and get started with signing up for events. We charge a low fee to give you a valuable event experience with an extra surprise perk on the side. Sign up now and enjoy the fun. We also have a telegram bot to help you.  
          </p> 
 
          <p>
            <a href="https://www.youtube.com/watch?v=FN_sOmPuuec" className="text-blue-400 hover:underline" target="_blank">
              Learn more about EDGY EVENTS (Video)
            </a>
          </p>

          {/* NEW: User auth controls */}
          <div className="flex gap-3 items-center flex-wrap justify-center">
            {!authUser ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition">
                  Create account
                </button>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-semibold transition">
                  Log in
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span>Signed in as <span className="font-semibold text-white">{authUser.username}</span></span>
                <button onClick={handleLogout} className="ml-2 px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">Log out</button>
              </div>
            )}

            {/* Admin wallet connect — visible but only useful for admin */}
            <div className="ml-auto flex items-center gap-2">
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
          </div>

          {isAdmin && (
            <p className="text-sm break-words text-center max-w-xs font-mono">
              Connected as admin: {address}
            </p>
          )}
        </header>

        {/* ---------------- SBT Section ---------------- */}
        <section>
  {isAdmin && <AdminSBTManager darkMode={true} />}
</section>


{/* ---------------- Event Flow Explanation ---------------- */}
<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
  <h2 className="text-2xl font-semibold mb-6 text-center text-blue-400">How It Works</h2>
  <div className="grid md:grid-cols-3 gap-6 text-left">
    {/* Box 1 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-yellow-400">1. Prebook</h3>
      <p className="text-gray-300 text-sm">
Show your interest in the event and sign up to hear when events are confirmed and open for coupon purchase.
   </p> 

    </div>
    {/* Box 2 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-green-400">2. Book</h3>
      <p className="text-gray-300 text-sm">

        Purchase your coupon for the venue to meet your network and get your perks. Buy coupons early.
      </p> 
    </div>
    {/* Box 3 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-blue-400">3. Show Up</h3>
      <p className="text-gray-300 text-sm">
        Get registered on the digital guestlist, meet new people, place your order, and enjoy the mystery perk served on the side.
      </p>
    </div>
  </div>
</section>

        {/* ---------------- NEW: User Menu ---------------- */}
        {authUser && (
          <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400">Your Account</h2>

            {/* Edit profile */}
            <form onSubmit={saveProfile} className="space-y-3 mb-8">
              <div>
                <label className="block text-sm mb-1">User name</label>
                <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full p-2 rounded text-black" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full p-2 rounded text-black" placeholder="you@example.com" />
              </div>
              <button disabled={savingProfile} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-60">Save changes</button>
            </form>

            {/* Paid event coupons */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-2">Paid event coupons</h3>
              {coupons?.length ? (
                <ul className="space-y-2 text-sm">
                  {coupons.map((c) => (
                    <li key={c.id} className="flex justify-between items-center border border-zinc-700 rounded p-3">
                      <span className="truncate">{c.event_name} — {new Date(c.event_datetime).toLocaleString()}</span>
                      <span className="text-green-400 font-medium">Paid</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-sm">No paid coupons yet.</p>
              )}
            </div>

            {/* Prebooked events */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Prebooked events</h3>
              {prebookings?.length ? (
                <ul className="space-y-2 text-sm">
                  {prebookings.map((p) => (
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
              ) : (
                <p className="text-gray-400 text-sm">No prebooked events yet.</p>
              )}
            </div>
          </section>
        )}

 {/* ---------------- Dynamic Event Grid ---------------- */}
<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-2xl font-semibold text-blue-400 text-center">Explore Events</h2>
    {/* View toggle */}
    <button
      onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
      className="text-sm px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
    >
      {viewMode === 'grid' ? 'List view' : 'Grid view'}
    </button>
  </div>

  {/* Filters */}
  <div className="flex gap-4 mb-6 justify-center">
    {/* City Filter */}
    <select
      className="bg-zinc-800 text-white p-2 rounded"
      onChange={(e) => setSelectedCity(e.target.value)}
      value={selectedCity}
    >
      <option value="">All Cities</option>
      {[...new Set((events || []).map(e => e.city).filter(Boolean))].map((city, i) => (
        <option key={i} value={city}>{city}</option>
      ))}
    </select>

    {/* Venue Type Filter */}
    <select
      className="bg-zinc-800 text-white p-2 rounded"
      onChange={(e) => setSelectedVenueType(e.target.value)}
      value={selectedVenueType}
    >
      <option value="">Event Types</option>
      {[...new Set((events || []).map(e => e.venue_type).filter(Boolean))].map((type, i) => (
        <option key={i} value={type}>{type}</option>
      ))}
    </select>
  </div>

  {/* Filtered Events */}
  {((events || []).filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true;
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true;
    return cityMatch && venueMatch;
  })).length === 0 ? (
    <p className="text-center text-gray-400">No events match your filter.</p>
  ) : viewMode === 'grid' ? (
    <div className="grid md:grid-cols-3 gap-6">
      {((events || []).filter((e) => {
        const cityMatch = selectedCity ? e.city === selectedCity : true;
        const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true;
        return cityMatch && venueMatch;
      })).map(event => <DynamicEventCard key={event.id} event={event} />)}
    </div>
  ) : (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      <div className="grid grid-cols-5 gap-2 items-center py-2 px-3 bg-zinc-800 text-xs uppercase tracking-wide text-gray-400">
        <span>Type</span>
        <span>Date</span>
        <span>Name</span>
        <span>City</span>
        <span className="text-right">Preview</span>
      </div>
      {((events || []).filter((e) => {
        const cityMatch = selectedCity ? e.city === selectedCity : true;
        const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true;
        return cityMatch && venueMatch;
      })).map(event => (
        <EventListRow key={event.id} event={event} onPreview={() => alert(`Preview: ${event.name}`)} />
      ))}
    </div>
  )}
</section>


        {/* ---------------- EDGE Network Info ---------------- */}
 <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center">
  <h2 className="text-2xl font-semibold mb-4 text-blue-400">Join us on Telegram</h2>
  <p className="mb-4 text-gray-300">If your life is to short for web, we have built a telegram-bot (APP) where you can register, book, pay and show the coupon at the venue.</p>

  <button
    onClick={() => window.open('https://t.me/TeaIsHereBot', '_blank')}
    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition"
  >
    Open Telegram
  </button>
</section>


        {/* ---------------- Roadmap ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-center text-blue-400">Project Roadmap</h2>
          <ul className="list-disc list-inside space-y-2">
           
            <li>Q2 2025: Blockchain and SBT experiments </li>
            <li>Q2 2025: BOT development </li>
            <li>Q3 2025: planning of architecture ()Web2)      </li>
            <li>Q3 2025: Web2 event platform design (Web2)     </li>
            <li>Q3 2025: Web2 payment integration (Web2)       </li>
            <li>Q3 2025: Web2 mail integration (Web2)          </li>
            <li>Q3 2025: Web2 invite-incentives integration (Web2)        </li>
            <li>Q4 2025: Partner onboarding & growth (Web2)    </li> 
            <li>Q1 2026: Telegram BOT -market expansion (Web2) </li>
            <li>Q2 2026: Telegram wallet integration (Web3)    </li>
            <li>Q2 2026: loyalty-reward integration ()Web3)    </li>
          </ul>
          <div className="text-center mt-4- Main: “EDGY EVENTS: Where people, venues, and opportunities meet.”
- Subhead: “Curated experiences that blend business with social connection.”
We give your edge in networking, nightlife, and opportunity.">
            <button
              onClick={() => setShowFullRoadmap(!showFullRoadmap)}
              className="text-blue-400 hover:underline text-sm"
            >
              {showFullRoadmap ? 'Hide Full Roadmap' : '📜 Show Full Roadmap'}
            </button>
          </div>
          {showFullRoadmap && (
            <div className="mt-6 text-sm space-y-4 text-gray-300">
              {/* Detailed roadmap content omitted for brevity, same as before */}
            </div>
          )}
        </section>

        {/* ---------------- Footer ---------------- */}
            {/* Footer */}
        <footer className="bg-zinc-900 border-zinc-700 text-gray-400 rounded-3xl p-6 border shadow-lg text-center space-y-2 transition-colors duration-300">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">GitHub Repository</a></p>
          <p>Twitter: <a href="https://twitter.com/yourtwitterhandle" className="text-blue-400 hover:underline" target="_blank">@TEAProject</a></p>
          <p>Intro Video: <a href="https://youtu.be/5QSHQ26JMm8" className="text-blue-400 hover:underline" target="_blank">Watch on YouTube</a></p>
          <p>Contact: <a href="linkedin.com/in/mortenthygesens" className="text-blue-400 hover:underline">Connect On Linkedin</a></p>
          <p className="text-xs mt-4">&copy; 2025 TEA Project Team</p>
        </footer>

      </div>

      {/* ---------------- Email Modal (Admin-only) ---------------- */}
      {isAdmin && showEmailModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEmailModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Email Notifications</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full p-2 rounded mb-3 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEmail}
                disabled={isLoadingEmail}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save
              </button>
              <button
                onClick={handleDeleteEmail}
                disabled={isLoadingEmail}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Delete
              </button>
            </div>
            {emailStatus && <p className="mt-2 text-sm">{emailStatus}</p>}
          </div>
        </div>
      )}

      {/* ---------------- Login Modal ---------------- */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Log in</h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <input name="username" placeholder="Username" className="w-full p-2 rounded text-black" />
              <input name="password" type="password" placeholder="Password" className="w-full p-2 rounded text-black" />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowLoginModal(false)} className="px-3 py-2 rounded bg-zinc-700">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">Log in</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- Signup Modal ---------------- */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowSignupModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Create account</h2>
            <form onSubmit={handleSignup} className="space-y-3">
              <input name="username" placeholder="Username" className="w-full p-2 rounded text-black" />
              <input name="email" type="email" placeholder="Email" className="w-full p-2 rounded text-black" />
              <input name="password" type="password" placeholder="Password" className="w-full p-2 rounded text-black" />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSignupModal(false)} className="px-3 py-2 rounded bg-zinc-700">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">Sign up</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>

