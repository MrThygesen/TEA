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
  const [searchTerm, setSearchTerm] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [previewSBT, setPreviewSBT] = useState(null)

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

  const filteredSBTs = availableSBTs.filter((sbt) =>
    sbt.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div
      className={`${
        darkMode ? 'bg-black text-white' : 'bg-white text-black'
      } min-h-screen p-4 transition-colors duration-300`}
    >
      <div className="max-w-7xl mx-auto">
        {/* Top Bar */}
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
            className="px-4 py-2 rounded border text-sm font-medium transition-all hover:bg-gray-200 dark:hover:bg-zinc-700"
          >
            {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>

        {filteredSBTs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No available SBTs to claim.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
                  className={`border rounded-lg p-4 ${
                    darkMode
                      ? 'bg-zinc-900 text-white border-zinc-700'
                      : 'bg-white text-black shadow'
                  } hover:shadow-lg transition`}
                >
                  <img
                    src={image}
                    alt={name}
                    className="w-full aspect-[4/3] object-cover rounded mb-3"
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
                      className={`flex-1 py-2 rounded text-white font-semibold ${
                        loadingTypeId === typeId
                          ? 'bg-blue-300'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {loadingTypeId === typeId ? 'Claiming...' : 'Claim'}
                    </button>
                    <button
                      onClick={() => setPreviewSBT(metadata)}
                      className="flex-1 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white font-semibold"
                    >
                      Preview
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* === PREVIEW MODAL === */}
        {previewSBT && (
          <div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-lg max-w-xl w-full max-h-[80vh] overflow-y-auto relative">
              <button
                onClick={() => setPreviewSBT(null)}
                aria-label="Close preview"
                tabIndex={0}
                className="absolute top-3 right-3 text-black dark:text-white text-3xl font-bold leading-none hover:text-red-600 transition"
              >
                &times;
              </button>
              <h3 className="text-2xl font-bold mb-2">{previewSBT.name}</h3>
              {previewSBT.image && (
                <img
                  src={previewSBT.image}
                  alt={previewSBT.name}
                  className="w-full h-auto rounded mb-4"
                />
              )}
              <p className="mb-4 text-sm">{previewSBT.description}</p>
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
              <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(previewSBT, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

