'use client'
import { useState, useEffect } from 'react'
import QRCode from 'react-qr-code'

export default function YourAccountModal({ onClose, refreshTrigger }) {
  const [profile, setProfile] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [qrModal, setQrModal] = useState(null)


  useEffect(() => {
    async function loadAccount() {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setProfile(null)
        setTickets([])
        setLoading(false)
        return
      }

      try {
        // fetch profile
        const profileRes = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data || null)
        } else {
          setProfile(null)
        }

        // fetch tickets
          const ticketsRes = await fetch('/api/user/myTickets', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (ticketsRes.ok) {
          const data = await ticketsRes.json()
          setTickets(Array.isArray(data.tickets) ? data.tickets : [])
        } else {
          setTickets([])
        }
      } catch (err) {
        console.error('Failed to load account info', err)
        setProfile(null)
        setTickets([])
      } finally {
        setLoading(false)
      }
    }

    loadAccount()
  }, [refreshTrigger])

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 text-white relative overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4">Your Account</h2>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : profile ? (
          <>
            <div className="mb-4">
              <p><strong>Username:</strong> {profile.username || '—'}</p>
              <p><strong>Email:</strong> {profile.email || '—'}</p>
            </div>

            <h3 className="text-lg font-semibold mb-2">Your Tickets</h3>
            {tickets.length === 0 ? (
              <p className="text-gray-400">No tickets yet.</p>
            ) : (
              <ul className="space-y-2">
                {tickets.map((ticket) => (
                  <li
                    key={ticket.id || Math.random()}
                    className="p-2 bg-zinc-800 rounded flex justify-between items-center"
                  >
                    <span>
                      {ticket.event_name || 'Unknown Event'} — {ticket.stage || 'Unknown'}
                    </span>
                   {ticket.qrData ? (
  <button onClick={() => setQrModal(ticket)}>
    <QRCode value={ticket.qrData} size={48} />
  </button>
) : (
  <span className="text-xs text-gray-400">No QR</span>
)}

                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-gray-400">Not logged in.</p>
        )}
      </div>
    </div>
{qrModal && (
  <div
    className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
    onClick={() => setQrModal(null)}
  >
    <div className="bg-zinc-900 p-6 rounded-lg" onClick={e => e.stopPropagation()}>
      <h3 className="mb-4">{qrModal.event_name}</h3>
      <QRCode value={qrModal.qrData} size={256} />
      <button
        onClick={() => setQrModal(null)}
        className="mt-4 px-4 py-2 bg-blue-600 rounded text-white"
      >
        Close
      </button>
    </div>
  </div>
)}



  )
}





