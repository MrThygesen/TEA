'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { WebAccessSBTV2_ABI } from '../abis/WebAccessSBTV2_ABI'
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

  const isAdmin =
    address?.toLowerCase() ===
    process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const { writeContract } = useWriteContract()

  const handleCreate = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV2_ABI,
      functionName: 'setTypeURI',
      args: [typeId, uri, burnable],
      onSuccess: () => toast.success('SBT Type Created'),
      onError: (err) => toast.error(err.message),
    })
  }

  const handleActivate = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: WebAccessSBTV2_ABI,
      functionName: 'setActive',
      args: [typeId, true],
      onSuccess: () => toast.success('SBT Type Activated'),
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
    <div className="p-4 border rounded max-w-md mx-auto bg-white text-black">
      <h2 className="text-xl font-bold mb-4">Admin: Create SBT Type</h2>

      <label className="block mb-2">Select SBT Category</label>
      <select
        value={typeId.toString()}
        onChange={(e) => {
          const selected = predefinedTypes.find(t => t.id.toString() === e.target.value)
          if (selected) {
            setTypeId(selected.id)
            setUri(selected.uri)
          }
        }}
        className="w-full mb-4 p-2 border rounded"
      >
        {predefinedTypes.map(({ id, label }) => (
          <option key={id.toString()} value={id.toString()}>
            {label}
          </option>
        ))}
      </select>

      <label className="block mb-2">Metadata URI</label>
      <input
        type="text"
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />

      <label className="block mb-2">
        <input
          type="checkbox"
          checked={burnable}
          onChange={(e) => setBurnable(e.target.checked)}
          className="mr-2"
        />
        Burnable
      </label>

      <button
        onClick={handleCreate}
        className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
      >
        Create Type
      </button>

      <button
        onClick={handleActivate}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Activate Type
      </button>
    </div>
  )
}

