// WebAccessSBT.js
'use client'

import { useState } from 'react'
import {
  useAccount,
  useChainId,
  useSimulateContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi'
import { polygon } from 'wagmi/chains'
import { toast } from 'react-hot-toast'
import { WebAccessSBTV3_ABI } from '../abis/WebAccessSBTV3_ABI'

const CONTRACT = '0x576c2c7544c180De7EBCa37d25c6c08Db543bBBF'

const options = [
  { id: 1n, label: '1 – Coffee Voucher (Berlin)', desc: 'Redeem this SBT at a participating Berlin café for a free drink.' },
  { id: 2n, label: '2 – Restaurant Club (Copenhagen)', desc: 'Join our partner restaurant club and receive exclusive member deals.' },
  { id: 3n, label: '3 – Free Meeting Pass', desc: 'Access a shared meeting space once with this one-time SBT.' },
  { id: 4n, label: '4 – Business Meeting w/ NDA', desc: 'This token represents agreement to a confidential business meeting NDA.' },
]

export default function WebAccessSBT() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const [typeId, setTypeId] = useState(1n)
  const [hash, setHash] = useState(null)

  const currentOption = options.find(o => o.id === typeId)

  const { data: sim, error: simError, status: simStatus } = useSimulateContract({
    address: CONTRACT,
    abi: WebAccessSBTV3_ABI,
    functionName: 'claim',
    args: [typeId],
    account: address,
    query: { enabled: isConnected },
  })

  const { writeContractAsync, isPending: isSending } = useWriteContract({ mode: 'prepared' })
  const { isLoading: isMining, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const { data: tokenIds } = useReadContracts({
    contracts: Array.from({ length: 10 }).map((_, i) => ({
      address: CONTRACT,
      abi: WebAccessSBTV3_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, i],
    })),
    allowFailure: true,
  })

  async function handleClaim() {
    try {
      if (!isConnected) return toast.error('Connect wallet first')
      if (chainId !== polygon.id) return toast.error('Switch to Polygon Mainnet')
      if (simError) return toast.error(simError.shortMessage || simError.message)
      if (!sim?.request) return toast.error('Simulation still pending…')

      const txHash = await writeContractAsync(sim.request)
      toast.success('Transaction sent – waiting for confirmation…')
      setHash(txHash)
    } catch (err) {
      toast.error(err?.message ?? 'Transaction failed')
      console.error(err)
    }
  }

  async function burnToken(tokenId) {
    try {
      await writeContractAsync({
        address: CONTRACT,
        abi: WebAccessSBTV3_ABI,
        functionName: 'burn',
        args: [tokenId],
      })
      toast.success(`Token #${tokenId} burned.`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const isDisabled = isSending || isMining || !!simError || simStatus === 'pending'

  return (
    <section className="w-full max-w-xl mx-auto mt-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200 space-y-8">
        <div>
          <h2 className="text-3xl font-extrabold text-blue-900 mb-2">🎉 Join the Network</h2>
          <p className="text-gray-700 text-sm">
            Claim your Soulbound Token (SBT) to unlock perks — from loyalty rewards to verified meeting access.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="typeId" className="block text-sm font-semibold text-gray-900 mb-1">
              Choose a token type:
            </label>
            <select
              id="typeId"
              className="w-full rounded-md border p-2"
              value={typeId.toString()}
              onChange={(e) => setTypeId(BigInt(e.target.value))}
            >
              {options.map(o => (
                <option key={o.id} value={o.id.toString()}>{o.label}</option>
              ))}
            </select>
            {currentOption?.desc && (
              <p className="text-xs text-gray-600 italic mt-1">{currentOption.desc}</p>
            )}
          </div>

          {simError && (
            <div className="bg-red-100 border border-red-300 p-3 text-sm text-red-800">
              ⚠️ {simError.shortMessage || simError.message}
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={isDisabled}
            className={`w-full rounded-xl py-3 font-semibold text-white transition ${
              isConfirmed ? 'bg-green-600' : (isSending || isMining) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            { isConfirmed ? '✅ Claimed' : isMining ? 'Confirming…' : isSending ? 'Sending…' : simStatus === 'pending' ? 'Simulating…' : 'Claim SBT'}
          </button>

          {hash && !isConfirmed && (
            <p className="text-xs text-center text-gray-500 break-words">Tx Hash: {hash}</p>
          )}

          {isConfirmed && (
            <p className="text-center text-green-700 text-sm mt-1 font-semibold">
              🎉 Success! Token minted to your wallet.
            </p>
          )}
        </div>

        {tokenIds?.map((res, i) => (
          res?.result && (
            <div key={i} className="border p-2 mt-3 rounded-md">
              <p className="text-sm text-gray-700">You own Token #{res.result.toString()}</p>
              <button
                onClick={() => burnToken(res.result.toString())}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded mt-1"
              >
                🔥 Burn
              </button>
            </div>
          )
        ))}

        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-inner">
          <h3 className="text-base font-semibold text-blue-800 mb-2">ℹ️ About This System</h3>
          <p className="text-sm text-gray-700">
            The TEA Project enables loyalty networks and social membership clubs using on-chain proof of access.
            SBTs represent vouchers, discounts, or meeting agreements.
            Wallet-based and compatible with real-world businesses using QR codes or point-of-sale integrations.
          </p>
        </div>
      </div>
    </section>
  )
}

