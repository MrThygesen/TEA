//YourAccountModal.js

'use client'

import { useState, useEffect } from 'react'

export default function YourAccountModal({ profile, onClose }) {
  const [profilePasswordInput, setProfilePasswordInput] = useState('')
  const [saving, setSaving] = useState(false)

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
        width: '350px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h2 className="text-xl font-semibold mb-4">Your Account</h2>

        <p><strong>Username:</strong> {profile.username}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>City:</strong> {profile.city || '-'}</p>
        <p><strong>Tier:</strong> {profile.tier}</p>

        {/* Password setup block */}
        {!profile.hasPassword && profile.email && (
          <div className="mb-4 p-2 border border-yellow-600 rounded mt-4">
            <p>🔐 Set a password for web access to view tickets and history.</p>
            <input
              type="password"
              placeholder="New password"
              value={profilePasswordInput}
              onChange={(e) => setProfilePasswordInput(e.target.value)}
              className="w-full p-2 rounded mt-2"
            />
            <button
              onClick={savePassword}
              disabled={saving}
              className="mt-2 px-4 py-2 bg-blue-600 rounded text-white"
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

