import { useState, useEffect } from 'react'

export default function useTranslation() {
  const [lang, setLang] = useState('en')
  const [t, setT] = useState({})

  useEffect(() => {
    const stored = localStorage.getItem('language') || 'en'
    import(`/locales/${stored}.json`)
      .then((m) => setT(m))
      .catch(() => import('/locales/en.json').then((m) => setT(m)))
    setLang(stored)
  }, [])

  function changeLang(newLang) {
    localStorage.setItem('language', newLang)
    window.location.reload()
  }

  function translate(key) {
    return t[key] || key
  }

  return { t: translate, lang, changeLang }
}

