import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

export default function Home() {
  const { isConnected, address } = useAccount()

  return (
    <main style={{ padding: 20 }}>
      <h1>TEA Project Demo</h1>
      <ConnectButton />
      {isConnected && <p>Connected wallet: {address}</p>}
    </main>
  )
}

