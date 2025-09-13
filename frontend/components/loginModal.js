'use client'

import { useState } from 'react'

export default function LoginModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    console.log('📩 Modal sending:', { email, password })

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log('🟢 Modal server response:', data)

      if (!res.ok) throw new Error(data.error || 'Login failed')

      alert('✅ Login success!')
      if (onClose) onClose()
    } catch (err) {
      console.error('❌ Modal login failed:', err)
      setError(err.message)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        padding: '1rem',
        borderRadius: '8px',
        width: '300px'
      }}>
        <h2>Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              console.log('✏️ Email input:', e.target.value)
              setEmail(e.target.value)
            }}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              console.log('✏️ Password input:', e.target.value)
              setPassword(e.target.value)
            }}
            required
            style={{ display: 'block', marginBottom: '0.5rem', width: '100%' }}
          />
          <button type="submit" style={{ width: '100%' }}>Login</button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={onClose} style={{ marginTop: '0.5rem', width: '100%' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

