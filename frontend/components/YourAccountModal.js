'use client'

import { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import Link from 'next/link'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [registrations, setRegistrations] = useState([])
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

        // --- Fetch user profile + registrations
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile(data || null)

        // --- Make sure each registration has a ticket_code fallback
        const regs = Array.isArray(data.registrations) ? data.registrations : []
        regs.forEach((r) => {
          if (!r.ticket_code && r.event_id && data.id) {
            r.ticket_code = `ticket:${r.event_id}:${data.id}`
          }
        })
        setRegistrations(regs)
      } catch (err) {
        console.error('❌ Failed to load account:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [refreshTrigger])

  if (loading) return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
        <p>Loading your account...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
        <p className="text-red-600 mb-4">Error: {error}</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
          Close
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-6xl w-full p-6 text-white relative">

        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-6 text-blue-400">Your Account</h2>

        {profile && (
          <>
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-800 p-4 rounded-lg border border-zinc-700">
              <p><span className="font-semibold text-gray-300">Name:</span> {profile.username || '-'}</p>
              <p><span className="font-semibold text-gray-300">Email:</span> {profile.email || '-'}</p>
              <p><span className="font-semibold text-gray-300">Wallet:</span> {profile.wallet_address || '-'}</p>
              <p><span className="font-semibold text-gray-300">City:</span> {profile.city || '-'}</p>
              <p><span className="font-semibold text-gray-300">Tier:</span> {profile.tier || '-'}</p>
              <p><span className="font-semibold text-gray-300">Role:</span> {profile.role || '-'}</p>
            </div>

            {registrations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-gray-300">
                      <th className="px-3 py-2 border border-zinc-700 text-left">Date</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Time</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Event</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Price</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Paid</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Popularity</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r, i) => {
                      if (!r || !r.event_name || !r.datetime) return null
                      const dt = new Date(r.datetime)
                      const date = dt.toLocaleDateString()
                      const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={i} className="bg-zinc-800 hover:bg-zinc-700">
                          <td className="px-3 py-2 border border-zinc-700">{date}</td>
                          <td className="px-3 py-2 border border-zinc-700">{time}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <Link href={`/events/${r.event_id}`} className="text-blue-400 hover:underline">
                              {r.event_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{r.price ? `${Number(r.price).toFixed(2)} DKK` : 'Free'}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            {r.has_paid ? <span className="text-green-400 font-semibold">Yes</span> : <span className="text-red-400 font-semibold">No</span>}
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{r.popularity || 0}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            {r.ticket_code ? (
                              <div className="cursor-pointer" onClick={() => setActiveQR(r.ticket_code)}>
                                <QRCodeCanvas value={r.ticket_code} size={48} />
                              </div>
                            ) : <span className="text-gray-500">No QR</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">No tickets found.</p>
            )}
          </>
        )}
      </div>

      {activeQR && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setActiveQR(null)}>
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <QRCodeCanvas value={activeQR} size={256} />
            <p className="text-black text-center mt-4">Scan this ticket</p>
          </div>
        </div>
      )}
    </div>
  )
}

