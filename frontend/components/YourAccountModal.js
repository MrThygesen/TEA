'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ profile, onClose }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [qrModal, setQrModal] = useState(null)

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

  // --- Filtering rules ---
  const now = new Date()
  const cutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

  const visibleTickets = tickets.filter((t) => new Date(t.datetime) >= cutoff)

  // Group tickets
  const confirmed = visibleTickets.filter(
    (t) => t.stage === 'book' && (t.price === 0 || t.has_paid) && t.ticket_sent
  )
  const showedInterest = visibleTickets.filter(
    (t) => t.stage === 'prebook' && !t.has_paid && !t.ticket_sent
  )
  const guestlist = visibleTickets.filter((t) => t.stage === 'prebook' && !t.has_paid)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 text-white rounded-2xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Close
        </button>

        <h2 className="text-xl font-semibold text-blue-400 mb-4">Your Account</h2>

        <div className="mb-6">
          <p><strong>Username:</strong> {profile?.username || '—'}</p>
          <p><strong>Email:</strong> {profile?.email || '—'}</p>
        </div>

        {loading && <p>Loading tickets…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && (
          <>
            {/* Confirmed Tickets */}
            <h3 className="text-lg font-semibold text-green-400 mt-6 mb-2">Confirmed Tickets</h3>
            {confirmed.length === 0 ? (
              <p className="text-gray-400 text-sm">No confirmed tickets.</p>
            ) : (
              <div className="divide-y divide-zinc-700 border border-zinc-700 rounded-lg">
                <div className="grid grid-cols-4 text-sm text-gray-400 bg-zinc-800 px-3 py-2 font-semibold">
                  <span>Date</span>
                  <span>Event</span>
                  <span>Status</span>
                  <span>Ticket</span>
                </div>
                {confirmed.map((t) => (
                  <div key={t.id} className="grid grid-cols-4 px-3 py-2 items-center text-sm">
                    <span>{new Date(t.datetime).toLocaleDateString()}</span>
                    <span>{t.event_name}</span>
                    <span className="text-green-400">✅ Confirmed</span>
                    <button
                      onClick={() => setQrModal(t)}
                      className="text-blue-400 hover:underline"
                    >
                      Open QR
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Showed Interest */}
            <h3 className="text-lg font-semibold text-yellow-400 mt-6 mb-2">You Showed Interest</h3>
            {showedInterest.length === 0 ? (
              <p className="text-gray-400 text-sm">No pending interests.</p>
            ) : (
              <div className="divide-y divide-zinc-700 border border-zinc-700 rounded-lg">
                <div className="grid grid-cols-3 text-sm text-gray-400 bg-zinc-800 px-3 py-2 font-semibold">
                  <span>Date</span>
                  <span>Event</span>
                  <span>Status</span>
                </div>
                {showedInterest.map((t) => (
                  <div key={t.id} className="grid grid-cols-3 px-3 py-2 items-center text-sm">
                    <span>{new Date(t.datetime).toLocaleDateString()}</span>
                    <span>{t.event_name}</span>
                    <span className="text-yellow-400">👀 You showed interest</span>
                  </div>
                ))}
              </div>
            )}

            {/* Guestlist */}
            <h3 className="text-lg font-semibold text-gray-400 mt-6 mb-2">Guestlist</h3>
            {guestlist.length === 0 ? (
              <p className="text-gray-400 text-sm">No guestlist entries.</p>
            ) : (
              <div className="divide-y divide-zinc-700 border border-zinc-700 rounded-lg">
                <div className="grid grid-cols-3 text-sm text-gray-400 bg-zinc-800 px-3 py-2 font-semibold">
                  <span>Date</span>
                  <span>Event</span>
                  <span>Status</span>
                </div>
                {guestlist.map((t) => (
                  <div key={t.id} className="grid grid-cols-3 px-3 py-2 items-center text-sm">
                    <span>{new Date(t.datetime).toLocaleDateString()}</span>
                    <span>{t.event_name}</span>
                    <span className="text-yellow-400">⏳ Not confirmed</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-zinc-900 rounded-xl p-6 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">{qrModal.event_name}</h3>
            <QRCode
              value={qrModal.ticket_code || 'NO-CODE'}
              size={200}
              className="mx-auto mb-4"
            />
            <button
              onClick={() => setQrModal(null)}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

