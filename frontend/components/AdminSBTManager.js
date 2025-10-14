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

  const [pendingEvents, setPendingEvents] = useState([]) // 🔥 new state
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()
  const previewCache = useRef({})

  const buildUri = (filename) => `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`
  const formatDisplayName = (filename) =>
    filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  // ---------- Fetch templates ----------
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

  // ---------- Fetch pending events from DB ----------
  useEffect(() => {
    async function fetchPending() {
      try {
        const res = await fetch('/api/events?status=pending')
        if (!res.ok) throw new Error('Failed to load pending events')
        const data = await res.json()
        setPendingEvents(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        toast.error('Error loading pending events')
      }
    }
    fetchPending()
  }, [refreshTrigger])

  // ---------- Fetch SBT types ----------
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

  // ---------- SBT Actions ----------
  const handlePreview = async () => {
    if (!title) return toast.error('Select a metadata template first')
    const uri = buildUri(title)
    if (previewCache.current[uri]) {
      setPreviewData(previewCache.current[uri])
      return toast.success(`🔍 Preview: ${previewCache.current[uri].name}`)
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
      toast.success('✅ SBT type created')
      if (typeId <= 4999) {
        await postEventToDB(typeId, title, previewData?.date || new Date().toISOString(), createSbtCity)
      }
      setRefreshTrigger((n) => n + 1)
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
      toast.error('Burn failed')
    }
    setLoading(false)
  }

  // ---------- DB posting ----------
  async function postEventToDB(id, title, datetime, city) {
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
      toast.error('Failed to register event in database')
    }
  }

  // ---------- Approve/Reject handlers ----------
  async function handleApprove(eventId) {
    try {
      const res = await fetch(`/api/events/${eventId}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Approval failed')
      toast.success('✅ Event approved')
      setRefreshTrigger((n) => n + 1)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function handleReject(eventId) {
    if (!confirm('Reject this event?')) return
    try {
      const res = await fetch(`/api/events/${eventId}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Rejection failed')
      toast('❌ Event rejected')
      setRefreshTrigger((n) => n + 1)
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-red-600 font-semibold p-4">
        You must be the admin to access this panel.
      </div>
    )
  }

  // ---------- UI ----------
  return (
    <div className="p-4 border rounded max-w-5xl mx-auto bg-white text-black space-y-6">
      <h2 className="text-xl font-bold">Admin Dashboard</h2>

      {/* SBT Type Creation */}
      <SbtTypeCreator
        {...{
          typeId,
          setTypeId,
          title,
          setTitle,
          availableTemplates,
          formatDisplayName,
          createSbtCity,
          setCreateSbtCity,
          maxSupply,
          setMaxSupply,
          burnable,
          setBurnable,
          loading,
          handleCreateType,
          handleActivate,
          handleDeactivate,
          handlePreview,
          previewData,
          buildUri,
        }}
      />

      <SbtDashboard sbtTypesData={sbtTypesData} />
      <BurnToken {...{ handleBurn, burnTokenId, setBurnTokenId, loading }} />

      {/* 🔥 NEW MODULE: Pending Events */}
      <PendingEventsList
        events={pendingEvents}
        handleApprove={handleApprove}
        handleReject={handleReject}
      />
    </div>
  )
}

// -------------- Subcomponents ----------------

function SbtTypeCreator(props) {
  const {
    typeId, setTypeId, title, setTitle, availableTemplates, formatDisplayName,
    createSbtCity, setCreateSbtCity, maxSupply, setMaxSupply, burnable, setBurnable,
    loading, handleCreateType, handleActivate, handleDeactivate, handlePreview,
    previewData, buildUri,
  } = props

  return (
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
        <button onClick={handleCreateType} disabled={loading} className="px-4 py-2 rounded text-white bg-blue-600">Create</button>
        <button onClick={handleActivate} disabled={loading} className="px-4 py-2 rounded text-white bg-green-600">Activate</button>
        <button onClick={handleDeactivate} disabled={loading} className="px-4 py-2 rounded text-white bg-yellow-600">Deactivate</button>
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
  )
}

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

// 🔥 Pending Event List
function PendingEventsList({ events, handleApprove, handleReject }) {
  return (
    <div className="p-4 border rounded bg-gray-50">
      <h3 className="font-semibold mb-3 text-blue-700">Pending Event Templates</h3>
      {events.length === 0 && <p className="text-gray-500 text-sm">No pending events awaiting approval.</p>}
      {events.map((ev) => (
        <div key={ev.id} className="border border-gray-300 bg-white p-3 rounded mb-3 shadow-sm">
          <h4 className="font-semibold">{ev.title}</h4>
          <p className="text-sm text-gray-600 mb-1">{ev.city} • {new Date(ev.datetime).toLocaleString()}</p>
          <p className="text-sm mb-1">{ev.description}</p>
          <p className="text-xs text-gray-400">Submitted by: {ev.admin_email || 'Unknown'}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => handleApprove(ev.id)} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Approve</button>
            <button onClick={() => handleReject(ev.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Reject</button>
          </div>
        </div>
      ))}
    </div>
  )
}

