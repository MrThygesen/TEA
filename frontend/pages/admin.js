// pages/admin.js
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'

export default function AdminPage() {
  const { address, isConnected } = useAccount()
  const [adminAddr, setAdminAddr] = useState(null)

  useEffect(() => {
    setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null)
  }, [])

  const isAdmin = !!(
    isConnected &&
    address &&
    adminAddr &&
    address.toLowerCase() === adminAddr
  )

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <h1 className="text-3xl font-bold text-blue-400">Admin Dashboard</h1>

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-gray-400">Please connect your wallet to continue.</p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : isAdmin ? (
          <div className="mt-6">
            <p className="mb-4 text-green-400">
              ✅ Connected as admin ({address})
            </p>
            <AdminSBTManager darkMode={true} />
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-red-400">❌ Access denied</p>
            <p className="text-gray-400 text-sm mt-2">
              Connected wallet is not the admin address.
            </p>
            <div className="mt-4 flex justify-center">
              <ConnectButton />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

