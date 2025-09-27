'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode.react'
import Link from 'next/link'

export default function YourAccountModal({ onClose, refreshTrigger, userId }) {
  const [profile, setProfile] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeQR, setActiveQR] = useState(null) // For enlarged QR

  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          console.warn('No token found')
          return
        }

        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`)

        const data = await res.json()
        setProfile(data || null)
        setRegistrations(Array.isArray(data.registrations) ? data.registrations : [])
      } catch (err) {
        console.error('❌ Failed to load account:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAccount()
  }, [refreshTrigger])

  // Generate QR value
  const qrValue = (eventId) => `ticket:${eventId}:${profile?.id || userId}`

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-6xl w-full p-6 text-white relative">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-6 text-blue-400">Your Account</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : profile ? (
          <>
            {/* Profile section */}
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-800 p-4 rounded-lg border border-zinc-700">
              <p><span className="font-semibold text-gray-300">Name:</span> {profile.username || '-'}</p>
              <p><span className="font-semibold text-gray-300">Email:</span> {profile.email || '-'}</p>
              <p><span className="font-semibold text-gray-300">Wallet:</span> {profile.wallet_address || '-'}</p>
              <p><span className="font-semibold text-gray-300">City:</span> {profile.city || '-'}</p>
              <p><span className="font-semibold text-gray-300">Tier:</span> {profile.tier || '-'}</p>
              <p><span className="font-semibold text-gray-300">Role:</span> {profile.role || '-'}</p>
            </div>

            {/* Registrations */}
            {registrations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-zinc-700 text-sm">
                  <thead>
                    <tr className="bg-zinc-800 text-gray-300">
                      <th className="px-3 py-2 border border-zinc-700 text-left">Date</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Time</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Event</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Price</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Paid</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">Popularity</th>
                      <th className="px-3 py-2 border border-zinc-700 text-left">QR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r, i) => {
                      if (!r || !r.event_name || !r.datetime) return null

                      const dt = new Date(r.datetime)
                      const date = dt.toLocaleDateString()
                      const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                      return (
                        <tr key={i} className="bg-zinc-800 hover:bg-zinc-700">
                          <td className="px-3 py-2 border border-zinc-700">{date}</td>
                          <td className="px-3 py-2 border border-zinc-700">{time}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <Link href={`/events/${r.event_id}`} className="text-blue-400 hover:underline">
                              {r.event_name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">
                            {r.price ? `${Number(r.price).toFixed(2)} DKK` : 'Free'}
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">
                            {r.has_paid ? (
                              <span className="text-green-400 font-semibold">Yes</span>
                            ) : (
                              <span className="text-red-400 font-semibold">No</span>
                            )}
                          </td>
                          <td className="px-3 py-2 border border-zinc-700">{r.popularity || 0}</td>
                          <td className="px-3 py-2 border border-zinc-700">
                            <div
                              className="cursor-pointer"
                              onClick={() => setActiveQR(qrValue(r.event_id))}
                            >
                              <QRCode value={qrValue(r.event_id)} size={48} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">No registrations yet.</p>
            )}
          </>
        ) : (
          <p className="text-red-400">Failed to load account.</p>
        )}

        {/* Close button bottom */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-700 rounded hover:bg-zinc-600"
          >
            Close
          </button>
        </div>
      </div>

      {/* QR Lightbox */}
      {activeQR && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-60"
          onClick={() => setActiveQR(null)}
        >
          <QRCode value={activeQR} size={256} className="rounded-lg shadow-lg" />
        </div>
      )}
    </div>
  )
}

