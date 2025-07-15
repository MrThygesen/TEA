'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId, useSwitchChain, useWriteContract, useReadContract } from 'wagmi'
import CONTRACT_ABI from '../abis/WebAccessSBTV5.json'
import { polygonAmoy } from '../chains/polygonAmoy'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

export default function AdminSBTManager() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [types, setTypes] = useState([])

  // Example contract read using useReadContract (Wagmi v2)
  const { data: sbtTypeCount, refetch } = useReadContract({
    abi: CONTRACT_ABI,
    address: CONTRACT_ADDRESS,
    functionName: 'getTypeCount',
  })

  // Load SBT Types (custom logic, assuming your contract supports it)
  useEffect(() => {
    const loadTypes = async () => {
      if (!isConnected || chainId !== polygonAmoy.id) return
      try {
        const count = Number(sbtTypeCount)
        const typesArray = []
        for (let i = 0; i < count; i++) {
          const res = await fetch(`/api/sbt-meta/${i}.json`)
          const meta = await res.json()
          typesArray.push({ id: i, ...meta })
        }
        setTypes(typesArray)
      } catch (err) {
        console.error('Failed to load types:', err)
      }
    }
    loadTypes()
  }, [sbtTypeCount, isConnected, chainId])

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Admin SBT Manager</h2>
      {chainId !== polygonAmoy.id && (
        <button
          className="px-4 py-2 bg-yellow-500 text-white rounded"
          onClick={() => switchChain({ chainId: polygonAmoy.id })}
        >
          Switch to Polygon Amoy
        </button>
      )}
      {types.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {types.map((type) => (
            <li key={type.id} className="p-2 border rounded">
              <strong>{type.name}</strong> — {type.description}
            </li>
          ))}
        </ul>
      ) : (
        <p>No SBT types found or not connected.</p>
      )}
    </div>
  )
}

