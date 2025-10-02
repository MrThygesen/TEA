//scanner.js
'use client'
import { useState, useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'

export default function ScannerPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [events, setEvents] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [lastTicket, setLastTicket] = useState(null)
  const [scanCooldown, setScanCooldown] = useState(false)

  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)

  // Load token
  useEffect(() => {
    const token = localStorage.getItem('scanner_token')
    if (token) setLoggedIn(true)
  }, [])

  // Fetch events/registrations
  useEffect(() => {
    if (!loggedIn) return
    const token = localStorage.getItem('scanner_token')
    fetch('/api/scan', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setEvents(data.events || [])
        setRegistrations(data.registrations || [])
      })
      .catch(err => console.error('Event load error:', err))
  }, [loggedIn])

  // QR Scanner
  useEffect(() => {
    if (!loggedIn || !videoRef.current) return
    codeReaderRef.current = new BrowserMultiFormatReader()
    codeReaderRef.current
      .decodeFromVideoDevice(null, videoRef.current, async (result) => {
        if (result && !scanCooldown) {
          setScanCooldown(true)
          const code = result.getText()
          setLastTicket(code)
          await handleScan(code)
        }
      })
      .catch(err => console.error('Camera error:', err))
    return () => codeReaderRef.current?.reset()
  }, [loggedIn, selectedEvent])

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
      if (!ticketCode) {
        setStatus('❌ No ticket selected or scanned yet')
        return
      }

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
      setStatus(`${action}: ${data.status}`)

      // update table locally
      setRegistrations(prev =>
        prev.map(r => (r.ticket_code === ticketCode ? { ...r, ...data } : r))
      )
    } catch (err) {
      setStatus(`❌ ${err.message}`)
    } finally {
      setTimeout(() => setScanCooldown(false), 2000)
    }
  }

  async function handleScan(ticketCode) {
    setStatus('Checking ticket...')
    await handleAction(ticketCode, 'arrive')
  }

  function handleLogout() {
    localStorage.removeItem('scanner_token')
    setLoggedIn(false)
    setEmail('')
    setPassword('')
    setStatus('')
    setLastTicket(null)
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-zinc-900 p-6 rounded-lg shadow-md w-80 flex flex-col gap-3">
          <h2 className="text-xl font-bold mb-2">Organizer Login</h2>
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} className="p-2 rounded bg-zinc-800 text-white" required />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} className="p-2 rounded bg-zinc-800 text-white" required />
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 rounded p-2 text-white">Log In</button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </main>
    )
  }

  // Filter registrations for selected event
  const eventRegistrations = selectedEvent
    ? registrations.filter(r => r.event_id === selectedEvent)
    : []

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Organizer Dashboard</h1>
        <button onClick={handleLogout} className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600">
          Log out
        </button>
      </div>

      {/* Event selector */}
      <div className="mb-4">
        <label className="mr-2">Select Event:</label>
        <select
          className="bg-zinc-800 text-white p-2 rounded"
          value={selectedEvent || ''}
          onChange={e => setSelectedEvent(Number(e.target.value))}
        >
          <option value="">-- Choose Event --</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name} ({new Date(ev.datetime).toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* QR Scanner */}
          <div className="mb-4">
            <video ref={videoRef} className="w-full max-w-md rounded border border-zinc-700" autoPlay muted playsInline />
            <p className="mt-2">{status}</p>
          </div>

          {/* Action buttons for last scanned ticket */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => handleAction(lastTicket, 'arrive')}
              className="flex-1 bg-green-600 py-3 rounded text-xl"
            >
              Arrival
            </button>
            <button
              onClick={() => handleAction(lastTicket, 'perk1')}
              className="flex-1 bg-blue-600 py-3 rounded text-xl"
            >
              Perk1
            </button>
            <button
              onClick={() => handleAction(lastTicket, 'perk2')}
              className="flex-1 bg-purple-600 py-3 rounded text-xl"
            >
              Perk2
            </button>
          </div>

          {/* Guest list */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Arrival</th>
                <th className="p-2">Perk1</th>
                <th className="p-2">Perk2</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventRegistrations.map(reg => (
                <tr key={reg.id} className="border-b border-zinc-700">
                  <td className="p-2">{reg.username || '—'}</td>
                  <td className="p-2">{reg.email || '—'}</td>
                  <td className="p-2">{reg.has_arrived ? '✔' : '❌'}</td>
                  <td className="p-2">{reg.basic_perk_applied ? '✔' : '❌'}</td>
                  <td className="p-2">{reg.advanced_perk_applied ? '✔' : '❌'}</td>
                  <td className="p-2 flex gap-2">
                    <button onClick={() => handleAction(reg.ticket_code, 'arrive')} className="bg-green-600 px-2 py-1 rounded">Arrival</button>
                    <button onClick={() => handleAction(reg.ticket_code, 'perk1')} className="bg-blue-600 px-2 py-1 rounded">Perk1</button>
                    <button onClick={() => handleAction(reg.ticket_code, 'perk2')} className="bg-purple-600 px-2 py-1 rounded">Perk2</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  )
}

