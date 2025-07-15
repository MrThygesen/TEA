import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import WebAccessSBT from '../components/WebAccessSBT'
import AdminSBTManager from '../components/AdminSBTManager'

export default function Home() {
  const { isConnected, address } = useAccount()

  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  return (
    <main className="min-h-screen bg-gray-100 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="bg-white shadow-lg rounded-3xl p-8 border border-gray-200">
          <h1 className="text-3xl font-bold text-blue-800 mb-4 text-center">
            TEA Project Demo
          </h1>

          {/* Logo and Intro */}
          <div className="mb-6 space-y-4 text-center">
            <img
              src="/tea.png" // 🖼️ Place your logo in /public/tea.png
              alt="TEA Project Logo"
              className="w-20 h-20 mx-auto object-contain"
            />
            <p className="text-gray-700 text-sm leading-relaxed max-w-md mx-auto">
              Welcome to the TEA Project — a Web3 loyalty and access platform.
              Use your wallet to claim <strong>Soulbound Tokens</strong> for
              discounts, meeting passes, or membership validation.
            </p>
          </div>

          {/* Connect Button */}
          <div className="flex justify-center mb-6">
            <ConnectButton />
          </div>

          {/* Conditional content based on connection and admin */}
          {isConnected && (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 break-words text-center">
                Connected as: <span className="font-mono">{address}</span>
              </p>

              {isAdmin ? <AdminSBTManager /> : <WebAccessSBT />}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

