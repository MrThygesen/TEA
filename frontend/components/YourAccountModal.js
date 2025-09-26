'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      try {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          setProfile(null)
          setLoading(false)
          return
        }

        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) {
          setProfile(data)
        } else {
          console.error('❌ me.js error:', data)
          setProfile(null)
        }
      } catch (err) {
        console.error('❌ Fetch error in YourAccountModal:', err)
        setProfile(null)
      }
      setLoading(false)
    }
    loadAccount()
  }, [refreshTrigger])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-6 rounded shadow-md">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-6 rounded shadow-md">
          <p>No profile found. Please log in.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
      <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">Your Account</h2>

        {/* Profile Info */}
        <div className="mb-4">
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Wallet:</strong> {profile.wallet_address || 'N/A'}</p>
          <p><strong>City:</strong> {profile.city}</p>
          <p><strong>Role:</strong> {profile.role}</p>
        </div>

        {/* Tickets */}
        <h3 className="text-lg font-semibold mb-2">Your Tickets</h3>
        {profile.registrations?.length === 0 ? (
          <p>No tickets yet.</p>
        ) : (
          profile.registrations.map((reg) => (
            <div key={reg.event_id} className="border rounded p-3 mb-4">
              <p className="font-semibold">{reg.event_name}</p>
              <p className="text-sm text-gray-600">
                {new Date(reg.datetime).toLocaleString()}
              </p>
              <p className="text-sm">Tickets: {reg.user_tickets} / {reg.max_per_user}</p>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {reg.ticket_codes.map((code, idx) => (
                  <div key={idx} className="flex flex-col items-center border rounded p-2">
                    <QRCode value={code} size={80} />
                    <p className="text-xs mt-1">{code.slice(0, 8)}...</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded"
        >
          Close
        </button>
      </div>
    </div>
  )
}

