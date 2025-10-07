'use client'
import { useState, useEffect } from 'react'

// Dynamically import all locales
const translations = {}
const localeModules = import.meta.glob('../locales/*.json', { eager: true })
for (const path in localeModules) {
  const lang = path.match(/\/([a-z]+)\.json$/i)?.[1]
  if (lang) translations[lang] = localeModules[path].default
}

export default function useTranslation() {
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const stored = localStorage.getItem('language')
    if (stored && translations[stored]) {
      setLang(stored)
    }
  }, [])

  function changeLang(newLang) {
    if (translations[newLang]) {
      localStorage.setItem('language', newLang)
      setLang(newLang)
    }
  }

  function t(key) {
    return translations[lang]?.[key] || key
  }

  return { t, lang, changeLang }
}

