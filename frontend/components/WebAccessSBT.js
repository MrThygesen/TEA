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
  const [ownedSBTs, setOwnedSBTs] = useState([])
  const [loadingTypeId, setLoadingTypeId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [previewSBT, setPreviewSBT] = useState(null)

  // Helper to extract tags array from attributes
  const extractTags = (attributes) => {
    if (!Array.isArray(attributes)) return []
    const tagsAttr = attributes.find(attr => attr.trait_type === 'Tags')
    if (!tagsAttr || !tagsAttr.value) return []
    return tagsAttr.value.split(',').map(tag => tag.trim())
  }

  // Fetch available SBTs with exclusion of typeId 1-50
  const fetchAvailableSBTs = useCallback(async () => {
    if (!address || !publicClient) return

    const maxTypeCount = 100
    const found = []

    for (let i = 51; i <= maxTypeCount; i++) {
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
            const tags = extractTags(metadata.attributes)

            found.push({
              typeId: i,
              uri,
              name: metadata.name || `SBT Type ${i}`,
              image: metadata.image || '',
              description: metadata.description || '',
              tags,
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

  // Fetch owned SBTs with exclusion of typeId 1-50
  const fetchOwnedSBTs = useCallback(async () => {
    if (!address || !publicClient) return

    try {
      const tokenIds = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WebAccessSBTV31_ABI,
        functionName: 'tokensOfOwner',
        args: [address],
      })

      const owned = []
      for (const tokenId of tokenIds) {
        const typeId = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV31_ABI,
          functionName: 'typeOf',
          args: [tokenId],
        })

        // Exclude typeId 1-50
        if (typeId >= 1 && typeId <= 50) continue

        const sbtType = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WebAccessSBTV31_ABI,
          functionName: 'sbtTypes',
          args: [typeId],
        })

        const [uri] = sbtType

        try {
          const res = await fetch(uri)
          const metadata = await res.json()
          const tags = extractTags(metadata.attributes)

          owned.push({
            tokenId,
            typeId,
            uri,
            name: metadata.name || `SBT Type ${typeId}`,
            image: metadata.image || '',
            description: metadata.description || '',
            tags,
            attributes: metadata.attributes || [],
            metadata,
          })
        } catch (e) {
          console.warn(`Error loading owned token ${tokenId}:`, e.message)
        }
      }

      setOwnedSBTs(owned)
    } catch (err) {
      console.error('Error fetching owned SBTs:', err)
    }
  }, [address, publicClient])

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
      await fetchAvailableSBTs()
      await fetchOwnedSBTs()
    } catch (err) {
      console.error('Claim failed:', err)
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoadingTypeId(null)
    }
  }

  const filteredSBTs = availableSBTs.filter((sbt) =>
    sbt.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

        {/* Available SBTs */}
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white mt-6 mb-4">
          Available SBTs
        </h2>
        {filteredSBTs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No available SBTs to claim.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filteredSBTs.map(
              ({ typeId, name, image, description, tags, tokensLeft, metadata }) => (
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

                  {Array.isArray(tags) && tags.length > 0 && (
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

        {/* Owned SBTs */}
        <h2 className="text-xl font-bold mt-10 mb-4">Your Owned SBTs</h2>
        {ownedSBTs.length === 0 ? (
          <p className="text-gray-500">You do not own any SBTs yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {ownedSBTs.map(({ tokenId, typeId, name, image, description, tags, metadata }) => (
              <div
                key={tokenId.toString()}
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
                {Array.isArray(tags) && tags.length > 0 && (
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

                <button
                  onClick={() => setPreviewSBT(metadata)}
                  className="mt-2 w-full py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white font-semibold transition"
                >
                  Preview
                </button>
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
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto relative animate-fade-in-up">
              <button
                onClick={() => setPreviewSBT(null)}
                aria-label="Close preview"
                className="absolute top-3 right-3 text-white bg-red-500 hover:bg-red-600 rounded-full w-10 h-10 text-center font-bold shadow-lg transition duration-200"
              >
                &times;
              </button>

              {/* Title */}
              <h3 className="text-2xl font-bold mb-4 text-center dark:text-white">
                {previewSBT.name}
              </h3>

              {/* Image */}
              {previewSBT.image && (
                <img
                  src={previewSBT.image}
                  alt={previewSBT.name}
                  className="w-full max-w-xs mx-auto h-48 object-cover rounded mb-4 shadow"
                />
              )}

              {/* Description */}
              {previewSBT.description && (
                <p className="text-gray-700 dark:text-gray-300 text-center mb-4">
                  {previewSBT.description}
                </p>
              )}

              {/* External URL */}
              {previewSBT.external_url && (
                <a
                  href={previewSBT.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-blue-600 dark:text-blue-400 hover:underline mb-6"
                >
                  Visit Event Page ↗
                </a>
              )}

              {/* Attributes */}
              {Array.isArray(previewSBT.attributes) && previewSBT.attributes.length > 0 && (
                <div className="mb-6 space-y-2">
                  {previewSBT.attributes
                    .filter((attr) => attr.trait_type !== 'Tag' && attr.trait_type !== 'Tags')
                    .map((attr, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="font-semibold text-gray-600 dark:text-gray-400 w-40">
                          {attr.trait_type}:
                        </span>
                        <span className="text-gray-900 dark:text-gray-200">
                          {Array.isArray(attr.value)
                            ? attr.value.join(', ')
                            : attr.value?.replace(/^["']|["']$/g, '')}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6 justify-center">
                {previewSBT.attributes
                  ?.filter((attr) => attr.trait_type === 'Tag' || attr.trait_type === 'Tags')
                  .flatMap(attr => {
                    const vals = Array.isArray(attr.value)
                      ? attr.value
                      : attr.value.split?.(',')
                      ? attr.value.split(',').map(t => t.trim())
                      : [attr.value]
                    return vals
                  })
                  .map((tag, index) => (
                    <span
                      key={index}
                      className="bg-indigo-100 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100 px-3 py-1 rounded-full text-sm font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
                <button
                  onClick={handleShare}
                  className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-md transition"
                >
                  📋 Copy Link
                </button>
                {previewSBT.external_url && (
                  <a
                    href={previewSBT.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-semibold text-center shadow-md transition"
                  >
                    🌐 Visit
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

