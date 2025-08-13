'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100
const EVENTS_API = process.env.NEXT_PUBLIC_EVENTS_API || '/api/events'

export default function AdminSBTManager() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [title, setTitle] = useState('')
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState('')
  const [typeId, setTypeId] = useState(1n)
  const [loading, setLoading] = useState(false)
  const [city, setCity] = useState('') // ✅ new

  const [sbtTypesData, setSbtTypesData] = useState([])
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [burnTokenId, setBurnTokenId] = useState('')
  const [previewData, setPreviewData] = useState(null)

  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const buildUri = (filename) => `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`
  const formatDisplayName = (filename) =>
    filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

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

  useEffect(() => {
    if (!publicClient) return
    async function fetchTypes() {
      const types = []
      for (let i = 1; i <= MAX_TYPES; i++) {
        try {
          const sbtType = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV33_ABI,
            functionName: 'sbtTypes',
            args: [i],
          })
          const [uri, active, maxSupplyBig, mintedBig, created, burnableFlag] = sbtType
          const maxSupplyNum = Number(maxSupplyBig)
          const mintedNum = Number(mintedBig)

          let title = ''
          if (uri) {
            try {
              const res = await fetch(uri)
              const metadata = await res.json()
              title = metadata?.name || ''
            } catch {}
          }

          if (uri) {
            types.push({
              id: i,
              uri,
              active,
              burnable: burnableFlag,
              maxSupply: maxSupplyNum,
              minted: mintedNum,
              title,
            })
          }
        } catch {}
      }
      setSbtTypesData(types)
    }
    fetchTypes()
  }, [publicClient, loading])

  const handlePreview = async () => {
    const uri = buildUri(title)
    try {
      const res = await fetch(uri)
      const metadata = await res.json()
      setPreviewData(metadata)
      toast.success(`🔍 Preview: ${metadata.name}`)
    } catch {
      toast.error('Preview failed')
    }
  }

  // ✅ Updated to include city
  async function postEventToDB(typeId, title, datetime) {
    if (!datetime) {
      toast.error('Event datetime required to register event')
      return
    }
    try {
      const res = await fetch(EVENTS_API, {
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
      alert('Failed to register event in database: ' + err.message)
    }
  }

  const handleCreateType = async () => {
    if (!title || !maxSupply || !typeId || !city) {
      toast.error('Please fill in all fields')
      return
    }
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
        await postEventToDB(typeId, title, previewData?.date || new Date().toISOString())
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to create SBT type')
    }
    setLoading(false)
  }

  const handleActivate = async () => {
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

  if (!isAdmin) {
    return <div className="text-center text-red-600 font-semibold p-4">You must be the admin to access this panel.</div>
  }

  return (
    <div className="p-4 border rounded max-w-4xl mx-auto bg-white text-black space-y-6">
      <h2 className="text-xl font-bold">Admin: Manage SBTs</h2>
      <div>
        <h3 className="font-semibold mb-2">Create New SBT Type</h3>
        <label className="block mb-1">Type ID</label>
        <input type="number" value={typeId.toString()} onChange={(e) => setTypeId(BigInt(e.target.value))} className="w-full mb-4 p-2 border rounded" />
        <label className="block mb-1">Metadata Template</label>
        <select value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mb-4 p-2 border rounded">
          <option value="">Select metadata</option>
          {availableTemplates.map((file, index) => (
            <option key={index} value={file}>{formatDisplayName(file)}</option>
          ))}
        </select>
        <label className="block mb-1">City</label>
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full mb-4 p-2 border rounded" />
        <label className="block mb-1">Max Supply</label>
        <input type="number" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value)} className="w-full mb-4 p-2 border rounded" />
        <label className="block mb-4">
          <input type="checkbox" checked={burnable} onChange={(e) => setBurnable(e.target.checked)} className="mr-2" />
          Burnable
        </label>
        <p className="text-sm text-gray-500 mb-2 break-words">Metadata URI: <code>{buildUri(title)}</code></p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCreateType} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>
            {loading ? 'Creating...' : 'Create SBT Type'}
          </button>
          <button onClick={handleActivate} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-green-300' : 'bg-green-600'}`}>
            {loading ? 'Activating...' : 'Activate'}
          </button>
          <button onClick={handleDeactivate} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-yellow-300' : 'bg-yellow-600'}`}>
            {loading ? 'Deactivating...' : 'Deactivate'}
          </button>
          <button onClick={handlePreview} disabled={!title || loading} className="px-4 py-2 rounded text-white bg-gray-600">
            Preview
          </button>
        </div>

        {previewData && (
          <div className="mt-6 p-6 border rounded-lg shadow-md bg-white max-w-xl">
            <h4 className="font-semibold text-xl mb-4">{previewData.name}</h4>
            {previewData.image && <img src={previewData.image} alt={previewData.name} className="w-full max-w-xs h-48 object-cover rounded mb-4" />}
            <p className="mb-4">{previewData.description}</p>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">SBT Dashboard</h3>
        <table className="w-full text-sm text-left border">
          <thead className="bg-gray-100">
            <tr><th>ID</th><th>Title</th><th>Max</th><th>Minted</th><th>Active</th><th>Burnable</th></tr>
          </thead>
          <tbody>
            {sbtTypesData.map((type) => (
              <tr key={type.id} className="border-t">
                <td>{type.id}</td>
                <td>{type.title || `Type ${type.id}`}</td>
                <td>{type.maxSupply}</td>
                <td>{type.minted}</td>
                <td>{type.active ? '✅' : '❌'}</td>
                <td>{type.burnable ? '🔥' : '🚫'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Burn Token</h3>
        <input type="text" value={burnTokenId} onChange={(e) => setBurnTokenId(e.target.value)} placeholder="Token ID to burn" className="w-full mb-2 p-2 border rounded" />
        <button onClick={handleBurn} disabled={loading} className="px-4 py-2 rounded text-white bg-red-600">Burn Token</button>
      </div>

      <div className="mt-10 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Database Dump (Render DB)</h3>
        <DbDump />
      </div>

      <div className="mt-10 p-4 border rounded bg-gray-50">
        <h3 className="font-semibold mb-2">Create Event (DB Only)</h3>
        <EventCreator />
      </div>
    </div>
  )
}

// DbDump unchanged
function DbDump() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => {
    async function fetchDump() {
      setLoading(true)
      try {
        const res = await fetch('/api/dump')
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDump()
  }, [])
  if (loading) return <p>Loading database dump...</p>
  if (error) return <p className="text-red-600">Error loading dump: {error}</p>
  if (!data) return null
  return <pre className="max-h-96 overflow-auto bg-white p-4 rounded border text-xs">{JSON.stringify(data, null, 2)}</pre>
}

// EventCreator updated to include city
function EventCreator() {
  const [typeId, setTypeId] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [datetime, setDatetime] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  async function handleCreate() {
    if (!typeId || !name || !datetime || !city) {
      setMessage('All fields are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId: Number(typeId),
          name,
          city,
          datetime: new Date(datetime).toISOString(),
          min_attendees: 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error creating event')
      setMessage('✅ Event created successfully')
    } catch (err) {
      setMessage('❌ ' + err.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="space-y-2">
      <input type="number" placeholder="Type ID" value={typeId} onChange={(e) => setTypeId(e.target.value)} className="w-full p-2 border rounded" />
      <input type="text" placeholder="Event name" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" />
      <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="w-full p-2 border rounded" />
      <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="w-full p-2 border rounded" />
      <button onClick={handleCreate} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>
        {loading ? 'Creating...' : 'Create Event'}
      </button>
      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  )
}

