'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'

export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  // States
  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)
  const [listView, setListView] = useState(false)
  const [user, setUser] = useState(null)
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')

  // Fetch events
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // Check local user session
  useEffect(() => {
    const sessionUser = localStorage.getItem('user')
    if (sessionUser) {
      setUser(JSON.parse(sessionUser))
    }
  }, [])

  // Filtered events
  const filteredEvents = events.filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return cityMatch && venueMatch
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
        setLoginError(err.error || 'Login failed')
        return
      }
      const userData = await res.json()
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      setShowLoginModal(false)
    } catch (e) {
      setLoginError('Login error')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-3xl space-y-10">
        {/* Header */}
        <header className="bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border overflow-hidden relative">
          <h1 className="text-4xl font-bold text-blue-400 text-left">EDGY EVENT PLATFORM</h1>
          <p className="text-left text-gray-400 mb-6">
            Our event platform connects people, venues, and opportunities. Register to start booking events.
          </p>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition"
            >
              {user ? `Hello, ${user.username}` : 'Login / Register'}
            </button>
          </div>
        </header>

        {/* Admin SBT Section */}
        <section>
          {isConnected ? (
            isAdmin ? <AdminSBTManager darkMode={true} /> : <WebAccessSBT darkMode={true} />
          ) : null}
        </section>

        {/* Event List/Grid Toggle */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <div className="flex justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-400">Explore Events</h2>
            <button
              onClick={() => setListView(!listView)}
              className="text-sm text-blue-400 hover:underline"
            >
              {listView ? 'Switch to Grid View' : 'Switch to List View'}
            </button>
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
                  <button
                    onClick={() => window.open(`/event/${event.id}`, '_blank')}
                    className="text-blue-400 hover:underline"
                  >
                    Preview
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {filteredEvents.map(event => (
                <div key={event.id} className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow flex flex-col justify-between">
                  <img
                    src={event.image_url || '/default-event.jpg'}
                    alt={event.name}
                    className="w-full h-40 object-cover rounded mb-3"
                  />
                  <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
                  <p className="text-sm mb-2">{event.description?.split(' ').slice(0, 30).join(' ')}...</p>
                  <button
                    onClick={() => window.open(`/event/${event.id}`, '_blank')}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer with wallet link */}
        <footer className="bg-zinc-900 border-zinc-700 text-gray-400 rounded-3xl p-6 border shadow-lg text-center space-y-2 transition-colors duration-300">
          <p>
            <button onClick={() => document.querySelector('.rk-connect-button').click()} className="text-blue-400 hover:underline">
              Admin Connect Wallet
            </button>
          </p>
          <p>&copy; 2025 TEA Project Team</p>
        </footer>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">User Login</h2>
            {user ? (
              <div className="space-y-3">
                <p className="text-green-400">Logged in as {user.username}</p>
                <button onClick={handleLogout} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white">
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="text" className="w-full p-2 rounded text-black" placeholder="Username" value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
                <input type="password" className="w-full p-2 rounded text-black" placeholder="Password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
                <button onClick={handleLogin} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">
                  Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

