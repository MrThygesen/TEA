//frontend/pages/event/[id].js
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function EventPage() {
  const router = useRouter()
  const { id } = router.query
  const [event, setEvent] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(setEvent)
      .catch(err => console.error('Failed to load event:', err))
  }, [id])

async function handleBooking() {
  if (!agreed) return
  setLoading(true)
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/events/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({ eventId: event.id, quantity }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Booking failed')

    if (data.checkoutUrl) {
      // Paid ticket → redirect to Stripe checkout
      window.location.href = data.checkoutUrl
    } else {
      // Free ticket → already booked
      alert('✅ Ticket booked! Check your email for the ticket.')
      onBookingSuccess?.(data)
    }
  } catch (err) {
    console.error(err)
    alert(err.message)
  } finally {
    setLoading(false)
  }
}

  if (!event) return <p className="text-white p-6">Loading event...</p>

  const tags = [event.tag1, event.tag2, event.tag3].filter(Boolean)

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="bg-zinc-900 rounded-2xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] shadow-2xl relative">
        <h1 className="text-2xl font-bold mb-1">{event.name}</h1>
        <p className="text-sm text-gray-400 mb-3">
          📅 {new Date(event.datetime).toLocaleDateString()} · 🕒{' '}
          {new Date(event.datetime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          <br />
          📍 {event.city}
          {event.venue_location ? `, ${event.venue_location}` : ''}
        </p>

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.name}
            className="w-full h-48 object-cover rounded-xl mb-4"
          />
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="bg-zinc-800 text-xs px-3 py-1 rounded-full border border-zinc-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span>🎟 Price per ticket:</span>
            <span>
              {event.price && Number(event.price) > 0
                ? `${Number(event.price).toFixed(2)} USD`
                : 'Free'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="quantity">Quantity:</label>
            <input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={1}
              max={event.max_attendees || 10}
              className="w-16 p-1 rounded bg-zinc-800 border border-zinc-600 text-white text-center"
            />
          </div>
        </div>

        <div className="border-t border-zinc-700 pt-4 mt-4">
          <label className="flex items-center gap-2 mb-4 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="form-checkbox"
            />
            I agree to follow the event guidelines.
          </label>

          <div className="flex justify-end mb-6">
            <button
              onClick={handleBooking}
              disabled={!agreed || loading}
              className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Get Ticket'}
            </button>
          </div>

          {/* Event Details */}
          <div className="text-gray-300 text-sm space-y-1 mt-2">
            {event.description && (
              <p className="text-gray-400 leading-snug">{event.description}</p>
            )}
            {event.additional_info && (
              <p className="mt-2 text-gray-500 italic">{event.additional_info}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

