'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import WebAccessSBTV33_ABI from '../abis/WebAccessSBTV33_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'
const MAX_TYPES = 100

export default function AdminSBTManager() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [title, setTitle] = useState('')
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState('')
  const [typeId, setTypeId] = useState(1n)
  const [loading, setLoading] = useState(false)

  const [sbtTypesData, setSbtTypesData] = useState([])
  const [availableTemplates, setAvailableTemplates] = useState([])
  const [burnTokenId, setBurnTokenId] = useState('')
  const [previewData, setPreviewData] = useState(null)

  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const buildUri = (filename) => `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename}`

  const formatDisplayName = (filename) => filename.replace('.json', '').replace(/[_-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

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

  const handleCreateType = async () => {
    if (!title || !maxSupply || !typeId) {
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

if (Number(typeId) >= 5000) {
  const eventPayload = {
    typeId: Number(typeId),
    name: previewData?.name || `Event ${typeId}`,
    datetime: new Date().toISOString()  // You may allow admin to choose in future
  }

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload)
    })
    if (res.ok) {
      console.log('✅ Event added to DB')
    } else {
      console.error('⚠️ Failed to insert event in DB')
    }
  } catch (err) {
    console.error('❌ Error creating event in DB', err)
  }
}


      toast.success('SBT type created')
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
        <label className="block mb-1">Max Supply</label>
        <input type="number" value={maxSupply} onChange={(e) => setMaxSupply(e.target.value)} className="w-full mb-4 p-2 border rounded" />
        <label className="block mb-4">
          <input type="checkbox" checked={burnable} onChange={(e) => setBurnable(e.target.checked)} className="mr-2" />
          Burnable
        </label>
        <p className="text-sm text-gray-500 mb-2 break-words">Metadata URI: <code>{buildUri(title)}</code></p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleCreateType} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}>{loading ? 'Creating...' : 'Create SBT Type'}</button>
          <button onClick={handleActivate} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-green-300' : 'bg-green-600'}`}>{loading ? 'Activating...' : 'Activate'}</button>
          <button onClick={handleDeactivate} disabled={loading} className={`px-4 py-2 rounded text-white ${loading ? 'bg-yellow-300' : 'bg-yellow-600'}`}>{loading ? 'Deactivating...' : 'Deactivate'}</button>
          <button onClick={handlePreview} disabled={!title || loading} className="px-4 py-2 rounded text-white bg-gray-600">Preview</button>
        </div>

        {previewData && (
          <div className="mt-6 p-6 border rounded-lg shadow-md bg-white max-w-xl">
            <h4 className="font-semibold text-xl mb-4">{previewData.name}</h4>
            {previewData.image && (<img src={previewData.image} alt={previewData.name} className="w-full max-w-xs h-48 object-cover rounded mb-4" />)}
            <p className="mb-4">{previewData.description}</p>
            {previewData.external_url && (<a href={previewData.external_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block mb-6">Visit Event Page ↗</a>)}
            <div className="mb-6 space-y-2">
              {previewData.attributes?.filter(attr => attr.trait_type !== "Tag").map((attr, index) => (
                <div key={index} className="flex gap-2">
                  <span className="font-semibold w-40">{attr.trait_type}:</span>
                  <span>{attr.value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {previewData.attributes?.filter(attr => attr.trait_type === "Tag").map((tag, index) => (
                <span key={index} className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-semibold">{tag.value}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">SBT Dashboard</h3>
        <table className="w-full text-sm text-left border">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1">ID</th>
              <th className="px-2 py-1">Title</th>
              <th className="px-2 py-1">Max</th>
              <th className="px-2 py-1">Minted</th>
              <th className="px-2 py-1">Active</th>
              <th className="px-2 py-1">Burnable</th>
            </tr>
          </thead>
          <tbody>
            {sbtTypesData.map((type) => (
              <tr key={type.id} className="border-t">
                <td className="px-2 py-1">{type.id}</td>
                <td className="px-2 py-1">{type.title || `Type ${type.id}`}</td>
                <td className="px-2 py-1">{type.maxSupply}</td>
                <td className="px-2 py-1">{type.minted}</td>
                <td className="px-2 py-1">{type.active ? '✅' : '❌'}</td>
                <td className="px-2 py-1">{type.burnable ? '🔥' : '🚫'}</td>
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
    </div>
  )
}

