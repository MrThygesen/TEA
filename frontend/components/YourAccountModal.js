'use client'

import { useState, useEffect } from 'react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [rsvps, setRsvps] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }

        const [profileRes, rsvpsRes] = await Promise.all([
          fetch('/api/user/me', { headers }),
          fetch('/api/user/rsvps', { headers }),
        ])

        const profileData = await profileRes.json()
        const rsvpsData = await rsvpsRes.json()

        if (!profileData.error) {
          setProfile(profileData.profile)
          setTickets(profileData.tickets || [])
        }

        if (!rsvpsData.error) {
          setRsvps(rsvpsData || [])
        }
      } catch (err) {
        console.error(err)
      }
    }

    fetchData()
  }, [refreshTrigger])

  if (!profile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
        <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg text-center">
          <h2 className="text-xl font-semibold text-gray-700">Loading profile…</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Your Account</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600"
          >
            Close
          </button>
        </div>

        {/* Profile info */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <p className="text-sm text-gray-500">Username</p>
            <p className="font-semibold text-gray-800">{profile.username || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <p className="text-sm text-gray-500">Wallet</p>
            <p className="font-mono text-gray-800 break-all">
              {profile.wallet_address}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <p className="text-sm text-gray-500">Tier</p>
            <p className="text-lg font-semibold text-indigo-600">
              {profile.tier || 'Standard'}
            </p>
          </div>
        </div>

        {/* Tickets Table */}
        <h3 className="text-xl font-semibold text-gray-700 mb-3">Your Tickets</h3>
        <div className="overflow-x-auto mb-8">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-medium text-gray-600">
                <th className="p-3 border-b">Event</th>
                <th className="p-3 border-b">Date</th>
                <th className="p-3 border-b">Stage</th>
                <th className="p-3 border-b">Paid</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 border-b text-gray-800">{ticket.event_title}</td>
                    <td className="p-3 border-b text-gray-600">
                      {new Date(ticket.event_date).toLocaleString()}
                    </td>
                    <td className="p-3 border-b text-gray-600">{ticket.stage}</td>
                    <td className="p-3 border-b">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          ticket.has_paid
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {ticket.has_paid ? 'Yes' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-500">
                    No tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RSVPs Table */}
        <h3 className="text-xl font-semibold text-gray-700 mb-3">Your RSVPs</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-medium text-gray-600">
                <th className="p-3 border-b">Event</th>
                <th className="p-3 border-b">Date</th>
                <th className="p-3 border-b">Location</th>
                <th className="p-3 border-b">Popularity</th>
              </tr>
            </thead>
            <tbody>
              {rsvps.length > 0 ? (
                rsvps.map((rsvp) => (
                  <tr key={rsvp.rsvp_id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 border-b text-gray-800">{rsvp.title}</td>
                    <td className="p-3 border-b text-gray-600">
                      {new Date(rsvp.date).toLocaleString()}
                    </td>
                    <td className="p-3 border-b text-gray-600">{rsvp.location}</td>
                    <td className="p-3 border-b text-gray-600">{rsvp.popularity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-500">
                    No RSVPs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

