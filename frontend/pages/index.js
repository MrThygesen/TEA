'use client'

import { useState, useEffect } from 'react'
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

export function DynamicEventCard({ event, authUser, setShowAccountModal }) {
  const [heartCount, setHeartCount] = useState(0)
  const [bookable, setBookable] = useState(event.is_confirmed)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [userTickets, setUserTickets] = useState(0)
  const [maxPerUser, setMaxPerUser] = useState(event.tag1 === 'group' ? 5 : 1)

  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [agreeChecked, setAgreeChecked] = useState(false)

  const HEART_THRESHOLD = 10

  // Fetch hearts
  useEffect(() => {
    async function fetchHearts() {
      try {
        const res = await fetch(`/api/events/hearts?eventId=${event.id}`)
        if (!res.ok) return
        const data = await res.json()
        setHeartCount(data.count)
        setBookable(data.count >= HEART_THRESHOLD || event.is_confirmed)
      } catch (err) {
        console.error('Failed to fetch hearts', err)
      }
    }
    fetchHearts()
  }, [event.id, event.is_confirmed])

  // Fetch user's tickets
  useEffect(() => {
    if (!authUser) return
    async function fetchMyTickets() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const reg = (data.registrations || []).find(r => r.event_id === event.id)
        if (reg) {
          setUserTickets(reg.user_tickets || 0)
          setMaxPerUser(reg.max_per_user || (event.tag1 === 'group' ? 5 : 1))
        }
      } catch (err) {
        console.error('Failed to fetch my tickets', err)
      }
    }
    fetchMyTickets()
  }, [authUser, event.id, event.tag1])

  const reachedLimit = userTickets >= maxPerUser

  // Booking logic
  async function handleBooking() {
    if (!authUser) {
      setShowAccountModal(true)
      return
    }
    if (!bookable || reachedLimit) return
    if (!agreeChecked) return // must check policy

    setLoading(true)
    setStatusMsg('Processing…')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      setUserTickets(prev => prev + 1)
      setStatusMsg('Booking confirmed!')
      setConfirmModalOpen(false)
      setAgreeChecked(false)

      // Paid event -> redirect to Stripe checkout
      if (data.clientSecret) {
        window.location.href = `/api/events/checkout?payment_intent_client_secret=${data.clientSecret}`
      }
    } catch (err) {
      console.error(err)
      setStatusMsg('Error registering')
    } finally {
      setLoading(false)
      setTimeout(() => setStatusMsg(''), 2500)
    }
  }

  // Hearts
  async function handleHeartClick() {
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/events/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ eventId: event.id })
      })
      if (!res.ok) throw new Error('Failed to like')
      const data = await res.json()
      setHeartCount(data.count)
      if (data.count >= HEART_THRESHOLD) setBookable(true)
    } catch (err) {
      console.error(err)
    }
  }

  function getButtonLabel() {
    if (!authUser) return 'Go to login'
    if (reachedLimit) return `Max ${maxPerUser} tickets`
    if (!bookable) return `Needs ${HEART_THRESHOLD} hearts (${heartCount}/${HEART_THRESHOLD})`
    if (loading) return statusMsg || 'Processing…'
    if (event.price && Number(event.price) > 0) return 'Pay Now'
    return 'Book Free'
  }

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800 shadow flex flex-col justify-between relative">
        {/* Heart in top right */}
        <button
          onClick={handleHeartClick}
          className="absolute top-2 right-2 text-red-500 text-xl"
        >
          ❤️ {heartCount}/{HEART_THRESHOLD}
        </button>

        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">{event.description}</p>

        {/* Booking button → opens internal modal */}
        <div className="flex flex-col gap-2 mt-auto mb-2">
          <button
            onClick={() => setInternalModalOpen(true)}
            disabled={!bookable || loading || reachedLimit}
            className={`w-full px-3 py-1 rounded ${
              !authUser
                ? 'bg-zinc-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white text-sm disabled:opacity-50`}
          >
            {getButtonLabel()}
          </button>
        </div>

        {/* Footer info */}
        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 Booked: {userTickets} / {event.max_attendees || '∞'}</span>
        </div>
      </div>

      {/* Internal Modal */}
      {internalModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setInternalModalOpen(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">{event.name}</h2>
            <p className="text-gray-300 mb-4">{event.details || event.description}</p>
            <button
              onClick={() => {
                setInternalModalOpen(false)
                setConfirmModalOpen(true)
              }}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Continue to Confirm
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmModalOpen(false)}>
          <div className="bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full p-6 text-white relative"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-3">Confirm Booking</h2>
            <p className="text-sm mb-4">
              Please confirm you agree with our event policy before booking.
            </p>
            <label className="flex items-center gap-2 mb-4 text-sm">
              <input
                type="checkbox"
                checked={agreeChecked}
                onChange={(e) => setAgreeChecked(e.target.checked)}
              />
              I agree to the policy
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={!agreeChecked || loading}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Processing…' : 'Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------
// Main Home Component
// ---------------------------
export default function Home() {
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
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)

  // --- fetch events ---
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // --- load user data on auth ---
  useEffect(() => {
    async function loadProfile() {
      const token = localStorage.getItem('token')
      if (!token) return

      try {
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        setProfileName(data.username || '')
        setProfileEmail(data.email || '')

        const updatedUser = { ...authUser, ...data }
        setAuthUser(updatedUser)
        saveAuth(updatedUser)
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }

    if (showAccountModal) loadProfile()
  }, [showAccountModal])

  // --- auth handlers (login/signup/logout) ---
  async function handleLogin(e) { /* ... same as your code ... */ }
  async function handleSignup(e) { /* ... same as your code ... */ }
  function handleLogout() { clearAuth(); setAuthUser(null) }

  const filteredEvents = events.filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return cityMatch && venueMatch
  })

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      {/* keep your header, video, highlights, etc. unchanged */}

      <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-blue-400">Explore Network Events</h2>
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="text-sm px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">
            {viewMode === 'grid' ? 'List view' : 'Grid view'}
          </button>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="text-center text-gray-400">No events found</p>
        ) : viewMode === 'grid' ? (
          <div className="grid md:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <DynamicEventCard
                key={event.id}
                event={event}
                authUser={authUser}
                setShowAccountModal={setShowAccountModal}
              />
            ))}
          </div>
        ) : (
          /* list view unchanged */
          null
        )}
      </section>

      {showAccountModal && (
        <YourAccountModal
          onClose={() => setShowAccountModal(false)}
          refreshTrigger={Date.now()}
        />
      )}
    </main>
  )
}

