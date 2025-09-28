// components/YourAccountModal.js
'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('Not logged in')

        // fetch profile + tickets
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load profile')
        const data = await res.json()
        setProfile(data.profile)
        setTickets(data.tickets || [])

        // fetch RSVPs
        const resRsvp = await fetch('/api/events/myRsvps', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (resRsvp.ok) {
          const dataRsvp = await resRsvp.json()
          setRsvps(dataRsvp.rsvps || [])
        }
      } catch (err) {
        console.error('Error loading account', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadAccount()
  }, [refreshTrigger])

  async function cancelRsvp(eventId) {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/rsvp', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId }),
      })
      if (!res.ok) throw new Error('Failed to cancel RSVP')
      setRsvps(rsvps.filter((r) => r.event_id !== eventId))
    } catch (err) {
      console.error('Error canceling RSVP', err)
      alert('Could not cancel RSVP')
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
          <p className="text-gray-700">Loading your account...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Your Account</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 font-bold"
          >
            ✕
          </button>
        </div>

        {/* Profile Info */}
        {profile && (
          <div className="mb-6">
            <p className="text-gray-700">
              <strong>Email:</strong> {profile.email}
            </p>
            <p className="text-gray-700">
              <strong>Hearts:</strong> {profile.hearts}
            </p>
          </div>
        )}

        {/* Tickets */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Tickets</h3>
          {tickets.length === 0 ? (
            <p className="text-gray-500">No tickets booked yet.</p>
          ) : (
            <ul className="space-y-3">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="p-3 border rounded-md shadow-sm bg-gray-50 flex flex-col items-start"
                >
                  <p>
                    <strong>Event:</strong> {t.event_title}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {new Date(t.event_date).toLocaleString()}
                  </p>
                  <p>
                    <strong>Ticket Code:</strong> {t.ticket_code}
                  </p>
                  <div className="mt-2">
                    <QRCode value={t.ticket_code} size={128} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* RSVPs */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Your RSVPs
          </h3>
          {rsvps.length === 0 ? (
            <p className="text-gray-500">No RSVPs yet.</p>
          ) : (
            <ul className="space-y-3">
              {rsvps.map((r) => (
                <li
                  key={r.favorite_id}
                  className="p-3 border rounded-md shadow-sm bg-gray-50 flex flex-col items-start"
                >
                  <p>
                    <strong>Event:</strong> {r.title}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {new Date(r.date).toLocaleString()}
                  </p>
                  <p>
                    <strong>Location:</strong> {r.location}</p>
                  <button
                    onClick={() => cancelRsvp(r.event_id)}
                    className="mt-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Cancel RSVP
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

