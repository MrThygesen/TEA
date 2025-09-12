'use client'
import { useState } from 'react'

export default function LoginModal({ onClose }) {
  const [form, setForm] = useState({ email: '', password: '' })

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    })
  }

  const handleLogin = async () => {
    console.log("📨 Frontend about to send:", form)

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
      /><br />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
      /><br />
      <button onClick={handleLogin}>Login</button>
    </div>
  )
}

