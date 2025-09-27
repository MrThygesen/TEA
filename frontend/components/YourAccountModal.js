'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'
import Link from 'next/link'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

useEffect(() => {
  async function loadAccount() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch('/api/user/me', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error('Failed to load profile')

      const data = await res.json()
      setProfile(data || null)
      setTickets(data.registrations || [])
    } catch (err) {
      console.error('Failed to load account:', err)
    } finally {
      setLoading(false)
    }
  }

  loadAccount()
}, [refreshTrigger])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-4xl w-full p-6 text-white relative">
        
        {/* Close button top right */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-blue-400">Your Account</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : profile ? (
          <>
            <p className="mb-2"><strong>Name:</strong> {profile.username}</p>
            <p className="mb-4"><strong>Email:</strong> {profile.email}</p>

            {tickets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800">
                      <th className="px-3 py-2 border border-zinc-700">Date</th>
                      <th className="px-3 py-2 border border-zinc-700">Time</th>
                      <th className="px-3 py-2 border border-zinc-700">Event</th>
                      <th className="px-3 py-2 border border-zinc-700">Popularity</th>
                      <th className="px-3 py-2 border border-zinc-700">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t, i) => {
                      const dt = new Date(t.datetime)
                      const date = dt.toLocaleDateString()
                      const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={i} className="bg-zinc-800 border border-zinc-700">
                          <td className="px-3 py-2 border border-zinc-700">{date}</td>
                          <td className="px-3 py-2 border border-zinc-700">{time}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <Link href={`/events/${t.event_id}`} className="text-blue-400 hover:underline">
                              {t.event_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{t.popularity}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <QRCode value={t.ticket_code || ''} size={48} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">No tickets yet.</p>
            )}
          </>
        ) : (
          <p className="text-red-400">Failed to load account.</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

