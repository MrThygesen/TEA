'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { toast } from 'react-hot-toast'
import { WebAccessSBTV3_ABI } from '../abis/WebAccessSBTV3_ABI'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

export default function WebAccessSBT() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [availableTypes, setAvailableTypes] = useState([])
  const [selectedTypeId, setSelectedTypeId] = useState()
  const [loading, setLoading] = useState(false)

  const fetchAvailableSBTs = useCallback(async () => {
    if (!address || !publicClient) {
      setAvailableTypes([])
      return
    }

    const maxTypeCount = 20
    const found = []

    for (let i = 1; i <= maxTypeCount; i++) {
      try {
        const [sbtType, hasClaimed] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV3_ABI,
            functionName: 'sbtTypes',
            args: [i],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV3_ABI,
            functionName: 'hasClaimed',
            args: [i, address],
          }),
        ])

        console.log(`Type ${i}:`, sbtType, 'claimed?', hasClaimed)

        // Correct destructuring from tuple (array)
        const [uri, active, transferable, maxSupply, minted] = sbtType

        if (!uri) {
          console.warn(`SBT type ${i} has no URI`)
          continue
        }

        if (active && !hasClaimed && minted < maxSupply) {
          const label = `${i} - ${uri.split('/').pop()?.replace('.json', '') || ''}`;
          found.push({ id: i, label });
        }
      } catch (err) {
        console.warn(`Failed to fetch SBT type ${i}:`, err)
        continue
      }
    }

    setAvailableTypes(found)
  }, [address, publicClient])

  useEffect(() => {
    fetchAvailableSBTs()
  }, [address, fetchAvailableSBTs])

  const handleClaim = async () => {
    if (!selectedTypeId) {
      toast.error('Please select an SBT type')
      return
    }

    try {
      setLoading(true)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'claim',
        args: [selectedTypeId],
      })

      toast.success('🎉 SBT claimed successfully!')

      await fetchAvailableSBTs()
      setSelectedTypeId(undefined)
    } catch (err) {
      console.error('Claim failed:', err)
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded max-w-md mx-auto bg-white text-black">
      <h2 className="text-xl font-bold mb-4">Claim Your SBT</h2>

      <label className="block mb-1">Available Types</label>
      <select
        value={selectedTypeId?.toString() || ''}
        onChange={(e) => setSelectedTypeId(Number(e.target.value))}
        className="w-full p-2 border rounded mb-4"
      >
        <option value="">-- Select SBT Type --</option>
        {availableTypes.length === 0 ? (
          <option disabled>No available SBTs found</option>
        ) : (
          availableTypes.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))
        )}
      </select>

      <button
        onClick={handleClaim}
        disabled={!selectedTypeId || loading}
        className={`w-full px-4 py-2 rounded text-white ${
          loading ? 'bg-blue-300' : 'bg-blue-600'
        }`}
      >
        {loading ? 'Claiming...' : 'Claim'}
      </button>

      {availableTypes.length === 0 && (
        <p className="mt-4 text-gray-500 text-sm">No SBTs available to claim.</p>
      )}
    </div>
  )
}

