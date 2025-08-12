'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import AdminSBTManager from '../components/AdminSBTManager'
import WebAccessSBT from '../components/WebAccessSBT'
import { useState, useEffect } from 'react'

export default function Home() {
  const { isConnected, address } = useAccount()
  const isAdmin =
    address?.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN?.toLowerCase()

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState('')
  const [isLoadingEmail, setIsLoadingEmail] = useState(false)
  const [showAmoyInfo, setShowAmoyInfo] = useState(false)
  const [showFullRoadmap, setShowFullRoadmap] = useState(false)

  const [emailFormStatus, setEmailFormStatus] = useState(null) // 'loading', 'success', 'error'

  useEffect(() => {
    if (address) {
      fetch(`/api/email-optin?wallet=${address}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.email) setEmail(data.email)
        })
        .catch(() => {})
    } else {
      setEmail('')
      setEmailStatus('')
    }
  }, [address])

  const handleSaveEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch('/api/email-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wallet: address }),
      })
      setEmailStatus(res.ok ? 'Saved' : 'Error saving email')
    } catch (e) {
      setEmailStatus('Error saving email')
    }
    setIsLoadingEmail(false)
  }

  const handleDeleteEmail = async () => {
    setIsLoadingEmail(true)
    try {
      const res = await fetch(`/api/email-optin?wallet=${address}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEmail('')
        setEmailStatus('Deleted')
      }
    } catch (e) {
      setEmailStatus('Error deleting email')
    }
    setIsLoadingEmail(false)
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailFormStatus('loading')
    const formData = new FormData(e.target)

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          message: formData.get('message'),
        }),
      })

      if (res.ok) {
        setEmailFormStatus('success')
        e.target.reset()
      } else {
        setEmailFormStatus('error')
      }
    } catch {
      setEmailFormStatus('error')
    }
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4 transition-colors duration-300">
      <div className="w-full max-w-3xl space-y-10">
        {/* Header */}
        <header className="relative bg-zinc-900 border-zinc-700 shadow-lg rounded-3xl p-8 flex flex-col items-center space-y-4 border transition-colors duration-300 overflow-hidden">
          <div className="absolute inset-0 -z-10 opacity-10 animate-spin-slow pointer-events-none select-none">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="hexagonPattern"
                  x="0"
                  y="0"
                  width="10"
                  height="8.66"
                  patternUnits="userSpaceOnUse"
                >
                  <polygon
                    points="5,0 10,2.89 10,7.77 5,10.66 0,7.77 0,2.89"
                    fill="#ffffff"
                    fillOpacity="0.05"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hexagonPattern)" />
            </svg>
          </div>

          <img src="/tea.png" alt="TEA Project Logo" className="w-24 h-24 object-contain" />
<h1 className="text-4xl font-bold text-blue-400 text-left">WELCOME TO THE TEA NETWORK</h1> <p className="text-left text-gray-400 mb-6"> We’re the club for social / business meetings. The TEA Network operates in the cafe, bar and restaurant domain, where you get to meet new and old connections and enjoy a free welcome drink, coffee or dessert. Perks depends on our partners' interests. We are working with Polygon blockchain technology to expand your network and benefits.  </p> 

// <p> <a href="https://youtu.be/5QSHQ26JMm8" className="text-blue-400 hover:underline" target="_blank">Learn more about the TEA network (Video) </a></p>
    
 <div className="flex gap-3 items-center">
            <ConnectButton />
            {isConnected && (
              <button
                onClick={() => setShowEmailModal(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >

               📧 Email Notifications
              </button>
            )}
          </div>
          {isConnected && (
            <p className="text-sm break-words text-center max-w-xs font-mono">
              Connected as: {address}
            </p>
          )}
        </header>


        {/* SBT Access Section */}
        <section>
          {isConnected ? (
            isAdmin ? (
              <AdminSBTManager darkMode={true} />
            ) : (
              <WebAccessSBT darkMode={true} />
            )
          ) : ()}
        </section>

<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">
              We Onboard with Telegram for Web2 and Web3 users.
            </h2>
</section>

        {!isConnected && (
          <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">
              FREE Basic Access (No Wallet):
            </h2>
            <p className="text-center text-gray-400 mb-6">
              Register Event On Telegram to Get in!
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/dinner-circle-copenhagen.json',
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/night-owls-copenhagen.json',
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/wine-pass-copenhagen.json',
              ].map((url, index) => (
                <StaticSBTCard key={index} url={url} />
              ))}
            </div>

            {/* Telegram Register Button */}
            <div className="mt-8 flex justify-center">
              <a
                href="https://t.me/TeaIsHereBot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                <img src="/telegram-logo.png" alt="Telegram" className="w-5 h-5" />
                Telegram Basic Access 
              </a>
            </div>
          </section>
        )}

        {/* Pro Access Section */}

