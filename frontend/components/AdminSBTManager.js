// components/AdminSBTManager.js
'use client'

import React, { useEffect, useState } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100

export default function AdminSBTManager() {
  // 🟢 State
  const [events, setEvents] = useState([])
  const [editingEventId, setEditingEventId] = useState(null)
  const [editData, setEditData] = useState({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [creatingEvent, setCreatingEvent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authEmail, setAuthEmail] = useState('')

  const [eventData, setEventData] = useState({
    name: '',
    title: '',
    city: '',
    venue: '',
    datetime: '',
    description: '',
    details: '',
    tags: '',
    price: '',
    image_url: '',
  })

  // 🟢 Load admin email from localStorage token data (if stored)
  useEffect(() => {
    const userEmail = localStorage.getItem('email')
    if (userEmail) setAuthEmail(userEmail)
  }, [])

  // 🟢 Load events
  const fetchEvents = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/events')
      const data = await res.json()
      setEvents(data.events || [])
    } catch (err) {
      toast.error('Failed to load events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  // 🟢 Create event
  async function handleCreateEvent(e) {
    e.preventDefault()
    setCreatingEvent(true)
    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
      const payload = {
        ...eventData,
        admin_email: authEmail || '',
        approval_status: 'pending',
        datetime: new Date(eventData.datetime).toISOString(),
      }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      toast.success('✅ Event submitted for approval!')
      setEventData({
        name: '',
        title: '',
        city: '',
        venue: '',
        datetime: '',
        description: '',
        details: '',
        tags: '',
        price: '',
        image_url: '',
      })
      setShowEventForm(false)
      fetchEvents()
    } catch (err) {
      toast.error(`❌ ${err.message}`)
    } finally {
      setCreatingEvent(false)
    }
  }

  // 🟢 Update event (inline)
  async function handleUpdateEvent(e, id) {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const token = localStorage.getItem('token')
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
      const payload = {
        ...editData,
        datetime: new Date(editData.datetime).toISOString(),
      }
      const res = await fetch(`/api/events?id=${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update event')
      toast.success('✅ Event updated successfully')
      setEditingEventId(null)
      fetchEvents()
    } catch (err) {
      toast.error(`❌ ${err.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // 🟢 Delete event
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('🗑️ Event deleted')
      fetchEvents()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // 🟢 Render
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 text-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-green-400">Admin Event Manager</h2>

      {/* --- Inline Event Creation Section --- */}
      <div className="my-6">
        {!showEventForm ? (
          <button
            onClick={() => setShowEventForm(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            + Create New Event
          </button>
        ) : (
          <form onSubmit={handleCreateEvent} className="mt-4 space-y-3 bg-zinc-800 p-4 rounded-xl">
            <h3 className="text-lg font-semibold mb-2 text-green-400">Create a New Event</h3>

            <input
              type="text"
              placeholder="Event Name"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.name}
              onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Event Title"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.title}
              onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="City"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.city}
              onChange={(e) => setEventData({ ...eventData, city: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Venue"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.venue}
              onChange={(e) => setEventData({ ...eventData, venue: e.target.value })}
              required
            />

            <input
              type="datetime-local"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.datetime}
              onChange={(e) => setEventData({ ...eventData, datetime: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Image file name (e.g. cafe1.jpg)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.image_url}
              onChange={(e) => setEventData({ ...eventData, image_url: e.target.value })}
            />

            <textarea
              placeholder="Description"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.description}
              onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
              rows="2"
            />

            <textarea
              placeholder="Host and Venue Details"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.details}
              onChange={(e) => setEventData({ ...eventData, details: e.target.value })}
              rows="2"
            />

            <input
              type="text"
              placeholder="Tags (comma-separated)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.tags}
              onChange={(e) => setEventData({ ...eventData, tags: e.target.value })}
            />

            <input
              type="number"
              placeholder="Ticket Price (optional)"
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
              value={eventData.price}
              onChange={(e) => setEventData({ ...eventData, price: e.target.value })}
            />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creatingEvent}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
              >
                {creatingEvent ? 'Submitting...' : 'Submit for Approval'}
              </button>
              <button
                type="button"
                onClick={() => setShowEventForm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* --- Event List with Inline Editing --- */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <p>Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-400">No events found yet.</p>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
              {editingEventId === ev.id ? (
                <form onSubmit={(e) => handleUpdateEvent(e, ev.id)} className="space-y-3">
                  <input
                    type="text"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                  <input
                    type="text"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="City"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    value={editData.city}
                    onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Venue"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    value={editData.venue}
                    onChange={(e) => setEditData({ ...editData, venue: e.target.value })}
                  />
                  <input
                    type="datetime-local"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    value={
                      editData.datetime
                        ? new Date(editData.datetime).toISOString().slice(0, 16)
                        : ''
                    }
                    onChange={(e) => setEditData({ ...editData, datetime: e.target.value })}
                  />
                  <textarea
                    placeholder="Description"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    rows="2"
                    value={editData.description}
                    onChange={(e) =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                  />
                  <textarea
                    placeholder="Host and Venue Details"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                    rows="2"
                    value={editData.details}
                    onChange={(e) =>
                      setEditData({ ...editData, details: e.target.value })
                    }
                  />
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
                    >
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingEventId(null)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-lg font-semibold text-green-400">{ev.title}</h4>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditingEventId(ev.id)
                          setEditData(ev)
                        }}
                        className="text-blue-400 hover:text-blue-500 text-sm"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="text-red-400 hover:text-red-500 text-sm"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">
                    <strong>City:</strong> {ev.city} | <strong>Venue:</strong> {ev.venue}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {new Date(ev.datetime).toLocaleString()}
                  </p>
                  {ev.description && (
                    <p className="text-gray-400 text-sm mt-2">{ev.description}</p>
                  )}
                  {ev.details && (
                    <p className="text-gray-500 text-xs mt-1 italic">{ev.details}</p>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

