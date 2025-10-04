// pages/event/[id]/policy.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import EventPolicy from '../../../components/EventPolicy'

export default function EventPolicyPage() {
  const router = useRouter()
  const { id } = router.query
  const [event, setEvent] = useState(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(setEvent)
      .catch(console.error)
  }, [id])

  if (!event) return <p className="text-center mt-12 text-white">Loading event...</p>

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <EventPolicy event={event} onClose={() => router.push('/')} />
    </div>
  )
}

