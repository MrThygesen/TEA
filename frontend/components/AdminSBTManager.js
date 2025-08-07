'use client'

import { useState } from 'react'
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi'
import WebAccessSBT from '../abis/WebAccessSBTV4.json'
import { parseEther } from 'viem'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

export default function AdminSBTManager() {
  const { address } = useAccount()

  const [typeId, setTypeId] = useState('')
  const [name, setName] = useState('')
  const [uri, setUri] = useState('')
  const [maxSupply, setMaxSupply] = useState('')
  const [price, setPrice] = useState('')
  const [datetime, setDatetime] = useState('')

  const {
    write: createSBTType,
    data: txData,
    isLoading,
  } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: WebAccessSBT,
    functionName: 'createType',
  })

  const { isSuccess } = useWaitForTransaction({
    hash: txData?.hash,
    onSuccess: async () => {
      alert('SBT type created successfully.')

      // Automatically store in database if typeId is valid
      if (parseInt(typeId) <= 4999) {
        await createEvent(typeId, name, datetime)
      }
    },
  })

  async function createEvent(typeId, name, datetime) {
    try {
      const res = await fetch('/api/events', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ typeId, name, datetime }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      console.log('Event stored in DB:', data)
    } catch (err) {
      console.error('Failed to store event in DB:', err)
      alert('Failed to store event in Render DB')
    }
  }

  function handleCreate() {
    if (!typeId || !name || !uri || !maxSupply || !price || !datetime) {
      alert('Please fill in all fields.')
      return
    }

    createSBTType({
      args: [
        BigInt(typeId),
        name,
        uri,
        BigInt(maxSupply),
        parseEther(price),
        true,
      ],
    })
  }

  return (
    <section className="p-6 border border-gray-700 bg-zinc-900 text-white rounded-2xl">
      <h2 className="text-xl font-bold mb-4">Create New SBT Type</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="number"
          placeholder="Type ID (max 4999 = public)"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
        <input
          type="text"
          placeholder="Metadata URI"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
        <input
          type="number"
          placeholder="Max Supply"
          value={maxSupply}
          onChange={(e) => setMaxSupply(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
        <input
          type="text"
          placeholder="Price in MATIC"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
        <input
          type="datetime-local"
          placeholder="Event Date/Time"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="p-2 rounded bg-zinc-800 border border-zinc-600"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
      >
        {isLoading ? 'Creating...' : 'Create SBT Type'}
      </button>

      {isSuccess && (
        <p className="mt-2 text-green-500">Transaction Confirmed!</p>
      )}
    </section>
  )
}

