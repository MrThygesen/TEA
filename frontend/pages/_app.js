import '../styles/globals.css'
import '@rainbow-me/rainbowkit/styles.css'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { Toaster } from 'react-hot-toast'
import { WagmiConfig } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '../utils/wagmi.config'

// 🏳️‍🌈 Flag selector component
function LanguageSelector() {
  const router = useRouter()

  const flags = {
    en: '🇬🇧',
    da: '🇩🇰',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
    zh: '🇨🇳',
  }

  const changeLanguage = (locale) => {
    const { pathname, query, asPath } = router
    router.push({ pathname, query }, asPath, { locale }) // ✅ correct, no stacking
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex gap-1 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1">
      {Object.entries(flags).map(([code, flag]) => (
        <button
          key={code}
          onClick={() => changeLanguage(code)}
          className={`text-sm ${
            router.locale === code ? 'opacity-100' : 'opacity-60'
          } hover:opacity-100`}
          title={code.toUpperCase()}
          translate="no"
        >
          {flag}
        </button>
      ))}
    </div>
  )
}

const queryClient = new QueryClient()

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // 🌍 Auto-detect browser language on first visit
  useEffect(() => {
    if (router.locale === 'en') {
      const userLang = navigator.language?.split('-')[0]
      const supported = ['da', 'de', 'fr', 'es', 'zh']
      if (supported.includes(userLang)) {
        router.replace(router.asPath, router.asPath, { locale: userLang })
      }
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <RainbowKitProvider>
          <LanguageSelector />
          <Component {...pageProps} />
          <Toaster position="top-right" />
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  )
}

