'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState({ username: '', email: '' })
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile({ username: data.username, email: data.email })
        setTickets(data.registrations || [])
      } catch (err) {
        console.error('❌ Load account:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAccount()
  }, [refreshTrigger])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div
        className="bg-zinc-900 rounded-lg max-w-3xl w-full p-6 overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-blue-400">Your Account</h2>
          <button onClick={onClose} className="text-white text-xl font-bold">✕</button>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <>
            <div className="mb-6">
              <p><strong>Username:</strong> {profile.username}</p>
              <p><strong>Email:</strong> {profile.email}</p>
            </div>

            <h3 className="text-xl font-semibold mb-2 text-blue-400">Your Bookings</h3>
            {tickets.length === 0 ? (
              <p className="text-gray-400">You have no booked tickets.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800">
                      <th className="border border-zinc-700 px-3 py-1 text-left">Date</th>
                      <th className="border border-zinc-700 px-3 py-1 text-left">Event</th>
                      <th className="border border-zinc-700 px-3 py-1 text-left">Status</th>
                      <th className="border border-zinc-700 px-3 py-1 text-left">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t, i) => (
                      <tr key={i} className="odd:bg-zinc-800 even:bg-zinc-700">
                        <td className="border border-zinc-700 px-3 py-1">
                          {t.datetime ? new Date(t.datetime).toLocaleDateString() : '—'}
                        </td>
                        <td className="border border-zinc-700 px-3 py-1">
                          <a href={`/events/${t.event_id}`} className="text-blue-400 hover:underline">
                            {t.event_name}
                          </a>
                        </td>
                        <td className="border border-zinc-700 px-3 py-1">
                          {t.user_tickets} / {t.max_per_user}
                        </td>
                        <td className="border border-zinc-700 px-3 py-1">
                          {t.ticket_codes && t.ticket_codes.length > 0 ? (
                            <QRCode
                              value={t.ticket_codes[0]}
                              size={64}
                              bgColor="#1f2937"
                              fgColor="#ffffff"
                            />
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

