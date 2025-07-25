'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { toast } from 'react-hot-toast'
import WebAccessSBTV31_ABI from '../abis/WebAccessSBTV31_ABI.json'

const CONTRACT_ADDRESS = '0x67c4654C71d665DC94c507cF35Adf03031db9655'

export default function WebAccessSBT() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const [availableSBTs, setAvailableSBTs] = useState([])
  const [ownedSBTs, setOwnedSBTs] = useState([])       // owned tokens metadata array
  const [loadingTypeId, setLoadingTypeId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [previewSBT, setPreviewSBT] = useState(null)

  // Fetch SBTs available to claim (existing)
  const fetchAvailableSBTs = useCallback(async () => {
    if (!address || !publicClient) return

    const maxTypeCount = 50
    const found = []

    for (let i = 30; i <= maxTypeCount; i++) {
      try {
        const [sbtType, hasClaimed] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV31_ABI,
            functionName: 'sbtTypes',
            args: [i],
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WebAccessSBTV31_ABI,
            functionName: 'hasClaimed',
            args: [i, address],
          }),
        ])

        const [uri, active, , maxSupply, minted] = sbtType

        if (active && !hasClaimed && minted < maxSupply) {
          try {
            const res = await fetch(uri)
            const metadata = await res.json()

            found.push({
              typeId: i,
              uri,
              name: metadata.name || `SBT Type ${i}`,
              image: metadata.image || '',
              description: metadata.description || '',
              tags: metadata.tags || [],
              tokensLeft: Number(maxSupply) - Number(minted),
              metadata,
            })
          } catch (e) {
            console.warn(`Error loading SBT ${i}:`, e.message)
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch SBT type ${i}:`, err)
        continue
      }
    }

    setAvailableSBTs(found)
  }, [address, publicClient])

  // Fetch tokens owned by user and their metadata
  const fetchOwnedSBTs = useCallback(async () => {
    if (!address || !publicClient) return

    try {
      // 1. Get token IDs owned by user
      const tokenIds = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV31_ABI,
        functionName: 'tokensOfOwner',
        args: [address],
      })

      const owned = []
      for (const tokenId of tokenIds) {
        // 2. Fetch token typeId via public mapping getter "typeOf"
        const typeId = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV31_ABI,
          functionName: 'typeOf',  // <-- fixed from 'tokenType'
          args: [tokenId],
        })

        // 3. Fetch sbtType info for metadata URI
        const sbtType = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV31_ABI,
          functionName: 'sbtTypes',
          args: [typeId],
        })

        const [uri] = sbtType

        // 4. Fetch metadata JSON from URI
        try {
          const res = await fetch(uri)
          const metadata = await res.json()

          owned.push({
            tokenId,
            typeId,
            uri,
            name: metadata.name || `SBT Type ${typeId}`,
            image: metadata.image || '',
            description: metadata.description || '',
            tags: metadata.tags || [],
            metadata,
          })
        } catch (e) {
          console.warn(`Error loading owned token ${tokenId}:`, e.message)
        }
      }

      setOwnedSBTs(owned)
    } catch (err) {
      console.error('Failed to fetch owned SBTs:', err)
    }
  }, [address, publicClient])

  // Fetch both available and owned SBTs when address or client changes
  useEffect(() => {
    fetchAvailableSBTs()
    fetchOwnedSBTs()
  }, [fetchAvailableSBTs, fetchOwnedSBTs])

  const handleClaim = async (typeId) => {
    try {
      setLoadingTypeId(typeId)
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV31_ABI,
        functionName: 'claim',
        args: [typeId],
      })
      toast.success(`🎉 Claimed SBT type ${typeId}`)
      // Refresh lists
      await fetchAvailableSBTs()
      await fetchOwnedSBTs()
    } catch (err) {
      console.error('Claim failed:', err)
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoadingTypeId(null)
    }
  }

  // Filter available SBTs by search term
  const filteredSBTs = availableSBTs.filter((sbt) =>
    sbt.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Helper to render any extra metadata key-values (except handled ones)
  const renderExtraMetadata = (metadata) => {
    const skipKeys = new Set(['name', 'description', 'image', 'tags', 'external_url'])
    return Object.entries(metadata)
      .filter(([key]) => !skipKeys.has(key))
      .map(([key, value]) => (
        <div key={key} className="mb-2 text-xs text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{key}:</span>{' '}
          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
        </div>
      ))
  }

  const handleShare = () => {
    if (previewSBT?.uri) {
      navigator.clipboard.writeText(previewSBT.uri)
      toast.success('Metadata URI copied to clipboard!')
    }
  }

  return (
    <div
      className={`${
        darkMode ? 'bg-black text-white' : 'bg-white text-black'
      } min-h-screen p-4 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <input
            type="text"
            placeholder="Search SBT by name..."
            className="w-full sm:w-2/3 p-2 border rounded bg-white text-black dark:bg-zinc-800 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-all bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
          >
            {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {/* Available to claim section */}
        {filteredSBTs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No available SBTs to claim.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSBTs.map(
              ({
                typeId,
                name,
                image,
                description,
                tags,
                tokensLeft,
                metadata,
              }) => (
                <div
                  key={typeId}
                  className={`border rounded-xl p-4 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                    darkMode
                      ? 'bg-zinc-900 text-white border-zinc-700'
                      : 'bg-white text-black'
                  }`}
                >
                  <img
                    src={image}
                    alt={name}
                    className="w-full aspect-[4/3] object-cover rounded mb-3 shadow"
                  />
                  <h3 className="text-lg font-semibold mb-1">{name}</h3>
                  <p className="text-sm mb-2 line-clamp-3">
                    {description.split(' ').slice(0, 12).join(' ')}...
                  </p>
                  <p className="text-xs mb-2 text-gray-500 dark:text-gray-400">
                    🧮 Tokens left: {tokensLeft}
                  </p>

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-100 text-blue-800 px-2 py-0.5 text-xs rounded dark:bg-blue-800 dark:text-white"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handleClaim(typeId)}
                      disabled={loadingTypeId === typeId}
                      className={`flex-1 py-2 rounded-lg text-white font-bold shadow-sm transform transition-all active:scale-95 ${
                        loadingTypeId === typeId
                          ? 'bg-blue-300'
                          : 'bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800'
                      }`}
                    >
                      {loadingTypeId === typeId ? 'Claiming...' : 'Claim'}
                    </button>
                    <button
                      onClick={() => setPreviewSBT(metadata)}
                      className="flex-1 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Owned SBTs section */}
        <h2 className="text-xl font-bold mt-10 mb-4">Your Owned SBTs</h2>
        {ownedSBTs.length === 0 ? (
          <p className="text-gray-500">You do not own any SBTs yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {ownedSBTs.map(({ tokenId, typeId, name, image, description, tags }) => (
              <div
                key={tokenId}
                className={`border rounded-xl p-4 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                  darkMode ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                }`}
              >
                <img
                  src={image}
                  alt={name}
                  className="w-full aspect-[4/3] object-cover rounded mb-3 shadow"
                />
                <h3 className="text-lg font-semibold mb-1">{name}</h3>
                <p className="text-sm mb-2 line-clamp-3">{description}</p>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-100 text-blue-800 px-2 py-0.5 text-xs rounded dark:bg-blue-800 dark:text-white"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">Token ID: {tokenId.toString()}</p>
                <p className="text-xs text-gray-400">Type ID: {typeId.toString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Preview modal */}
        {previewSBT && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] overflow-y-auto relative animate-fade-in-up">
              <button
                onClick={() => setPreviewSBT(null)}
                aria-label="Close preview"
                className="absolute top-3 right-3 text-white bg-red-500 hover:bg-red-600 rounded-full w-10 h-10 text-center font-bold shadow-lg transition duration-200"
              >
                &times;
              </button>
              <h3 className="text-2xl font-bold mb-4">{previewSBT.name}</h3>

              {previewSBT.image && (
                <img
                  src={previewSBT.image}
                  alt={previewSBT.name}
                  className="w-full max-h-60 object-contain rounded-lg shadow mb-4"
                />
              )}

              <p className="mb-4 text-sm">{previewSBT.description}</p>

              {previewSBT.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {previewSBT.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="bg-blue-100 text-blue-800 px-2 py-0.5 text-xs rounded dark:bg-blue-800 dark:text-white"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Render all other metadata keys */}
              {renderExtraMetadata(previewSBT)}

              {previewSBT.external_url && (
                <a
                  href={previewSBT.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline text-sm block mb-4"
                >
                  🌐 External Link
                </a>
              )}

              <button
                onClick={handleShare}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                📋 Copy Metadata URI
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
 
