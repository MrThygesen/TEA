// pages/account.js
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFetchEvents = async () => {
    if (!email) {
      setError('Please enter your verified email to load your account.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/user-events?email=${encodeURIComponent(email)}`)
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || 'Failed to fetch events')
      }
      const data = await res.json()
      setEvents(data)
      setEmailSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="bg-black text-white min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-blue-400">Your Account</h1>

        {/* Email input */}
        {!emailSaved && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <p className="text-gray-300 mb-2">
              Enter your <strong>verified email</strong> to see your registrations.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 p-2 rounded text-black"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                onClick={handleFetchEvents}
              >
                Load
              </button>
            </div>
            {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {/* Event list */}
        {loading && <p>Loading your registrations...</p>}

        {emailSaved && !loading && events.length === 0 && (
          <p className="text-gray-400">
            No registrations found for <strong>{email}</strong>.
          </p>
        )}

        {events.map((event) => (
          <div
            key={event.id}
            className="border border-zinc-700 rounded-xl p-4 bg-zinc-900 shadow"
          >
            <h2 className="text-xl font-semibold">{event.name}</h2>
            <p className="text-sm text-gray-400">
              {new Date(event.datetime).toLocaleString()}
            </p>
            <p className="text-sm">
              Status:{' '}
              {event.has_paid ? '✅ Paid (Ticket Available)' : '💳 Not Paid (Pre-booked only)'}
            </p>
            {event.has_paid && (
              <Link
                href={`/ticket/${event.id}?email=${encodeURIComponent(email)}`}
                className="mt-2 inline-block text-blue-400 hover:underline"
              >
                View Ticket
              </Link>
            )}
          </div>
        ))}

        <Link href="/" className="text-blue-400 hover:underline">
          ← Back to Home
        </Link>
      </div>
    </main>
  )
}

