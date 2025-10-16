// components/AdminSBTManager.js
'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100

export default function AdminSBTManager() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const previewCache = useRef({})

  // admin gating (superadmin wallet)
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  // --- SBT state (kept from your original)
  const [typeId, setTypeId] = useState(1n)
  const [title, setTitle] = useState('')
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState('')
  const [createSbtCity, setCreateSbtCity] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [burnTokenId, setBurnTokenId] = useState('')
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [sbtTypesData, setSbtTypesData] = useState([])

  // --- Event & moderation state
  const [events, setEvents] = useState([])
  const [activeTab, setActiveTab] = useState('pending') // 'pending' | 'approved' | 'rejected'
  const [showCreateInline, setShowCreateInline] = useState(false)
  const [creating, setCreating] = useState(false)

  // profile (logged in user) so we can set admin_email automatically
  const [profile, setProfile] = useState(null)

  // Event form contains all DB columns you referenced
  const blankEvent = {
    id: '',
    admin_email: '',
    group_id: '',
    name: '',
    city: '',
    datetime: '',
    min_attendees: 1,
    max_attendees: 40,
    is_confirmed: false,
    is_rejected: false,
    description: '',
    details: '',
    venue: '',
    venue_type: '',
    basic_perk: '',
    advanced_perk: '',
    tag1: '',
    tag2: '',
    tag3: '',
    tag4: '',
    language: 'en',
    price: 0,
    image_url: '',
    status: 'pending',
  }
  const [eventForm, setEventForm] = useState({ ...blankEvent })

  // helpers for metadata templates
  const buildUri = (filename) => `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`
  const formatDisplayName = (filename) =>
    filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  // --- Fetch template list from GitHub
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('https://api.github.com/repos/MrThygesen/TEA/contents/data')
        const data = await res.json()
        const jsonFiles = Array.isArray(data) ? data.filter((f) => f.name?.endsWith('.json')).map((f) => f.name) : []
        setAvailableTemplates(jsonFiles)
      } catch (err) {
        console.error('Failed to fetch templates:', err)
      }
    }
    fetchTemplates()
  }, [])

  // fetch profile (so we know the current user's email) — reuses your /api/user/me
  useEffect(() => {
    async function loadProfile() {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        if (data?.profile) {
          setProfile(data.profile)
          // set admin_email initial value for eventForm
          setEventForm(f => ({ ...f, admin_email: data.profile.email || '' }))
        }
      } catch (err) {
        console.error('Failed loading profile in AdminSBTManager:', err)
      }
    }
    loadProfile()
  }, [])

  // existing code: SBT types fetch
  useEffect(() => {
    let mounted = true
    async function fetchTypes() {
      const typePromises = Array.from({ length: MAX_TYPES }, (_, i) =>
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV33_ABI,
          functionName: 'sbtTypes',
          args: [i + 1],
        }).catch(() => null)
      )
      const typesRaw = await Promise.all(typePromises)
      const types = []
      for (let i = 0; i < typesRaw.length; i++) {
        const sbtType = typesRaw[i]
        if (!sbtType) continue
        try {
          const [uri, active, maxSupplyBig, mintedBig, , burnableFlag] = sbtType
          if (!uri) continue
          let typeTitle = ''
          if (previewCache.current[uri]) {
            typeTitle = previewCache.current[uri].name
          } else {
            try {
              const res = await fetch(uri)
              const metadata = await res.json()
              typeTitle = metadata?.name || ''
              previewCache.current[uri] = metadata
            } catch {}
          }
          types.push({
            id: i + 1,
            uri,
            active,
            burnable: burnableFlag,
            maxSupply: Number(maxSupplyBig),
            minted: Number(mintedBig),
            title: typeTitle,
          })
        } catch (err) {
          console.error('Error parsing SBT type:', err)
        }
      }
      if (mounted) setSbtTypesData(types)
    }
    fetchTypes()
    return () => { mounted = false }
  }, [publicClient, loading])

  // --- SBT handlers (kept)
  const handlePreview = async () => {
    if (!title) return toast.error('Select a metadata template first')
    const uri = buildUri(title)
    if (previewCache.current[uri]) {
      setPreviewData(previewCache.current[uri])
      toast.success(`🔍 Preview: ${previewCache.current[uri].name}`)
      return
    }
    try {
      const res = await fetch(uri)
      const metadata = await res.json()
      setPreviewData(metadata)
      previewCache.current[uri] = metadata
      toast.success(`🔍 Preview: ${metadata.name}`)
    } catch {
      toast.error('Preview failed')
    }
  }

  const handleCreateType = async () => {
    if (!title || !maxSupply || !typeId || !createSbtCity) return toast.error('Fill in all fields')
    setLoading(true)
    try {
      const uri = buildUri(title)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV33_ABI,
        functionName: 'createType',
        args: [typeId, uri, BigInt(maxSupply), burnable],
      })
      toast.success('SBT type created')
      if (typeId <= 4999) {
        await postEventFromSbt(typeId, title, previewData?.date || new Date().toISOString(), createSbtCity)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create SBT type')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!typeId) return toast.error('Select Type ID')
    setLoading(true)
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV33_ABI,
        functionName: 'setTypeStatus',
        args: [typeId, true],
      })
      toast.success('SBT type activated')
    } catch (err) {
      console.error(err)
      toast.error('Activation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (!typeId) return toast.error('Select Type ID')
    setLoading(true)
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV33_ABI,
        functionName: 'setTypeStatus',
        args: [typeId, false],
      })
      toast.success('SBT type deactivated')
    } catch (err) {
      console.error(err)
      toast.error('Deactivation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBurn = async () => {
    if (!burnTokenId) return toast.error('Missing Token ID')
    setLoading(true)
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV33_ABI,
        functionName: 'burn',
        args: [BigInt(burnTokenId)],
      })
      toast.success('Token burned')
    } catch (err) {
      console.error(err)
      toast.error('Burn failed')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (eventId) => {
    await fetch('/api/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, approval_status: 'approved' })
    })
    fetchEvents() // refresh
  }

  const handleReject = async (eventId) => {
    await fetch('/api/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: eventId, approval_status: 'rejected' })
    })
    fetchEvents() // refresh
  }

  // when SBT posts event we want to attribute to the currently logged-in user if present
  async function postEventFromSbt(typeIdArg, titleArg, datetime, city) {
    try {
      const token = localStorage.getItem('token')
      const admin_email = profile?.email || process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''
      await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          admin_email,
          name: titleArg,
          city,
          datetime,
          min_attendees: 1,
        }),
      })
    } catch (err) {
      console.error('Error posting SBT type as event:', err)
    }
  }

  // ------------------ Events APIs ------------------

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      if (!Array.isArray(data)) {
        // if API returns object, try to adapt
        setEvents(data?.rows ?? [])
      } else {
        setEvents(data)
      }
    } catch (err) {
      console.error('fetchEvents error', err)
      toast.error('Failed to load events')
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    fetchEvents()
  }, [isAdmin])

  // Approve/reject (one click)
  const handleModeration = async (id, action) => {
    if (!id) return
    const approval_status = action === 'approve' ? 'approved' : 'rejected'
    try {
      const res = await fetch('/api/events', {
        method: 'PUT', // your api expects PUT with approval_status
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approval_status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Moderation failed')
      toast.success(`${approval_status}`)
      fetchEvents()
    } catch (err) {
      console.error('Moderation error', err)
      toast.error(err.message || 'Moderation failed')
    }
  }

  // --- Create event handler (now used by inline form)
  const handleCreateEvent = async (formData) => {
    if (!formData.name || !formData.city || !formData.datetime) {
      return toast.error('Please fill: name, city, datetime')
    }

    setCreating(true)
    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...formData,
        admin_email: formData.admin_email || profile?.email || '',
        datetime: new Date(formData.datetime).toISOString(),
      }

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')

      toast.success('✅ Event created successfully (pending approval)')
      setShowCreateInline(false)
      setEventForm({ ...blankEvent }) // reset form
      fetchEvents()
    } catch (err) {
      console.error('Create event error:', err)
      toast.error(err.message || 'Error creating event')
    } finally {
      setCreating(false)
    }
  }

  // ---------------- UI components ----------------

  // Event moderation panel (kept)
  function EventModerationPanel() {
    const pending = events.filter(ev => {
      if (ev.approval_status) return ev.approval_status === 'pending'
      if (typeof ev.is_confirmed !== 'undefined' || typeof ev.is_rejected !== 'undefined') {
        return (!ev.is_confirmed && !ev.is_rejected)
      }
      if (ev.status) return ev.status === 'pending'
      return true
    })
    const approved = events.filter(ev => {
      if (ev.approval_status) return ev.approval_status === 'approved'
      if (typeof ev.is_confirmed !== 'undefined') return !!ev.is_confirmed
      if (ev.status) return ev.status === 'approved'
      return false
    })
    const rejected = events.filter(ev => {
      if (ev.approval_status) return ev.approval_status === 'rejected'
      if (typeof ev.is_rejected !== 'undefined') return !!ev.is_rejected
      if (ev.status) return ev.status === 'rejected'
      return false
    })

    const shown = activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected

    return (
      <div>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setActiveTab('pending')} className={`px-3 py-1 rounded ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Pending ({pending.length})</button>
          <button onClick={() => setActiveTab('approved')} className={`px-3 py-1 rounded ${activeTab === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>Approved ({approved.length})</button>
          <button onClick={() => setActiveTab('rejected')} className={`px-3 py-1 rounded ${activeTab === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>Rejected ({rejected.length})</button>
          <button onClick={fetchEvents} className="ml-auto px-3 py-1 bg-gray-800 text-white rounded">Refresh</button>
        </div>

        <div className="overflow-auto max-h-96 border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">City</th>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Admin Email</th>
                <th className="p-2 text-left">Venue</th>
                <th className="p-2 text-left">Tags</th>
                <th className="p-2 text-left">Price</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(ev => (
                <tr key={ev.id} className="border-t">
                  <td className="p-2 align-top">{ev.id}</td>
                  <td className="p-2 align-top">
                    <div className="font-semibold">{ev.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{ev.description}</div>
                    {ev.details && <details className="text-xs mt-1"><summary className="cursor-pointer text-blue-600">Details</summary><div className="mt-1 text-xs whitespace-pre-wrap">{ev.details}</div></details>}
                  </td>
                  <td className="p-2 align-top">{ev.city}</td>
                  <td className="p-2 align-top">{ev.datetime ? new Date(ev.datetime).toLocaleString() : '-'}</td>
                  <td className="p-2 align-top">{ev.admin_email}</td>
                  <td className="p-2 align-top">{ev.venue ?? '-'}</td>
                  <td className="p-2 align-top">
                    {[ev.tag1, ev.tag2, ev.tag3, ev.tag4].filter(Boolean).map((t, i) => <span key={i} className="text-xs mr-1 px-1 bg-gray-200 rounded">{t}</span>)}
                  </td>
                  <td className="p-2 align-top">{ev.price ? `${ev.price}` : 'Free'}</td>
                  <td className="p-2 align-top">
                    {ev.approval_status ?? (ev.is_confirmed ? 'approved' : ev.is_rejected ? 'rejected' : 'pending')}
                  </td>
                  <td className="p-2 align-top space-x-1">
                    {(!ev.is_confirmed && !ev.is_rejected && (ev.approval_status === 'pending' || !ev.approval_status)) && (
                      <>
                        <button onClick={() => handleModeration(ev.id, 'approve')} className="px-2 py-1 bg-green-600 text-white rounded">Approve</button>
                        <button onClick={() => handleModeration(ev.id, 'reject')} className="px-2 py-1 bg-red-600 text-white rounded">Reject</button>
                      </>
                    )}
                    <button onClick={() => navigator.clipboard?.writeText(JSON.stringify(ev))} className="px-2 py-1 bg-gray-300 rounded">Copy</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // --- Inline create event UI (replaces modal)
  function CreateEventInline() {
    const [local, setLocal] = useState({ ...eventForm })

    useEffect(() => {
      // init admin_email if profile available
      setLocal(prev => ({ ...prev, admin_email: prev.admin_email || profile?.email || '' }))
    }, [profile])

    const handleField = (k, v) => setLocal(prev => ({ ...prev, [k]: v }))

    const submit = async (e) => {
      e.preventDefault()
      // use handleCreateEvent above
      await handleCreateEvent(local)
    }

    return (
      <div className="border border-zinc-700 bg-zinc-800 p-4 rounded-lg mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-blue-400">Create Event (Inline)</h3>
          <div className="flex gap-2">
            <button onClick={() => { setShowCreateInline(false) }} className="px-3 py-1 bg-gray-600 rounded text-white">Close</button>
            <button onClick={() => { setLocal({ ...blankEvent, admin_email: profile?.email || '' }); setEventForm({ ...blankEvent }) }} className="px-3 py-1 bg-gray-700 rounded text-white">Reset</button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Event Name" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.name} onChange={e => handleField('name', e.target.value)} />
          <input required placeholder="Title (short)" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.description} onChange={e => handleField('description', e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input required placeholder="City" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.city} onChange={e => handleField('city', e.target.value)} />
            <input required type="datetime-local" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.datetime} onChange={e => handleField('datetime', e.target.value)} />
          </div>

          <input placeholder="Venue" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.venue} onChange={e => handleField('venue', e.target.value)} />
          <select required value={local.venue_type} onChange={e => handleField('venue_type', e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
            <option value="">Select Venue Type</option>
            <option value="cafe">Cafe</option>
            <option value="bar">Bar</option>
            <option value="gallery">Gallery</option>
            <option value="restaurant">Restaurant</option>
            <option value="club">Club</option>
            <option value="other">Other</option>
          </select>

          <textarea placeholder="Details (host, venue, etc.)" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" rows={3} value={local.details} onChange={e => handleField('details', e.target.value)} />

          <div className="grid md:grid-cols-4 gap-2">
            <input name="tag1" placeholder="Tag 1" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.tag1} onChange={e => handleField('tag1', e.target.value)} />
            <input name="tag2" placeholder="Tag 2" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.tag2} onChange={e => handleField('tag2', e.target.value)} />
            <input name="tag3" placeholder="Tag 3" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.tag3} onChange={e => handleField('tag3', e.target.value)} />
            <input name="tag4" placeholder="Tag 4" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.tag4} onChange={e => handleField('tag4', e.target.value)} />
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <input type="number" name="price" placeholder="Price (DKK)" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.price} onChange={e => handleField('price', e.target.value)} />
            <select name="language" className="p-2 bg-zinc-900 border border-zinc-700 rounded text-sm" value={local.language} onChange={e => handleField('language', e.target.value)}>
              <option value="en">English</option>
              <option value="da">Danish</option>
            </select>
          </div>

          <input placeholder="Image file name or URL (e.g. cafe1.jpg)" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" value={local.image_url} onChange={e => handleField('image_url', e.target.value)} />

          {/* admin email - readonly when profile present */}
          <input name="admin_email" placeholder="Admin Email" type="email"
                 className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                 value={local.admin_email || profile?.email || ''} readOnly />

          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
              {creating ? 'Creating...' : 'Create Event'}
            </button>
            <button type="button" onClick={() => setShowCreateInline(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  // --- Role assignment form (SetRoleForm) ---
  function SetRoleForm() {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('user')
    const [selectedEvent, setSelectedEvent] = useState('')
    const [status, setStatus] = useState('')

    // use parent events list (only approved or pending)
    const availableEvents = events
      .filter(ev => ev.is_confirmed === true || ev.status === 'approved')
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))

    const handleSubmit = async (e) => {
      e.preventDefault()
      setStatus('')
      try {
        const body = { email, role }
        if (role === 'organizer' && selectedEvent) body.event_id = Number(selectedEvent)
        const res = await fetch('/api/setRole', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet': address || '',
          },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to set role')
        setStatus(`✅ Updated ${data.updated.email} → ${data.updated.role}`)
        setEmail('')
        setRole('user')
        setSelectedEvent('')
      } catch (err) {
        console.error('SetRole error', err)
        setStatus(`❌ Error: ${err.message}`)
      }
    }

    return (
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 p-4 rounded shadow mt-6 flex flex-col gap-3 text-white"
      >
        <h3 className="font-semibold text-lg">Assign Role</h3>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          placeholder="User Email"
          className="p-2 rounded bg-zinc-800"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="p-2 rounded bg-zinc-800"
        >
          <option value="user">User</option>
          <option value="organizer">Organizer</option>
          <option value="admin">Admin</option>
        </select>

        {role === 'organizer' && (
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="p-2 rounded bg-zinc-800"
          >
            <option value="">Select event</option>
            {availableEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} — {new Date(ev.datetime).toLocaleString()}
              </option>
            ))}
          </select>
        )}

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 rounded" type="submit">
            Update Role
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-500 rounded"
            onClick={() => {
              setEmail('')
              setRole('user')
              setSelectedEvent('')
            }}
          >
            Reset
          </button>
        </div>
        {status && <div className="text-sm mt-2">{status}</div>}
      </form>
    )
  }

  // ------------------ Render main admin UI ------------------
  if (!isAdmin) {
    return <div className="text-center text-red-600 font-semibold p-4">You must be the admin to access this panel.</div>
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Super Admin — SBT & Events</h1>

      {/* Event creation & moderation section (above SBT) */}
      <section className="p-4 bg-white rounded shadow">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Events — Create & Moderate</h2>
            <p className="text-sm text-gray-500">Create events (admin-created) and moderate pending events submitted by clients.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowCreateInline((s) => !s) }} className="px-3 py-1 bg-blue-600 text-white rounded">+ Create Event</button>
            <button onClick={fetchEvents} className="px-3 py-1 bg-gray-800 text-white rounded">Refresh</button>
          </div>
        </div>

        <div className="mt-4">
          <EventModerationPanel />
        </div>

        {showCreateInline && <CreateEventInline />}
      </section>

      {/* Role assignment */}
      <section className="p-4 bg-white rounded shadow">
        <SetRoleForm />
      </section>

      {/* SBT Management */}
      <section className="p-4 bg-white rounded shadow">
        <h2 className="text-lg font-semibold mb-2">SBT Management</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm">Type ID</label>
            <input type="number" value={typeId.toString()} onChange={(e) => setTypeId(e.target.value ? BigInt(e.target.value) : 0n)} className="w-full p-2 border rounded mb-2" />
            <label className="block text-sm">Metadata Template</label>
            <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded mb-2">
              <option value="">Select metadata template</option>
              {availableTemplates.map((file, i) => <option key={i} value={file}>{formatDisplayName(file)}</option>)}
            </select>
            <input placeholder="City" value={createSbtCity} onChange={(e) => setCreateSbtCity(e.target.value)} className="w-full p-2 border rounded mb-2" />
            <input placeholder="Max Supply" type="number" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value)} className="w-full p-2 border rounded mb-2" />
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={burnable} onChange={(e) => setBurnable(e.target.checked)} />Burnable</label>
            <div className="mt-3 flex gap-2">
              <button onClick={handleCreateType} className="px-3 py-1 bg-blue-600 text-white rounded">Create SBT Type</button>
              <button onClick={handleActivate} className="px-3 py-1 bg-green-600 text-white rounded">Activate</button>
              <button onClick={handleDeactivate} className="px-3 py-1 bg-yellow-600 text-white rounded">Deactivate</button>
              <button onClick={handlePreview} className="px-3 py-1 bg-gray-600 text-white rounded">Preview</button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">SBT Types</h3>
            <div className="overflow-auto max-h-64 border rounded">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr><th className="p-2">ID</th><th className="p-2">Title</th><th className="p-2">Max</th><th className="p-2">Minted</th><th className="p-2">Active</th><th className="p-2">Burnable</th></tr>
                </thead>
                <tbody>
                  {sbtTypesData.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="p-2">{t.id}</td>
                      <td className="p-2">{t.title || `Type ${t.id}`}</td>
                      <td className="p-2">{t.maxSupply}</td>
                      <td className="p-2">{t.minted}</td>
                      <td className="p-2">{t.active ? '✅' : '❌'}</td>
                      <td className="p-2">{t.burnable ? '🔥' : '🚫'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3">
              <h4 className="font-semibold">Burn Token</h4>
              <div className="flex gap-2 mt-2">
                <input placeholder="Token ID" value={burnTokenId} onChange={(e) => setBurnTokenId(e.target.value)} className="p-2 border rounded flex-1" />
                <button onClick={handleBurn} className="px-3 py-1 bg-red-600 text-white rounded">Burn</button>
              </div>
            </div>
          </div>
        </div>

        {previewData && (
          <div className="mt-4 p-3 border rounded">
            <h4 className="font-semibold">{previewData.name}</h4>
            {previewData.image && <img src={previewData.image} alt={previewData.name} className="w-full max-w-xs h-48 object-cover rounded mb-2" />}
            <p>{previewData.description}</p>
          </div>
        )}
      </section>

    </div>
  )
}

