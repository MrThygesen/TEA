// components/YourAccountModal.js
'use client'

import { useState, useEffect } from 'react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      try {
        // fetch profile
        const profileRes = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const ticketsRes = await fetch('/api/user/myTickets', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data)
        }
        if (ticketsRes.ok) {
          const data = await ticketsRes.json()
          setTickets(data.tickets || [])
        }
      } catch (err) {
        console.error('Failed to load account info', err)
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [refreshTrigger])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 text-white relative overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4">Your Account</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <>
            {profile && (
              <div className="mb-4">
                <p><strong>Username:</strong> {profile.username}</p>
                <p><strong>Email:</strong> {profile.email}</p>
              </div>
            )}

            <h3 className="text-lg font-semibold mb-2">Your Tickets</h3>
            {tickets.length === 0 ? (
              <p className="text-gray-400">No tickets yet.</p>
            ) : (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="p-2 bg-zinc-800 rounded flex justify-between items-center"
                  >
                    <span>{ticket.event_name} — {ticket.stage}</span>
                    {ticket.qrImage && (
                      <img
                        src={ticket.qrImage}
                        alt="QR Code"
                        className="w-12 h-12 object-contain"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

