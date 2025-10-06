// components/LanguageSelector.js
'use client'

import { useRouter } from 'next/router'
import Image from 'next/image'

export default function LanguageSelector() {
  const router = useRouter()

  const changeLanguage = (locale) => {
    const { pathname, query, asPath } = router
    router.push({ pathname, query }, asPath, { locale }) // ✅ correct
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => changeLanguage('en')}>
        <Image src="/flags/en.png" width={24} height={16} alt="English" />
      </button>
      <button onClick={() => changeLanguage('da')}>
        <Image src="/flags/da.png" width={24} height={16} alt="Danish" />
      </button>
      <button onClick={() => changeLanguage('de')}>
        <Image src="/flags/de.png" width={24} height={16} alt="German" />
      </button>
      <button onClick={() => changeLanguage('zh')}>
        <Image src="/flags/zh.png" width={24} height={16} alt="Chinese" />
      </button>
    </div>
  )
}

