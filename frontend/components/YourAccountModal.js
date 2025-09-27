//YourAccountModal.js

'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      try {
        const res = await fetch('/api/user/me')
        const data = await res.json()
        setProfile(data || null)
        setRegistrations(data.registrations || [])
      } catch (err) {
        console.error('Failed to load account:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAccount()
  }, [refreshTrigger])

  if (loading) return <div className="p-4">Loading…</div>
  if (!profile) return <div className="p-4">No profile found.</div>

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full shadow-lg overflow-auto">
        <h2 className="text-xl font-bold mb-4">Your Account</h2>

        <div className="mb-6">
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Role:</strong> {profile.role}</p>
        </div>

        <h3 className="text-lg font-semibold mb-2">Your Tickets</h3>
        {registrations.length === 0 ? (
          <p>You have no tickets yet.</p>
        ) : (
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Date, Time</th>
                <th className="border px-3 py-2 text-left">Event</th>
                <th className="border px-3 py-2 text-right">Price</th>
                <th className="border px-3 py-2 text-center">Paid</th>
                <th className="border px-3 py-2 text-center">QR</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.registration_id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">
                    {new Date(r.datetime).toLocaleDateString()}{" "}
                    {new Date(r.datetime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="border px-3 py-2">
                    <a
                      href={`/events/${r.event_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {r.event_name}
                    </a>
                  </td>
                  <td className="border px-3 py-2 text-right">
                    {r.price ? `$${r.price}` : 'Free'}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    {r.has_paid ? '✅' : '❌'}
                  </td>
                  <td className="border px-3 py-2 text-center">
                    <QRCode
                      value={`${window.location.origin}/ticket/${r.ticket_code}`}
                      size={48}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

