// lib/autoTranslate.js
const TRANSLATION_CACHE_KEY = 'translationCache_v1'

function getCache() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(TRANSLATION_CACHE_KEY)) || {}
  } catch {
    return {}
  }
}

function saveCache(cache) {
  localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cache))
}

export async function translateText(text, targetLang) {
  if (!text?.trim() || targetLang === 'en') return text

  const cache = getCache()
  const key = `${targetLang}:${text}`
  if (cache[key]) return cache[key]

  try {
    const res = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: targetLang })
    })
    const data = await res.json()
    const translated = data.translatedText || text
    cache[key] = translated
    saveCache(cache)
    return translated
  } catch (err) {
    console.warn('Translation failed:', err)
    return text
  }
}

