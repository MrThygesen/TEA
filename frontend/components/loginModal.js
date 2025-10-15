//loginModal.js
'use client'

import { useState } from 'react'

export default function LoginModal({ onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log('Login response:', data)

      if (!res.ok) throw new Error(data.error || 'Login failed')

      // Save JWT token
localStorage.setItem('token', data.token)
localStorage.setItem('user_role', data.user?.role || 'user')
localStorage.setItem('user_email', data.user?.email || '')


      if (onLogin) onLogin(data) // pass user/token back to parent
      if (onClose) onClose()
    } catch (err) {
      console.error('Login failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', width: '300px' }}>
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
          />
          <button type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
        <button onClick={onClose} style={{ marginTop: '0.5rem', width: '100%' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