{!isConnected && (
          <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg transition-colors duration-300">
            <h2 className="text-2xl font-semibold mb-4 text-blue-400 text-center">
              FREE Advanced Access (Wallet Required):
            </h2>
            <p className="text-center text-gray-400 mb-6">
              Register Event on Telegram to get in!!!
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/dinner-circle-copenhagen.json',
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/night-owls-copenhagen.json',
                'https://raw.githubusercontent.com/MrThygesen/TEA/main/data/wine-pass-copenhagen.json',
              ].map((url, index) => (
                <StaticSBTCard key={index} url={url} />
              ))}
            </div>

            {/* Telegram Register Button */}
            <div className="mt-8 flex justify-center">
              <a
                href="https://t.me/TeaIsHereBotPro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition"
              >
                <img src="/telegram-logo.png" alt="Telegram" className="w-5 h-5" />
                Telegram Web3 Pro Access
              </a>
            </div>
          </section>
        )}         


 <div className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-6 border shadow-lg transition-colors duration-300">
            
  <h2 className="text-2xl font-bold mb-4 text-center text-blue-400">Advanced Wallet Access- Get Your Web3 Deal Done </h2>
<p className="text-center text-gray-300 mb-4">  

After your event registration and event is confirmed on Telegram, you would need to claim the deal (SBT). This is done here, and then the SBT is registered on the Polygon Amoy Blockchain. This is now your Digital Access Card to the real life extended perk / discount deal at the venue.
            </p>
            <div className="text-center">
              <button
                onClick={() => setShowAmoyInfo(prev => !prev)}
                className="text-blue-400 hover:underline text-sm"
              >
                {showAmoyInfo ? 'Hide Amoy Network Setup' : '📘 How to add Amoy to your wallet'}
              </button>

              {showAmoyInfo && (
                <div className="mt-4 text-sm text-left bg-zinc-800 border border-zinc-600 rounded-lg p-4 max-w-md mx-auto">
                  <p className="mb-2">To add the Amoy network to your wallet, start with Add Custom Network:</p>
                  <ul className="list-disc list-inside text-gray-300 space-y-1">
                    <li><strong>Network Name:</strong> Polygon Amoy Testnet</li>
                    <li><strong>New RPC URL:</strong> https://rpc-amoy.polygon.technology/</li>
                    <li><strong>Chain ID:</strong> 80002</li>
                    <li><strong>Currency Symbol:</strong> POL</li>
                    <li><strong>Block Explorer URL:</strong> https://amoy.polygonscan.com/</li>

<li><strong>Polygon Amoy Coins:</strong>, we can provide it for you, contact on linkedin</li>
                  </ul>
                </div>
              )}

              {/* Wallet Connect Button */}
              <div className="mt-6 flex justify-center">
                <ConnectButton />
              </div>
            </div>
          </div>

        {/* Intro Section */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg text-center space-y-4 transition-colors duration-300">
          <h2 className="text-3xl font-bold text-blue-400">TEA NETWORK (EXTENDED INFO):</h2>
                    <p className="text-center text-gray-300 mb-4">
 We are a community-driven network designed to unlock real-life perks and expand your network.</p>
          <p className="text-center text-gray-300 mb-4"> We are building a Web3 meeting space on the Polygon blockchain, designed to bridge Web2 accessibility with Web3 trust. We strongly believe in the telegram potential with automated bots and invitations. The onboarding process provided by the bot is designed according to the audience preference for web2 (no wallet), or Web3 (wallet). </p>

<p className="text-center text-gray-300 mb-4"> 
We like to support all ends of our network. You come alone or bring a few friends as part of the network, its all open. </p> 

<p className="text-center text-gray-300 mb-4"> 
We foresee a more accountable future with pro-booked meetings, pre-payments, deposits and network confirmed meetings with enhacned venue based user validations. This is the Web3 approach. But we are also open for people who actually dislike too much "surveillance" and can opt-in on more flexible terms with some level of benefits.
We are ready to find the best way for most people and partners.
</p> 

<p className="text-center text-gray-300 mb-4"> 
TEA NETWORK is here to help you connect friendships, business, dating— and enjoy a few discounted drinks along the way.</p>

        </section>

        {/* Roadmap Section */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg transition-colors duration-300">
          <h2 className="text-2xl font-semibold mb-4 text-center text-blue-400">Project Roadmap</h2>

          <ul className="list-disc list-inside space-y-2">
            <li>Q2 2025: Initial blockchain architecture planning and development for SBT.</li>
            <li>Q3 2025: Telegram registration & testnet launch</li>
            <li>Q4 2025: Mainnet deployment & audits</li>
            <li>Q1 2026: Partner onboarding & growth</li>
            <li>Q2 2026: Loyalty rewards integration</li>
            <li>Q3 2026: Mobile app + expanded features</li>
          </ul>

          <div className="text-center mt-4">
            <button
              onClick={() => setShowFullRoadmap(!showFullRoadmap)}
              className="text-blue-400 hover:underline text-sm"
            >
              {showFullRoadmap ? 'Hide Full Roadmap' : '📜 Show Full Roadmap'}
            </button>
          </div>

          {showFullRoadmap && (
            <div className="mt-6 text-sm space-y-4 text-gray-300">
              {[
                {
                  title: 'Q2 2025',
                  items: [
                    'Initial blockchain architecture planning for Soul Bound Token (SBT).',
                    'Develop smart contracts and JavaScript for SBT interactions.',
                    'Conduct internal audits and ensure coverage for blockchain code.',
                    'Prepare deployment scripts and testing environments.'
                  ]
                },
                {
                  title: 'Q3 2025',
                  items: [
                    'Design and develop the Telegram registration bot.',
                    'MVP development and SBT deployment on Polygon Amoy Testnet.',
                    'Gather user feedback and refine features.',
                    'Prepare for full mainnet deployment.'
                  ]
                },
                {
                  title: 'Q4 2025',
                  items: [
                    'Deploy core smart contracts on Polygon mainnet.',
                    'Conduct security audits & smart contract reviews.',
                    'Launch ERC-20 token, coordinate with exchanges.',
                    'Develop and execute partner onboarding strategy.'
                  ]
                },
                {
                  title: 'Q1 2026',
                  items: [
                    'Launch community growth initiatives (tutorials, AMA sessions, rewards).',
                    'Implement DAO or incentive mechanisms.',
                    'Run marketing and outreach campaigns.'
                  ]
                },
                {
                  title: 'Q2 2026',
                  items: [
                    'Integrate payment gateways and loyalty reward systems.',
                    'Develop and test mobile app versions.',
                    'Expand social features.',
                    'Finalize testing & QA, prepare for full rollout.'
                  ]
                }
              ].map(({ title, items }, idx) => (
                <div key={idx}>
                  <h3 className="text-blue-300 font-semibold">{title}</h3>
                  <ul className="list-disc list-inside ml-4">
                    {items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="bg-zinc-900 border-zinc-700 text-gray-400 rounded-3xl p-6 border shadow-lg text-center space-y-2 transition-colors duration-300">
          <p>Docs: <a href="https://github.com/MrThygesen/TEA" className="text-blue-400 hover:underline" target="_blank">GitHub Repository</a></p>
          <p>Twitter: <a href="https://twitter.com/yourtwitterhandle" className="text-blue-400 hover:underline" target="_blank">@TEAProject</a></p>
          <p>Intro Video: <a href="https://youtu.be/5QSHQ26JMm8" className="text-blue-400 hover:underline" target="_blank">Watch on YouTube</a></p>
          <p>Contact: <a href="linkedin.com/in/mortenthygesens" className="text-blue-400 hover:underline">Connect On Linkedin</a></p>
          <p className="text-xs mt-4">&copy; 2025 TEA Project Team</p>
        </footer>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="relative p-6 rounded-lg max-w-md w-full bg-gray-900 text-white">
            <button
              onClick={() => setShowEmailModal(false)}
              className="absolute top-2 right-3 text-2xl font-bold cursor-pointer"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-2">Email Notifications</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEmail}
                disabled={isLoadingEmail || !email}
                className="px-3 py-1 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {isLoadingEmail ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleDeleteEmail}
                disabled={isLoadingEmail}
                className="px-3 py-1 border rounded text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                Delete
              </button>
            </div>
            {emailStatus && <p className="mt-2 text-sm">{emailStatus}</p>}
          </div>
        </div>
      )}
    </main>
  )
}

function StaticSBTCard({ url }) {
  const [data, setData] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
  }, [url])

  if (!data) return null

  const tags = data.attributes?.find((a) =>
    a.trait_type?.toLowerCase().includes('tag')
  )?.value?.split(',') || []

  const filteredAttributes = data.attributes?.filter(
    (attr) =>
      attr.trait_type?.toLowerCase() !== 'typeid' &&
      attr.trait_type?.toLowerCase() !== 'tokenid'
  )

  return (
    <>
      <div className="border border-zinc-700 rounded-lg p-4 text-left bg-zinc-800 shadow">
        <img src={data.image} alt={data.name} className="w-full h-40 object-cover rounded mb-3" />
        <h3 className="text-lg font-semibold mb-1">{data.name}</h3>
        <p className="text-sm mb-2">{data.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {tags.map((tag, i) => (
            <span key={i} className="bg-blue-700 text-xs px-2 py-1 rounded">
              {tag.trim()}
            </span>
          ))}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-blue-400 hover:underline text-sm"
        >
          Preview Details
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{data.name}</h2>
            <img src={data.image} alt={data.name} className="w-full h-56 object-contain rounded mb-4" />
            <p className="mb-4">{data.description}</p>
            <ul className="list-disc list-inside space-y-1">
              {filteredAttributes.map(({ trait_type, value }, idx) => (
                <li key={idx}>
                  <strong>{trait_type}:</strong> {value}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

