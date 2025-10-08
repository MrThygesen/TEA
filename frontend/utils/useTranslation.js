'use client'
import { useState, useEffect } from 'react'
import en from '../locales/en.json'
import da from '../locales/da.json'
import fr from '../locales/fr.json'
import hi from '../locales/fr.json'
import ar from '../locales/fr.json'
import ru from '../locales/fr.json'
import pt from '../locales/fr.json'
import es from '../locales/fr.json'
import zh from '../locales/fr.json'

// Static imports = Webpack friendly
const translations = { en, da, fr, hi, ar, ru, pt, es, zh}

export default function useTranslation() {
  const [lang, setLang] = useState('en')

  // Load saved language from localStorage (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('language')
    if (stored && translations[stored]) {
      setLang(stored)
    }
  }, [])

  // Change language and persist
  function changeLang(newLang) {
    if (translations[newLang]) {
      localStorage.setItem('language', newLang)
      setLang(newLang)
    }
  }

  // Translate function
  function t(key) {
    return translations[lang]?.[key] || key
  }

  return { t, lang, changeLang }
}

