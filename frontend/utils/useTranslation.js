'use client'
import { useState, useEffect } from 'react'
import en from '../locales/en.json'
import da from '../locales/da.json'
import fr from '../locales/fr.json'

// ✅ Static imports = Webpack friendly
const translations = { en, da, fr }

export default function useTranslation() {
  const [lang, setLang] = useState('en')

  // Load saved language from localStorage (client-side only)
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

