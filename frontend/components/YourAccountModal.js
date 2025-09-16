'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'

export default function YourAccountModal({ profile, onClose }) {
  const [profilePasswordInput, setProfilePasswordInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [tickets, setTickets] = useState([])

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch('/api/user/myTickets')
        if (!res.ok) throw new Error('Failed to fetch tickets')
        const data = await res.json()
        setTickets(data.tickets || [])
      } catch (err) {
        console.error('❌ Failed to load tickets', err)
      }
    }
    fetchTickets()
  }, [])

  const savePassword = async () => {
    if (!profilePasswordInput || profilePasswordInput.length < 8) {
      alert('❌ Password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user/updatePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: profilePasswordInput }),
      })
      if (!res.ok) throw new Error('Failed to save password')

      setProfilePasswordInput('')
      alert('✅ Password saved!')
    } catch (err) {
      console.error(err)
      alert('❌ Failed to save password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div style={{
        background: '#fff',
        padding: '1.5rem',
        borderRadius: '12px',
        width: '420px',
        maxHeight: '85vh',
        overflowY: 'auto'
      }}>
        <h2 className="text-xl font-semibold mb-4">Your Account</h2>

        <p><strong>Username:</strong> {profile.username}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>City:</strong> {profile.city || '-'}</p>
        <p><strong>Tier:</strong> {profile.tier}</p>

        {/* Tickets list */}
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">🎟 Your Tickets</h3>
          {tickets.length === 0 ? (
            <p className="text-gray-600">No tickets yet.</p>
          ) : (
            <ul className="space-y-4">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="border rounded p-3 bg-gray-50 text-sm"
                >
                  <strong>{t.event_name}</strong> ({t.city}) <br />
                  {new Date(t.datetime).toLocaleString()} <br />
                  {t.has_paid || t.price === 0 ? (
                    t.ticket_sent ? (
                      <div className="mt-2">
                        <span className="text-green-700">✅ Ticket issued</span>
                        {t.qrData && (
                          <div className="mt-2 flex justify-center">
                            <QRCode value={t.qrData} size={128} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-yellow-600">⏳ Processing</span>
                    )
                  ) : (
                    <span className="text-red-600">❌ Not paid</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Password setup block */}
        {!profile.hasPassword && profile.email && (
          <div className="mb-4 p-2 border border-yellow-600 rounded mt-4">
            <p>🔐 Set a password for web access to view tickets and history.</p>
            <input
              type="password"
              placeholder="New password"
              value={profilePasswordInput}
              onChange={(e) => setProfilePasswordInput(e.target.value)}
              className="w-full p-2 rounded mt-2 border"
            />
            <button
              onClick={savePassword}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-blue-600 rounded text-white w-full"
            >
              {saving ? 'Saving...' : 'Save password'}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-300 rounded w-full"
        >
          Close
        </button>
      </div>
    </div>
  )
}

