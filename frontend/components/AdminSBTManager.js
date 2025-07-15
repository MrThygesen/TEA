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

  const [sbtTypesData, setSbtTypesData] = useState([])
  const [burnTokenId, setBurnTokenId] = useState('')

  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  // Fetch all SBT types to display dashboard overview
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
          // sbtType = [uri, active, burnable, maxSupply, minted]
          const [uri, active, burnableFlag, maxSupplyBig, mintedBig] = sbtType
          const maxSupplyNum = Number(maxSupplyBig.toString())
          const mintedNum = Number(mintedBig.toString())

          if (uri) {
            types.push({
              id: i,
              uri,
              active,
              burnable: burnableFlag,
              maxSupply: maxSupplyNum,
              minted: mintedNum,
            })
          }
        } catch (err) {
          // ignore errors to continue fetching others
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
    console.log('Creating with:', { typeId, uri, burnable, maxSupply })

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
    console.log('Activating Type ID:', typeId)
    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'setActive',
        args: [typeId, true],
      })
      toast.success('✅ SBT type is now active and claimable.')
    } catch (err) {
      console.error('Activate failed:', err)
      toast.error(err.message || 'Activate failed')
    } finally {
      setLoading(false)
    }
  }

  // Burn a token by tokenId
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
      console.error('Burn failed:', err)
      toast.error(err.message || 'Burn failed')
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
    <div className="p-4 border rounded max-w-3xl mx-auto bg-white text-black">
      <h2 className="text-xl font-bold mb-4">Admin: Create SBT Type</h2>

      <label className="block mb-1">Type ID</label>
      <input
        type="number"
        value={typeId.toString()}
        onChange={(e) => setTypeId(BigInt(e.target.value))}
        className="w-full mb-4 p-2 border rounded"
      />

      <label className="block mb-1">
        Title{' '}
        <span className="text-sm text-gray-500">
          (e.g. <code>free-meeting-pass</code>)
        </span>
      </label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Filename for metadata"
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

      <p className="text-sm text-gray-500 mb-4 break-words">
        Metadata URI: <br />
        <code>{`https://raw.githubusercontent.com/MrThygesen/TEA/main/data/${title}.json`}</code>
      </p>

      <div className="flex space-x-2 mb-8">
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
          {loading ? 'Activating...' : 'Activate SBT Type'}
        </button>
      </div>

      <h2 className="text-xl font-bold mb-4">Dashboard Overview</h2>

      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr>
            <th className="border p-2">Type ID</th>
            <th className="border p-2">URI</th>
            <th className="border p-2">Active</th>
            <th className="border p-2">Burnable</th>
            <th className="border p-2">Max Supply</th>
            <th className="border p-2">Minted</th>
          </tr>
        </thead>
        <tbody>
          {sbtTypesData.length === 0 && (
            <tr>
              <td colSpan="6" className="border p-2 text-center text-gray-500">
                No SBT types found.
              </td>
            </tr>
          )}
          {sbtTypesData.map(({ id, uri, active, burnable, maxSupply, minted }) => (
            <tr key={id}>
              <td className="border p-2">{id}</td>
              <td className="border p-2 truncate max-w-xs" title={uri}>
                {uri.split('/').pop()}
              </td>
              <td className="border p-2">{active ? '✅' : '❌'}</td>
              <td className="border p-2">{burnable ? '✅' : '❌'}</td>
              <td className="border p-2">{maxSupply}</td>
              <td className="border p-2">{minted}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-xl font-bold mb-4">Burn Token</h2>

      <label className="block mb-1">Token ID to Burn</label>
      <input
        type="number"
        value={burnTokenId}
        onChange={(e) => setBurnTokenId(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
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
  )
}

