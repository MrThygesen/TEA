// pages/event/[id]/policy.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import EventPolicy from '../../../components/EventPolicy'

export default function EventPolicyPage() {
  const router = useRouter()
  const { id } = router.query
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(data => setEvent(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <p className="text-center mt-12 text-white">Loading event...</p>
  }

  if (!event) {
    return <p className="text-center mt-12 text-red-500">Event not found</p>
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <EventPolicy
        event={event}
        onBookingSuccess={(data) => {
          alert(`Success! You booked ${data.quantity} ticket(s).`)
          router.push(`/event/${event.id}`) // redirect back to event page or wherever
        }}
        onClose={() => router.push(`/event/${event.id}`)} // close modal
      />
    </div>
  )
}

