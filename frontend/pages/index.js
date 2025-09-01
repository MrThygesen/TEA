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
   Main Home Component
---------------------------- */
export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  // --- State Hooks ---
  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showAmoyInfo, setShowAmoyInfo] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [emailFormStatus, setEmailFormStatus] = useState(null)

  // --- Fetch events ---
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // --- Fetch email for connected wallet ---
  useEffect(() => {
    if (address) {
      fetch(`/api/email-optin?wallet=${address}`)
        .then(res => res.json())
        .then(data => { if(data.email) setEmail(data.email) })
        .catch(() => {})
    } else {
      setEmail('')
      setEmailStatus('')
    }
  }, [address])

  // --- Filtered Events ---
  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return tagMatch && cityMatch && venueMatch
  })

  // --- Email Handlers ---
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

          <img src="/new.png" alt="EDGE Project Logo" className="w-24 h-24 object-contain" />
          <h1 className="text-4xl font-bold text-blue-400 text-left">WELCOME TO THE EDGE NETWORK</h1>

          <p className="text-left text-gray-400 mb-6">
Our network is the spot where people, venues, and opportunities meet.
Our guests receive curated experiences that blend business with social connections. 
We are happy to make you happy and prosperous.
          </p> 

          <p className="text-left text-gray-400 mb-6">
Register an account here on the web or through Telegram, and get started with signing up for events. 
We charge a low fee to give you a valuable event experience. 
         </p> 
          <p>
            <a href="https://youtu.be/5QSHQ26JMm8" className="text-blue-400 hover:underline" target="_blank">
              Learn more about the EDGE network (Video)
            </a>
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

        {/* ---------------- SBT Section ---------------- */}
        <section>
          {isConnected ? (
            isAdmin ? <AdminSBTManager darkMode={true} /> : <WebAccessSBT darkMode={true} />
          ) : (
            <p className="text-center text-gray-400"></p>
          )}
        </section>


{/* ---------------- Event Flow Explanation ---------------- */}
<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
  <h2 className="text-2xl font-semibold mb-6 text-center text-blue-400">How It Works</h2>
  <div className="grid md:grid-cols-3 gap-6 text-left">
    {/* Box 1 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-yellow-400">1. Prebook</h3>
      <p className="text-gray-300 text-sm">
Show your interest in the event and sign up to hear when events are confirmed and open for ticket purchase.
   </p> 

    </div>
    {/* Box 2 */}
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow">
      <h3 className="text-lg font-bold mb-2 text-green-400">2. Book</h3>
      <p className="text-gray-300 text-sm">

        Purchase your ticket for the venue to meet your network and get your perks. Buy tickets early.
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


        {/* ---------------- Dynamic Event Grid ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">Explore Events</h2>

          {/* Filters */}
          
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


<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center">
  <h2 className="text-2xl font-semibold mb-4 text-blue-400">Join us on Telegram</h2>
  <p className="mb-4 text-gray-300"> We are also Telegram, and you can actually use the whole system for booking and tickets on telegram.</p>
  <button
    onClick={() => window.open('https://t.me/TeaIsHereBot', '_blank')}
    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition"
  >
    Open Telegram
  </button>
</section>



        {/* ---------------- EDGE Network Info ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center space-y-4">
          <h2 className="text-3xl font-bold text-blue-400">EDGE NETWORK </h2>
          <p className="text-left text-gray-300 mb-4">
            Your edge in networking, nightlife, and opportunity.

          </p>
          <p className="text-left text-gray-300 mb-4">
            EDGE NETWORK helps you connect friendships, business, dating — and enjoy discounted drinks. 
            We provide the deal and coordinate between guests and partners. Join the EDGE Network and its mission getting people and business together 
          </p>
          <p className="text-left text-gray-300 mb-4">
            Everybody is welcome.
          </p>
        </section>

        {/* ---------------- Roadmap ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-center text-blue-400">Project Roadmap</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Q2 2025: Initial blockchain architecture planning and development for SBT.</li>
            <li>Q3 2025: Telegram registration & testnet launch</li>
            <li>Q4 2025: Mainnet deployment & audits</li>
            <li>Q1 2026: Partner onboarding & growth</li>
            <li>Q2 2026: Loyalty rewards integration</li>
          </ul>
          <div className="text-center mt-4- Main: “EDGE NETWORK: Where people, venues, and opportunities meet.”
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

      {/* ---------------- Email Modal ---------------- */}
      {showEmailModal && (
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
    </main>
  )
}

