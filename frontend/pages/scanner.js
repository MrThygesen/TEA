'use client'

import { useState, useEffect } from 'react'
import { useZxing } from 'react-zxing'

export default function ScannerPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [scanCooldown, setScanCooldown] = useState(false)

  // Load token from localStorage
  useEffect(() => {
    const token = localStorage.getItem('scanner_token')
    if (token) setLoggedIn(true)
  }, [])

  const { ref: videoRef } = useZxing({
    onDecodeResult: async (result) => {
      if (!scanCooldown) {
        setScanCooldown(true)
        await handleScan(result.getText())
      }
    },
    constraints: { video: { facingMode: 'environment' } },
  })

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('scanner_token', data.token)
      setLoggedIn(true)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleScan(ticketCode) {
    setStatus('Checking ticket...')
    try {
      const token = localStorage.getItem('scanner_token')
      if (!token) throw new Error('Not authenticated')

      // Mark arrival
      let res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_code: ticketCode, action: 'arrive' }),
      })
      let data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')

      setStatus(`Arrival: ${data.status}`)

      // Apply perk
      res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_code: ticketCode, action: 'perk' }),
      })
      data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Perk failed')

      setStatus((prev) => prev + ` | Perk: ${data.status}`)
    } catch (err) {
      console.error(err)
      setStatus(`❌ ${err.message}`)
    } finally {
      // wait 2s before scanning next QR
      setTimeout(() => setScanCooldown(false), 2000)
    }
  }

  function handleLogout() {
    localStorage.removeItem('scanner_token')
    setLoggedIn(false)
    setEmail('')
    setPassword('')
    setStatus('')
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="bg-zinc-900 p-6 rounded-lg shadow-md w-80 flex flex-col gap-3"
        >
          <h2 className="text-xl font-bold mb-2">Scanner Login</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 rounded p-2 text-white"
          >
            Log In
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-4">QR Scanner</h1>
      <video
        ref={videoRef}
        className="w-full max-w-md rounded border border-zinc-700"
        autoPlay
        muted
        playsInline
      />
      <p className="mt-4 text-lg">{status}</p>
      <button
        onClick={handleLogout}
        className="mt-6 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
      >
        Log out
      </button>
    </main>
  )
}
