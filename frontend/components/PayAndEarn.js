'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from 'wagmi'
import { parseEther, formatEther } from 'viem'

// ========= Replace with deployed addresses =========
const TEA_TOKEN_ADDRESS          = '0xYourTEAToken'
const PAYMENT_WITH_POINTS_ADDRESS = '0xYourPaymentWithPoints'
// ===================================================

// --- Minimal ABIs ----------------------------------
const teaAbi = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
]

const paymentAbi = [
  { name: 'payAndEarn', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'restaurant', type: 'address' },
      { name: 'amount',     type: 'uint256' },
    ],
    outputs: [] },
]
// ----------------------------------------------------

export default function PayAndEarn() {
  const { address } = useAccount()
  const [restaurant, setRestaurant] = useState('')
  const [amount, setAmount]         = useState('')

  /* ----  reads  ---- */
  const { data: balance } = useReadContract({
    abi: teaAbi,
    address: TEA_TOKEN_ADDRESS,
    functionName: 'balanceOf',
    args: [address ?? '0x0'],
    query: { enabled: Boolean(address) },
  })

  const { data: allowance } = useReadContract({
    abi: teaAbi,
    address: TEA_TOKEN_ADDRESS,
    functionName: 'allowance',
    args: [address ?? '0x0', PAYMENT_WITH_POINTS_ADDRESS],
    query: { enabled: Boolean(address) },
  })

  /* ----  writes  ---- */
  const { writeContractAsync, isPending } = useWriteContract()

  const needApproval =
    allowance !== undefined &&
    parseEther(amount || '0') > allowance

  const handleClick = async () => {
    try {
      const wei = parseEther(amount || '0')

      if (needApproval) {
        await writeContractAsync({
          abi: teaAbi,
          address: TEA_TOKEN_ADDRESS,
          functionName: 'approve',
          args: [PAYMENT_WITH_POINTS_ADDRESS, wei],
        })
        toast.success('Allowance set – now sign payment')
      }

      const hash = await writeContractAsync({
        abi: paymentAbi,
        address: PAYMENT_WITH_POINTS_ADDRESS,
        functionName: 'payAndEarn',
        args: [restaurant, wei],
      })
      toast.success('Payment tx: ' + hash)
      setAmount('')
      setRestaurant('')
    } catch (err) {
      toast.error(err.message || 'Transaction failed')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 border rounded-xl space-y-4">
      <h2 className="text-xl font-semibold">Pay &amp; Earn Points</h2>

      <label className="block text-sm">
        Restaurant wallet
        <input
          type="text"
          placeholder="0x..."
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          className="w-full p-2 border rounded mt-1"
        />
      </label>

      <label className="block text-sm">
        Amount (TEA)
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="12.50"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-2 border rounded mt-1"
        />
      </label>

      <button
        onClick={handleClick}
        disabled={isPending || !restaurant || !amount}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded disabled:opacity-40"
      >
        {needApproval
          ? isPending ? 'Confirm allowance…' : 'Approve & Pay'
          : isPending ? 'Confirm payment…' : 'Pay & Earn'}
      </button>

      <p className="text-sm text-gray-600">
        Your TEA balance:{' '}
        {balance ? `${Number(formatEther(balance)).toFixed(2)} TEA` : '—'}
      </p>
    </div>
  )
}

