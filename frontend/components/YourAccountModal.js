// components/YourAccountModal.js
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

  // 🟢 New: event creation
  const [showEventForm, setShowEventForm] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [eventData, setEventData] = useState({
    name: '',
    title: '',
    city: '',
    venue: '',
    datetime: '',
    description: '',
    details: '',
    tags: '',
    price: '',
    image_name: '',
  })

  useEffect(() => {
    let cancelled = false
    async function loadAccount() {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        if (!token) throw new Error('Not logged in')
        const headers = { Authorization: `Bearer ${token}` }

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

        const eventIdsWithTickets = new Set(userTickets.map((t) => t.event_id))
        const filteredRsvps = rsvpData.filter((r) => !eventIdsWithTickets.has(r.event_id))
        setTickets(userTickets)
        setRsvps(filteredRsvps)

        const userEmail = meData.profile?.email
        const isOwner = eventArray.some((e) => e.admin_email === userEmail)

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

  const userEmail = profile?.email
  const isOwner = Array.isArray(events) && events.some((e) => e.admin_email === userEmail)
  const isClientOrOwner =
    profile?.role === 'client' ||
    profile?.role === 'admin' ||
    events.some((ev) => ev.admin_email === profile?.email)

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

  // 🟢 Event creation handler
  async function handleCreateEvent(e) {
    e.preventDefault()
    setCreatingEvent(true)
    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
      const payload = {
        ...eventData,
        admin_email: profile?.email,
        approval_status: 'pending',
        datetime: new Date(eventData.datetime).toISOString(),
      }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      alert('✅ Event suggested for approval!')
      setEventData({
        name: '',
        title: '',
        city: '',
        venue: '',
        datetime: '',
        description: '',
        details: '',
        tags: '',
        price: '',
        image_name: '',
      })
      setShowEventForm(false)
    } catch (err) {
      alert(`❌ ${err.message}`)
    } finally {
      setCreatingEvent(false)
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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg max-w-6xl w-full p-6 text-white relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">✕</button>

        <h2 className="text-2xl font-bold mb-1 text-blue-400">{t('YourAccount')}</h2>
        {profile?.email && <p className="text-sm text-gray-400 mb-6">Email: {profile.email}</p>}

        {/* 🟢 Event Suggestion Section */}
        {(profile?.role === 'client' || profile?.role === 'admin') && (
          <div className="mb-8">
            {!showEventForm ? (
              <button
                onClick={() => setShowEventForm(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                + Suggest New Event
              </button>
            ) : (
              <form onSubmit={handleCreateEvent} className="mt-4 space-y-3 bg-zinc-800 p-4 rounded-xl">
                <h3 className="text-lg font-semibold mb-2 text-green-400">Suggest a New Event</h3>

                <input
                  type="text"
                  placeholder="Event Name"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.name}
                  onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                  required
                />

                <input
                  type="text"
                  placeholder="Event Title"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.title}
                  onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                  required
                />

                <input
                  type="text"
                  placeholder="City"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.city}
                  onChange={(e) => setEventData({ ...eventData, city: e.target.value })}
                />

                <input
                  type="text"
                  placeholder="Venue"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.venue}
                  onChange={(e) => setEventData({ ...eventData, venue: e.target.value })}
                />

                <input
                  type="datetime-local"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.datetime}
                  onChange={(e) => setEventData({ ...eventData, datetime: e.target.value })}
                  required
                />

                <input
                  type="text"
                  placeholder="Image file name (e.g. cafe1.jpg)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.image_name}
                  onChange={(e) => setEventData({ ...eventData, image_name: e.target.value })}
                />

                <textarea
                  placeholder="Description"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.description}
                  onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                  rows="2"
                />

                <textarea
                  placeholder="Details (host, venue, etc.)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.details}
                  onChange={(e) => setEventData({ ...eventData, details: e.target.value })}
                  rows="2"
                />

                <input
                  type="text"
                  placeholder="Tags (comma-separated)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.tags}
                  onChange={(e) => setEventData({ ...eventData, tags: e.target.value })}
                />

                <input
                  type="number"
                  placeholder="Ticket Price (optional)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                  value={eventData.price}
                  onChange={(e) => setEventData({ ...eventData, price: e.target.value })}
                />

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creatingEvent}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
                  >
                    {creatingEvent ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEventForm(false)}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ... all other sections (Tickets, RSVPs, metrics, settings) remain unchanged ... */}
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

