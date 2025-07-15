'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { WebAccessSBTV3_ABI } from '../abis/WebAccessSBTV3_ABI'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'
const MAX_TYPES = 20

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
          } catch {
            // Ignore fetch or parse errors, keep title empty
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
        } catch (err) {
          continue
        }
      }
      setSbtTypesData(types)
    }

    fetchTypes()
  }, [publicClient, loading])

  const handleCreateType = async () => {
    if (!title || !maxSupply || isNaN(Number(maxSupply))) {
      toast.error('Title and Max Supply required')
      return
    }

    const uri = `https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${title}.json`

    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'createSBTType',
        args: [
          typeId,
          uri,
          burnable,
          BigInt(maxSupply),
          false, // whitelist disabled
        ],
      })
      toast.success('✅ SBT is now created and ready to be activated.')
    } catch (err) {
      console.error('Create failed:', err)
      toast.error(err.message || 'Create failed')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'setActive',
        args: [typeId, true],
      })
      toast.success('✅ SBT type is now active.')
    } catch (err) {
      toast.error(err.message || 'Activate failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'setActive',
        args: [typeId, false],
      })
      toast.success('🛑 SBT type is now deactivated.')
    } catch (err) {
      toast.error(err.message || 'Deactivate failed')
    } finally {
      setLoading(false)
    }
  }

  const handleBurn = async () => {
    if (!burnTokenId || isNaN(Number(burnTokenId))) {
      toast.error('Please enter a valid token ID')
      return
    }

    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'burn',
        args: [BigInt(burnTokenId)],
      })
      toast.success(`🔥 Token ${burnTokenId} burned successfully!`)
      setBurnTokenId('')
    } catch (err) {
      toast.error(err.message || 'Burn failed')
    } finally {
      setLoading(false)
    }
  }

  // Optional: edit URI and maxSupply — only if contract supports it
  const handleEditSBT = async () => {
    try {
      setLoading(true)

      if (editUri) {
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV3_ABI,
          functionName: 'updateSBTUri',
          args: [typeId, editUri],
        })
      }

      if (editMaxSupply) {
        await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV3_ABI,
          functionName: 'updateMaxSupply',
          args: [typeId, BigInt(editMaxSupply)],
        })
      }

      toast.success('✏️ SBT type updated')
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-red-600 font-semibold p-4">
        You must be the admin to access this panel.
      </div>
    )
  }

  return (
    <div className="p-4 border rounded max-w-3xl mx-auto bg-white text-black space-y-6">
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
          Metadata URI: <code>{`https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${title}.json`}</code>
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
        </div>
      </div>

      {/* === EDIT === */}
      <div>
        <h3 className="font-semibold mb-2">Edit Existing SBT Type</h3>

        <label className="block mb-1">New URI (full)</label>
        <input
          type="text"
          value={editUri}
          onChange={(e) => setEditUri(e.target.value)}
          placeholder="https://...json"
          className="w-full mb-4 p-2 border rounded"
        />

        <label className="block mb-1">New Max Supply</label>
        <input
          type="number"
          value={editMaxSupply}
          onChange={(e) => setEditMaxSupply(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
        />

        <button
          onClick={handleEditSBT}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded"
        >
          {loading ? 'Updating...' : 'Update SBT Type'}
        </button>
      </div>

      {/* === DASHBOARD === */}
      <div>
        <h3 className="font-semibold mb-2">Dashboard</h3>
        <table className="w-full text-left border-collapse mb-4">
          <thead>
            <tr>
              <th className="border p-2">Type ID</th>
              <th className="border p-2">Title</th>
              <th className="border p-2">URI</th>
              <th className="border p-2">Active</th>
              <th className="border p-2">Burnable</th>
              <th className="border p-2">Max</th>
              <th className="border p-2">Minted</th>
            </tr>
          </thead>
          <tbody>
            {sbtTypesData.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center text-gray-500 p-4">
                  No SBT types found.
                </td>
              </tr>
            ) : (
              sbtTypesData.map((t) => (
                <tr key={t.id}>
                  <td className="border p-2">{t.id}</td>
                  <td className="border p-2 truncate max-w-xs" title={t.title}>
                    {t.title || '-'}
                  </td>
                  <td className="border p-2 truncate max-w-xs" title={t.uri.split('/').pop()}>
                    {t.uri.split('/').pop()}
                  </td>
                  <td className="border p-2">{t.active ? '✅' : '❌'}</td>
                  <td className="border p-2">{t.burnable ? '✅' : '❌'}</td>
                  <td className="border p-2">{t.maxSupply}</td>
                  <td className="border p-2">{t.minted}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* === BURN === */}
      <div>
        <h3 className="font-semibold mb-2">Burn Token</h3>
        <input
          type="number"
          value={burnTokenId}
          onChange={(e) => setBurnTokenId(e.target.value)}
          className="w-full mb-4 p-2 border rounded"
          placeholder="Token ID"
        />
        <button
          onClick={handleBurn}
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? 'bg-red-300' : 'bg-red-600'
          }`}
        >
          {loading ? 'Burning...' : 'Burn Token'}
        </button>
      </div>
    </div>
  )
}

