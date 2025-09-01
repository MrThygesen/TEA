'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'

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

/* ---------------------------
   Main Home Component
---------------------------- */
export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)

  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

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

  const filteredEvents = events.filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return cityMatch && venueMatch
  })

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-3xl space-y-10">

        {/* HEADER */}
        <header className="relative bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border overflow-hidden">
          <img src="/new.png" alt="EDGE Project Logo" className="w-24 h-24 object-contain" />
          <h1 className="text-4xl font-bold text-blue-400 text-left">WELCOME TO THE EDGE NETWORK</h1>
          <p className="text-left text-gray-400 mb-6">
            Our network is the spot where people, venues, and opportunities meet.
          </p>
          <div className="flex gap-3 items-center">
            <ConnectButton />
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
        </header>

        {/* SBT Section */}
        <section>
          {isConnected ? (
            isAdmin ? <AdminSBTManager darkMode={true} /> : <WebAccessSBT darkMode={true} />
          ) : (
            <p className="text-center text-gray-400"></p>
          )}
        </section>

        {/* Event Filters (City & Venue only) */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">Explore Events</h2>
          <div className="flex gap-4 mb-6 justify-center">
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

        {/* Telegram Section */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400">Join us on Telegram</h2>
          <p className="mb-4 text-gray-300">
            You can use the whole system for booking and tickets via Telegram.
          </p>
          <button
            onClick={() => window.open('https://t.me/TeaIsHereBot', '_blank')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition"
          >
            Open Telegram
          </button>
        </section>

        {/* Footer */}
        <footer className="bg-zinc-900 border-zinc-700 text-gray-400 rounded-3xl p-6 border shadow-lg text-center space-y-2 transition-colors duration-300">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">GitHub Repository</a></p>
          <p>Twitter: <a href="https://twitter.com/yourtwitterhandle" className="text-blue-400 hover:underline" target="_blank">@TEAProject</a></p>
          <p>Intro Video: <a href="https://youtu.be/5QSHQ26JMm8" className="text-blue-400 hover:underline" target="_blank">Watch on YouTube</a></p>
          <p>Contact: <a href="linkedin.com/in/mortenthygesens" className="text-blue-400 hover:underline">Connect On Linkedin</a></p>
          <p className="text-xs mt-4">&copy; 2025 TEA Project Team</p>
        </footer>
      </div>
    </main>
  )
}

