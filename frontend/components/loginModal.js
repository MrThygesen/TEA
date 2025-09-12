'use client'

import { useState, useContext } from 'react'
import { useRouter } from 'next/router'
import { UserContext } from '../context/UserContext'

export default function LoginModal({ onClose }) {
  const router = useRouter()
  const { setUser } = useContext(UserContext)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('🔹 Submitting login fetch', { email, password })

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log('🟢 Server response:', data)

      if (!res.ok) throw new Error(data.error || 'Login failed')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      onClose()
      router.push('/')
    } catch (err) {
      console.error('❌ Login failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#111', padding: '2rem', borderRadius: '1rem', width: '300px' }}>
        <h2 style={{ marginBottom: '1rem', color: '#4f46e5' }}>Login</h2>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem' }}
          />
          {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.5rem', background: '#4f46e5', color: 'white' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <button onClick={onClose} style={{ marginTop: '0.5rem', width: '100%', padding: '0.5rem', background: '#333', color: 'white' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

