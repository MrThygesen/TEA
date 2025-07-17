// frontend/pages/_app.js
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'

import { WagmiConfig, createConfig, http } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { RainbowKitProvider, getDefaultWallets } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import NoSSR from '../components/NoSSR'

/** Define supported chains */
const chains = [polygonAmoy]

/** Setup RainbowKit wallet connectors */
const { connectors } = getDefaultWallets({
  appName: 'TEA Project',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains,
})

/** Setup wagmi config */
const config = createConfig({
  connectors,
  chains,
  transports: {
    [polygonAmoy.id]: http(),
  },
  ssr: false,
})

/** React Query client */
const queryClient = new QueryClient()

/** App root */
export default function App({ Component, pageProps }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <NoSSR>
          <RainbowKitProvider chains={chains}>
            <Component {...pageProps} />
          </RainbowKitProvider>
        </NoSSR>
      </QueryClientProvider>
    </WagmiConfig>
  )
}

