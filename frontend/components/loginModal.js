'use client'
import { useState } from 'react'

export default function LoginModal({ onClose }) {
  const [form, setForm] = useState({ email: '', password: '' })

  const handleInput = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
    console.log("✏️ Input:", e.target.name, "→", e.target.value)
  }

  const handleLogin = async () => {
    console.log("📨 Frontend sending:", form)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
        value={form.email}
        onInput={handleInput}
        autoComplete="email"
      /><br />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={form.password}
        onInput={handleInput}
        autoComplete="current-password"
      /><br />
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

