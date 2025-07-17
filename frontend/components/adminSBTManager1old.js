'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { WebAccessSBTV4_ABI } from '../abis/WebAccessSBTV4_ABI'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

const predefinedTypes = [
  {
    id: 1n,
    label: '1 – Coffee Vouchers',
    uri: 'https://example.com/metadata/1.json',
  },
  {
    id: 2n,
    label: '2 – Restaurants Clubs',
    uri: 'https://example.com/metadata/2.json',
  },
  {
    id: 3n,
    label: '3 – Free Individual Pass',
    uri: 'https://example.com/metadata/3.json',
  },
  {
    id: 4n,
    label: '4 – Business Meeetings NDA',
    uri: 'https://example.com/metadata/4.json',
  },
]

export default function AdminSBTManager() {
  const { address } = useAccount()
  const [typeId, setTypeId] = useState(predefinedTypes[0].id)
  const [uri, setUri] = useState(predefinedTypes[0].uri)
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState(100)
  const [useWhitelist, setUseWhitelist] = useState(false)
  const [organizer, setOrganizer] = useState('')

  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const { writeContract } = useWriteContract()

  const handleCreate = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV4_ABI,
      functionName: 'createSBTType',
      args: [typeId, uri, burnable, BigInt(maxSupply), useWhitelist],
      onSuccess: () => toast.success('✅ SBT Type Created'),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleActivate = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV4_ABI,
      functionName: 'setActive',
      args: [typeId, true],
      onSuccess: () => toast.success('✅ SBT Type Activated'),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleAddOrganizer = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV4_ABI,
      functionName: 'addOrganizer',
      args: [organizer],
      onSuccess: () => toast.success('✅ Organizer added'),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleRemoveOrganizer = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV4_ABI,
      functionName: 'removeOrganizer',
      args: [organizer],
      onSuccess: () => toast.success('✅ Organizer removed'),
      onError: (err) => toast.error(err.message),
    })
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-red-600 font-semibold p-4">
        You must be the admin to access this panel.
      </div>
    )
  }

  return (
    <div className="p-6 border rounded max-w-xl mx-auto bg-white text-black space-y-4">
      <h2 className="text-2xl font-bold mb-2">🔧 Admin: SBT Type Manager</h2>

      <div>
        <label className="block mb-1 font-semibold">SBT Category</label>
        <select
          value={typeId.toString()}
          onChange={(e) => {
            const selected = predefinedTypes.find(t => t.id.toString() === e.target.value)
            if (selected) {
              setTypeId(selected.id)
              setUri(selected.uri)
            }
          }}
          className="w-full mb-2 p-2 border rounded"
        >
          {predefinedTypes.map(({ id, label }) => (
            <option key={id.toString()} value={id.toString()}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1 font-semibold">Metadata URI</label>
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
        />
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={burnable}
            onChange={(e) => setBurnable(e.target.checked)}
            className="mr-2"
          />
          Burnable
        </label>

        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={useWhitelist}
            onChange={(e) => setUseWhitelist(e.target.checked)}
            className="mr-2"
          />
          Whitelist Enabled
        </label>
      </div>

      <div>
        <label className="block mb-1 font-semibold">Max Supply</label>
        <input
          type="number"
          min="1"
          value={maxSupply}
          onChange={(e) => setMaxSupply(parseInt(e.target.value))}
          className="w-full mb-2 p-2 border rounded"
        />
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          ➕ Create Type
        </button>

        <button
          onClick={handleActivate}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          ✅ Activate Type
        </button>
      </div>

      <hr className="my-4" />

      <h3 className="text-lg font-bold">📋 Organizer Roles</h3>

      <div>
        <input
          type="text"
          placeholder="0x... wallet address"
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
        />
        <div className="flex space-x-3">
          <button
            onClick={handleAddOrganizer}
            className="bg-indigo-600 text-white px-4 py-2 rounded"
          >
            ➕ Add Organizer
          </button>
          <button
            onClick={handleRemoveOrganizer}
            className="bg-red-600 text-white px-4 py-2 rounded"
          >
            ➖ Remove
          </button>
        </div>
      </div>
    </div>
  )
}

