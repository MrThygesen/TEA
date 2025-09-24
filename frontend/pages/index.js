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
// Helpers
// ---------------------------
function computeStage(preCount, minAttendees) {
  return preCount < (minAttendees || 0) ? 'prebook' : 'book';
}

// ---------------------------
// DynamicEventCard
// ---------------------------
export function DynamicEventCard({ event, authUser, setShowAccountModal, counters, onUpdateCounters }) {
  const safeCounters = counters || { prebook: 0, book: 0 }
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState(safeCounters)
  const [stage, setStage] = useState(computeStage(safeCounters.prebook, event.min_attendees))

  // Sync counters from parent
  useEffect(() => {
    const updatedCounters = counters || { prebook: 0, book: 0 }
    setRegisteredUsers(updatedCounters)
    setStage(computeStage(updatedCounters.prebook, event.min_attendees))
  }, [counters, event.min_attendees])

  const displayCount = stage === 'prebook' ? registeredUsers.prebook : registeredUsers.book
  const isDisabled = loading

  async function handleWebAction() {
    setLoading(true)
    setStatusMsg(stage === 'prebook' ? 'Joining...' : 'Booking...')

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setShowAccountModal(true)
        return
      }

      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: event.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      if (data.counters) {
        const preCount = data.counters.prebook_count ?? registeredUsers.prebook
        const bookCount = data.counters.book_count ?? registeredUsers.book

        const newStage = computeStage(preCount, event.min_attendees)
        const newCounters = { prebook: preCount, book: bookCount }

        setRegisteredUsers(newCounters)
        setStage(newStage)

        if (onUpdateCounters) onUpdateCounters(newCounters)

        setStatusMsg(newStage === 'prebook' ? 'Added to Guestlist!' : 'Booking confirmed!')
      }

      if (data.clientSecret) setStatusMsg('Redirecting to payment…')
    } catch (err) {
      console.error('❌ Registration error:', err)
      setStatusMsg('Error registering')
    } finally {
      setLoading(false)
      setTimeout(() => setStatusMsg(''), 2000)
    }
  }

  function getWebButtonLabel() {
    if (loading) return statusMsg || (stage === 'prebook' ? 'Guestlist…' : 'Processing…')
    if (statusMsg) return statusMsg
    if (stage === 'prebook') return 'Join Guestlist'
    if (stage === 'book') return !event.price || Number(event.price) === 0 ? 'Book Free' : 'Pay Now'
    return 'Registration Closed'
  }

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800 shadow flex flex-col justify-between">
        <img src={event.image_url || '/default-event.jpg'} alt={event.name} className="w-full h-40 object-cover rounded mb-3" />
        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">{event.description?.split(' ').slice(0, 30).join(' ')}...</p>

        <div className="flex flex-wrap gap-1 mb-2">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">{tag}</span>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-auto mb-2">
          {/* Main action button */}
          <button
            onClick={() => setConfirmModalOpen(true)}
            disabled={isDisabled}
            className={`w-full px-3 py-1 rounded ${stage === 'book' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-600 hover:bg-yellow-700'} text-white text-sm disabled:opacity-50`}
          >
            {getWebButtonLabel()}
          </button>

          {/* Preview button */}
          <button
            onClick={() => setInternalModalOpen(true)}
            className="w-full px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
          >
            Preview
          </button>
        </div>

        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 {stage === 'prebook' ? 'Guestlist' : 'Booked'}: {displayCount}</span>
        </div>
      </div>

      {/* Internal Preview Modal */}
      {internalModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setInternalModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{event.name}</h2>
            <img src={event.image_url || '/default-event.jpg'} alt={event.name} className="w-full h-56 object-contain rounded mb-4"/>
            <p className="mb-2 text-sm text-gray-400">{new Date(event.datetime).toLocaleString()} @ {event.venue} ({event.venue_type || 'N/A'})</p>
            <p className="mb-4">{event.details}</p>
            {event.basic_perk && <p className="text-sm text-gray-300"><strong>Basic Perk:</strong> {event.basic_perk}</p>}
            {registeredUsers.book >= 10 && event.advanced_perk && <p className="text-sm text-gray-300"><strong>Advanced Perk:</strong> {event.advanced_perk}</p>}

            {(stage === 'prebook' || stage === 'book') && (
              <button
                disabled={isDisabled}
                onClick={async () => { setInternalModalOpen(false); await handleWebAction() }}
                className="mt-4 w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                {stage === 'prebook' ? 'Join Guestlist' : !event.price || Number(event.price) === 0 ? 'Book Free' : 'Pay Now'}
              </button>
            )}

            <button onClick={() => setInternalModalOpen(false)} className="mt-2 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white w-full">Close</button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setConfirmModalOpen(false)}>
          <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 text-white relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4 text-center">{event.name}</h2>
            <p className="mb-6 text-sm text-gray-300 text-center leading-relaxed">
              By confirming, you declare a genuine interest in participating.
            </p>

            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                I agree to guidelines and receive emails for this event.
              </label>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setConfirmModalOpen(false)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm">Cancel</button>
                <button
                  disabled={!agree || loading}
                  onClick={async () => { setConfirmModalOpen(false); await handleWebAction() }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  {stage === 'prebook' ? 'Join Guestlist' : !event.price || Number(event.price) === 0 ? 'Book Free' : 'Pay Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------
// Video Hero
// ---------------------------
function VideoHero() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg mt-10 text-center">
      <h2 className="text-2xl font-semibold mb-6 text-blue-400">
        Watch How It Works
      </h2>
      <div
        className="relative mx-auto w-full max-w-4xl cursor-pointer rounded-lg overflow-hidden"
        onClick={() => setOpen(true)}
        aria-label="Play video"
        role="button"
      >
        <img
          src="/images/video-poster.jpg"
          alt="Video poster describing how it works"
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="bg-black bg-opacity-60 text-white rounded-full p-3"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,.6)' }}
          >
            ▶
          </span>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-label="Video modal"
        >
          <div className="relative w-full max-w-4xl aspect-video bg-black">
            <iframe
              className="w-full h-full rounded-lg"
              src="https://www.youtube.com/embed/FN_sOmPuuec?si=pNEvmL1ELtpqMRKD"
              title="Event Platform Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full p-2"
              aria-label="Close video"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
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
      <button onClick={() => onPreview(event)} className="text-blue-500 hover:underline">Preview</button>
    </div>
  )
}

// ---------------------------
// Main Page
// ---------------------------
export default function Home() {
  const { isConnected, address } = useAccount()
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [events, setEvents] = useState([])
  const [counters, setCounters] = useState({})

  // Refresh auth persistence
  useEffect(() => saveAuth(authUser), [authUser])

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch('/api/events/list')
        const data = await res.json()
        setEvents(data.events || [])
      } catch (err) {
        console.error('Error fetching events', err)
      }
    }
    loadEvents()
  }, [])

  return (
    <main className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">TEA Events Platform</h1>
        <ConnectButton />
      </header>

      <AdminSBTManager authUser={authUser} setAuthUser={setAuthUser} />

      {showAccountModal && (
        <YourAccountModal
          onClose={() => setShowAccountModal(false)}
          refreshTrigger={() => setAuthUser(loadAuth())}
        />
      )}

      <VideoHero />

      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {events.map((event) => (
          <DynamicEventCard
            key={event.id}
            event={event}
            authUser={authUser}
            setShowAccountModal={setShowAccountModal}
            counters={counters[event.id]}
            onUpdateCounters={(newCounters) => setCounters(prev => ({ ...prev, [event.id]: newCounters }))}
          />
        ))}
      </section>
    </main>
  )
}

