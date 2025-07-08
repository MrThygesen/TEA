// frontend/pages/_app.js
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'

import { WagmiConfig } from 'wagmi'
import { http } from 'wagmi'
import {
  RainbowKitProvider,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { polygonAmoy } from '../chains/polygonAmoy'

// ---------- RainbowKit builds the wagmi config for us ----------
const wagmiConfig = getDefaultConfig({
  appName: 'TEA Demo',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [polygonAmoy],

  // optional: override the default transport for this chain
  transports: {
    [polygonAmoy.id]: http(
      `https://polygon-amoy.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    ),
  },

  ssr: true, // needed for Next .js
})

const queryClient = new QueryClient()

export default function MyApp({ Component, pageProps }) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={wagmiConfig.chains}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}

