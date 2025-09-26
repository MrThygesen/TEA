//index.js
'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import YourAccountModal from '../components/YourAccountModal'
import DynamicEventCard from '../components/DynamicEventCard'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('auth')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export default function HomePage() {
  const { address } = useAccount()
  const [authUser, setAuthUser] = useState(loadAuth())
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [events, setEvents] = useState([])

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events/list')
        const data = await res.json()
        setEvents(data)
      } catch (err) {
        console.error('Error fetching events', err)
      }
    }
    fetchEvents()
  }, [])

  function handleLogout() {
    localStorage.removeItem('auth')
    setAuthUser(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">TEA Events</h1>
        <div className="flex gap-2 items-center">
          <ConnectButton />
          {authUser && (
            <button
              className="text-xs bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
              onClick={handleLogout}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Admin Panel */}
      {address === process.env.NEXT_PUBLIC_ADMIN_ADDRESS && (
        <div className="mb-6">
          <AdminSBTManager />
        </div>
      )}

      {/* Event List */}
      <div className="grid gap-4">
        {events.map((event) => (
          <DynamicEventCard
            key={event.id}
            event={event}
            counters={event.counters}
            auth={authUser}
          />
        ))}
      </div>

      {/* Account Modal */}
      {showAccountModal && (
        <YourAccountModal
          onClose={() => setShowAccountModal(false)}
          refreshTrigger={authUser}
        />
      )}
    </div>
  )
}

