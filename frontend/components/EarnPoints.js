'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'

// TODO: replace with your deployed addresses
const PURCHASE_TRACKER_ADDRESS = '0xYourPurchaseTracker'
const POINTS_TOKEN_ADDRESS     = '0xYourPointsToken'

// --- Minimal ABIs ---------------------------------------------------------
const purchaseTrackerAbi = [
  {
    name: 'recordPurchase',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amountSpent', type: 'uint256' }],
    outputs: [],
  },
]

const pointsTokenAbi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
]

export default function EarnPoints() {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')

  // Read points balance
  const { data: balance } = useReadContract({
    abi: pointsTokenAbi,
    address: POINTS_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: [address ?? '0x0'],
    query: { enabled: Boolean(address) },
  })

  // Write – record purchase
  const { writeContractAsync, isPending } = useWriteContract()

  const handleEarn = async () => {
    try {
      const hash = await writeContractAsync({
        abi: purchaseTrackerAbi,
        address: PURCHASE_TRACKER_ADDRESS,
        functionName: 'recordPurchase',
        args: [parseEther(amount || '0')],
      })
      toast.success('Tx submitted: ' + hash)
      setAmount('')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Transaction failed')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded-xl space-y-4">
      <h2 className="text-xl font-semibold">Earn TEA Points</h2>

      <label className="block">
        <span className="text-sm">Purchase amount (in MATIC / USDC)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="25.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full p-2 border rounded mt-1"
        />
      </label>

      <button
        onClick={handleEarn}
        disabled={isPending || !amount}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded disabled:opacity-40"
      >
        {isPending ? 'Confirm in wallet…' : 'Record Purchase & Mint Points'}
      </button>

      <p className="text-sm text-gray-600">
        Your balance:{' '}
        {balance ? `${Number(formatEther(balance)).toLocaleString()} pts` : '—'}
      </p>
    </div>
  )
}

