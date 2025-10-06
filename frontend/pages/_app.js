import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Toaster } from 'react-hot-toast'
import { WagmiConfig } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '../utils/wagmi.config'

const queryClient = new QueryClient()

// --- Language Context ---
const LangContext = createContext()
export const useLang = () => useContext(LangContext)

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [lang, setLang] = useState('en')

  // Detect from URL or browser
  useEffect(() => {
    const pathLang = router.asPath.split('/')[1]
    const supported = ['da', 'de', 'fr', 'es', 'zh']
    if (supported.includes(pathLang)) {
      setLang(pathLang)
    } else {
      const browserLang = navigator.language?.slice(0, 2)
      if (supported.includes(browserLang)) setLang(browserLang)
      else setLang('en')
    }
  }, [router.asPath])

  // Handle manual language change
  const handleLangChange = (newLang) => {
    setLang(newLang)
    const parts = router.asPath.split('/')
    if (['da', 'de', 'fr', 'es', 'zh'].includes(parts[1])) parts[1] = newLang
    else parts.unshift('', newLang)
    router.push(parts.join('/'))
  }

  // Flags
  const flags = {
    en: '🇬🇧',
    da: '🇩🇰',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
    zh: '🇨🇳',
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider>
          <LangContext.Provider value={{ lang, setLang }}>
            {/* Flag Selector */}
            <div className="fixed top-3 right-3 z-50 flex gap-1 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1">
              {Object.entries(flags).map(([code, flag]) => (
                <button
                  key={code}
                  onClick={() => handleLangChange(code)}
                  className={`text-sm ${lang === code ? 'opacity-100' : 'opacity-60'} hover:opacity-100`}
                  title={code.toUpperCase()}
                  translate="no"
                >
                  {flag}
                </button>
              ))}
            </div>

            {/* Main Content */}
            <Component {...pageProps} />
            <Toaster position="top-right" />
          </LangContext.Provider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  )
}

