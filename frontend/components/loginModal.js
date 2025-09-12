'use client'
import { useState } from 'react'

export default function LoginModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    console.log("📨 Frontend about to send:", { email, password })

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    console.log("📬 Response:", data)

    if (res.ok) {
      alert("✅ Login OK: " + JSON.stringify(data))
      onClose?.()
    } else {
      alert("❌ Login failed: " + data.error)
    }
  }

  return (
    <div style={{ padding: 20, border: '1px solid gray' }}>
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      /><br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      /><br />
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

