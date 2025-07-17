// Enhanced Admin SBT Manager UI
'use client'

import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import WebAccessSBTV5_ABI from '../abis/WebAccessSBTV5_ABI.json'
import { toast } from 'react-hot-toast'

const CONTRACT_ADDRESS = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

const predefinedTypes = [
  { id: 1n, label: '1 – Coffee Vouchers', uri: 'https://example.com/metadata/1.json' },
  { id: 2n, label: '2 – Restaurants Clubs', uri: 'https://example.com/metadata/2.json' },
  { id: 3n, label: '3 – Free Individual Pass', uri: 'https://example.com/metadata/3.json' },
  { id: 4n, label: '4 – Business Meetings NDA', uri: 'https://example.com/metadata/4.json' },
]

export default function AdminSBTManager () {
  const { address } = useAccount()
  const [typeId, setTypeId] = useState(predefinedTypes[0].id)
  const [uri, setUri] = useState(predefinedTypes[0].uri)
  const [burnable, setBurnable] = useState(false)
  const [maxSupply, setMaxSupply] = useState(100)
  const [useWhitelist, setUseWhitelist] = useState(false)
  const [organizer, setOrganizer] = useState('')
  const [airdropAddress, setAirdropAddress] = useState('')
  const [whitelistAddress, setWhitelistAddress] = useState('')

  const isAdmin = address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()
  const { writeContract } = useWriteContract()

  const exec = (fn, args, msg) => writeContract({
    address: CONTRACT_ADDRESS,
    abi: WebAccessSBTV5_ABI.abi,
    functionName: fn,
    args,
    onSuccess: () => toast.success(`✅ ${msg}`),
    onError: (err) => toast.error(err.message),
  })

  if (!isAdmin) {
    return <div className="p-4 text-center text-red-600 font-semibold">Admin access required</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white border rounded-xl space-y-6">
      <h2 className="text-2xl font-bold">🔧 Admin: SBT Type Manager</h2>

      <select value={typeId.toString()} onChange={e => {
        const t = predefinedTypes.find(t => t.id.toString() === e.target.value)
        if (t) {
          setTypeId(t.id)
          setUri(t.uri)
        }
      }} className="w-full p-2 border rounded">
        {predefinedTypes.map(t => (
          <option key={t.id.toString()} value={t.id.toString()}>{t.label}</option>
        ))}
      </select>

      <input type="text" value={uri} onChange={e => setUri(e.target.value)} className="w-full p-2 border rounded" placeholder="Metadata URI" />

      <div className="flex items-center space-x-4">
        <label><input type="checkbox" checked={burnable} onChange={e => setBurnable(e.target.checked)} className="mr-2" />Burnable</label>
        <label><input type="checkbox" checked={useWhitelist} onChange={e => setUseWhitelist(e.target.checked)} className="mr-2" />Whitelist</label>
      </div>

      <input type="number" min={1} value={maxSupply} onChange={e => setMaxSupply(parseInt(e.target.value))} className="w-full p-2 border rounded" placeholder="Max Supply" />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => exec('createSBTType', [typeId, uri, burnable, BigInt(maxSupply), useWhitelist], 'Created Type')} className="bg-blue-600 text-white px-4 py-2 rounded">Create</button>
        <button onClick={() => exec('setActive', [typeId, true], 'Activated')} className="bg-green-600 text-white px-4 py-2 rounded">Activate</button>
        <button onClick={() => exec('setActive', [typeId, false], 'Deactivated')} className="bg-yellow-600 text-white px-4 py-2 rounded">Deactivate</button>
      </div>

      <h3 className="text-lg font-bold mt-4">👤 Organizer Management</h3>
      <input type="text" value={organizer} onChange={e => setOrganizer(e.target.value)} className="w-full p-2 border rounded" placeholder="0x... Organizer" />
      <button onClick={() => exec('setOrganizer', [typeId, organizer], 'Organizer Set')} className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded">Set Organizer</button>

      <h3 className="text-lg font-bold mt-4">✉️ Whitelist Management</h3>
      <input type="text" value={whitelistAddress} onChange={e => setWhitelistAddress(e.target.value)} className="w-full p-2 border rounded" placeholder="0x... whitelist address" />
      <button onClick={() => exec('addToWhitelist', [typeId, [whitelistAddress]], 'Added to Whitelist')} className="mt-2 bg-purple-600 text-white px-4 py-2 rounded">Add to Whitelist</button>

      <h3 className="text-lg font-bold mt-4">📤 Airdrop</h3>
      <input type="text" value={airdropAddress} onChange={e => setAirdropAddress(e.target.value)} className="w-full p-2 border rounded" placeholder="0x... recipient address" />
      <button onClick={() => exec('airdropTo', [typeId, [airdropAddress]], 'Airdropped')} className="mt-2 bg-teal-600 text-white px-4 py-2 rounded">Airdrop</button>
    </div>
  )
}

