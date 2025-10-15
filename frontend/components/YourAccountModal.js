// YourAccountModal.js
'use client'
import React, { useState, useEffect } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import Link from 'next/link'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const t = (text) => text
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [events, setEvents] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

useEffect(() => {
  let cancelled = false

  async function loadAccount() {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) throw new Error('Not logged in')

      const headers = { Authorization: `Bearer ${token}` }

      // Fetch /me, /rsvps, and /events
      const [meRes, rsvpRes, eventRes] = await Promise.all([
        fetch('/api/user/me', { headers }),
        fetch('/api/user/rsvps', { headers }),
        fetch('/api/events', { headers }),
      ])

      if (!meRes.ok) throw new Error('Failed to fetch user profile')
      if (!rsvpRes.ok) throw new Error('Failed to fetch RSVPs')
      if (!eventRes.ok) throw new Error('Failed to fetch events')

      const [meData, rsvpDataRaw, eventsData] = await Promise.all([
        meRes.json(),
        rsvpRes.json(),
        eventRes.json(),
      ])

      if (cancelled) return

      setProfile(meData.profile ?? null)
      const eventArray = Array.isArray(eventsData?.rows)
        ? eventsData.rows
        : Array.isArray(eventsData)
        ? eventsData
        : []
      setEvents(eventArray)

      const userTickets = Array.isArray(meData.tickets) ? meData.tickets : []
      let rsvpData = Array.isArray(rsvpDataRaw) ? rsvpDataRaw : []

      // Hide RSVPs for events where user already has a ticket
      const eventIdsWithTickets = new Set(userTickets.map((t) => t.event_id))
      const filteredRsvps = rsvpData.filter((r) => !eventIdsWithTickets.has(r.event_id))

      setTickets(userTickets)
      setRsvps(filteredRsvps)

      // --- Determine if this user is admin_email for any events ---
      const userEmail = meData.profile?.email
      const isOwner = eventArray.some((ev) => ev.admin_email === userEmail)

      // Choose correct endpoint for metrics
      const metricEndpoint =
        meData.profile?.role === 'admin' || isOwner
          ? '/api/admin/stats'
          : '/api/user/metrics'

      const metricRes = await fetch(metricEndpoint, { headers })
      if (metricRes.ok) {
        const metricData = await metricRes.json()
        if (!cancelled) setMetrics(metricData)
      }
    } catch (err) {
      if (!cancelled) setError(err.message)
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  loadAccount()
  return () => {
    cancelled = true
  }
}, [refreshTrigger])

  async function handleEmailUpdate() {
    if (!newEmail) return
    setUpdatingEmail(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/user/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail }),
      })
      if (!res.ok) throw new Error('Failed to update email')
      alert('✅ Email updated successfully!')
      setNewEmail('')
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setUpdatingEmail(false)
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return
    setDeletingAccount(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete account')
      alert('Account deleted. Logging out.')
      localStorage.removeItem('token')
      window.location.reload()
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setDeletingAccount(false)
    }
  }

  if (loading || error) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
          {loading && <p>{t('LoadingAccount')}</p>}
          {error && (
            <>
              <p className="text-red-600 mb-4">{t('Error')} {error}</p>
              <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">
                {t('Close')}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const userEmail = profile?.email
const isOwner = Array.isArray(events) && events.some((e) => e.admin_email === userEmail)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-6xl w-full p-6 text-white relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">✕</button>

        <h2 className="text-2xl font-bold mb-1 text-blue-400">{t('YourAccount')}</h2>
        {profile?.email && <p className="text-sm text-gray-400 mb-6">Email: {profile.email}</p>}

        {/* Tickets */}
        {tickets.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-2">{t('YourTickets')}</h3>
            <div className="overflow-x-auto mb-8">
              <table className="min-w-full border-collapse border border-zinc-700 text-sm">
                <thead>
                  <tr className="bg-zinc-800 text-gray-300">
                    {['Date', 'Time', 'Event', 'Location', 'Price', 'Paid', 'QR'].map((h) => (
                      <th key={h} className="px-3 py-2 border border-zinc-700 text-left">{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => {
                    const dt = new Date(t.event_date)
                    return (
                      <tr key={i} className="bg-zinc-800 hover:bg-zinc-700">
                        <td className="px-3 py-2 border border-zinc-700">{dt.toLocaleDateString()}</td>
                        <td className="px-3 py-2 border border-zinc-700">
                          {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 border border-zinc-700">
                          <Link href={`/event/${t.event_id}`} className="text-blue-400 hover:underline">
                            {t.event_title}
                          </Link>
                        </td>
                        <td className="px-3 py-2 border border-zinc-700">{t.location ?? '-'}</td>
                        <td className="px-3 py-2 border border-zinc-700">
                          {t.event_price ? `${t.event_price} DKK` : t('Free')}
                        </td>
                        <td className="px-3 py-2 border border-zinc-700">{t.has_paid ? '✅' : '❌'}</td>
                        <td className="px-3 py-2 border border-zinc-700">
                          {t.ticket_code && <OptimizedQRCode value={t.ticket_code} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* RSVPs */}
        <h3 className="text-lg font-semibold mb-2">{t('YourRSVPs')}</h3>
        {rsvps.length > 0 ? (
          <ul className="text-sm space-y-1 mb-8">
            {rsvps.map((r, i) => (
              <li key={i} className="border border-zinc-700 p-2 rounded bg-zinc-800">
                <Link href={`/event/${r.event_id}`} className="text-blue-400 hover:underline">{r.title}</Link> —{' '}
                {new Date(r.date).toLocaleDateString()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400 mb-8">{t('NoRSVPsFound')}</p>
        )}

        {/* ADMIN OR OWNER METRICS */}
        {(profile?.role === 'admin' || isOwner) && metrics && (
          <>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Client / Admin Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              <Metric label="Tickets Sold" value={metrics.tickets_sold} />
              <Metric label="RSVP Count" value={metrics.rsvp_count} />
              <Metric label="Venues Opened" value={metrics.venues_opened} />
              <Metric label="Host Info Views" value={metrics.host_views} />
              <Metric label="No Show Rate" value={`${metrics.no_show_rate}%`} />
            </div>
          </>
        )}

        {/* USER METRICS */}
        {profile?.role === 'user' && metrics && !isOwner && (
          <>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Your Activity</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <Metric label="Tickets Bought" value={metrics.tickets_bought} />
              <Metric label="Show-up Rate" value={`${metrics.show_up_rate}%`} />
              <Metric label="Points Earned" value={metrics.points} />
            </div>
          </>
        )}

        {/* ACCOUNT MANAGEMENT */}
        <h3 className="text-lg font-semibold mb-3">{t('AccountSettings')}</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-center mb-6">
          <input
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm flex-1"
          />
          <button
            onClick={handleEmailUpdate}
            disabled={updatingEmail}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm disabled:opacity-50"
          >
            {updatingEmail ? 'Updating...' : 'Update Email'}
          </button>
        </div>

        <button
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm text-white disabled:opacity-50"
        >
          {deletingAccount ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </div>
  )
}

const Metric = ({ label, value }) => (
  <div className="border border-zinc-700 bg-zinc-800 p-3 rounded-lg text-center">
    <div className="text-lg font-bold">{value ?? '-'}</div>
    <div className="text-sm text-gray-400">{label}</div>
  </div>
)

const OptimizedQRCode = React.memo(function OptimizedQRCode({ value }) {
  return <QRCodeCanvas value={value} size={48} />
})

