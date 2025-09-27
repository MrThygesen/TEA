'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

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
        if (!res.ok) return
        const data = await res.json()
        setProfile(data)
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
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-lg w-full p-6 text-white relative">
        
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
              <div>
                <h3 className="font-semibold mb-2">Your Tickets</h3>
                <ul className="space-y-2 text-sm">
                  {tickets.map((t, i) => (
                    <li key={i} className="bg-zinc-800 p-2 rounded flex justify-between">
                      <span>{t.event_name}</span>
                      <QRCode value={t.ticket_qr || ''} size={48} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-gray-400">No tickets yet.</p>
            )}
          </>
        ) : (
          <p className="text-red-400">Failed to load account.</p>
        )}

        {/* Footer close button */}
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

