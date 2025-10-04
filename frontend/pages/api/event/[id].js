// pages/event/[id].js
'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function EventPage() {
  const router = useRouter()
  const { id } = router.query
  const [event, setEvent] = useState(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(setEvent)
      .catch(err => console.error(err))
  }, [id])

  if (!event) return <p className="text-white p-6">Loading...</p>

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="bg-zinc-900 max-w-3xl w-full rounded-xl p-6 shadow-lg border border-zinc-700">
        <h1 className="text-3xl font-bold mb-3">{event.name}</h1>
        <p className="text-gray-400 mb-3">
          📅 {new Date(event.datetime).toLocaleDateString()} · 
          🕒 {new Date(event.datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} <br/>
          📍 {event.city} {event.venue ? `· ${event.venue}` : ''}
        </p>

        {event.image_url && (
          <img src={event.image_url} alt={event.name} className="w-full h-64 object-cover rounded mb-4" />
        )}

        <p className="mb-4">{event.description}</p>
        <p className="text-sm text-gray-300 mb-4">{event.details}</p>

        {/* Perks */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2 text-blue-400">🎁 Perks</h3>
          {event.basic_perk && <p>✨ Basic: {event.basic_perk}</p>}
          {event.advanced_perk && <p>💎 Advanced: {event.advanced_perk}</p>}
        </div>

        {/* Tickets */}
        <div className="flex justify-between mb-4">
          <span>💰 {event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : "Free"}</span>
          <span>👥 Max {event.max_attendees || '∞'}</span>
        </div>

        {/* You can reuse booking/RSVP buttons here */}
      </div>
    </main>
  )
}


