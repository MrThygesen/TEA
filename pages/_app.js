// frontend/pages/_app.js
import '../styles/globals.css'
import { WagmiConfig, createConfig } from 'wagmi'
import { http } from 'wagmi'
import { polygonAmoy } from '../chains/polygonAmoy'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

// 1. Define chains
const chains = [polygonAmoy]




// 2. Get wallet connectors
const { connectors } = getDefaultWallets({
  appName: 'TEA Project',
  projectId: 'your_project_id_here',  // 👈 replace with real projectId
  chains,
})

// 3. Set up wagmi config with `http()` from viem
const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient: http(),  // use viem client
})

export default function App({ Component, pageProps }) {
  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={chains}>
        <Component {...pageProps} />
      </RainbowKitProvider>
    </WagmiConfig>
  )
}

