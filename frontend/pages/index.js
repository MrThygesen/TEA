'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'

/* ---------------------------
   Helpers: Auth persistence
---------------------------- */
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('edgy_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}
function saveAuth(user) {
  try { localStorage.setItem('edgy_auth_user', JSON.stringify(user)) } catch (_) {}
}
function clearAuth() {
  try { localStorage.removeItem('edgy_auth_user') } catch (_) {}
}

export default function Home() {
  const { isConnected, address } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)
  useEffect(() => {
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const email = form.get('email')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!email || !password) return setAuthError('Please enter email and password.')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return setAuthError(data.error || 'Login failed')
      setAuthUser(data.user)
      saveAuth(data.user)
      setShowLoginModal(false)
    } catch (_) {
      setAuthError('Network error')
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const username = form.get('username')?.toString().trim()
    const email = form.get('email')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!username || !email || !password) return setAuthError('All fields are required.')
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })
      const data = await res.json()
      if (!res.ok) return setAuthError(data.error || 'Sign up failed')
      setAuthUser(data.user)
      saveAuth(data.user)
      setShowSignupModal(false)
    } catch (_) {
      setAuthError('Network error')
    }
  }

  function handleLogout() {
    clearAuth()
    setAuthUser(null)
    setShowAccountModal(false)
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-5xl space-y-10">

        {/* ========================= */}
        {/* Header / Intro Section */}
        {/* ========================= */}
        <header className="bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 text-center">
          <h1 className="text-4xl font-bold text-blue-400">EDGY EVENT PLATFORM</h1>
          <p className="mt-4 text-gray-400">Where people, venues, and opportunities meet.</p>

          {/* Account controls */}
          <div className="mt-6 flex justify-center gap-3">
            {!authUser ? (
              <>
                <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700">Create account</button>
                <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600">Log in</button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700"
                >
                  Your Account
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ========================= */}
        {/* Concept / Explainer Boxes */}
        {/* ========================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-800 p-6 rounded-2xl text-center">
            <h3 className="font-bold text-lg">Concept 1</h3>
            <p className="mt-2 text-gray-300">Explanation of concept one.</p>
          </div>
          <div className="bg-zinc-800 p-6 rounded-2xl text-center">
            <h3 className="font-bold text-lg">Concept 2</h3>
            <p className="mt-2 text-gray-300">Explanation of concept two.</p>
          </div>
          <div className="bg-zinc-800 p-6 rounded-2xl text-center">
            <h3 className="font-bold text-lg">Concept 3</h3>
            <p className="mt-2 text-gray-300">Explanation of concept three.</p>
          </div>
        </section>

        {/* ========================= */}
        {/* Dynamic Event Cards */}
        {/* ========================= */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Assuming you have an array `events` from props or state */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-800 p-4 rounded-2xl shadow-md">
              <h4 className="font-bold text-lg">Event #{i + 1}</h4>
              <p className="text-gray-300 mt-2">Details about event #{i + 1}</p>
            </div>
          ))}
        </section>

        {/* ========================= */}
        {/* Footer with Wallet */}
        {/* ========================= */}
        <footer className="bg-zinc-900 border-zinc-700 rounded-3xl p-6 text-center text-gray-400 mt-auto">
          <p>&copy; 2025 TEA Project Team</p>
          <div className="mt-3">
            <ConnectButton />
            {isAdmin && <p className="text-xs mt-1">Connected as admin: {address}</p>}
          </div>
        </footer>
      </div>

      {/* ========================= */}
      {/* Modals */}
      {/* ========================= */}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Log in</h2>
            <form onSubmit={handleLogin} className="space-y-3">
              <input name="email" type="email" placeholder="Email" className="w-full p-2 rounded text-black" />
              <input name="password" type="password" placeholder="Password" className="w-full p-2 rounded text-black" />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowLoginModal(false)} className="px-3 py-2 rounded bg-zinc-700">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">Log in</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowSignupModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Create account</h2>
            <form onSubmit={handleSignup} className="space-y-3">
              <input name="username" placeholder="Username" className="w-full p-2 rounded text-black" />
              <input name="email" type="email" placeholder="Email" className="w-full p-2 rounded text-black" />
              <input name="password" type="password" placeholder="Password" className="w-full p-2 rounded text-black" />
              {authError && <p className="text-red-400 text-sm">{authError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowSignupModal(false)} className="px-3 py-2 rounded bg-zinc-700">Cancel</button>
                <button type="submit" className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">Sign up</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && authUser && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowAccountModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Your Account</h2>
            <p><strong>Username:</strong> {authUser.username}</p>
            <p><strong>Email:</strong> {authUser.email}</p>
            <div className="flex justify-end mt-4">
              <button onClick={handleLogout} className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600">Log out</button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}

