'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'
export default function YourAccountModal({ profile, onClose }) {
  const [tickets, setTickets] = useState([])
  const [profilePasswordInput, setProfilePasswordInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return

    const fetchTickets = async () => {
      try {
        const res = await fetch('/api/user/myTickets', {
          headers: {
            'Authorization': `Bearer ${profile.token}`,
          },
        })
        const data = await res.json()
        setTickets(data.tickets || [])
      } catch (err) {
        console.error('Failed to fetch tickets', err)
      }
    }

    fetchTickets()
  }, [profile])

  const savePassword = async () => {
    if (!profilePasswordInput) return
    setSaving(true)
    try {
      const res = await fetch('/api/user/updatePassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${profile.token}`,
        },
        body: JSON.stringify({ password: profilePasswordInput }),
      })
      if (!res.ok) throw new Error('Password update failed')
      alert('Password updated successfully!')
      setProfilePasswordInput('')
    } catch (err) {
      console.error(err)
      alert('Error updating password')
    }
    setSaving(false)
  }

  if (!profile) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 text-white rounded-xl p-6 max-w-3xl w-full relative">
        <button
          className="absolute top-3 right-3 text-white font-bold text-xl"
          onClick={onClose}
        >
          ×
        </button>
        <h2 className="text-2xl font-semibold mb-4">Your Account</h2>
        <div className="mb-6">
          <p><strong>Username:</strong> {profile.username}</p>
          <p><strong>Email:</strong> {profile.email}</p>
        </div>

        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">Change Password</h3>
          <input
            type="password"
            placeholder="New password"
            value={profilePasswordInput}
            onChange={(e) => setProfilePasswordInput(e.target.value)}
            className="p-2 rounded text-black w-full"
          />
          <button
            onClick={savePassword}
            disabled={saving}
            className="mt-2 px-4 py-2 bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-2">Your Tickets</h3>
          {tickets.length === 0 ? (
            <p>No tickets yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map((t) => (
                <div key={t.id} className="border border-zinc-700 p-3 rounded">
                  <h4 className="font-semibold">{t.event_name}</h4>
                  <p>{t.city} - {new Date(t.datetime).toLocaleString()}</p>
                  <p>{t.has_paid ? 'Paid' : 'Pending'}</p>
                  {t.qrData && (
                    <div className="mt-2 bg-white p-1 inline-block">
                      <QRCode value={t.qrData} size={64} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

