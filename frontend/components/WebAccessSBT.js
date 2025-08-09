'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { parseAbi } from 'viem'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0xA508A0f5733bcfcf6eA0b41ca9344c27855FeEF0'

const styles = {
  container: 'min-h-screen p-4 max-w-5xl mx-auto',
  header: 'flex justify-between items-center mb-4',
  btnPrimary:
    'px-3 py-1 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed',
  btnSecondary:
    'px-3 py-1 border rounded text-blue-600 border-blue-600 hover:bg-blue-50',
  tagBadgeActive: 'bg-blue-600 text-white text-xs px-3 py-1 rounded-full',
  tagBadgeInactive: 'border border-blue-400 text-blue-400 text-xs px-3 py-1 rounded-full',
  tagBadge: 'border border-blue-400 text-blue-200 text-xs px-2 py-1 rounded-full',
  emailButton: 'px-3 py-1 text-sm border rounded bg-blue-600 text-white hover:bg-blue-700',
  sbtCard: 'border rounded p-4 text-left',
  sbtImage: 'w-full h-40 object-cover rounded mb-2',
  previewModalBg: 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50',
  previewModalContentDark: 'relative p-6 rounded-lg max-w-md w-full bg-gray-900 text-white text-left',
  previewCloseButton: 'absolute top-2 right-3 text-2xl font-bold cursor-pointer',
  flexWrapGap2: 'flex flex-wrap gap-2 mt-2',
  textGray400: 'text-xs mt-2 text-gray-400',
  flexGap2: 'flex gap-2',
  flexItemsStartGap2: 'flex items-start gap-2 text-sm mt-3 mb-2',
  checkboxMarginTop: 'mt-1',
  gridMd3Gap4: 'grid md:grid-cols-3 gap-4 mb-6',
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  )
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
  const [previewSBT, setPreviewSBT] = useState(null)
  const [loadingTypeId, setLoadingTypeId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState([])
  const [showOwned, setShowOwned] = useState(true)
  const [policyAccepted, setPolicyAccepted] = useState({})

  const extractTags = (attributes) => {
    if (!attributes || !Array.isArray(attributes)) return []
    const tagsAttr = attributes.find(
      (attr) =>
        attr.trait_type?.toLowerCase() === 'tags' ||
        attr.trait_type?.toLowerCase() === 'tag'
    )
    if (!tagsAttr?.value) return []
    return tagsAttr.value.split(',').map((t) => t.trim()).filter(Boolean)
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
          tags: extractTags(metadata.attributes),
          metadata,
        })
      } catch (err) {
        console.warn('Error loading owned SBT metadata:', err)
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

        if (created && active && uri && supply < maxSupply) {
          // NO event attendance check here at all, just add as available

          const res = await fetch(uri)
          const metadata = await res.json()

          available.push({
            typeId: i,
            uri,
            name: metadata.name || `SBT Type ${i}`,
            image: metadata.image || '',
            description: metadata.description || '',
            tags: extractTags(metadata.attributes),
            tokensLeft: Number(maxSupply) - Number(supply),
            metadata,
            eventAttendance: null,
          })
        }
      } catch (e) {
        console.warn(`Failed to fetch sbtTypes[${i}]:`, e)
      }
    }

    setOwnedSBTs(owned)
    setAvailableSBTs(available)
    setIsLoading(false)
  }, [address, publicClient])

  useEffect(() => {
    fetchSBTs()
  }, [fetchSBTs])

  const handleClaim = async (typeId) => {
    if (ownedSBTs.some((sbt) => sbt.typeId === typeId)) {
      toast.error(`❌ Already claimed SBT of type ${typeId}`)
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
      toast.success(`🎉 Claimed SBT type ${typeId}`)
      await fetchSBTs()
    } catch (err) {
      toast.error(err.message || 'Claim failed')
    } finally {
      setLoadingTypeId(null)
    }
  }

  const allTags = Array.from(
    new Set([...availableSBTs.flatMap((sbt) => sbt.tags), ...ownedSBTs.flatMap((sbt) => sbt.tags)])
  ).sort()

  const filteredAvailable =
    selectedTags.length === 0
      ? availableSBTs
      : availableSBTs.filter((sbt) => selectedTags.every((tag) => sbt.tags.includes(tag)))

  const filteredOwned =
    selectedTags.length === 0
      ? ownedSBTs
      : ownedSBTs.filter((sbt) => selectedTags.every((tag) => sbt.tags.includes(tag)))

  // Split available by typeId threshold
  const specificSBTs = filteredAvailable.filter((sbt) => sbt.typeId < 5000)
  const subscriptionSBTs = filteredAvailable.filter((sbt) => sbt.typeId >= 5000)

  return (
    <div className="bg-black text-white min-h-screen">
      <div className="bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border transition-colors duration-300">
        <h1 className="text-3xl font-bold mb-2 text-left w-full max-w-5xl">Grab the available network and membership deal</h1>
      </div>

      <div className={`${styles.container} relative overflow-hidden rounded-lg p-6`}>
        {/* TAG FILTER SECTION WITH HEADLINE */}
        <section className="border border-zinc-700 rounded-lg p-4 mb-4">
          <h2 className="text-xl font-semibold mb-3">Filter Deals</h2>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    )
                  }
                  className={
                    selectedTags.includes(tag) ? styles.tagBadgeActive : styles.tagBadgeInactive
                  }
                >
                  {tag}
                </button>
              ))}
            </div>
            <label className="text-sm">
              <input
                type="checkbox"
                className="mr-2"
                checked={showOwned}
                onChange={() => setShowOwned(!showOwned)}
              />
              Show My Deals
            </label>
          </div>
        </section>

        {isLoading && <LoadingSpinner />}

        {/* OWNED SBTs */}
        {showOwned && !isLoading && (
          <section className="border-zinc-700 text-white rounded-3xl p-8 border shadow-lg space-y-4 transition-colors duration-300 text-left">
            <h2 className="text-lg font-semibold mb-2">Your Deals</h2>
            {filteredOwned.length === 0 ? (
              <p className="text-gray-400">You did not join any social perk network yet.</p>
            ) : (
              <div className={styles.gridMd3Gap4}>
                {filteredOwned.map((sbt) => (
                  <div key={sbt.tokenId} className={styles.sbtCard}>
                    <img src={sbt.image} alt={sbt.name} className={styles.sbtImage} />
                    <h3 className="text-lg font-semibold">{sbt.name}</h3>
                    <p className="text-sm">{shortenText(sbt.description)}</p>
                    <div className={styles.flexWrapGap2}>
                      {sbt.tags.map((tag, idx) => (
                        <span key={idx} className={styles.tagBadge}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className={styles.textGray400}>
                      Type ID: {sbt.typeId} · Token ID: {sbt.tokenId}
                    </p>
                    <button
                      onClick={() => setPreviewSBT(sbt)}
                      className={`${styles.btnSecondary} mt-3`}
                    >
                      Preview
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* AVAILABLE SPECIFIC SBTs */}
        {!isLoading && specificSBTs.length > 0 && (
          <section className="border-zinc-700 text-white rounded-3xl p-8 border shadow-lg space-y-4 transition-colors duration-300 text-left">
            <h2 className="text-lg font-semibold mb-2">Available Specific Deals</h2>
            <div className={styles.gridMd3Gap4}>
              {specificSBTs.map((sbt) => (
                <SBTCard key={sbt.typeId} sbt={sbt} loadingTypeId={loadingTypeId} policyAccepted={policyAccepted} setPolicyAccepted={setPolicyAccepted} onClaim={handleClaim} onPreview={() => setPreviewSBT(sbt)} />
              ))}
            </div>
          </section>
        )}

        {/* AVAILABLE SUBSCRIPTION SBTs */}
        {!isLoading && subscriptionSBTs.length > 0 && (
          <section className="border-zinc-700 text-white rounded-3xl p-8 border shadow-lg space-y-4 transition-colors duration-300 text-left">
            <h2 className="text-lg font-semibold mb-2">Available Subscription Deals</h2>
            <div className={styles.gridMd3Gap4}>
              {subscriptionSBTs.map((sbt) => (
                <SBTCard key={sbt.typeId} sbt={sbt} loadingTypeId={loadingTypeId} policyAccepted={policyAccepted} setPolicyAccepted={setPolicyAccepted} onClaim={handleClaim} onPreview={() => setPreviewSBT(sbt)} />
              ))}
            </div>
          </section>
        )}

        {previewSBT && (
          <div className={styles.previewModalBg}>
            <div className={styles.previewModalContentDark}>
              <button onClick={() => setPreviewSBT(null)} className={styles.previewCloseButton}>
                ×
              </button>
              <h3 className="text-xl font-semibold mb-2">{previewSBT.name}</h3>
              <img src={previewSBT.image} alt={previewSBT.name} className="w-full h-48 object-cover rounded mb-2" />
              <p className="mb-2">{previewSBT.description}</p>
              <div className={styles.flexWrapGap2}>
                {previewSBT.tags.map((tag, idx) => (
                  <span key={idx} className={styles.tagBadge}>
                    {tag}
                  </span>
                ))}
              </div>
              {previewSBT.metadata?.attributes?.length > 0 && (
                <div className="mt-4 text-sm space-y-1">
                  <h4 className="font-semibold">Metadata Attributes</h4>
                  {previewSBT.metadata.attributes.map((attr, idx) => (
                    <p key={idx}>
                      <span className="text-gray-400">{attr.trait_type}:</span> {attr.value}
                    </p>
                  ))}
                </div>
              )}
              {previewSBT.metadata?.external_url && (
                <p className="mt-3 text-sm">
                  <a
                    href={previewSBT.metadata.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-blue-400"
                  >
                    View External Page
                  </a>
                </p>
              )}
              <p className={styles.textGray400}>
                Type ID: {previewSBT.typeId}
                {previewSBT.tokenId !== undefined && ` · Token ID: ${previewSBT.tokenId}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SBTCard({ sbt, loadingTypeId, policyAccepted, setPolicyAccepted, onClaim, onPreview }) {
  return (
    <div className={styles.sbtCard}>
      <img src={sbt.image} alt={sbt.name} className={styles.sbtImage} />
      <h3 className="text-lg font-semibold">{sbt.name}</h3>
      <p className="text-sm">{shortenText(sbt.description)}</p>
      <div className={styles.flexWrapGap2}>
        {sbt.tags.map((tag, idx) => (
          <span key={idx} className={styles.tagBadge}>
            {tag}
          </span>
        ))}
      </div>
      <p className={styles.textGray400}>
        Tokens left: {sbt.tokensLeft} · Type ID: {sbt.typeId}
      </p>

      {/* Policy acceptance checkbox */}
      <div className="flex items-center mt-2">
        <input
          type="checkbox"
          id={`policyAccept_${sbt.typeId}`}
          checked={policyAccepted[sbt.typeId] || false}
          onChange={(e) =>
            setPolicyAccepted((prev) => ({ ...prev, [sbt.typeId]: e.target.checked }))
          }
          className="mr-2"
        />
        <label htmlFor={`policyAccept_${sbt.typeId}`} className="text-xs select-none cursor-pointer">
          I accept the <a href="/policy" target="_blank" rel="noopener noreferrer" className="underline">policy</a>
        </label>
      </div>

      <button
        onClick={() => onClaim(sbt.typeId)}
        disabled={loadingTypeId === sbt.typeId || !policyAccepted[sbt.typeId]}
        className={`${styles.btnPrimary} mt-3 w-full`}
      >
        {loadingTypeId === sbt.typeId ? 'Claiming...' : 'Claim'}
      </button>
      <button onClick={onPreview} className={`${styles.btnSecondary} mt-2 w-full`}>
        Preview
      </button>
    </div>
  )
}

