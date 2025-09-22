'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import YourAccountModal from '../components/YourAccountModal'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('edgy_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}
function saveAuth(user) {
  try { localStorage.setItem('edgy_auth_user', JSON.stringify(user)) } catch (_) {}
}
function clearAuth() {
  try { localStorage.removeItem('edgy_auth_user') } catch (_) {}
}

// ---------------------------
// Dynamic Event Card
// ---------------------------
export function DynamicEventCard({ event, onPreview, authUser, setShowAccountModal }) {
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [selectedStage, setSelectedStage] = useState(null)
  const [registeredUsers, setRegisteredUsers] = useState(event.registered_users || 0)
  const [hasTicket, setHasTicket] = useState(false)

  const eventConfirmed = event.is_confirmed === true
  const isMaxReached = () => {
    if (!authUser) return false
    if (event.tag1 === 'group') return event.user_ticket_count >= 10
    return event.user_ticket_count >= 1
  }

  const handleWebAction = async (stage) => {
    if (!authUser) {
      setShowAccountModal(true)
      return
    }
    setLoading(true)
    setStatusMsg('Processing...')
    try {
      const token = authUser?.token || localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: event.id, stage })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to register')
      if (typeof data.registeredCount === 'number') setRegisteredUsers(data.registeredCount)
      if (stage === 'prebook') setStatusMsg(data.message || 'Guestlist confirmed!')
      else if (stage === 'book') {
        if (!event.price || Number(event.price) === 0) setHasTicket(true), setStatusMsg(data.message || 'Ticket sent!')
        else if (data.url) setTimeout(() => { window.location.href = data.url }, 500)
      }
      setTimeout(() => setStatusMsg(''), 2500)
    } catch (err) {
      console.error(err)
      setStatusMsg(err.message || 'Error occurred')
      setTimeout(() => setStatusMsg(''), 2500)
    } finally { setLoading(false) }
  }

  const getWebButtonLabel = () => {
    if (loading) return <span className="flex items-center justify-center gap-2">Processing...</span>
    if (isMaxReached()) return 'Max reached'
    if (!eventConfirmed) return 'Guestlist'
    if (eventConfirmed && (!event.price || Number(event.price) === 0)) return 'Free Access'
    if (eventConfirmed && Number(event.price) > 0) return 'Pay Access'
    return 'Book'
  }

  const handleConfirmClick = () => {
    if (isMaxReached()) return
    const stage = !eventConfirmed ? 'prebook' : 'book'
    setSelectedStage(stage)
    setConfirmModalOpen(true)
  }

  return (
    <>
      <div className="bg-zinc-900 rounded-2xl shadow p-4 flex flex-col">
        <h3 className="text-lg font-semibold mb-2">{event.name}</h3>
        <p className="text-sm text-gray-400 mb-2">{new Date(event.datetime).toLocaleString()} @ {event.venue}</p>
        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 {registeredUsers} Users</span>
        </div>

        {!onPreview && (
          <>
            <button
              onClick={handleConfirmClick}
              disabled={isMaxReached() || loading}
              className={`mt-2 w-full px-3 py-1 rounded text-sm ${
                isMaxReached() ? 'bg-zinc-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {getWebButtonLabel()}
            </button>
            <button
              onClick={() => setInternalModalOpen(true)}
              className="mt-2 w-full px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
            >
              Preview
            </button>
          </>
        )}

        {/* Confirmation Modal */}
        {confirmModalOpen && selectedStage && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmModalOpen(false)}>
            <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 text-white relative" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-semibold mb-4 text-center">{event.name}</h2>
              <p className="mb-6 text-sm text-gray-300 text-center leading-relaxed">Confirm participation by agreeing to the event guidelines.</p>
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  I agree to guidelines and event emails.
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm">Cancel</button>
                  <button
                    disabled={!agree || loading}
                    onClick={async () => { setConfirmModalOpen(false); await handleWebAction(selectedStage) }}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {selectedStage === 'prebook' ? 'Join Guestlist' : !event.price || Number(event.price) === 0 ? 'Book Free' : 'Pay Now'}
                  </button>
                </div>
              </div>
              <p className="mt-6 text-xs text-gray-500 text-center">
                By proceeding, you agree to our{' '}
                <a href="/policies" className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noopener noreferrer">policies</a>.
              </p>
            </div>
          </div>
        )}

        {/* Event Details Modal */}
        {internalModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setInternalModalOpen(false)}>
            <div className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4">{event.name}</h2>
              <img src={event.image_url || '/default-event.jpg'} alt={event.name} className="w-full h-56 object-contain rounded mb-4" />
              <p className="mb-2 text-sm text-gray-400">{new Date(event.datetime).toLocaleString()} @ {event.venue} ({event.venue_type || 'N/A'})</p>
              <p className="mb-4">{event.details}</p>
              {event.basic_perk && <p className="text-sm text-gray-300"><strong>Basic Perk:</strong> {event.basic_perk}</p>}
              {(event.paid_count || 0) >= 10 && event.advanced_perk && <p className="text-sm text-gray-300"><strong>Advanced Perk:</strong> {event.advanced_perk}</p>}
              <button onClick={() => setInternalModalOpen(false)} className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Close</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ---------------------------
// Video Hero Component
// ---------------------------
function VideoHero() {
  const [open, setOpen] = useState(false)

  return (
    <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg mt-10 text-center">
      <h2 className="text-2xl font-semibold mb-6 text-blue-400">Watch How It Works</h2>
      <div className="relative mx-auto w-full max-w-4xl cursor-pointer rounded-lg overflow-hidden" onClick={() => setOpen(true)} role="button" aria-label="Play video">
        <img src="/images/video-poster.jpg" alt="Video poster" className="w-full h-64 object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="bg-black bg-opacity-60 text-white rounded-full p-3" style={{ boxShadow: '0 4px 14px rgba(0,0,0,.6)' }}>▶</span>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" role="dialog" aria-label="Video modal">
          <div className="relative w-full max-w-4xl aspect-video bg-black">
            <iframe className="w-full h-full rounded-lg" src="https://www.youtube.com/embed/FN_sOmPuuec?si=pNEvmL1ELtpqMRKD" title="Event Platform Video" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-white bg-black/60 rounded-full p-2" aria-label="Close video">✕</button>
          </div>
        </div>
      )}
    </section>
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
      <button onClick={() => onPreview && onPreview(event)} className="justify-self-end text-blue-400 hover:underline">Preview</button>
    </div>
  )
}

// ---------------------------
// Main Home Component
// ---------------------------
export default function Home() {
  const { address } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)
  useEffect(() => { setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null) }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')
  const [coupons, setCoupons] = useState([])
  const [prebookings, setPrebookings] = useState([])

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)

  // --- fetch events ---
  useEffect(() => {
    fetch('/api/dump').then((res) => res.json()).then(setEvents).catch(() => setEvents([]))
  }, [])

  // --- load user data on auth ---
  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem('token')
      if (!token) return
      try {
        const res = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) return
        const data = await res.json()
        setProfileName(data.username || '')
        setProfileEmail(data.email || '')
        setCoupons(data.paid_coupons || [])
        setPrebookings(data.prebooked_events || [])
        const updatedUser = { ...authUser, ...data }
        setAuthUser(updatedUser)
        saveAuth(updatedUser)
      } catch (err) { console.error(err) }
    }
    if (authUser) loadProfile()
  }, [authUser])

  const handleLogout = () => { clearAuth(); localStorage.removeItem('token'); setAuthUser(null); setProfileName(''); setProfileEmail(''); setAuthError(''); }

  const filteredEvents = events.filter(e => (!selectedCity || e.city === selectedCity) && (!selectedVenueType || e.venue_type === selectedVenueType))
  const openPreview = (event) => { setSelectedEvent(event); setShowEventModal(true) }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">
        {/* HEADER */}
        <header className="bg-zinc-900 rounded-3xl p-8 border border-zinc-700 shadow-lg text-center">
          <h1 className="text-4xl font-bold text-blue-400">EDGY EVENT PLATFORM</h1>
          <p className="text-left text-gray-400 mb-6 mt-4">
            Our event platform and network is the spot where people, venues, and opportunities meet...
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            {!authUser ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">Create account</button>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600">Login</button>
              </>
            ) : (
              <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700">Logout</button>
            )}
          </div>
        </header>

        {/* VIDEO HERO */}
        <VideoHero />

        {/* EVENT GRID */}
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 gap-6' : 'grid-cols-1 gap-2'}`}>
          {filteredEvents.map((ev) => (
            <DynamicEventCard key={ev.id} event={ev} authUser={authUser} onPreview={openPreview} setShowAccountModal={setShowAccountModal} />
          ))}
        </div>

        {/* ADMIN PANEL */}
        {isAdmin && <AdminSBTManager />}
      </div>

      {/* ACCOUNT MODAL */}
      {showAccountModal && <YourAccountModal authUser={authUser} setShowModal={setShowAccountModal} />}
    </main>
  )
}

