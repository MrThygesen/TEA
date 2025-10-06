//hooks(useAutoTranslator


import { useEffect } from 'react'
import axios from 'axios'

export default function useAutoTranslator(lang) {
  useEffect(() => {
    if (!lang || lang === 'en') return // English = default

    async function translatePage() {
      const elems = document.querySelectorAll('[data-translate]')
      for (let el of elems) {
        if (el.dataset.noTranslate) continue // skip protected text
        const text = el.innerText
        try {
          const { data } = await axios.post('/api/translate', { text, targetLang: lang })
          el.innerText = data.translated
        } catch (e) {
          console.error('Translation failed for element:', el, e)
        }
      }
    }

    translatePage()
  }, [lang])
}

