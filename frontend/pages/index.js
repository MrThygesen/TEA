'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'

// ---------------------------
// Dynamic Event Card Component
// ---------------------------
function DynamicEventCard({ event }) {
  const [showModal, setShowModal] = useState(false)
  const telegramLink = `https://t.me/TeaIsHereBot?start=${event.id}`

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow flex flex-col justify-between">
        <img src={event.image_url || '/default-event.jpg'} alt={event.name} className="w-full h-40 object-cover rounded mb-3" />
        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">{event.description?.split(' ').slice(0, 30).join(' ')}...</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">{tag}</span>
          ))}
        </div>
        <div className="flex justify-between items-center mt-auto mb-2">
          <button onClick={() => setShowModal(true)} className="text-blue-400 hover:underline text-sm">Preview</button>
          {(event.registered_users || 0) < event.min_attendees ? (
            <button onClick={() => window.open(telegramLink, '_blank')} className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm">Prebook</button>
          ) : (
            <button onClick={() => window.open(`https://t.me/TeaIsHereBot?start=buy_${event.id}`, '_blank')} className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm">Book</button>
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 {event.registered_users || 0} Users</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{event.name}</h2>
            <img src={event.image_url || '/default-event.jpg'} alt={event.name} className="w-full h-56 object-contain rounded mb-4" />
            <p className="mb-2 text-sm text-gray-400">{new Date(event.datetime).toLocaleString()} @ {event.venue} ({event.venue_type || 'N/A'})</p>
            <p className="mb-4">{event.details}</p>
            {event.basic_perk && <p className="text-sm text-gray-300"><strong>Basic Perk:</strong> {event.basic_perk}</p>}
            {event.paid_count >= 10 && event.advanced_perk && <p className="text-sm text-gray-300"><strong>Advanced Perk:</strong> {event.advanced_perk}</p>}
            <button onClick={() => setShowModal(false)} className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Close</button>
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
  const { isConnected, address } = useAccount()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const [events, setEvents] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [emailFormStatus, setEmailFormStatus] = useState(null)

  // Added states for user auth and list view toggle
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [user, setUser] = useState(null)
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [listView, setListView] = useState(false)

  useEffect(() => {
    fetch('/api/dump').then((res) => res.json()).then(setEvents).catch(() => setEvents([]))
  }, [])

  useEffect(() => {
    const sessionUser = localStorage.getItem('user')
    if (sessionUser) setUser(JSON.parse(sessionUser))
  }, [])

  const filteredEvents = events.filter((e) => {
    const tagMatch = selectedTag ? [e.tag1, e.tag2, e.tag3].includes(selectedTag) : true
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return tagMatch && cityMatch && venueMatch
  })

  const handleLogin = async () => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      })
      if (!res.ok) {
        const err = await res.json()
        setAuthError(err.error || 'Login failed')
        return
      }
      const userData = await res.json()
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      setShowLoginModal(false)
    } catch (e) {
      setAuthError('Login error')
    }
  }

  const handleRegister = async () => {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      })
      if (!res.ok) {
        const err = await res.json()
        setAuthError(err.error || 'Registration failed')
        return
      }
      setShowRegisterModal(false)
      setShowLoginModal(true)
    } catch (e) {
      setAuthError('Registration error')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-3xl space-y-10">
        <header className="relative bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border overflow-hidden">
          <h1 className="text-4xl font-bold text-blue-400 text-left">EDGY EVENT PLATFORM</h1>
          <p className="text-left text-gray-400 mb-6">Our event platform and network is the spot where people, venues, and opportunities meet.</p>
          <div className="flex gap-3 items-center">
            {!user ? (
              <>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition">Login</button>
                <button onClick={() => setShowRegisterModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition">Register</button>
              </>
            ) : (
              <button onClick={handleLogout} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition">Logout {user.username}</button>
            )}
          </div>
          <ConnectButton />
        </header>

        <section>
          {isConnected ? (isAdmin ? <AdminSBTManager darkMode={true} /> : <WebAccessSBT darkMode={true} />) : null}
        </section>

        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <div className="flex justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-400 text-center">Explore Events</h2>
            <button onClick={() => setListView(!listView)} className="text-blue-400 hover:underline text-sm">{listView ? 'Grid View' : 'List View'}</button>
          </div>
          <div className="flex gap-4 mb-6 justify-center">
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedCity(e.target.value)}>
              <option value="">All Cities</option>
              {[...new Set(events.map(e => e.city))].map((city, i) => (
                <option key={i} value={city}>{city}</option>
              ))}
            </select>
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedVenueType(e.target.value)}>
              <option value="">Event Types</option>
              {[...new Set(events.map(e => e.venue_type).filter(Boolean))].map((type, i) => (
                <option key={i} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">No events match your filter.</p>
          ) : listView ? (
            <ul className="divide-y divide-zinc-700">
              {filteredEvents.map(event => (
                <li key={event.id} className="py-2 flex justify-between items-center">
                  <span>{event.venue_type || 'N/A'}</span>
                  <span>{new Date(event.datetime).toLocaleDateString()}</span>
                  <span>{event.name}</span>
                  <span>{event.city}</span>
                  <button onClick={() => window.open(`/event/${event.id}`, '_blank')} className="text-blue-400 hover:underline">Preview</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredEvents.map(event => <DynamicEventCard key={event.id} event={event} />)}
            </div>
          )}
        </section>

        <footer className="bg-zinc-900 border-zinc-700 text-gray-400 rounded-3xl p-6 border shadow-lg text-center space-y-2 transition-colors duration-300">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">GitHub Repository</a></p>
          <p className="text-xs mt-4">&copy; 2025 TEA Project Team</p>
        </footer>
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Login</h2>
            <input type="text" placeholder="Username" className="w-full p-2 mb-2 rounded text-black" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
            <input type="password" placeholder="Password" className="w-full p-2 mb-2 rounded text-black" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
            {authError && <p className="text-red-400 text-sm mb-2">{authError}</p>}
            <button onClick={handleLogin} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Login</button>
          </div>
        </div>
      )}

      {showRegisterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowRegisterModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Register</h2>
            <input type="text" placeholder="Username" className="w-full p-2 mb-2 rounded text-black" value={registerData.username} onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })} />
            <input type="email" placeholder="Email" className="w-full p-2 mb-2 rounded text-black" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
            <input type="password" placeholder="Password" className="w-full p-2 mb-2 rounded text-black" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
            {authError && <p className="text-red-400 text-sm mb-2">{authError}</p>}
            <button onClick={handleRegister} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white">Register</button>
          </div>
        </div>
      )}
    </main>
  )
}

