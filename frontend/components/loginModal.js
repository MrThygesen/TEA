'use client'

import { useState } from 'react'

export default function LoginModal({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('🔹 Modal submitting login fetch', { email, password })

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log('🟢 Modal server response:', data)

      if (!res.ok) throw new Error(data.error || 'Login failed')

      if (onLoginSuccess) onLoginSuccess(data) // pass token + user up
      onClose() // close modal after success
    } catch (err) {
      console.error('❌ Modal login failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          width: '320px',
          maxWidth: '90%',
        }}
      >
        <h2 style={{ marginBottom: '1rem' }}>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              width: '100%',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              padding: '0.5rem',
              width: '100%',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem',
              width: '100%',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
        <button
          onClick={onClose}
          style={{
            marginTop: '1rem',
            padding: '0.5rem',
            width: '100%',
            border: '1px solid #ccc',
            background: 'white',
            borderRadius: '4px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

