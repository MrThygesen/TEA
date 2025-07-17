'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { WebAccessSBTV3_ABI } from '../abis/WebAccessSBTV3_ABI'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'
const MAX_TYPES = 30

export default function AdminSBTManager() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [title, setTitle] = useState('')
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState('')
  const [typeId, setTypeId] = useState(1n)
  const [loading, setLoading] = useState(false)

  const [editUri, setEditUri] = useState('')
  const [editMaxSupply, setEditMaxSupply] = useState('')
  const [sbtTypesData, setSbtTypesData] = useState([])
  const [burnTokenId, setBurnTokenId] = useState('')
  const [previewData, setPreviewData] = useState(null)

  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  useEffect(() => {
    if (!publicClient) return

    async function fetchTypes() {
      const types = []
      for (let i = 1; i <= MAX_TYPES; i++) {
        try {
          const sbtType = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV3_ABI,
            functionName: 'sbtTypes',
            args: [i],
          })
          const [uri, active, burnableFlag, maxSupplyBig, mintedBig] = sbtType
          const maxSupplyNum = Number(maxSupplyBig.toString())
          const mintedNum = Number(mintedBig.toString())

          let title = ''
          try {
            if (uri) {
              const res = await fetch(uri)
              const metadata = await res.json()
              title = metadata.name || ''
            }
          } catch {}

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
        } catch (err) {
          continue
        }
      }
      setSbtTypesData(types)
    }

    fetchTypes()
  }, [publicClient, loading])

  const buildUri = (filename) =>
    `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${filename.endsWith('.json') ? filename : filename + '.json'}`

  const handlePreview = async () => {
    const uri = buildUri(title)
    try {
      const res = await fetch(uri)
      const metadata = await res.json()
      toast.success(`🔍 Preview: ${metadata.name}`)
      setPreviewData(metadata)
      console.log('Preview metadata:', metadata)
    } catch (err) {
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
        abi: WebAccessSBTV3_ABI,
        functionName: 'createSBTType',
        args: [typeId, uri, burnable, BigInt(maxSupply)],
      })
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
        abi: WebAccessSBTV3_ABI,
        functionName: 'activateSBTType',
        args: [typeId],
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
        abi: WebAccessSBTV3_ABI,
        functionName: 'deactivateSBTType',
        args: [typeId],
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
        abi: WebAccessSBTV3_ABI,
        functionName: 'burn',
        args: [burnTokenId],
      })
      toast.success('Token burned')
    } catch (err) {
      console.error(err)
      toast.error('Burn failed')
    }
    setLoading(false)
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-red-600 font-semibold p-4">
        You must be the admin to access this panel.
      </div>
    )
  }

  return (
    <div className="p-4 border rounded max-w-4xl mx-auto bg-white text-black space-y-6">
      <h2 className="text-xl font-bold">Admin: Manage SBTs</h2>

      {/* === CREATE === */}
      <div>
        <h3 className="font-semibold mb-2">Create New SBT Type</h3>
        <label className="block mb-1">Type ID</label>
        <input
          type="number"
          value={typeId.toString()}
          onChange={(e) => setTypeId(BigInt(e.target.value))}
          className="w-full mb-4 p-2 border rounded"
        />
        <label className="block mb-1">Title / Filename</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. coffee-loyalty"
          className="w-full mb-4 p-2 border rounded"
        />
        <label className="block mb-1">Max Supply</label>
        <input
          type="number"
          value={maxSupply}
          onChange={(e) => setMaxSupply(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        />
        <label className="block mb-4">
          <input
            type="checkbox"
            checked={burnable}
            onChange={(e) => setBurnable(e.target.checked)}
            className="mr-2"
          />
          Burnable
        </label>
        <p className="text-sm text-gray-500 mb-2 break-words">
          Metadata URI: <code>{buildUri(title)}</code>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCreateType}
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${
              loading ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {loading ? 'Creating...' : 'Create SBT Type'}
          </button>
          <button
            onClick={handleActivate}
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${
              loading ? 'bg-green-300' : 'bg-green-600'
            }`}
          >
            {loading ? 'Activating...' : 'Activate'}
          </button>
          <button
            onClick={handleDeactivate}
            disabled={loading}
            className={`px-4 py-2 rounded text-white ${
              loading ? 'bg-yellow-300' : 'bg-yellow-600'
            }`}
          >
            {loading ? 'Deactivating...' : 'Deactivate'}
          </button>
          <button
            onClick={handlePreview}
            disabled={!title || loading}
            className="px-4 py-2 rounded text-white bg-gray-600"
          >
            Preview
          </button>
        </div>

        {/* === PREVIEW CARD === */}
        {previewData && (
          <div className="mt-4 p-4 border rounded bg-gray-50">
            <h4 className="font-semibold mb-2">Preview Metadata</h4>
            <div className="flex gap-4">
              {previewData.image && (
                <img
                  src={previewData.image}
                  alt={previewData.name}
                  className="w-32 h-32 object-contain rounded"
                />
              )}
              <div>
                <h5 className="text-lg font-semibold mb-1">{previewData.name}</h5>
                <p className="text-sm text-gray-700 mb-2">{previewData.description}</p>
                {previewData.tags && previewData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {previewData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mb-2 space-y-1">
                  {previewData.external_url && (
                    <a
                      href={previewData.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-sm block"
                    >
                      Official Website
                    </a>
                  )}
                  {previewData.social_link && (
                    <a
                      href={previewData.social_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-sm block"
                    >
                      Social Link
                    </a>
                  )}
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words max-w-sm">
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === DASHBOARD === */}
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

      {/* === BURN === */}
      <div>
        <h3 className="font-semibold mb-2">Burn Token</h3>
        <input
          type="text"
          value={burnTokenId}
          onChange={(e) => setBurnTokenId(e.target.value)}
          placeholder="Token ID to burn"
          className="w-full mb-2 p-2 border rounded"
        />
        <button
          onClick={handleBurn}
          disabled={loading}
          className="px-4 py-2 rounded text-white bg-red-600"
        >
          Burn Token
        </button>
      </div>
    </div>
  )
}

