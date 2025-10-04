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
  const [userTickets, setUserTickets] = useState(0)
  const [maxPerUser, setMaxPerUser] = useState(5) // adjust if needed

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(setEvent)
      .catch(err => console.error('Failed to load event:', err))
  }, [id])

  const handleBooking = async () => {
    if (!event) return
    if (!agreed) return alert('⚠️ Please agree to the guidelines.')
    
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ eventId: event.id, quantity })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Booking failed')

      alert('✅ Ticket booked! Check your email for confirmation.')
      setUserTickets(prev => prev + quantity)
    } catch (err) {
      console.error(err)
      alert(`⚠️ Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!event) return <p className="text-white p-6">Loading event...</p>

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] shadow-xl relative">
        <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
        <p className="text-sm text-gray-400 mb-3">
          📅 {new Date(event.datetime).toLocaleDateString()} · 🕒 {new Date(event.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>
          📍 {event.city}{event.venue_location ? `, ${event.venue_location}` : ''}
        </p>

        {event.image_url && (
          <img
            src={event.image_url}
            alt={event.name}
            className="w-full h-40 object-cover rounded mb-4"
          />
        )}

        <p className="text-gray-200 mb-4">{event.description}</p>

        {/* Ticket info */}
        <div className="mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Price per ticket:</span>
            <span>{event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : 'Free'}</span>
          </div>
          <div className="flex justify-between items-center">
            <label htmlFor="quantity">Quantity:</label>
            <input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min={1}
              max={maxPerUser - userTickets}
              className="w-16 p-1 rounded bg-zinc-800 border border-zinc-600 text-white text-center"
            />
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total:</span>
            <span>{event.price && Number(event.price) > 0 ? `${(Number(event.price) * quantity).toFixed(2)} USD` : 'Free'}</span>
          </div>
        </div>

        {/* Agreement */}
        <label className="flex items-center gap-2 mb-6 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="form-checkbox"
          />
          I follow the guidelines of the event.
        </label>

        {/* Book button */}
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
    </main>
  )
}

