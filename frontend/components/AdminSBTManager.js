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

  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()
  const previewCache = useRef({}) // cache for GitHub previews

  const buildUri = (filename) => `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`
  const formatDisplayName = (filename) =>
    filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  // Fetch metadata templates from GitHub
useEffect(() => {
  async function fetchTemplates() {
    try {
      const res = await fetch('https://api.github.com/repos/MrThygesen/TEA/contents/data')
      const data = await res.json()
      const jsonFiles = data.filter((file) => file.name.endsWith('.json')).map((file) => file.name)
      setAvailableTemplates(jsonFiles)
    } catch (err) {
      console.error('Failed to fetch templates from GitHub:', err)
    }
  }
  fetchTemplates()
}, [])


  // Fetch SBT types from contract (parallel)
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

  // --- SBT Creation ---
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
      // Optionally post event to DB if typeId <= 4999
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

  // --- Post Event to DB ---
  async function postEventToDB(id, title, datetime, city) {
    if (!city || !datetime) return toast.error('City and datetime are required')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(id),
          name: title,
          city,
          datetime: new Date(datetime).toISOString(),
          min_attendees: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Status ${res.status}`)
      toast.success('Event registered in database')
      return data
    } catch (err) {
      console.error('Error posting event:', err)
      toast.error('Failed to register event in database')
    }
  }

  if (!isAdmin) return <div className="text-center text-red-600 font-semibold p-4">You must be the admin to access this panel.</div>

  return (
    <div className="p-4 border rounded max-w-4xl mx-auto bg-white text-black space-y-6">
      <h2 className="text-xl font-bold">Admin: Manage SBTs</h2>

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

      {/* --- SBT Dashboard --- */}
      <SbtDashboard sbtTypesData={sbtTypesData} />

      {/* --- Burn Token --- */}
      <BurnToken handleBurn={handleBurn} burnTokenId={burnTokenId} setBurnTokenId={setBurnTokenId} loading={loading} />

      {/* --- DbDump --- */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Database Dump (Render DB)</h3>
        <DbDump />
      </div>

      {/* --- Set Role --- */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Assign Role to User</h3>
        <SetRoleForm />
      </div>

      {/* --- Event Creator --- */}
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Create Event (DB Only)</h3>
        <EventCreator />
      </div>
    </div>
  )
}

// ------------------ Subcomponents ------------------

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

function DbDump() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchDump() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/dump')
        let json = null
        try { json = await res.json() } catch {}
        if (!res.ok) throw new Error(json?.error || `Status ${res.status}`)
        setData(json)
      } catch (err) {
        console.error('[DbDump] Fetch failed:', err)
        setError(err.message || 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchDump()
  }, [])

  if (loading) return <p>Loading database dump...</p>
  if (error) return <p className="text-red-600">Error loading dump: {error}</p>
  if (!data) return <p>No data available.</p>

  return (
    <pre className="max-h-96 overflow-auto bg-white p-4 rounded border text-xs">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

function SetRoleForm() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('user')
  const [eventId, setEventId] = useState('')
  const [status, setStatus] = useState('')
  const [events, setEvents] = useState([])

  // Fetch events from DB for dropdown
 useEffect(() => {
    if (role !== 'organizer') return
    async function loadEvents() {
      try {
        const res = await fetch('/api/events?upcomingOnly=true')
        const data = await res.json()

 if (res.ok) {
         // API returns an array directly, not { events: [...] }
         setEvents(Array.isArray(data) ? data : [])
       } else {
         console.error('Event fetch failed', data)
       }

      } catch (err) {
        console.error('Error fetching events:', err)
      }
    }
    loadEvents()
  }, [role])

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('')

    try {
//      const token = localStorage.getItem('token')
//      if (!token) {
//        setStatus('❌ Not logged in')
//        return
//      }

      const body = { email, role }
      if (eventId && role === 'organizer') body.event_id = Number(eventId)

      const res = await fetch('/api/setRole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
  //        Authorization: `Bearer ${token}`,
 'x-wallet': address, // pass connected wallet 

       },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to set role')

      setStatus(`✅ ${data.updated.email} → ${data.updated.role}${eventId ? ` (event ${eventId})` : ''}`)
      setEmail('')
      setRole('user')
      setEventId('')
    } catch (err) {
      console.error('[SetRoleForm] error:', err)
      setStatus(`❌ ${err.message}`)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 p-4 rounded shadow mt-6 flex flex-col gap-3"
    >
      <h3 className="font-semibold text-lg">Assign Role</h3>
      <input
        type="email"
        placeholder="User Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 rounded bg-zinc-800 text-white"
        required
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="p-2 rounded bg-zinc-800 text-white"
      >
        <option value="user">User</option>
        <option value="organizer">Organizer</option>
        <option value="admin">Admin</option>
      </select>

      {/* Only show when assigning organizer */}
      {role === 'organizer' && (
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="p-2 rounded bg-zinc-800 text-white"
          required
        >
          <option value="">Select Event</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name} ({new Date(ev.datetime).toLocaleString()})
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 p-2 rounded text-white"
      >
        Update Role
      </button>
      {status && <p className="text-sm mt-2">{status}</p>}
    </form>
  )
}

function EventCreator() {
 const [event, setEvent] = useState({
  id: '',
  name: '',
  city: '',
  datetime: '',
  min_attendees: 1,
  max_attendees: 40,
  is_confirmed: false,
  description: '',
  details: '',
  venue: '',
  venue_type: '', // added
  basic_perk: '',
  advanced_perk: '',
  tag1: '',
  tag2: '',
  tag3: '',
  price: '',
  image_url: ''
});
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleChange = (field, value) => {
    setEvent(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = (method) => {
    const newErrors = {}
    if (method === 'PUT' && !event.id) newErrors.id = 'Event ID is required for update'
    if (!event.name) newErrors.name = 'Event Name is required'
    if (!event.city) newErrors.city = 'City is required'
    if (!event.datetime) newErrors.datetime = 'Date and Time are required'
    if (event.min_attendees && isNaN(Number(event.min_attendees))) newErrors.min_attendees = 'Must be a number'
    if (event.max_attendees && isNaN(Number(event.max_attendees))) newErrors.max_attendees = 'Must be a number'
    return newErrors
  }

  const handleSubmit = async (method) => {
    const fieldErrors = validate(method)
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors)
      setMessage('❌ Please fix the highlighted fields')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      // Ensure group_id = id and never null
      const body = {
        ...event,
        group_id: Number(event.id) || Date.now(), // fallback in case id is empty
        min_attendees: Number(event.min_attendees),
        max_attendees: Number(event.max_attendees),
        datetime: new Date(event.datetime).toISOString()
      }

      const res = await fetch('/api/events', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error saving event')

      setMessage(`✅ Event ${method === 'POST' ? 'created' : 'updated'} successfully`)
      if (method === 'POST') {
        setEvent({
          id: '',
          name: '',
          city: '',
          datetime: '',
          min_attendees: 1,
          max_attendees: 40,
          is_confirmed: false,
          description: '',
          details: '',
          venue: '',
          venue_type: '',
          basic_perk: '',
          advanced_perk: '',
          tag1: '',
          tag2: '',
          tag3: '',
          price: '',
        image_url: ''
        })
      }
    } catch (err) {
      setMessage('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field) =>
    `w-full p-2 border rounded ${errors[field] ? 'border-red-500' : 'border-gray-300'}`

  return (
    <div className="space-y-2">
      <input type="number" placeholder="Event ID (for update only)" value={event.id} onChange={e => handleChange('id', e.target.value)} className={inputClass('id')} />
      {errors.id && <p className="text-red-500 text-sm">{errors.id}</p>}

      <input type="text" placeholder="Event Name" value={event.name} onChange={e => handleChange('name', e.target.value)} className={inputClass('name')} />
      {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}

      <input type="text" placeholder="City" value={event.city} onChange={e => handleChange('city', e.target.value)} className={inputClass('city')} />
      {errors.city && <p className="text-red-500 text-sm">{errors.city}</p>}

      <input type="datetime-local" value={event.datetime} onChange={e => handleChange('datetime', e.target.value)} className={inputClass('datetime')} />
      {errors.datetime && <p className="text-red-500 text-sm">{errors.datetime}</p>}

      <input type="number" placeholder="Min Attendees" value={event.min_attendees} onChange={e => handleChange('min_attendees', e.target.value)} className={inputClass('min_attendees')} />
      {errors.min_attendees && <p className="text-red-500 text-sm">{errors.min_attendees}</p>}

      <input type="number" placeholder="Max Attendees" value={event.max_attendees} onChange={e => handleChange('max_attendees', e.target.value)} className={inputClass('max_attendees')} />
      {errors.max_attendees && <p className="text-red-500 text-sm">{errors.max_attendees}</p>}

      <textarea placeholder="Description" value={event.description} onChange={e => handleChange('description', e.target.value)} className={inputClass('description')} />
      <textarea placeholder="Details" value={event.details} onChange={e => handleChange('details', e.target.value)} className={inputClass('details')} />
      <input type="text" placeholder="Venue" value={event.venue} onChange={e => handleChange('venue', e.target.value)} className={inputClass('venue')} />
    
<select
  value={event.venue_type}
  onChange={e => handleChange('venue_type', e.target.value)}
  className={inputClass('venue_type')}
>
  <option value="">Select Venue Type</option>
  <option value="Business">Business</option>
  <option value="Entrepreneur">Entrepreneur</option>
  <option value="Concerts">Concerts</option>
  <option value="Romance">Romance</option>
  <option value="Social">Social</option>
</select>
{errors.venue_type && <p className="text-red-500 text-sm">{errors.venue_type}</p>}

  <input type="text" placeholder="Basic Perk" value={event.basic_perk} onChange={e => handleChange('basic_perk', e.target.value)} className={inputClass('basic_perk')} />
      <input type="text" placeholder="Advanced Perk" value={event.advanced_perk} onChange={e => handleChange('advanced_perk', e.target.value)} className={inputClass('advanced_perk')} />
      <input type="text" placeholder="Tag1" value={event.tag1} onChange={e => handleChange('tag1', e.target.value)} className={inputClass('tag1')} />
      <input type="text" placeholder="Tag2" value={event.tag2} onChange={e => handleChange('tag2', e.target.value)} className={inputClass('tag2')} />
      <input type="text" placeholder="Tag3" value={event.tag3} onChange={e => handleChange('tag3', e.target.value)} className={inputClass('tag3')} />
<input type="number" placeholder="Price" value={event.price} onChange={e => handleChange('price', e.target.value)} className={inputClass('price')} />
 {errors.price && <p className="text-red-500 text-sm">{errors.price}</p>}

   
<input type="text" placeholder="Image URL" value={event.image_url} onChange={e => handleChange('image_url', e.target.value)} className={inputClass('image_url')} />

      <label className="flex items-center">
        <input type="checkbox" checked={event.is_confirmed} onChange={e => handleChange('is_confirmed', e.target.checked)} className="mr-2" />
        Confirmed
      </label>

      <div className="flex gap-2">
        <button onClick={() => handleSubmit('POST')} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>Create</button>
        <button onClick={() => handleSubmit('PUT')} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-green-300' : 'bg-green-600'}`}>Update</button>
      </div>

      {message && <p className="text-sm mt-1">{message}</p>}
    </div>
  )
}

