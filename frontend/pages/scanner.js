// pages/scanner.js
'use client'
import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function ScannerPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [scanCooldown, setScanCooldown] = useState(false)
  const [guestList, setGuestList] = useState([]) // ✅ Track scanned guests
  const [lastTicket, setLastTicket] = useState(null) // ✅ Last scanned ticket

  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)

  // Load token
  useEffect(() => {
    const token = localStorage.getItem('scanner_token')
    if (token) setLoggedIn(true)
  }, [])

  // Initialize scanner after mount
  useEffect(() => {
    if (!loggedIn || !videoRef.current) return
    codeReaderRef.current = new BrowserMultiFormatReader()
    codeReaderRef.current
      .decodeFromVideoDevice(null, videoRef.current, async (result) => {
        if (result && !scanCooldown) {
          setScanCooldown(true)
          await handleScan(result.getText())
        }
      })
      .catch((err) => console.error('Camera error:', err))
    return () => codeReaderRef.current?.reset()
  }, [loggedIn])

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

  async function handleAction(ticketCode, action) {
    try {
      const token = localStorage.getItem('scanner_token')
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_code: ticketCode, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')

      setStatus(`${action.toUpperCase()}: ${data.status}`)
      setLastTicket(ticketCode)

      // ✅ Update guest list
      setGuestList((prev) => {
        const existing = prev.find((g) => g.ticket_code === data.ticket_code)
        if (existing) {
          return prev.map((g) =>
            g.ticket_code === data.ticket_code ? { ...g, ...data } : g
          )
        } else {
          return [...prev, data]
        }
      })
    } catch (err) {
      console.error(err)
      setStatus(`❌ ${err.message}`)
    } finally {
      setTimeout(() => setScanCooldown(false), 2000)
    }
  }

  async function handleScan(ticketCode) {
    // by default just arrival on scan
    await handleAction(ticketCode, 'arrive')
  }

  function handleLogout() {
    localStorage.removeItem('scanner_token')
    setLoggedIn(false)
    setEmail('')
    setPassword('')
    setStatus('')
    setGuestList([])
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-6 rounded-lg shadow-md w-80 flex flex-col gap-3">
          <h2 className="text-xl font-bold mb-2">Scanner Login</h2>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="p-2 rounded bg-zinc-800 text-white" required />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 rounded p-2 text-white">Log In</button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Organizer Dashboard</h1>
      <video ref={videoRef} className="w-full max-w-md rounded border border-zinc-700" autoPlay muted playsInline />

      {/* Action Buttons */}
      {lastTicket && (
        <div className="flex gap-4 mt-4">
          <button onClick={() => handleAction(lastTicket, 'arrive')} className="px-6 py-3 bg-green-600 rounded text-white text-lg font-bold">
            Arrival
          </button>
          <button onClick={() => handleAction(lastTicket, 'perk')} className="px-6 py-3 bg-blue-600 rounded text-white text-lg font-bold">
            Perk1
          </button>
          <button onClick={() => handleAction(lastTicket, 'perk2')} className="px-6 py-3 bg-purple-600 rounded text-white text-lg font-bold">
            Perk2
          </button>
        </div>
      )}

      <p className="mt-4 text-lg">{status}</p>

      {/* Guestlist */}
      <div className="mt-8 w-full max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Guest List</h2>
        <table className="w-full border border-zinc-700 text-left text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Arrival</th>
              <th className="p-2">Perk1</th>
              <th className="p-2">Perk2</th>
            </tr>
          </thead>
          <tbody>
            {guestList.map((g) => (
              <tr key={g.ticket_code} className="border-t border-zinc-700">
                <td className="p-2">{g.username || '-'}</td>
                <td className="p-2">{g.email || '-'}</td>
                <td className="p-2">{g.has_arrived ? '✅' : ''}</td>
                <td className="p-2">{g.basic_perk_applied ? '✅' : ''}</td>
                <td className="p-2">{g.advanced_perk_applied ? '✅' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={handleLogout} className="mt-6 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600">Log out</button>
    </main>
  )
}



/*
//pages/scanner.js
'use client'
import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function ScannerPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [scanCooldown, setScanCooldown] = useState(false)

  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)

  // Load token
  useEffect(() => {
    const token = localStorage.getItem('scanner_token')
    if (token) setLoggedIn(true)
  }, [])

  // Initialize scanner after mount
  useEffect(() => {
    if (!loggedIn || !videoRef.current) return

    codeReaderRef.current = new BrowserMultiFormatReader()
    codeReaderRef.current
      .decodeFromVideoDevice(
        null, // use default camera
        videoRef.current,
        async (result, err) => {
          if (result && !scanCooldown) {
            setScanCooldown(true)
            await handleScan(result.getText())
          }
        }
      )
      .catch((err) => console.error('Camera error:', err))

    return () => {
      codeReaderRef.current?.reset()
    }
  }, [loggedIn])

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

      // Arrival
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

      // Perk
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

*/
