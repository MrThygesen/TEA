// pages/_app.js
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'

import { WagmiConfig } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { config } from '../utils/wagmi.config'
import { useEffect, useState } from 'react'

const queryClient = new QueryClient()

export default function App({ Component, pageProps }) {
  const [darkMode, setDarkMode] = useState(false)

  // Apply the `dark` class to the <html> element
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider>
          {/* Optional: Toggle button */}
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              className="px-4 py-2 text-sm font-semibold rounded bg-gray-200 dark:bg-gray-700 dark:text-white shadow"
            >
              Toggle {darkMode ? 'Light' : 'Dark'} Mode
            </button>
          </div>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  )
}

