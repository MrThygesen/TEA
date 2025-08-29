'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
//import WebAccessSBT from '../components/WebAccessSBT'
import LoginModal from '../components/LoginModal' // user login modal

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
   Main Home Component
---------------------------- */
export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  // Event filters
  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')

  // User login state
  const [showLogin, setShowLogin] = useState(false)
  const [user, setUser] = useState(null)

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)

  // UI states
  const [showAmoyInfo, setShowAmoyInfo] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)

  // Load events
  useEffect(() => {
    fetch('/api/dump')
      .then(res => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // Load email for wallet user
  useEffect(() => {
    if (address) {
      fetch(`/api/email-optin?wallet=${address}`)
        .then(res => res.json())
        .then(data => { if (data.email) setEmail(data.email) })
        .catch(() => {})
    } else {
      setEmail('')
      setEmailStatus('')
    }
  }, [address])

  const handleLoginSuccess = (userData) => {
    setUser(userData)
  }

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

  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return tagMatch && cityMatch && venueMatch
  })

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">


        {/* HEADER */}
        <header className="relative bg-zinc-900 border-zinc-700 rounded-3xl p-8 flex flex-col items-center space-y-4 border">
          <img src="/tea.png" alt="TEA Project Logo" className="w-24 h-24 object-contain" />
          <h1 className="text-4xl font-bold text-blue-400 text-left">WELCOME TO THE TEA NETWORK</h1>
          <p className="text-left text-gray-400 mb-6">
            Meet, network, and enjoy perks in cafes, bars, and restaurants.
          </p>

          <div className="flex gap-3 items-center">
            <ConnectButton />
            {user ? (
              <Link
                href="/account"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                My Account ({user.username})
              </Link>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                Login
              </button>
            )}
            {isConnected && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                📧 Email Notifications
              </button>
            )}
          </div>
          {isConnected && (
            <p className="text-sm break-words text-center max-w-xs font-mono">
              Connected as: {address}
            </p>
          )}



{/* ---------------- Event Flow Explanation ---------------- */}
<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
  <h2 className="text-2xl font-semibold mb-6 text-center text-blue-400">How It Works</h2>
  <div className="grid md:grid-cols-3 gap-6 text-left">
    {/* Box 1 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-yellow-400">1. Prebook</h3>
      <p className="text-gray-300 text-sm">
        Tell us you're coming for a social or business meetup. Ticket booking opens once enough interest is confirmed. 
   </p>

      <p className="text-gray-300 text-sm">  Prebook and give us a heads up through your account here, or use our telegram message bot. </p>



    </div>
    {/* Box 2 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-green-400">2. Book</h3>
      <p className="text-gray-300 text-sm">
       Tickets are released when a minimum number of guests have signed up. Its a strict requirement to buy the ticket in advance. Secure your spot.
      </p> 
  <p className="text-gray-300 text-sm"> You book and pay for your ticket here or through our telegram message bot.

      </p> 
    </div>
    {/* Box 3 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-blue-400">3. Show Up</h3>
      <p className="text-gray-300 text-sm">
        Get registered on the digital guestlist, meet new people, place your order, and enjoy a free perk served on the side.
      </p>
    </div>
  </div>
</section>



        </header>

        {/* Login Modal */}
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {/* SBT Section */}
        <section>
          {isConnected ? (
            isAdmin ? <AdminSBTManager darkMode={true} /> : <WebAccessSBT darkMode={true} />
          ) : (
            <p className="text-center text-gray-400 text-sm">
              Connect your wallet to claim your Event Access Card.
            </p>
          )}
        </section>

        {/* Events */}
        <section className="bg-zinc-900 border-zinc-700 rounded-3xl p-8">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">Explore Events</h2>
          <div className="flex gap-4 mb-6 justify-center">
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="">All Tags</option>
              {[...new Set(events.flatMap(e => [e.tag1, e.tag2, e.tag3]).filter(Boolean))].map((tag, i) => (
                <option key={i} value={tag}>{tag}</option>
              ))}
            </select>
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedCity(e.target.value)}>
              <option value="">All Cities</option>
              {[...new Set(events.map(e => e.city))].map((city, i) => (
                <option key={i} value={city}>{city}</option>
              ))}
            </select>
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedVenueType(e.target.value)}>
              <option value="">All Venue Types</option>
              {[...new Set(events.map(e => e.venue_type).filter(Boolean))].map((type, i) => (
                <option key={i} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">No events match your filter.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredEvents.map(event => <DynamicEventCard key={event.id} event={event} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

