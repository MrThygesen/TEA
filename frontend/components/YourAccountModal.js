//components/YourAccountModal.js
'use client'

import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import Link from 'next/link'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeQR, setActiveQR] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('Not logged in')

        const res = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()

        setProfile(data.profile ?? null)
        const userTickets = Array.isArray(data.tickets) ? data.tickets : []

        // Fallback ticket_code
        userTickets.forEach(t => {
          if (!t.ticket_code && t.event_id && data.profile?.id) {
            t.ticket_code = `ticket:${t.event_id}:${data.profile.id}`
          }
        })

        setTickets(userTickets)

        // Fetch RSVPs
        const rsvpRes = await fetch('/api/user/rsvps', { headers: { Authorization: `Bearer ${token}` } })
        if (!rsvpRes.ok) throw new Error('Failed to load RSVPs')
        const rsvpData = await rsvpRes.json()

        const ticketEventIds = new Set(userTickets.map(t => t.event_id))
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 1)

        const filteredRsvps = (Array.isArray(rsvpData) ? rsvpData : []).filter(r => {
          if (ticketEventIds.has(r.event_id)) return false
          return new Date(r.date) >= cutoff
        })

        setRsvps(filteredRsvps)
      } catch (err) {
        console.error('❌ Failed to load account:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [refreshTrigger])

  if (loading || error) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
          {loading && <p data-translate>Loading your account...</p>}
          {error && (
            <>
              <p className="text-red-600 mb-4" data-translate>Error: {error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
                data-translate
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-6xl w-full p-6 text-white relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-6 text-blue-400" data-translate>Your Account</h2>

        {profile && (
          <>
            {/* Profile Info */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-800 p-4 rounded-lg border border-zinc-700">
              {['username', 'email', 'wallet_address', 'city', 'tier', 'role'].map((key) => (
                <p key={key}>
                  <span className="font-semibold text-gray-300" data-translate>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}:
                  </span>{' '}
                  {profile[key] ?? '-'}
                </p>
              ))}
            </div>

            {/* Tickets Table */}
            <h3 className="text-lg font-semibold mb-2" data-translate>Your Tickets</h3>
            {tickets.length ? (
              <div className="overflow-x-auto mb-8">
                <table className="min-w-full border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-gray-300">
                      {['Date', 'Time', 'Event', 'Location', 'Price', 'Paid', 'Popularity', 'QR'].map((h) => (
                        <th key={h} className="px-3 py-2 border border-zinc-700 text-left" data-translate>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t, i) => {
                      if (!t || !t.event_title || !t.event_date) return null
                      const dt = new Date(t.event_date)
                      const date = dt.toLocaleDateString()
                      const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={i} className="bg-zinc-800 hover:bg-zinc-700">
                          <td className="px-3 py-2 border border-zinc-700">{date}</td>
                          <td className="px-3 py-2 border border-zinc-700">{time}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <Link href={`/events/${t.event_id}`} className="text-blue-400 hover:underline">{t.event_title}</Link>
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{t.location ?? '-'}</td>
                          <td className="px-3 py-2 border border-zinc-700">{t.event_price ? `${Number(t.event_price).toFixed(2)} DKK` : 'Free'}</td>
                          <td className="px-3 py-2 border border-zinc-700">{t.has_paid ? <span className="text-green-400 font-semibold" data-translate>Yes</span> : <span className="text-yellow-400 font-semibold" data-translate>Free</span>}</td>
                          <td className="px-3 py-2 border border-zinc-700">{t.popularity ?? 0}</td>
                          

                          <td className="px-3 py-2 border border-zinc-700">
  {(t.stage === 'book' || t.has_paid) && t.ticket_code ? (
    <div className="cursor-pointer" onClick={() => setActiveQR(t.ticket_code)}>
      <QRCodeCanvas value={t.ticket_code} size={48} />
    </div>
  ) : (
    <span className="text-gray-500" data-translate>No QR</span>
  )}
</td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 mb-8" data-translate>No tickets found.</p>}

            {/* RSVPs Table */}
            <h3 className="text-lg font-semibold mb-2" data-translate>Your RSVPs</h3>
            {rsvps.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-gray-300">
                      {['Date', 'Time', 'Event', 'Location', 'Price', 'Popularity'].map((h) => (
                        <th key={h} className="px-3 py-2 border border-zinc-700 text-left" data-translate>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map((r, i) => {
                      const dt = new Date(r.date)
                      const date = dt.toLocaleDateString()
                      const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={i} className="bg-zinc-800 hover:bg-zinc-700">
                          <td className="px-3 py-2 border border-zinc-700">{date}</td>
                          <td className="px-3 py-2 border border-zinc-700">{time}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <Link href={`/events/${r.event_id}`} className="text-blue-400 hover:underline">{r.title}</Link>
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{r.location ?? '-'}</td>
                          <td className="px-3 py-2 border border-zinc-700">{r.price ? `${Number(r.price).toFixed(2)} DKK` : 'Free'}</td>
                          <td className="px-3 py-2 border border-zinc-700">{r.popularity ?? 0}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400" data-translate>No RSVPs found.</p>}
          </>
        )}

        {/* QR Modal */}
        {activeQR && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setActiveQR(null)}>
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <QRCodeCanvas value={activeQR} size={256} />
              <p className="text-black text-center mt-4" data-translate>Scan this ticket</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

