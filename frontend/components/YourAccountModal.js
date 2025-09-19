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
          headers: { Authorization: `Bearer ${token}` },
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Close
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold text-blue-400 mb-4">Your Account</h2>

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

        {tickets.length > 0 && (
          <div className="divide-y divide-zinc-700 border border-zinc-700 rounded-lg">
            <div className="grid grid-cols-3 text-sm text-gray-400 bg-zinc-800 px-3 py-2 font-semibold">
              <span>Date</span>
              <span>Event</span>
              <span>Ticket</span>
            </div>
            {tickets.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-3 px-3 py-2 items-center text-sm"
              >
                <span>{new Date(t.datetime).toLocaleDateString()}</span>
                <span>{t.event_name}</span>
                {t.qrImage ? (
                  <a
                    href={t.qrImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Open QR
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

