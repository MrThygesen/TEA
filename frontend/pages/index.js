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
   Event List Row
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


        {/* ... keep your event flow, dynamic grid, etc. ... */}

        <footer className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 text-center text-gray-400">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">GitHub</a></p>
          {isAdmin && <ConnectButton />}
        </footer>
      </div>





      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50" onClick={() => setShowAccountModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Your Account</h2>
            <form className="space-y-3 mb-6">
              <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full p-2 rounded text-black" />
              <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} className="w-full p-2 rounded text-black" />
            </form>
            <h3 className="font-semibold mb-2">Paid Coupons</h3>
            {coupons.map(c => <p key={c.id}>{c.event_name}</p>)}
            <h3 className="font-semibold mt-4 mb-2">Prebookings</h3>
            {prebookings.map(p => <p key={p.id}>{p.event_name}</p>)}
            <button onClick={() => setShowAccountModal(false)} className="mt-4 px-4 py-2 bg-blue-600 rounded">Close</button>
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
  )
}

