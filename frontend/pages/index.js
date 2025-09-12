// pages/index.js
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

// === Reusable Modal ===
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-lg max-w-2xl w-full p-6 overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-2xl font-semibold mb-6 text-blue-400">{title}</h2>}
        {children}
        <button
          onClick={onClose}
          className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// === Login Modal ===
function LoginModal({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.user)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Login">
      <form onSubmit={handleLogin} className="space-y-4">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded text-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white w-full"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </Modal>
  )
}

// === Register Modal ===
function RegisterModal({ open, onClose }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setMessage('✅ Check your email to verify your account.')
    } catch (err) {
      setMessage(`❌ ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register">
      <form onSubmit={handleRegister} className="space-y-4">
        {message && <p className="text-sm">{message}</p>}
        <input
          type="text"
          placeholder="Username"
          className="w-full p-2 rounded text-black"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded text-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white w-full"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </Modal>
  )
}

// === User Account Modal ===
function UserAccountModal({ open, onClose, user, onLogout }) {
  return (
    <Modal open={open} onClose={onClose} title="Your Account">
      <div className="space-y-4">
        <p>
          <span className="font-semibold">Username:</span> {user?.username}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {user?.email}
        </p>
        <button
          onClick={() => {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            onLogout()
            onClose()
          }}
          className="mt-4 px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white w-full"
        >
          Logout
        </button>
      </div>
    </Modal>
  )
}

// === Main Page ===
export default function Home() {
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🎫 Edgy Events</h1>
        <div className="space-x-2">
          {!user ? (
            <>
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Login
              </button>
              <button
                onClick={() => setShowRegister(true)}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
              >
                Register
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowAccount(true)}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
              >
                Your Account
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <p className="text-gray-300">
          Welcome to the demo event system. Use the buttons above to register or log in.
        </p>
      </main>

      {/* Modals */}
      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} onLogin={setUser} />
      <RegisterModal open={showRegister} onClose={() => setShowRegister(false)} />
      <UserAccountModal
        open={showAccount}
        onClose={() => setShowAccount(false)}
        user={user}
        onLogout={() => setUser(null)}
      />
    </div>
  )
}

