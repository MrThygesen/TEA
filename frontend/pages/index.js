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
      <div className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow">
        <img
          src={event.image_url || '/default-event.jpg'}
          alt={event.name}
          className="w-full h-40 object-cover rounded mb-3"
        />
        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">
          {event.description?.split(' ').slice(0, 150).join(' ')}...
        </p>
        <div className="flex flex-wrap gap-1 mb-2">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">
              {tag}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-2">
          Registered: {event.registered_users || 0}
        </p>
        <div className="flex justify-between">
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-400 hover:underline text-sm"
          >
            Preview
          </button>
          <button
            onClick={() => window.open(telegramLink, '_blank')}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            Register
          </button>

         <div>
   <p className="text-xs text-gray-400 mb-2">   Price: {event.price ? `${event.price} USD` : 'Free'}  </p>
        </div>
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
              {new Date(event.datetime).toLocaleString()} @ {event.venue}
            </p>
            <p className="mb-4">{event.details}</p>
            <p className="text-sm text-gray-300">
              <strong>Basic Perk:</strong> {event.basic_perk || 'None'}
            </p>
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

export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showAmoyInfo, setShowAmoyInfo] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [emailFormStatus, setEmailFormStatus] = useState(null)

  // Dynamic events state
  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')

  /* ---------------------------
     Fetch email for connected user
  ---------------------------- */
  useEffect(() => {
    if (address) {
      fetch(`/api/email-optin?wallet=${address}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.email) setEmail(data.email)
        })
        .catch(() => {})
    } else {
      setEmail('')
      setEmailStatus('')
    }
  }, [address])

  /* ---------------------------
     Fetch events dynamically
  ---------------------------- */
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    return tagMatch && cityMatch
  })

  /* ---------------------------
     Email handlers
  ---------------------------- */
  const handleSaveEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch('/api/email-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet: address }),
      })
      setEmailStatus(res.ok ? 'Saved' : 'Error saving email')
    } catch (e) {
      setEmailStatus('Error saving email')
    }
    setIsLoadingEmail(false)
  }

  const handleDeleteEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch(`/api/email-optin?wallet=${address}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEmail('')
        setEmailStatus('Deleted')
      }
    } catch (e) {
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
          <div className="absolute inset-0 -z-10 opacity-10 animate-spin-slow pointer-events-none select-none">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="hexagonPattern"
                  x="0"
                  y="0"
                  width="10"
                  height="8.66"
                  patternUnits="userSpaceOnUse"
                >
                  <polygon
                    points="5,0 10,2.89 10,7.77 5,10.66 0,7.77 0,2.89"
                    fill="#ffffff"
                    fillOpacity="0.05"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hexagonPattern)" />
            </svg>
          </div>

          <img src="/tea.png" alt="TEA Project Logo" className="w-24 h-24 object-contain" />
          <h1 className="text-4xl font-bold text-blue-400 text-left">
            WELCOME TO THE TEA NETWORK
          </h1>
          <p className="text-left text-gray-400 mb-6">
            We’re the club for social and/or business meetings. The TEA Network operates in
            the cafe, bar, restaurant domain. Meet connections, enjoy perks, and expand your
            network with Polygon blockchain technology.
          </p>
          <p>
            <a
              href="https://youtu.be/5QSHQ26JMm8"
              className="text-blue-400 hover:underline"
              target="_blank"
            >
              Learn more about the TEA network (Video)
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
            isAdmin ? (
              <AdminSBTManager darkMode={true} />
            ) : (
              <WebAccessSBT darkMode={true} />
            )
          ) : (
            <p className="text-center text-gray-400"></p>
          )}
        </section>

        {/* ---------------- Telegram Info ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">
            We use our own Telegram-bot for onboarding to each event.
          </h2>
          <p className="text-left text-gray-400 mb-6">
            Register that you are joining the specific event through our Telegram-Bot and wait
            for the bot to confirm the event.
          </p>
        </section>

        {/* ---------------- Dynamic Event Grid ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">
            Explore Events
          </h2>

          {/* Filters */}
          <div className="flex gap-4 mb-6 justify-center">
            <select
              className="bg-zinc-800 text-white p-2 rounded"
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">All Tags</option>
              {[...new Set(events.flatMap(e => [e.tag1, e.tag2, e.tag3]).filter(Boolean))].map((tag, i) => (
                <option key={i} value={tag}>{tag}</option>
              ))}
            </select>

            <select
              className="bg-zinc-800 text-white p-2 rounded"
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {[...new Set(events.map(e => e.city))].map((city, i) => (
                <option key={i} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">No events match your filter.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredEvents.map(event => (
                <DynamicEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Wallet Info ---------------- */}
        <div className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-6 border shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-center text-blue-400">
            Web3 Wallet User
          </h2>
          <p className="text-left text-gray-300 mb-4">
            After the event is confirmed with minimum guests, the web3 user has to claim the
            deal and collect the Event Access Card, which serves as a ticket to the real-life
            extended perk at the venue.
          </p>
          <div className="text-center">
            <button
              onClick={() => setShowAmoyInfo(prev => !prev)}
              className="text-blue-400 hover:underline text-sm"
            >
              {showAmoyInfo ? 'Hide Amoy Network Setup' : '📘 How to add Amoy to your wallet'}
            </button>

            {showAmoyInfo && (
              <div className="mt-4 text-sm text-left bg-zinc-800 border border-zinc-600 rounded-lg p-4 max-w-md mx-auto">
                <p className="mb-2">To add the Amoy network to your wallet, start with Add Custom Network:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li><strong>Network Name:</strong> Polygon Amoy Testnet</li>
                  <li><strong>New RPC URL:</strong> https://rpc-amoy.polygon.technology/</li>
                  <li><strong>Chain ID:</strong> 80002</li>
                  <li><strong>Currency Symbol:</strong> POL</li>
                  <li><strong>Block Explorer URL:</strong> https://amoy.polygonscan.com/</li>
                  <li><strong>Polygon Amoy Coins:</strong> contact us to request</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ---------------- TEA Network Info ---------------- */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center space-y-4">
          <h2 className="text-3xl font-bold text-blue-400">TEA NETWORK (EXTENDED INFO):</h2>
          <p className="text-left text-gray-300 mb-4">
            We are a community-driven network designed to unlock real-life perks and expand your network.
          </p>
          <p className="text-left text-gray-300 mb-4">
            TEA NETWORK helps you connect friendships, business, dating — and enjoy discounted drinks. We provide the deal and coordinate between users and partners.
          </p>
          <p className="text-left text-gray-300 mb-4">
            Come alone or bring friends — it’s all open.
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
          <div className="text-center mt-4">
            <button
              onClick={() => setShowFullRoadmap(!showFullRoadmap)}
              className="text-blue-400 hover:underline text-sm"
            >
              {showFullRoadmap ? 'Hide Full Roadmap' : '📜 Show Full Roadmap'}
            </button>
          </div>
          {showFullRoadmap && (
            <div className="mt-6 text-sm space-y-4 text-gray-300">
              {/* Roadmap details */}
              {[
                {
                  title: 'Q2 2025 - Initial R&D',
                  items: [
                    'Initial blockchain architecture planning for Soul Bound Token (SBT).',
                    'Develop smart contracts and JavaScript for SBT interactions.',
                    'Conduct internal audits and ensure coverage.',
                    'Prepare deployment scripts and testing environments.'
                  ]
                },
                {
                  title: 'Q3 2025 - Alpha Trial / MVP',
                  items: [
                    'Deploy on Polygon Amoy Testnet.',
                    'Design Telegram bot and registration system.',
                    'Gather feedback and refine features.',
                    'Prepare for mainnet deployment.'
                  ]
                },
                {
                  title: 'Q4 2025 - Exchanges',
                  items: [
                    'Mainnet smart contracts & audits.',
                    'Launch ERC-20 token.',
                    'Develop partner onboarding strategy.'
                  ]
                },
                {
                  title: 'Q1 2026 - DAO and Organization',
                  items: [
                    'Implement DAO and incentives.',
                    'Integrate payment gateways and POS.',
                    'Finalize QA for full rollout.'
                  ]
                },
                {
                  title: 'Q2 2026 - Community Growth',
                  items: [
                    'Launch growth initiatives.',
                    'Develop mobile app.',
                    'Run marketing campaigns.'
                  ]
                }
              ].map(({ title, items }, idx) => (
                <div key={idx}>
                  <h3 className="text-blue-300 font-semibold">{title}</h3>
                  <ul className="list-disc list-inside ml-4">
                    {items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-6 border shadow-lg mt-10">
          <p className="text-center text-gray-400 text-sm">
            © {new Date().getFullYear()} TEA Network. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  )
}

