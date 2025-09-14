'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
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

// ---------------------------
// Dynamic Event Card Component
// ---------------------------
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

// ---------------------------
// Event List Row
// ---------------------------
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

// ---------------------------
// Main Home Component
// ---------------------------
export default function Home() {
  const { address } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)
  useEffect(() => {
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [coupons, setCoupons] = useState([])
  const [prebookings, setPrebookings] = useState([])

  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  useEffect(() => {
    if (!authUser) return
    setProfileName(authUser.username || '')
    setProfileEmail(authUser.email || '')

    fetch('/api/user/coupons', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { coupons: [] })
      .then(d => setCoupons(d.coupons || []))
      .catch(() => setCoupons([]))

    fetch('/api/user/prebookings', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => setPrebookings(d.items || []))
      .catch(() => setPrebookings([]))
  }, [authUser])

  function handleLogout() {
    clearAuth()
    setAuthUser(null)
  }

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

  // Filtered Events
  const filteredEvents = events.filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return cityMatch && venueMatch
  })

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">
        <header className="bg-zinc-900 rounded-3xl p-8 border border-zinc-700 shadow-lg text-center">
          <h1 className="text-4xl font-bold text-blue-400">EDGY EVENT PLATFORM</h1>

          <div className="mt-6 flex gap-3 justify-center">
            {!authUser ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">Create account</button>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600">Log in</button>
              </>
            ) : (
              <>
                <span>Welcome, {authUser.username}</span>
                <button onClick={() => setShowAccountModal(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Your Account</button>
                <button onClick={handleLogout} className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">Log out</button>
              </>
            )}
          </div>
        </header>

        {isAdmin && <AdminSBTManager darkMode={true} />}

        {/* Event Flow Explanation */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 text-center text-blue-400">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
              <h3 className="text-lg font-bold mb-2 text-yellow-400">1. Prebook</h3>
              <p className="text-gray-300 text-sm">Show your interest in the event and sign up to hear when events are confirmed and open for coupon purchase.</p>
            </div>
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
              <h3 className="text-lg font-bold mb-2 text-green-400">2. Book</h3>
              <p className="text-gray-300 text-sm">Purchase your coupon for the venue to meet your network and get your perks. Buy coupons early.</p>
            </div>
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
              <h3 className="text-lg font-bold mb-2 text-blue-400">3. Show Up</h3>
              <p className="text-gray-300 text-sm">Get registered on the digital guestlist, meet new people, place your order, and enjoy the mystery perk served on the side.</p>
            </div>
          </div>
        </section>

        {/* Event Grid/List Section */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-400">Explore Events</h2>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="text-sm px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
            >
              {viewMode === 'grid' ? 'List view' : 'Grid view'}
            </button>
          </div>

          <div className="flex gap-4 mb-6 justify-center">
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

          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">No events match your filter.</p>
          ) : viewMode === 'grid' ? (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredEvents.map(event => <DynamicEventCard key={event.id} event={event} />)}
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
              {filteredEvents.map(event => (
                <EventListRow key={event.id} event={event} onPreview={() => alert(`Preview: ${event.name}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-center text-gray-400">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">Git

