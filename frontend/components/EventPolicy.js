// components/EventPolicy.js
'use client'
import { useState } from 'react'

export default function EventPolicy({ event, onBookingSuccess, onClose }) {
  const [quantity, setQuantity] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const tags = [event.tag1, event.tag2, event.tag3].filter(Boolean)

  return (
    <div className="bg-zinc-900 rounded-2xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] text-white shadow-2xl relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-white"
      >
        ✕
      </button>

      {/* Title */}
      <h2 className="text-2xl font-bold mb-1">{event.name}</h2>
      <p className="text-sm text-gray-400 mb-3">
        📅 {new Date(event.datetime).toLocaleDateString()} · 📍 {event.city}
      </p>

      {/* Image */}
      {event.image && (
        <img
          src={event.image}
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

      {/* Ticket Section */}
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

      {/* Policy Confirmation */}
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
          {event.venue_location && (
            <p>📍 Venue: {event.venue_location}</p>
          )}
          {event.description && (
            <p className="mt-2 text-gray-400 leading-snug">{event.description}</p>
          )}
          {event.additional_info && (
            <p className="mt-2 text-gray-500 italic">{event.additional_info}</p>
          )}
        </div>
      </div>
    </div>
  )
}

