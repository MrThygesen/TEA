'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { parseAbi } from 'viem'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'

const styles = {
  container: 'min-h-screen p-4 max-w-5xl mx-auto',
  sectionBox: 'border border-zinc-700 rounded-lg p-4 mb-4 bg-zinc-900',
  header: 'text-xl font-semibold mb-3 text-white',
  btnPrimary: 'px-3 py-1 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed',
  btnSecondary: 'px-3 py-1 border rounded text-blue-600 border-blue-600 hover:bg-blue-50',
  sbtCard: 'border rounded p-4 text-left bg-zinc-800 text-white',
  sbtImage: 'w-full h-40 object-cover rounded mb-2',
  tagBadge: 'border border-blue-400 text-blue-200 text-xs px-2 py-1 rounded-full',
}

function shortenText(text, maxLen = 120) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

export default function WebAccessSBT() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [availableSBTs, setAvailableSBTs] = useState([])
  const [ownedSBTs, setOwnedSBTs] = useState([])
  const [approvedEvents, setApprovedEvents] = useState([])
  const [openEvents, setOpenEvents] = useState([])
  const [loadingTypeId, setLoadingTypeId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchEvents = async () => {
    try {
      const [openRes, approvedRes] = await Promise.all([
        fetch('/api/events?approvedOnly=false'),
        fetch('/api/events?approvedOnly=true'),
      ])
      const [openData, approvedData] = await Promise.all([openRes.json(), approvedRes.json()])
      setOpenEvents(openData)
      setApprovedEvents(approvedData)
    } catch (err) {
      console.error('Error loading events:', err)
    }
  }

  const fetchSBTs = useCallback(async () => {
    if (!address || !publicClient) return

    setIsLoading(true)
    const maxTypeCount = 100
    const owned = []
    const available = []

    let tokenIds = []
    try {
      tokenIds = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(['function tokensOfOwner(address) view returns (uint256[])']),
        functionName: 'tokensOfOwner',
        args: [address],
      })
    } catch (err) {
      console.error('Error fetching owned tokens:', err)
    }

    const ownedTypeIds = new Set()

    for (const tokenId of tokenIds) {
      try {
        const [typeId, uri] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(['function typeOf(uint256) view returns (uint256)']),
            functionName: 'typeOf',
            args: [tokenId],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: parseAbi(['function tokenURI(uint256) view returns (string)']),
            functionName: 'tokenURI',
            args: [tokenId],
          }),
        ])

        const res = await fetch(uri)
        const metadata = await res.json()

        ownedTypeIds.add(Number(typeId))

        owned.push({
          tokenId: Number(tokenId),
          typeId: Number(typeId),
          uri,
          name: metadata.name || `Token ${tokenId}`,
          image: metadata.image || '',
          description: metadata.description || '',
        })
      } catch (err) {
        console.warn('Error loading owned metadata:', err)
      }
    }

    for (let i = 1; i <= maxTypeCount; i++) {
      if (ownedTypeIds.has(i)) continue
      try {
        const sbtType = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: parseAbi([
            'function sbtTypes(uint256) view returns (string uri, bool active, uint256 maxSupply, uint256 supply, bool created, bool burnable)',
          ]),
          functionName: 'sbtTypes',
          args: [i],
        })

        const [uri, active, maxSupply, supply, created] = sbtType

        const isSubscription = i >= 100 && i < 5000
        const isApprovedEvent = i >= 5000 && approvedEvents.some(ev => ev.id === i)

        if (created && active && uri && supply < maxSupply && (isSubscription || isApprovedEvent)) {
          const res = await fetch(uri)
          const metadata = await res.json()

          available.push({
            typeId: i,
            uri,
            name: metadata.name || `SBT Type ${i}`,
            image: metadata.image || '',
            description: metadata.description || '',
            tokensLeft: Number(maxSupply) - Number(supply),
          })
        }
      } catch (e) {
        console.warn(`Failed to fetch sbtTypes[${i}]:`, e)
      }
    }

    setOwnedSBTs(owned)
    setAvailableSBTs(available)
    setIsLoading(false)
  }, [address, publicClient, approvedEvents])

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (approvedEvents.length) {
      fetchSBTs()
    }
  }, [fetchSBTs, approvedEvents])

  const handleClaim = async (typeId) => {
    if (ownedSBTs.some((sbt) => sbt.typeId === typeId)) {
      toast.error(`Already claimed SBT of type ${typeId}`)
      return
    }

    try {
      setLoadingTypeId(typeId)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: parseAbi(['function claim(uint256)']),
        functionName: 'claim',
        args: [typeId],
      })
      toast.success(`Claimed SBT type ${typeId}`)
      await fetchSBTs()
    } catch (err) {
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoadingTypeId(null)
    }
  }

  return (
    <div className={styles.container}>
      {/* Open Events */}
      <div className={styles.sectionBox}>
        <h2 className={styles.header}>🟠 Open Events (Telegram Registration)</h2>
        {openEvents.length === 0 ? (
          <p className="text-gray-400">No open events at the moment.</p>
        ) : (
          <ul className="list-disc ml-5 space-y-1 text-white text-sm">
            {openEvents.map((e) => (
              <li key={e.id}>
                {e.name} — {new Date(e.datetime).toLocaleString()} —{' '}
                <a href="https://t.me/YourTelegramGroup" target="_blank" className="text-blue-400 underline">Join on Telegram</a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Approved Event SBTs */}
      <div className={styles.sectionBox}>
        <h2 className={styles.header}>✅ Approved Event SBTs (Min 20 Attendees)</h2>
        {availableSBTs.filter(sbt => sbt.typeId >= 5000).length === 0 ? (
          <p className="text-gray-400">No claimable event passes yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {availableSBTs.filter(sbt => sbt.typeId >= 5000).map((sbt) => (
              <div key={sbt.typeId} className={styles.sbtCard}>
                <img src={sbt.image} alt={sbt.name} className={styles.sbtImage} />
                <h3 className="text-lg font-semibold">{sbt.name}</h3>
                <p className="text-sm">{shortenText(sbt.description)}</p>
                <p className="text-xs mt-1 text-gray-400">Type ID: {sbt.typeId}</p>
                <button
                  disabled={loadingTypeId === sbt.typeId}
                  onClick={() => handleClaim(sbt.typeId)}
                  className={`${styles.btnPrimary} mt-2`}
                >
                  {loadingTypeId === sbt.typeId ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription SBTs */}
      <div className={styles.sectionBox}>
        <h2 className={styles.header}>💎 Subscription SBTs</h2>
        {availableSBTs.filter(sbt => sbt.typeId >= 100 && sbt.typeId < 5000).length === 0 ? (
          <p className="text-gray-400">No subscriptions available now.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {availableSBTs.filter(sbt => sbt.typeId >= 100 && sbt.typeId < 5000).map((sbt) => (
              <div key={sbt.typeId} className={styles.sbtCard}>
                <img src={sbt.image} alt={sbt.name} className={styles.sbtImage} />
                <h3 className="text-lg font-semibold">{sbt.name}</h3>
                <p className="text-sm">{shortenText(sbt.description)}</p>
                <p className="text-xs mt-1 text-gray-400">Type ID: {sbt.typeId}</p>
                <button
                  disabled={loadingTypeId === sbt.typeId}
                  onClick={() => handleClaim(sbt.typeId)}
                  className={`${styles.btnPrimary} mt-2`}
                >
                  {loadingTypeId === sbt.typeId ? 'Claiming...' : 'Claim'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

