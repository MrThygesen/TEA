'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('edgy_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}
function saveAuth(user) {
  try { localStorage.setItem('edgy_auth_user', JSON.stringify(user)) } catch (_) {}
}
function clearAuth() {
  try { localStorage.removeItem('edgy_auth_user') } catch (_) {}
}

// ---------------------------
// Dynamic Event Card Component
// ---------------------------
function DynamicEventCard({ event }) {
  const [showModal, setShowModal] = useState(false)
  const telegramLink = `https://t.me/TeaIsHereBot?start=${event.id}`

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow flex flex-col justify-between">
        <img
          src={event.image_url || '/default-event.jpg'}
          alt={event.name}
          className="w-full h-40 object-cover rounded mb-3"
        />
        <h3 className="text-lg font-semibold mb-1">{event.name}</h3>
        <p className="text-sm mb-2">
          {event.description?.split(' ').slice(0, 30).join(' ')}...
        </p>
        <div className="flex flex-wrap gap-1 mb-2">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">{tag}</span>
          ))}
        </div>

        <div className="flex justify-between items-center mt-auto mb-2">
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-400 hover:underline text-sm"
          >
            Preview
          </button>
          {(event.registered_users || 0) < event.min_attendees ? (
            <button
              onClick={() => window.open(telegramLink, '_blank')}
              className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
            >
              Prebook
            </button>
          ) : (
            <button
              onClick={() => window.open(`https://t.me/TeaIsHereBot?start=buy_${event.id}`, '_blank')}
              className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
            >
              Book
            </button>
          )}
        </div>

        <div className="flex justify-between text-xs text-gray-400 border-t border-zinc-600 pt-2">
          <span>💰 {event.price && Number(event.price) > 0 ? `${event.price} USD` : 'Free'}</span>
          <span>👥 {event.registered_users || 0} Users</span>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{event.name}</h2>
            <img
              src={event.image_url || '/default-event.jpg'}
              alt={event.name}
              className="w-full h-56 object-contain rounded mb-4"
            />
            <p className="mb-2 text-sm text-gray-400">
              {new Date(event.datetime).toLocaleString()} @ {event.venue} ({event.venue_type || 'N/A'})
            </p>
            <p className="mb-4">{event.details}</p>

            {event.basic_perk && (
              <p className="text-sm text-gray-300">
                <strong>Basic Perk:</strong> {event.basic_perk}
              </p>
            )}
            {event.paid_count >= 10 && event.advanced_perk && (
              <p className="text-sm text-gray-300">
                <strong>Advanced Perk:</strong> {event.advanced_perk}
              </p>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------
// Event List Row
// ---------------------------
function EventListRow({ event, onPreview }) {
  return (
    <div className="grid grid-cols-5 gap-2 items-center py-2 px-3 border-b border-zinc-700 text-sm">
      <span className="truncate">{event.venue_type || '—'}</span>
      <span className="truncate">{new Date(event.datetime).toLocaleDateString()}</span>
      <span className="truncate">{event.name}</span>
      <span className="truncate">{event.city}</span>
      <button onClick={onPreview} className="justify-self-end text-blue-400 hover:underline">Preview</button>
    </div>
  )
}

// ---------------------------
// Main Home Component
// ---------------------------
export default function Home() {
  const { address } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)
  useEffect(() => {
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])
  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSe
