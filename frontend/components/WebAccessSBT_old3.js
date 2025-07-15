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

  const [availableSBTs, setAvailableSBTs] = useState([])
  const [loadingTypeId, setLoadingTypeId] = useState(null)

  const fetchAvailableSBTs = useCallback(async () => {
    if (!address || !publicClient) return

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

        const [uri, active, , maxSupply, minted] = sbtType

        if (active && !hasClaimed && minted < maxSupply) {
          // Load metadata (image, name, description)
          const res = await fetch(uri)
          const metadata = await res.json()

          found.push({
            typeId: i,
            uri,
            name: metadata.name,
            image: metadata.image,
            description: metadata.description,
          })
        }
      } catch (err) {
        console.warn(`Failed to fetch SBT type ${i}:`, err)
        continue
      }
    }

    setAvailableSBTs(found)
  }, [address, publicClient])

  useEffect(() => {
    fetchAvailableSBTs()
  }, [fetchAvailableSBTs])

  const handleClaim = async (typeId) => {
    try {
      setLoadingTypeId(typeId)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV3_ABI,
        functionName: 'claim',
        args: [typeId],
      })
      toast.success(`🎉 Claimed SBT type ${typeId}`)
      await fetchAvailableSBTs()
    } catch (err) {
      console.error('Claim failed:', err)
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoadingTypeId(null)
    }
  }

  if (availableSBTs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-600">
        No available SBTs to claim.
      </div>
    )
  }

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
      {availableSBTs.map(({ typeId, name, image, description }) => (
        <div key={typeId} className="border rounded-lg p-4 bg-white shadow">
          <img
            src={image}
            alt={name}
            className="w-full h-48 object-cover rounded mb-2"
          />
          <h3 className="text-lg font-semibold mb-1">{name}</h3>
          <p className="text-sm text-gray-700 mb-4 line-clamp-3">
            {description?.split(' ').slice(0, 10).join(' ')}...
          </p>
          <button
            onClick={() => handleClaim(typeId)}
            disabled={loadingTypeId === typeId}
            className={`w-full py-2 rounded text-white ${
              loadingTypeId === typeId ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {loadingTypeId === typeId ? 'Claiming...' : 'Claim'}
          </button>
        </div>
      ))}
    </div>
  )
}

