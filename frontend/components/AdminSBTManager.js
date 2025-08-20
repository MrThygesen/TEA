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

  // Fetch SBT types from contract
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

      // Set next available typeId automatically
      const nextId = types.length > 0 ? Math.max(...types.map(t => t.id)) + 1 : 1
      setTypeId(BigInt(nextId))
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

      // Post event to DB if typeId <= 4999
      if (typeId <= 4999n) {
        await postEventToDB(typeId, title, previewData?.date || new Date().toISOString(), createSbtCity)
      }

      // Reset inputs after creation
      setTitle('')
      setMaxSupply('')
      setCreateSbtCity('')
      setBurnable(false)
      setPreviewData(null)

      // Increment typeId for next creation
      setTypeId(prev => prev + 1n)

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

  async function postEventToDB(typeId, title, datetime, city) {
    if (!city || !datetime) return toast.error('City and datetime are required')
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: Number(typeId),
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
        <input type="number" value={typeId.toString()} readOnly className="w-full mb-2 p-2 border rounded" placeholder="Type ID" />
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

      <SbtDashboard sbtTypesData={sbtTypesData} />
      <BurnToken handleBurn={handleBurn} burnTokenId={burnTokenId} setBurnTokenId={setBurnTokenId} loading={loading} />
      <div className="mt-6 p-4 border rounded bg-gray-50"><h3 className="font-semibold mb-2">Database Dump (Render DB)</h3><DbDump /></div>
      <div className="mt-6 p-4 border rounded bg-gray-50"><h3 className="font-semibold mb-2">Assign Role to User</h3><SetRoleForm /></div>
      <div className="mt-6 p-4 border rounded bg-gray-50"><h3 className="font-semibold mb-2">Create Event (DB Only)</h3><EventCreator /></div>

      {/* Link to AdminEventManager */}
      <div className="mt-4">
        <a href="/admin-event-manager" className="text-blue-600 underline">Go to Event Manager</a>
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
  const [telegramUsername, setTelegramUsername] = useState('')
  const [telegramUserId, setTelegramUserId] = useState('')
  const [role, setRole] = useState('organizer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSetRole = async () => {
    if (!role || (!telegramUsername && !telegramUserId)) {
      setMessage('Telegram username or user ID and role are required')
      return
    }

    setLoading(true)
    try {
      const body = { role }
      if (telegramUsername) body.telegram_username = telegramUsername
      if (telegramUserId) body.telegram_user_id = telegramUserId

      const res = await fetch('/api/setRole', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error setting role')

      const target = telegramUserId ? `ID ${telegramUserId}` : `@${telegramUsername}`
      setMessage(`✅ Role "${role}" assigned to ${target}`)
    } catch (err) {
      setMessage('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input type="text" placeholder="Telegram username (optional)" value={telegramUsername} onChange={(e) => setTelegramUsername(e.target.value)} className="w-full p-2 border rounded" />
      <input type="text" placeholder="Telegram user ID (optional)" value={telegramUserId} onChange={(e) => setTelegramUserId(e.target.value)} className="w-full p-2 border rounded" />
      <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full p-2 border rounded">
        <option value="organizer">Organizer</option>
        <option value="admin">Admin</option>
        <option value="user">User</option>
      </select>
      <button onClick={handleSetRole} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>
        {loading ? 'Assigning...' : 'Assign Role'}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

function EventCreator() {
  const [eventName, setEventName] = useState('')
  const [city, setCity] = useState('')
  const [datetime, setDatetime] = useState('')
  const [minAttendees, setMinAttendees] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleCreateEvent = async () => {
    if (!eventName || !city || !datetime) {
      setMessage('Event name, city, and datetime are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: eventName, city, datetime, min_attendees: minAttendees }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')
      setMessage(`✅ Event "${eventName}" created`)
      setEventName('')
      setCity('')
      setDatetime('')
      setMinAttendees(1)
    } catch (err) {
      setMessage('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input type="text" placeholder="Event Name" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full p-2 border rounded" />
      <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-full p-2 border rounded" />
      <input type="datetime-local" placeholder="Datetime" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full p-2 border rounded" />
      <input type="number" placeholder="Min Attendees" value={minAttendees} onChange={(e) => setMinAttendees(Number(e.target.value))} className="w-full p-2 border rounded" />
      <button onClick={handleCreateEvent} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>
        {loading ? 'Creating...' : 'Create Event'}
      </button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}

