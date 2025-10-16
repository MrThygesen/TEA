// components/AdminSBTManager.js
'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100


export default function AdminSBTManager() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [authEmail, setAuthEmail] = useState('')

  // Load events
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

  // Load admin email from localStorage token data (if stored)
  useEffect(() => {
    const userEmail = localStorage.getItem('email')
    if (userEmail) setAuthEmail(userEmail)
  }, [])

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
      toast.success('Event deleted')
      fetchEvents()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 text-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-green-400">Admin Event Manager</h2>

      {/* --- CREATE / EDIT FORM --- */}
      {showForm ? (
        <AdminEventForm
          selectedEvent={editingEvent}
          adminEmail={authEmail}
          onSaved={() => {
            setShowForm(false)
            setEditingEvent(null)
            fetchEvents()
          }}
          onCancel={() => {
            setShowForm(false)
            setEditingEvent(null)
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 mb-6 bg-green-600 hover:bg-green-700 rounded-xl text-white"
        >
          + Create New Event
        </button>
      )}

      {/* --- EVENT TABLE --- */}
      <div className="overflow-x-auto">
        {loading ? (
          <p>Loading events...</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-800 text-left">
                <th className="p-3 border-b border-zinc-700">Title</th>
                <th className="p-3 border-b border-zinc-700">City</th>
                <th className="p-3 border-b border-zinc-700">Venue</th>
                <th className="p-3 border-b border-zinc-700">Date/Time</th>
                <th className="p-3 border-b border-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-zinc-800 hover:bg-zinc-900">
                  <td className="p-3">{ev.title}</td>
                  <td className="p-3">{ev.city}</td>
                  <td className="p-3">{ev.venue}</td>
                  <td className="p-3">
                    {new Date(ev.datetime).toLocaleString('da-DK', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => {
                        setEditingEvent(ev)
                        setShowForm(true)
                      }}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {events.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="text-center p-4 text-gray-500">
                    No events found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   INLINE EVENT CREATION / EDIT FORM
-------------------------------------------------------------------*/
function AdminEventForm({ selectedEvent, adminEmail, onSaved, onCancel }) {
  const [eventData, setEventData] = useState({
    id: selectedEvent?.id || '',
    name: selectedEvent?.name || '',
    title: selectedEvent?.title || '',
    city: selectedEvent?.city || '',
    venue: selectedEvent?.venue || '',
    datetime: selectedEvent?.datetime
      ? new Date(selectedEvent.datetime).toISOString().slice(0, 16)
      : '',
    description: selectedEvent?.description || '',
    details: selectedEvent?.details || '',
    tags: selectedEvent?.tags || '',
    price: selectedEvent?.price || '',
    image_url: selectedEvent?.image_url || '',
    admin_email: selectedEvent?.admin_email || adminEmail || '',
  })
  const [saving, setSaving] = useState(false)
  const isEditing = !!selectedEvent?.id

  const handleChange = (field, value) => {
    setEventData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...eventData,
        datetime: new Date(eventData.datetime).toISOString(),
      }

      const res = await fetch('/api/events', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save event')
      toast.success(isEditing ? '✅ Event updated' : '✅ Event created')

      onSaved?.()
    } catch (err) {
      toast.error(`❌ ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 bg-zinc-800 p-5 rounded-2xl shadow-lg text-sm space-y-3 border border-zinc-700"
    >
      <h3 className="text-lg font-semibold text-green-400 mb-2">
        {isEditing ? 'Edit Event' : 'Create New Event'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Event Name"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Event Title"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="City"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.city}
          onChange={(e) => handleChange('city', e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Venue"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.venue}
          onChange={(e) => handleChange('venue', e.target.value)}
          required
        />
        <input
          type="datetime-local"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.datetime}
          onChange={(e) => handleChange('datetime', e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Admin Email"
          readOnly
          className="bg-zinc-700 border border-zinc-600 rounded-xl px-3 py-2 text-gray-400 cursor-not-allowed"
          value={eventData.admin_email}
        />
      </div>

      <input
        type="text"
        placeholder="Image file name (e.g. cafe1.jpg)"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
        value={eventData.image_url}
        onChange={(e) => handleChange('image_url', e.target.value)}
      />

      <textarea
        placeholder="Description"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
        rows="2"
        value={eventData.description}
        onChange={(e) => handleChange('description', e.target.value)}
      />
      <textarea
        placeholder="Host and Venue Details"
        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
        rows="2"
        value={eventData.details}
        onChange={(e) => handleChange('details', e.target.value)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.tags}
          onChange={(e) => handleChange('tags', e.target.value)}
        />
        <input
          type="number"
          placeholder="Ticket Price (optional)"
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2"
          value={eventData.price}
          onChange={(e) => handleChange('price', e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Submit for Approval'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-xl text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

