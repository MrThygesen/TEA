//AdminSBTManager.js
'use client'

import { useState, useEffect, useRef } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100

export default function AdminSBTManager() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()
  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

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

  const [events, setEvents] = useState([])
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState({
    name: '',
    city: '',
    datetime: '',
    min_attendees: 1,
    max_attendees: 40,
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
    language: '',
    price: '',
    image_url: '',
  })
  const previewCache = useRef({})

  const buildUri = (filename) =>
    `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`
  const formatDisplayName = (filename) =>
    filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  // Fetch templates from GitHub
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('https://api.github.com/repos/MrThygesen/TEA/contents/data')
        const data = await res.json()
        const jsonFiles = data.filter((f) => f.name.endsWith('.json')).map((f) => f.name)
        setAvailableTemplates(jsonFiles)
      } catch (err) {
        console.error('Failed to fetch templates:', err)
      }
    }
    fetchTemplates()
  }, [])

  // Fetch SBT types
  useEffect(() => {
    if (!publicClient) return
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
      setSbtTypesData(types)
    }
    fetchTypes()
  }, [publicClient, loading])

  // --- SBT functions ---
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
    if (!title || !maxSupply || !typeId || !createSbtCity) return toast.error('Fill all fields')
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
        await postEventToDB(typeId, title, previewData?.date || new Date().toISOString(), createSbtCity)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create SBT type')
    }
    setLoading(false)
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
    }
    setLoading(false)
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
    }
    setLoading(false)
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
    }
    setLoading(false)
  }

  // --- Event API ---
  async function fetchEvents() {
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error('Failed to fetch events')
      const data = await res.json()
      setEvents(data)
    } catch (err) {
      console.error(err)
      toast.error('Error fetching events')
    }
  }

  useEffect(() => { if (isAdmin) fetchEvents() }, [isAdmin])

  const handleEventChange = (field, value) => {
    setEventForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateEvent = async () => {
    // auto-confirmed event
    try {
      const body = { ...eventForm, is_confirmed: true }
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      toast.success('Event created successfully')
      setShowEventModal(false)
      setEventForm({
        name: '',
        city: '',
        datetime: '',
        min_attendees: 1,
        max_attendees: 40,
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
        language: '',
        price: '',
        image_url: '',
      })
      fetchEvents()
    } catch (err) {
      console.error(err)
      toast.error('Error creating event')
    }
  }

  const handleModeration = async (eventId, action) => {
    try {
      const body = {}
      if (action === 'approve') body.is_confirmed = true
      if (action === 'reject') body.is_rejected = true
      const res = await fetch(`/api/events?id=${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Moderation failed')
      toast.success(`${action}d successfully`)
      fetchEvents()
    } catch (err) {
      console.error(err)
      toast.error('Moderation error')
    }
  }

  if (!isAdmin)
    return <div className="text-center text-red-600 font-semibold p-4">You must be the admin to access this panel.</div>

  return (
    <div className="p-4 border rounded max-w-5xl mx-auto bg-white text-black space-y-6">
      <h2 className="text-xl font-bold">Admin: Manage SBTs & Events</h2>

      {/* --- Create SBT --- */}
      <div>
        <h3 className="font-semibold mb-2">Create New SBT Type</h3>
        <input type="number" value={typeId.toString()} onChange={(e) => setTypeId(e.target.value ? BigInt(e.target.value) : 0n)} className="w-full mb-2 p-2 border rounded" placeholder="Type ID" />
        <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mb-2 p-2 border rounded">
          <option value="">Select metadata template</option>
          {availableTemplates.map((file, i) => <option key={i} value={file}>{formatDisplayName(file)}</option>)}
        </select>
        <input type="text" value={createSbtCity} onChange={(e) => setCreateSbtCity(e.target.value)} className="w-full mb-2 p-2 border rounded" placeholder="City" />
        <input type="number" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value)} className="w-full mb-2 p-2 border rounded" placeholder="Max Supply" />
        <label className="mb-2 block">
          <input type="checkbox" checked={burnable} onChange={(e) => setBurnable(e.target.checked)} className="mr-2" /> Burnable
        </label>
        <p className="text-sm text-gray-500 mb-2 break-words">Metadata URI: <code>{buildUri(title)}</code></p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleCreateType} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>{loading ? 'Creating...' : 'Create SBT Type'}</button>
          <button onClick={handleActivate} disabled={loading || !typeId} className={`px-4 py-2 rounded text-white ${loading ? 'bg-green-300' : 'bg-green-600'}`}>Activate</button>
          <button onClick={handleDeactivate} disabled={loading || !typeId} className={`px-4 py-2 rounded text-white ${loading ? 'bg-yellow-300' : 'bg-yellow-600'}`}>Deactivate</button>
          <button onClick={handlePreview} disabled={!title || loading} className="px-4 py-2 rounded text-white bg-gray-600">Preview</button>
        </div>

        {previewData && (
          <div className="mt-4 p-4 border rounded bg-white shadow max-w-xl">
            <h4 className="font-semibold text-lg">{previewData.name}</h4>
            {previewData.image && <img src={previewData.image} alt={previewData.name} className="w-full max-w-xs h-48 object-cover rounded mb-2" />}
            <p>{previewData.description}</p>
          </div>
        )}
      </div>

      {/* --- Event Dashboard --- */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2 flex justify-between items-center">
          Event Moderation
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => setShowEventModal(true)}>+ Create Event</button>
        </h3>
        <EventModerationTable events={events} onModerate={handleModeration} />
      </div>

      {/* --- Burn Token --- */}
      <BurnToken handleBurn={handleBurn} burnTokenId={burnTokenId} setBurnTokenId={setBurnTokenId} loading={loading} />

      {/* --- Event Creation Modal --- */}
      {showEventModal && <EventModal form={eventForm} setForm={setEventForm} onClose={() => setShowEventModal(false)} onSubmit={handleCreateEvent} />}
    </div>
  )
}

// -------------------- Subcomponents --------------------

function SbtDashboard({ sbtTypesData }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">SBT Dashboard</h3>
      <table className="w-full text-sm border text-left">
        <thead className="bg-gray-100">
          <tr><th>ID</th><th>Title</th><th>Max</th><th>Minted</th><th>Active</th><th>Burnable</th></tr>
        </thead>
        <tbody>
          {sbtTypesData.map(t => (
            <tr key={t.id} className="border-t">
              <td>{t.id}</td>
              <td>{t.title || `Type ${t.id}`}</td>
              <td>{t.maxSupply}</td>
              <td>{t.minted}</td>
              <td>{t.active ? '✅' : '❌'}</td>
              <td>{t.burnable ? '🔥' : '🚫'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BurnToken({ handleBurn, burnTokenId, setBurnTokenId, loading }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">Burn Token</h3>
      <input type="text" placeholder="Token ID to burn" value={burnTokenId} onChange={(e) => setBurnTokenId(e.target.value)} className="w-full mb-2 p-2 border rounded" />
      <button onClick={handleBurn} disabled={loading} className="px-4 py-2 rounded text-white bg-red-600">Burn Token</button>
    </div>
  )
}

function EventModerationTable({ events, onModerate }) {
  const pending = events.filter(e => !e.is_confirmed && !e.is_rejected)
  const approved = events.filter(e => e.is_confirmed)
  const rejected = events.filter(e => e.is_rejected)

  const renderRows = (list, status) => list.map(ev => (
    <tr key={ev.id} className="border-t">
      <td>{ev.id}</td>
      <td>{ev.name}</td>
      <td>{ev.city}</td>
      <td>{new Date(ev.datetime).toLocaleString()}</td>
      <td>{status}</td>
      <td className="space-x-2">
        {status === 'Pending' && (
          <>
            <button onClick={() => onModerate(ev.id, 'approve')} className="px-2 py-1 bg-green-600 text-white rounded">Approve</button>
            <button onClick={() => onModerate(ev.id, 'reject')} className="px-2 py-1 bg-red-600 text-white rounded">Reject</button>
          </>
        )}
      </td>
    </tr>
  ))

  return (
    <table className="w-full text-sm border text-left">
      <thead className="bg-gray-100"><tr><th>ID</th><th>Name</th><th>City</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        {renderRows(pending, 'Pending')}
        {renderRows(approved, 'Approved')}
        {renderRows(rejected, 'Rejected')}
      </tbody>
    </table>
  )
}

function EventModal({ form, setForm, onClose, onSubmit }) {
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Create Event</h3>
        <div className="space-y-2">
          {Object.entries(form).map(([key, value]) => (
            <div key={key}>
              <label className="block mb-1 capitalize">{key.replace('_', ' ')}</label>
              <input
                type={key === 'datetime' ? 'datetime-local' : 'text'}
                value={value}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
          <button onClick={onSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Create Event</button>
        </div>
      </div>
    </div>
  )
}

// Optional: Post new SBT type to DB as event for tracking
async function postEventToDB(typeId, title, datetime, city) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: title,
        datetime,
        city,
        is_confirmed: true,
        typeId,
      }),
    })
  } catch (err) {
    console.error('Error posting SBT type as event:', err)
  }
}

