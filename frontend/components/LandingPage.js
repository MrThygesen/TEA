'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'

export default function Home() {
  const { isConnected, address } = useAccount()

  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">
        {/* Header / Connect Button */}
        <header className="bg-white shadow-lg rounded-3xl p-8 border border-gray-200 flex flex-col items-center space-y-4">
          <img
            src="/tea.png"
            alt="TEA Project Logo"
            className="w-24 h-24 object-contain"
          />
          <h1 className="text-4xl font-bold text-blue-800 text-center">
            TEA NETWORK (MVP)
          </h1>
          <ConnectButton />
          {isConnected && (
            <p className="text-sm text-gray-600 break-words text-center max-w-xs font-mono">
              Connected as: {address}
            </p>
          )}
        </header>

        {/* Intro Text Box */}
        <section className="bg-white rounded-3xl p-8 border border-gray-200 shadow-lg text-center space-y-4">
          <h2 className="text-3xl font-bold text-blue-800">
            Welcome to the TEA Project
          </h2>
          <p className="text-lg text-gray-700">
            We are a community-driven Layer 3 blockchain network designed to unlock real-life perks.
          </p>
          <p className="text-md text-gray-600">
            Use your wallet to claim Soulbound Tokens that help you connect with others for friendship, business, or dating — plus enjoy discounted drinks along the way.
          </p>
          <p className="text-sm text-gray-500 italic">
            Technically, we build this Web3 meeting space on the Polygon blockchain, and rely on Telegram to keep you updated with new meetup spots and exclusive perks.
          </p>
        </section>

        {/* Main Content */}
        <section>
          {isConnected ? (
            isAdmin ? (
              <AdminSBTManager />
            ) : (
              <WebAccessSBT />
            )
          ) : (
            <p className="text-center text-gray-500">
              Please connect your wallet to access your dashboard.
            </p>
          )}
        </section>

        {/* Project Roadmap Placeholder */}
        <section className="bg-white rounded-3xl p-8 border border-gray-200 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-center">Project Roadmap</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Q3 2025: Launch MVP on Polygon Amoy Testnet</li>
            <li>Q4 2025: Full mainnet deployment & audits</li>
            <li>Q1 2026: Onboard partners and community growth</li>
            <li>Q2 2026: Integrate payment & loyalty rewards</li>
            <li>Q3 2026: Mobile app & expanded social features</li>
          </ul>
        </section>

        {/* Footer with Links & Contact */}
        <footer className="bg-white rounded-3xl p-6 border border-gray-200 shadow-lg text-center text-gray-600 space-y-2">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">GitHub Repository</a></p>
          <p>Twitter: <a href="https://twitter.com/yourtwitterhandle" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">@TEAProject</a></p>
          <p>Intro Video: <a href="https://youtu.be/yourvideolink" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Watch on YouTube</a></p>
          <p>Contact: <a href="mailto:contact@teaproject.xyz" className="text-blue-600 hover:underline">contact@teaproject.xyz</a></p>
          <p className="text-xs mt-4">&copy; 2025 TEA Project Team</p>
        </footer>
      </div>
    </main>
  )
}

