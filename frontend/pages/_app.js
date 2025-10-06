//_app.js
import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'

import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import useAutoTranslator from '../hooks/useAutoTranslator'

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

  // Detect language from URL and update lang state
  useEffect(() => {
    const pathLang = router.asPath.split('/')[1]
    if (['da', 'de', 'fr'].includes(pathLang)) setLang(pathLang)
    else setLang('en')
  }, [router.asPath])

  // Trigger auto translation whenever `lang` changes
  useAutoTranslator(lang)

  // Handle language switch
  const handleLangChange = (newLang) => {
    setLang(newLang)
    const pathParts = router.asPath.split('/')
    // Replace language in URL if it exists, else add it
    if (['da', 'de', 'fr'].includes(pathParts[1])) pathParts[1] = newLang
    else pathParts.unshift('', newLang) // add newLang as prefix
    router.push(pathParts.join('/'))
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider>
          <LangContext.Provider value={{ lang, setLang }}>
            {/* Language Selector */}
            <div className="fixed top-3 right-3 z-50 bg-zinc-900 text-white border border-zinc-700 rounded-md px-2 py-1">
              <select
                value={lang}
                onChange={(e) => handleLangChange(e.target.value)}
                className="bg-zinc-900 border-none outline-none text-sm"
              >
                <option value="en">🇬🇧 EN</option>
                <option value="da">🇩🇰 DA</option>
                <option value="de">🇩🇪 DE</option>
                <option value="fr">🇫🇷 FR</option>
              </select>
            </div>

            {/* Main content */}
            <Component {...pageProps} />
            <Toaster position="top-right" />
          </LangContext.Provider>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  )
}

