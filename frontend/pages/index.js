'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import YourAccountModal from '../components/YourAccountModal'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const token = localStorage.getItem('token')
    if (!token) return null
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return { token, user }
  } catch {
    return null
  }
}

// ---------------------------
// Event Card
// ---------------------------
function DynamicEventCard({ event, authUser, setShowAccountModal }) {
  const [heartCount, setHeartCount] = useState(0)
  const [bookable, setBookable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [userTickets, setUserTickets] = useState(0)
  const [maxPerUser, setMaxPerUser] = useState(event.tag1 === 'group' ? 5 : 1)

  // Fetch hearts
  useEffect(() => {
    async function fetchHearts() {
      try {
        const res = await fetch(`/api/events/hearts?eventId=${event.id}`)
        if (!res.ok) return
        const data = await res.json()
        setHeartCount(data.count)
        setBookable(data.count >= 10)
      } catch (err) {
        console.error('❌ Hearts fetch:', err)
      }
    }
    fetchHearts()
  }, [event.id])

  // Fetch user tickets
  useEffect(() => {
    async function fetchMyTickets() {
      if (!authUser) return
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
        console.error('❌ Tickets fetch:', err)
      }
    }
    fetchMyTickets()
  }, [authUser, event.id, event.tag1])

  const reachedLimit = userTickets >= maxPerUser

  async function handleRegister() {
    if (!authUser) {
      setShowAccountModal(true)
      return
    }
    if (reachedLimit || !bookable) return

    setLoading(true)
    setStatusMsg('Processing…')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      setUserTickets(prev => prev + 1)
      setStatusMsg('Booking confirmed!')

      if (data.clientSecret) {
        // redirect to Stripe checkout
        window.location.href = `/api/events/checkout?payment_intent_client_secret=${data.clientSecret}`
      }
    } catch (err) {
      console.error('❌ Registration:', err)
      setStatusMsg('Error registering')
    } finally {
      setLoading(false)
      setTimeout(() => setStatusMsg(''), 2000)
    }
  }

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
      if (!res.ok) throw new Error('Failed to heart')
      const data = await res.json()
      setHeartCount(data.count)
      if (data.count >= 10) setBookable(true)
    } catch (err) {
      console.error('❌ Heart click:', err)
    }
  }

  function getButtonLabel() {
    if (!authUser) return 'Go to login'
    if (reachedLimit) return `Max ${maxPerUser} tickets`
    if (!bookable) return `Needs 10 hearts (${heartCount}/10)`
    if (loading) return statusMsg || 'Processing…'
    if (statusMsg) return statusMsg
    return !event.price || Number(event.price) === 0 ? 'Book Free' : 'Pay Now'
  }

  return (
    <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800 shadow relative flex flex-col">
      {/* Heart in top-right */}
      <button
        onClick={handleHeartClick}
        className="absolute top-2 right-2 text-red-500 text-xl"
      >
        ❤️ {heartCount}/10
      </button>

      <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
      <p className="text-sm mb-2">{event.description}</p>

      <div className="mt-auto">
        <button
          onClick={handleRegister}
          disabled={loading || reachedLimit || !bookable}
          className={`w-full px-3 py-1 rounded ${
            !authUser
              ? 'bg-zinc-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white text-sm disabled:opacity-50`}
        >
          {getButtonLabel()}
        </button>
      </div>

      <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2 mt-2">
        <span>💰 {event.price > 0 ? `${event.price} USD` : 'Free'}</span>
        <span>👥 Booked: {userTickets} / {event.max_attendees || '∞'}</span>
      </div>
    </div>
  )
}

// ---------------------------
// Main Page
// ---------------------------
export default function HomePage() {
  const { address } = useAccount()
  const [events, setEvents] = useState([])
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showAccountModal, setShowAccountModal] = useState(false)

  useEffect(() => {
    async function loadEvents() {
      try {
        const res = await fetch('/api/events/list')
        if (!res.ok) throw new Error('Failed to load events')
        const data = await res.json()
        setEvents(data.events || [])
      } catch (err) {
        console.error('❌ Load events:', err)
      }
    }
    loadEvents()
  }, [])

  return (
    <div className="p-4 max-w-5xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        <div className="flex gap-4 items-center">
          <ConnectButton />
          {authUser && (
            <button
              onClick={() => setShowAccountModal(true)}
              className="bg-zinc-700 px-3 py-1 rounded"
            >
              Account
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map(event => (
          <DynamicEventCard
            key={event.id}
            event={event}
            authUser={authUser}
            setShowAccountModal={setShowAccountModal}
          />
        ))}
      </div>

      {showAccountModal && (
        <YourAccountModal
          onClose={() => setShowAccountModal(false)}
          refreshTrigger={Date.now()}
        />
      )}
    </div>
  )
}

