'use client'

import { useState } from 'react'
import { useRouter } from 'next/router'

export default function LoginModal({ onClose, onLoginSuccess }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
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

      // ✅ Save JWT + user
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      if (onLoginSuccess) onLoginSuccess(data)

      onClose()
      router.push('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4 text-blue-400">Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 p-2 rounded text-black"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-3 p-2 rounded text-black"
        />
        {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full bg-zinc-700 hover:bg-zinc-600 text-white p-2 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

