'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import ConfirmationModal from './ConfirmationModal'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

export default function DynamicEventCard({ event, counters, auth }) {
  const [loading, setLoading] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState(null)
  const [agree, setAgree] = useState(false)

  async function handleWebAction(stage) {
    if (!auth?.token) {
      alert('Please connect wallet to continue')
      return
    }

    setSelectedStage(stage)
    setConfirmModalOpen(true)
  }

  async function confirmAction() {
    if (!agree) {
      alert('You must agree to the event policy before continuing.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ eventId: event.id, stage: selectedStage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to register')

      // ---- Handle Stripe Payment Flow ----
      if (data.clientSecret) {
        const stripe = await stripePromise
        const result = await stripe.confirmCardPayment(data.clientSecret)
        if (result.error) {
          throw new Error(result.error.message)
        }
        if (result.paymentIntent.status !== 'succeeded') {
          throw new Error('Payment did not succeed')
        }
      }

      alert('✅ Successfully registered!')
      setConfirmModalOpen(false)
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ---- Counter display ----
  const displayCount =
    event.stage === 'prebook'
      ? `${counters.prebook_count} / ${event.min_attendees}`
      : `${counters.book_count} / ${event.max_attendees}`

  return (
    <div className="bg-gray-900 text-white p-4 rounded-xl shadow-md">
      <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
      <p className="text-sm text-gray-400 mb-2">{event.description}</p>
      <p className="text-xs text-gray-400 mb-2">Date: {event.date}</p>
      <p className="text-xs text-gray-400 mb-2">Location: {event.location}</p>
      <p className="text-xs text-gray-400 mb-2">Status: {event.stage}</p>
      <p className="text-xs text-gray-400 mb-4">Count: {displayCount}</p>

      {/* Buttons */}
      {event.stage === 'prebook' && (
        <button
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg mr-2"
          onClick={() => handleWebAction('prebook')}
        >
          Join Guestlist
        </button>
      )}

      {event.stage === 'book' && (
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          onClick={() => handleWebAction('book')}
        >
          Pay & Book ({event.price} DKK)
        </button>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <ConfirmationModal
          title="Confirm Registration"
          onCancel={() => setConfirmModalOpen(false)}
          onConfirm={confirmAction}
          loading={loading}
        >
          {event.policy_text && (
            <p className="text-xs text-gray-400 mb-2">{event.policy_text}</p>
          )}
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            I agree to guidelines and receive emails for this event.
          </label>
        </ConfirmationModal>
      )}
    </div>
  )
}

