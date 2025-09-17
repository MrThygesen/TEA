// components/YourAccountModal.js
'use client'

import { useState, useEffect } from 'react'

export default function YourAccountModal({ profile, onClose }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('Missing token')

        const res = await fetch('/api/user/myTickets', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (!res.ok) throw new Error('Failed to fetch tickets')
        const data = await res.json()
        setTickets(data.tickets || [])
      } catch (err) {
        console.error('❌ Error loading tickets:', err)
        setError('Could not load your tickets')
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-lg p-6 w-full max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-blue-400">Your Account</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Profile Info */}
        <div className="mb-6">
          <p><strong>Username:</strong> {profile?.username || '—'}</p>
          <p><strong>Email:</strong> {profile?.email || '—'}</p>
        </div>

        {/* Tickets Section */}
        <h3 className="text-lg font-semibold text-blue-300 mb-2">Your Tickets</h3>
        {loading && <p>Loading tickets…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {tickets.length === 0 && !loading && (
          <p className="text-gray-400">You have no tickets yet.</p>
        )}

        <div className="space-y-4">
          {tickets.map((t) => (
            <div key={t.id} className="border border-zinc-700 rounded-xl p-4">
              <h4 className="text-lg font-semibold">{t.event_name}</h4>
              <p className="text-sm text-gray-300">
                {t.city} — {new Date(t.datetime).toLocaleString()}
              </p>
              <p className="text-sm">
                {t.has_paid ? (
                  <span className="text-green-400">✅ Paid</span>
                ) : (
                  <span className="text-yellow-400">⏳ Not Paid</span>
                )}
              </p>

              {t.qrImage && (
                <div className="mt-2">
                  <img
                    src={t.qrImage}
                    alt="QR Ticket"
                    className="rounded-lg border border-zinc-700"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

