import '../styles/globals.css'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

function MyApp({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    console.log('Current locale:', router.locale)
  }, [router.locale])

  return <Component {...pageProps} />
}

export default MyApp

