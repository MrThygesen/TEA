'use client'
import { useState } from 'react'

export default function LoginModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    console.log("📨 Frontend sending:", { email, password })

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log("📬 Response:", data)

      if (res.ok) {
        alert("✅ Login OK")
        onClose?.()
      } else {
        alert("❌ Login failed: " + data.error)
      }
    } catch (err) {
      console.error("🚨 Fetch error:", err)
      alert("Network error, check console")
    }
  }

  return (
    <div style={{ padding: 20, border: '1px solid gray' }}>
      <h2>Login</h2>
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={email}
        onChange={(e) => {
          console.log("✏️ Email typed:", e.target.value)
          setEmail(e.target.value)
        }}
        autoComplete="email"
      /><br />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={password}
        onChange={(e) => {
          console.log("✏️ Password typed:", e.target.value)
          setPassword(e.target.value)
        }}
        autoComplete="current-password"
      /><br />
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

