// components/WebAccessSBT.js
'use client'

import { useState } from 'react'
import {
  useAccount,
  useChainId,
  useSimulateContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { toast } from 'react-hot-toast'
import { WebAccessSBTV3_ABI } from '../abis/WebAccessSBTV3_ABI'

const CONTRACT = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

const options = [
  { id: 1n, label: '1 – Coffee Voucher (Berlin)' },
  { id: 2n, label: '2 – Restaurant Club (Copenhagen)' },
  { id: 3n, label: '3 – Free Meeting Pass' },
  { id: 4n, label: '4 – Business Meeting w/ NDA' },
]

export default function WebAccessSBT () {
  /* ─ React state ─────────────────────────────────────────────────────── */
  const { address, isConnected } = useAccount()
  const chainId                  = useChainId()
  const [typeId, setTypeId]      = useState(1n)
  const [hash,   setHash]        = useState(null)

  /* ─ Dry‑run (simulation) ────────────────────────────────────────────── */
  const {
    data:   sim,          // sim?.request is the prepared tx
    error:  simError,
    status: simStatus,
  } = useSimulateContract({
    address: CONTRACT,
    abi:     WebAccessSBTV3_ABI,
    functionName: 'claim',
    args:    [typeId],
    account: address,
    query:   { enabled: isConnected },   // only run when wallet connected
  })

  /* ─ Write contract (prepared mode) ──────────────────────────────────── */
  const { writeContractAsync, isPending: isSending } =
    useWriteContract({ mode: 'prepared' })

  const { isLoading: isMining, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash })

  /* ─ Handler ─────────────────────────────────────────────────────────── */
  async function handleClaim () {
    try {
      if (!isConnected) return toast.error('Connect wallet first')
      if (chainId !== polygonAmoy.id)
        return toast.error('Switch to Polygon Amoy testnet')
      if (simError)
        return toast.error(simError.shortMessage || simError.message)
      if (!sim?.request)
        return toast.error('Simulation still pending…')

      const txHash = await writeContractAsync(sim.request) // ✅ only request
      toast.success('Transaction sent – waiting for confirmation…')
      setHash(txHash)

    } catch (err) {
      toast.error(err?.message ?? 'Transaction failed')
      console.error(err)
    }
  }

  /* ─ UI ──────────────────────────────────────────────────────────────── */
  const isDisabled = isSending || isMining || !!simError || simStatus === 'pending'

  return (
    <div className="mx-auto mt-8 max-w-md space-y-4 rounded-2xl border p-6 shadow">
      <h2 className="text-xl font-bold">Claim your SBT</h2>

      <select
        className="w-full rounded border p-2"
        value={typeId.toString()}
        onChange={(e) => setTypeId(BigInt(e.target.value))}
      >
        {options.map(o =>
          <option key={o.id} value={o.id.toString()}>{o.label}</option>
        )}
      </select>

      {simError &&
        <p className="rounded bg-red-50 p-2 text-red-700">
          {simError.shortMessage || simError.message}
        </p>}

      <button
        onClick={handleClaim}
        disabled={isDisabled}
        className={`w-full rounded py-2 font-semibold text-white
          ${isConfirmed ? 'bg-green-600'
          : (isSending || isMining) ? 'bg-gray-400'
          : 'bg-purple-600 hover:bg-purple-700'}`}
      >
        { isConfirmed ? '✅ Claimed'
          : isMining  ? 'Confirming…'
          : isSending ? 'Sending…'
          : simStatus === 'pending' ? 'Simulating…'
          : 'Claim SBT'}
      </button>

      {hash && !isConfirmed &&
        <p className="break-all text-center text-xs text-gray-500">Tx: {hash}</p>}
    </div>
  )
}

