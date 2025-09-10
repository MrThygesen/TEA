'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { auth } from '../lib/auth'   // <-- import our helper
import LoginModal from './LoginModal'

export default function UserDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [tickets, setTickets] = useState([])
  const [prebooked, setPrebooked] = useState([])
  const [editMode, setEditMode] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [compactView, setCompactView] = useState(false)

  // On mount, check if user is logged in
  useEffect(() => {
    if (auth.isLoggedIn()) {
      setUser(auth.getUser())   // pull user from JWT
    }
  }, [])

  // Fetch tickets + prebooked once user is set
  useEffect(() => {
    if (!user) return

    async function fetchData() {
      try {
        const ticketRes = await auth.fetchWithAuth(`/api/tickets`)
        const ticketData = await ticketRes.json()
        setTickets(ticketData.tickets || [])

        const prebookRes = await auth.fetchWithAuth(`/api/registrations`)
        const prebookData = await prebookRes.json()
        setPrebooked(prebookData.registrations || [])
      } catch (err) {
        console.error('Error fetching user events:', err)
      }
    }

    fetchData()
  }, [user])

  // When login succeeds, store token + user
  const handleLoginSuccess = (data) => {
    if (data.token) {
      auth.setToken(data.token, data.user)
      setUser(data.user)
      setUsername(data.user.username)
      setEmail(data.user.email)
    }
  }

  const handleSave = async () => {
    try {
      const res = await auth.fetchWithAuth('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        auth.setToken(auth.getToken(), data.user) // update local storage
        setEditMode(false)
      } else {
        alert(data.error || 'Update failed')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Logout handler
  const handleLogout = () => {
    auth.logout()
    setUser(null)
    setTickets([])
    setPrebooked([])
  }

  // If no user → show login button
  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowLogin(true)}
          className="bg-blue-600 text-white p-2 rounded"
        >
          Login
        </button>
        {showLogin && (
          <LoginModal
            onClose={() => setShowLogin(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-blue-400">
        Welcome, {user.username}
      </h2>

      <button
        onClick={handleLogout}
        className="mb-4 bg-red-600 p-2 rounded text-white"
      >
        Logout
      </button>

      {/* User Info */}
      <div className="mb-6 p-4 bg-zinc-800 rounded">
        {editMode ? (
          <>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mb-2 p-2 rounded w-full text-black"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-2 p-2 rounded w-full text-black"
            />
            <button
              onClick={handleSave}
              className="bg-green-600 p-2 rounded text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="ml-2 bg-gray-600 p-2 rounded text-white"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <p>Username: {user.username}</p>
            <p>Email: {user.email}</p>
            <p>Role: {user.role}</p>
            <button
              onClick={() => setEditMode(true)}
              className="mt-2 bg-blue-600 p-2 rounded text-white"
            >
              Edit Info
            </button>
          </>
        )}
      </div>

      {/* Tickets */}
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2 text-blue-400">Your Tickets</h3>
        {tickets.length === 0 ? (
          <p>No tickets yet.</p>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="p-2 mb-2 bg-zinc-800 rounded">
              <p>{t.name}</p>
              <p>Date: {new Date(t.datetime).toLocaleString()}</p>
              <p>Ticket Code: {t.ticketCode}</p>
            </div>
          ))
        )}
      </div>

      {/* Prebooked Events */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-blue-400">Prebooked Events</h3>
          <button
            onClick={() => setCompactView(!compactView)}
            className="bg-blue-600 p-1 rounded text-white text-sm"
          >
            {compactView ? 'Grid View' : 'Compact View'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {prebooked.length === 0 ? (
            <p>No prebooked events.</p>
          ) : (
            prebooked.map((e) => (
              <div
                key={e.id}
                className="p-2 bg-zinc-800 rounded flex flex-col md:flex-row justify-between items-start md:items-center"
              >
                {compactView ? (
                  <p>
                    {e.venue_type} | {new Date(e.datetime).toLocaleDateString()} |{' '}
                    {e.name} | {e.city} | Preview
                  </p>
                ) : (
                  <>
                    <p>Name: {e.name}</p>
                    <p>City: {e.city}</p>
                    <p>Date: {new Date(e.datetime).toLocaleString()}</p>
                    <p>Venue Type: {e.venue_type}</p>
                    <p>Status: {e.is_confirmed ? 'Confirmed' : 'Idle'}</p>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

