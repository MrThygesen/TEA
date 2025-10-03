//YourAccountModal.js
'use client'

import { useState, useEffect } from 'react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
        const data = await res.json()
        if (!data.error) {
          setProfile(data)
          setTickets(data.tickets || [])
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchProfile()
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
      <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-3xl">
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
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <p className="text-sm text-gray-500">Wallet Address</p>
            <p className="font-mono text-gray-800 break-all">{profile.address}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 shadow-inner">
            <p className="text-sm text-gray-500">Tickets Owned</p>
            <p className="text-lg font-semibold text-indigo-600">{tickets.length}</p>
          </div>
        </div>

        {/* Tickets Table */}
        <h3 className="text-xl font-semibold text-gray-700 mb-3">Your Tickets</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-medium text-gray-600">
                <th className="p-3 border-b">Event</th>
                <th className="p-3 border-b">Date</th>
                <th className="p-3 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length > 0 ? (
                tickets.map((ticket, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-3 border-b text-gray-800">{ticket.eventName}</td>
                    <td className="p-3 border-b text-gray-600">{ticket.date}</td>
                    <td className="p-3 border-b">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          ticket.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="p-4 text-center text-gray-500">
                    No tickets found.
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

