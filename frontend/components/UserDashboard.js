'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import auth from '../components/auth'
import LoginModal from './LoginModal'

// --- Simple reusable Modal ---
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 text-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-300 hover:text-white"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold mb-4 text-blue-400">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export default function UserDashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)

  const [tickets, setTickets] = useState([])
  const [prebooked, setPrebooked] = useState([])

  const [modalType, setModalType] = useState(null) // 'profile' | 'tickets' | 'prebooked'

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  // === On mount: read token + user from auth/localStorage ===
  useEffect(() => {
    if (auth.isLoggedIn()) {
      try {
        const u = auth.getUser()
        if (u) {
          setUser(u)
          setUsername(u.username || '')
          setEmail(u.email || '')
        }
      } catch (err) {
        console.error('Failed to parse stored user:', err)
        auth.logout()
      }
    }
  }, [])

  // === Fetch tickets + prebooked when user is available ===
  useEffect(() => {
    if (!user) return

    async function fetchData() {
      try {
        const ticketRes = await auth.fetchWithAuth('/api/tickets')
        const ticketData = await ticketRes.json()
        setTickets(ticketData?.tickets || [])

        const prebookRes = await auth.fetchWithAuth('/api/registrations')
        const prebookData = await prebookRes.json()
        setPrebooked(prebookData?.registrations || [])
      } catch (err) {
        console.error('Error fetching user events:', err)
      }
    }

    fetchData()
  }, [user])

  // === When login succeeds ===
  const handleLoginSuccess = (data) => {
    if (data.token) {
      auth.setToken(data.token, data.user)
      setUser(data.user)
      setUsername(data.user.username || '')
      setEmail(data.user.email || '')
      setShowLogin(false)
    }
  }

  // === Profile update ===
  const handleSaveProfile = async () => {
    try {
      const res = await auth.fetchWithAuth('/api/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      })
      const data = await res.json()
      if (res.ok) {
        setUser(data.user)
        auth.setToken(auth.getToken(), data.user)
        setModalType(null)
      } else {
        alert(data.error || 'Update failed')
      }
    } catch (err) {
      console.error(err)
      alert('Network error while updating profile')
    }
  }

  const handleLogout = () => {
    auth.logout()
    setUser(null)
    setTickets([])
    setPrebooked([])
    router.replace('/login')
  }

  // === If no user: show login modal ===
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

  // === Dashboard view when logged in ===
  return (
    <div className="p-6 text-white">
      <h2 className="text-3xl font-bold mb-6 text-blue-400">
        Welcome, {user.username}
      </h2>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setModalType('profile')}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Profile
        </button>
        <button
          onClick={() => setModalType('tickets')}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Tickets
        </button>
        <button
          onClick={() => setModalType('prebooked')}
          className="bg-purple-600 px-4 py-2 rounded"
        >
          Prebooked
        </button>
        <button
          onClick={handleLogout}
          className="bg-red-600 px-4 py-2 rounded ml-auto"
        >
          Logout
        </button>
      </div>

      {/* Profile Modal */}
      <Modal
        open={modalType === 'profile'}
        onClose={() => setModalType(null)}
        title="Your Profile"
      >
        <div className="flex flex-col gap-3">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 text-black rounded"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 text-black rounded"
            />
          </label>
          <p>Role: {user.role}</p>
          <div className="flex gap-2">
            <button
              onClick={handleSaveProfile}
              className="bg-green-600 px-4 py-2 rounded"
            >
              Save
            </button>
            <button
              onClick={() => setModalType(null)}
              className="bg-gray-600 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Tickets Modal */}
      <Modal
        open={modalType === 'tickets'}
        onClose={() => setModalType(null)}
        title="Your Tickets"
      >
        {tickets.length === 0 ? (
          <p>No tickets yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tickets.map((t) => (
              <div key={t.id} className="p-3 bg-zinc-800 rounded">
                <p className="font-bold">{t.name}</p>
                <p>Date: {new Date(t.datetime).toLocaleString()}</p>
                <p>Ticket Code: {t.ticketCode}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Prebooked Modal */}
      <Modal
        open={modalType === 'prebooked'}
        onClose={() => setModalType(null)}
        title="Prebooked Events"
      >
        {prebooked.length === 0 ? (
          <p>No prebooked events.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {prebooked.map((e) => (
              <div key={e.id} className="p-3 bg-zinc-800 rounded">
                <p className="font-bold">{e.name}</p>
                <p>City: {e.city}</p>
                <p>Date: {new Date(e.datetime).toLocaleString()}</p>
                <p>Venue: {e.venue_type}</p>
                <p>Status: {e.is_confirmed ? '✅ Confirmed' : '⌛ Idle'}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

