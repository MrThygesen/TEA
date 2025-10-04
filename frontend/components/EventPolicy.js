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
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ eventId: event.id, quantity })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')

      onBookingSuccess?.(data)
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
      onClose?.()
    }
  }

  return (
    <div className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] text-white shadow-xl relative">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-gray-400 hover:text-white"
      >
        ✕
      </button>

      <h2 className="text-xl font-bold mb-2">{event.name}</h2>
      <p className="text-sm text-gray-400 mb-3">
        📅 {new Date(event.datetime).toLocaleDateString()} · 📍 {event.city}
      </p>

      {event.image && <img src={event.image} alt={event.name} className="w-full h-40 object-cover rounded mb-4" />}
      <p className="text-gray-200 mb-4">{event.description}</p>

      <div className="mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Price per ticket:</span>
          <span>{event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : "Free"}</span>
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

      <label className="flex items-center gap-2 mb-6 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="form-checkbox"
        />
        I agree to follow the event guidelines.
      </label>

      <div className="flex justify-end">
        <button
          onClick={handleBooking}
          disabled={!agreed || loading}
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Get Ticket'}
        </button>
      </div>
    </div>
  )
}

