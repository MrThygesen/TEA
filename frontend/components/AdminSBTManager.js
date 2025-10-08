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
  const { address } = useAccount()
 
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


  'x-wallet': address,

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

function EventCreator({ onEventCreated }) {
  const [form, setForm] = useState({
    name: '',
    city: '',
    datetime: '',
    description: '',
    details: '',
    venue: '',
    venue_type: '',
    min_attendees: '',
    max_attendees: '',
    basic_perk: '',
    advanced_perk: '',
    tag1: '',
    tag2: '',
    tag3: '',
    tag4: '',
    language: 'en',
    price: '',
    image_url: '',
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: Date.now(), // quick unique ID
        }),
      })
      const data = await res.json()
      if (res.ok) {
        alert('✅ Event created successfully!')
        onEventCreated(data)
        setForm({
          name: '',
          city: '',
          datetime: '',
          description: '',
          details: '',
          venue: '',
          venue_type: '',
          min_attendees: '',
          max_attendees: '',
          basic_perk: '',
          advanced_perk: '',
          tag1: '',
          tag2: '',
          tag3: '',
          tag4: '',
          language: 'en',
          price: '',
          image_url: '',
        })
      } else {
        alert('❌ Error: ' + data.error)
      }
    } catch (err) {
      alert('❌ ' + err.message)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-zinc-800 rounded-lg">
      <input name="name" value={form.name} onChange={handleChange} placeholder="Event name" className="w-full p-2 bg-zinc-700 rounded" required />
      <input name="city" value={form.city} onChange={handleChange} placeholder="City" className="w-full p-2 bg-zinc-700 rounded" required />
      <input name="datetime" value={form.datetime} onChange={handleChange} placeholder="YYYY-MM-DD HH:mm" className="w-full p-2 bg-zinc-700 rounded" required />
      <input name="venue" value={form.venue} onChange={handleChange} placeholder="Venue" className="w-full p-2 bg-zinc-700 rounded" />
      <input name="venue_type" value={form.venue_type} onChange={handleChange} placeholder="Venue type" className="w-full p-2 bg-zinc-700 rounded" />
      <textarea name="description" value={form.description} onChange={handleChange} placeholder="Short description" className="w-full p-2 bg-zinc-700 rounded" />
      <textarea name="details" value={form.details} onChange={handleChange} placeholder="Full details" className="w-full p-2 bg-zinc-700 rounded" />

      <div className="grid grid-cols-2 gap-2">
        <input name="min_attendees" value={form.min_attendees} onChange={handleChange} placeholder="Min attendees" className="p-2 bg-zinc-700 rounded" />
        <input name="max_attendees" value={form.max_attendees} onChange={handleChange} placeholder="Max attendees" className="p-2 bg-zinc-700 rounded" />
      </div>

      <input name="basic_perk" value={form.basic_perk} onChange={handleChange} placeholder="Basic perk" className="w-full p-2 bg-zinc-700 rounded" />
      <input name="advanced_perk" value={form.advanced_perk} onChange={handleChange} placeholder="Advanced perk" className="w-full p-2 bg-zinc-700 rounded" />

      <div className="grid grid-cols-2 gap-2">
        <input name="tag1" value={form.tag1} onChange={handleChange} placeholder="Tag 1" className="p-2 bg-zinc-700 rounded" />
        <input name="tag2" value={form.tag2} onChange={handleChange} placeholder="Tag 2" className="p-2 bg-zinc-700 rounded" />
        <input name="tag3" value={form.tag3} onChange={handleChange} placeholder="Tag 3" className="p-2 bg-zinc-700 rounded" />
        <input name="tag4" value={form.tag4} onChange={handleChange} placeholder="Tag 4" className="p-2 bg-zinc-700 rounded" />
      </div>

      <select name="language" value={form.language} onChange={handleChange} className="w-full p-2 bg-zinc-700 rounded">
<option value="en">🇬🇧 English</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="hi">🇮🇳 हिंदी</option>
              <option value="es">🇪🇸 Español</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="pt">🇧🇷 Português</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="da">🇩🇰 Dansk</option>
      </select>

      <input name="price" value={form.price} onChange={handleChange} placeholder="Ticket price" className="w-full p-2 bg-zinc-700 rounded" />
      <input name="image_url" value={form.image_url} onChange={handleChange} placeholder="Image URL" className="w-full p-2 bg-zinc-700 rounded" />

      <button type="submit" disabled={loading} className="w-full bg-blue-500 text-white rounded p-2">
        {loading ? 'Saving...' : 'Create Event'}
      </button>
    </form>
  )
}

