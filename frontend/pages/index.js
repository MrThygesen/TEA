// pages/index.js
'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { toast } from 'react-hot-toast'
import YourAccountModal from '../components/YourAccountModal'
import Image from 'next/image'
import EventPolicy from '../components/EventPolicy'
import useTranslation from '../utils/useTranslation'

// ---------------------------
// Helpers: Auth persistence
// ---------------------------
function loadAuth() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('edgy_auth_user')
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}
function saveAuth(user) {
  try { localStorage.setItem('edgy_auth_user', JSON.stringify(user)) } catch (_) {}
}
function clearAuth() {
  try { localStorage.removeItem('edgy_auth_user') } catch (_) {}
}

// ---------------------------
// Dynamic Event Card (updated)
// ---------------------------
export function DynamicEventCard({
  event,
  authUser,
  setShowAccountModal,
  refreshTrigger,
  setRefreshTrigger,
}) {
  const [heartCount, setHeartCount] = useState(0)
  const [bookable, setBookable] = useState(event.is_confirmed)
  const [userTickets, setUserTickets] = useState(0)       // user's own booked tickets
  const [totalBooked, setTotalBooked] = useState(0)       // global booked/popularity
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showPerks, setShowPerks] = useState(false)       // hover / background perks reveal
  const { t } = useTranslation()

  const HEART_THRESHOLD = 0
  const reachedLimit = userTickets >= (event.tag1 === 'group' ? 5 : 1)

  // --- fetch hearts ---
  useEffect(() => {
    async function fetchHearts() {
      try {
        const res = await fetch(`/api/events/hearts?eventId=${event.id}`)
        if (!res.ok) return
        const data = await res.json()
        setHeartCount(data.count)
        setBookable(data.count >= HEART_THRESHOLD || event.is_confirmed)
      } catch (err) {
        console.error('Failed to fetch hearts', err)
      }
    }
    fetchHearts()
  }, [event.id, event.is_confirmed, refreshTrigger])

  // --- fetch user's tickets (myTickets) ---
  useEffect(() => {
    if (!authUser) return
    async function fetchMyTickets() {
      try {
        const token = localStorage.getItem('token')
        if (!token || token.split('.').length !== 3) return
        const res = await fetch('/api/user/myTickets', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        // find tickets for this event
        const myTickets = (data.tickets || []).filter((t) => t.event_id === event.id)
        const total = myTickets.reduce((sum, t) => sum + (t.quantity || 1), 0)
        setUserTickets(total)
        // If backend included a popularity field in the ticket rows (some endpoints do),
        // we can opportunistically use it to seed the global count:
        if (myTickets.length > 0 && typeof myTickets[0].popularity === 'number') {
          setTotalBooked(Number(myTickets[0].popularity))
        }
      } catch (err) {
        console.error('myTickets error:', err)
      }
    }
    fetchMyTickets()
  }, [authUser, event.id, refreshTrigger])

  // --- fetch global booked/popularity ---
  useEffect(() => {
    let cancelled = false

    async function fetchBooked() {
      // Try a dedicated endpoint first (recommended):
      try {
        const res = await fetch(`/api/events/booked?eventId=${event.id}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled && typeof json.count === 'number') {
            setTotalBooked(Number(json.count))
            return
          }
        }
      } catch (err) {
        // ignore and try fallbacks
      }

      // Fallback: if user is authenticated, try to get popularity from /api/user/myTickets (some setups include popularity)
      if (authUser) {
        try {
          const token = localStorage.getItem('token')
          if (token && token.split('.').length === 3) {
            const res = await fetch('/api/user/myTickets', {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
              const data = await res.json()
              // find any ticket row for the event and use its popularity if present
              const any = (data.tickets || []).find((t) => t.event_id === event.id && typeof t.popularity === 'number')
              if (any && !cancelled) {
                setTotalBooked(Number(any.popularity))
                return
              }
            }
          }
        } catch (err) {
          // ignore
        }
      }

      // Last fallback: try to fetch aggregated registrations count from a public endpoint
      // (if you have /api/events/popularity or /api/dump that returns counts, it will be used here)
      try {
        const res = await fetch(`/api/events/popularity?eventId=${event.id}`)
        if (res.ok) {
          const json = await res.json()
          if (!cancelled && typeof json.count === 'number') {
            setTotalBooked(Number(json.count))
            return
          }
        }
      } catch (err) {
        // nothing else we can do on the front-end
      }

      // final fallback: zero (or keep previous)
      if (!cancelled) setTotalBooked((prev) => prev || 0)
    }

    fetchBooked()
    return () => { cancelled = true }
  }, [event.id, authUser, refreshTrigger])

  // --- Heart / Favorite toggle ---
  async function handleHeartClick() {
    try {
      const token = localStorage.getItem('token') || ''
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/events/favorites', {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventId: event.id }),
      })

      if (!res.ok) throw new Error('Failed to like')
      const data = await res.json()
      if (data && typeof data.count === 'number') setHeartCount(data.count)
      toast.success('❤️ Liked!')
      // refresh popularity/booking numbers in case your backend ties favorites -> bookable
      setRefreshTrigger((p) => p + 1)
    } catch (err) {
      console.error(err)
      toast.error('❌ Error liking event (try again later)')
    }
  }

  // --- RSVP ---
  async function handleRSVPClick() {
    if (!authUser) {
      setShowAccountModal(true)
      toast.error('⚠️ Please log in to RSVP.')
      return
    }

    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/events/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ eventId: event.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to RSVP')
      toast.success('🎉 RSVP confirmed!')
      setRefreshTrigger((p) => p + 1)
    } catch (err) {
      console.error(err)
      toast.error('❌ Could not save RSVP. Maybe you already RSVPed?')
    }
  }

  // Language flag
  const langFlag = {
    English: '🇬🇧',
    Mandarin: '🇨🇳',
    Hindi: '🇮🇳',
    Spanish: '🇪🇸',
    Arabic: '🇸🇦',
    French: '🇫🇷',
    Portuguese: '🇧🇷',
    Russian: '🇷🇺',
    German: '🇩🇪',
    Danish: '🇩🇰',
  }[event.language || 'English']

  // Perks reveal handlers (hover + click-on-background)
  let perksTimeout = null
  const handleMouseEnter = () => {
    setShowPerks(true)
    // auto-hide after 4s
    perksTimeout = setTimeout(() => setShowPerks(false), 4000)
  }
  const handleMouseLeave = () => {
    if (perksTimeout) clearTimeout(perksTimeout)
    setShowPerks(false)
  }
  const handleCardClick = (e) => {
    // only toggle perks if the click is on the background (not buttons/links)
    if (e.target.closest('button, a')) return
    setShowPerks((s) => !s)
    // auto-hide
    if (perksTimeout) clearTimeout(perksTimeout)
    perksTimeout = setTimeout(() => setShowPerks(false), 4000)
  }

  return (
    <>
      <div
        className="border border-zinc-700 rounded-xl p-5 bg-gradient-to-b from-zinc-900 to-zinc-800 shadow-lg relative transition hover:shadow-2xl hover:border-blue-500 flex flex-col"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
      >
        <div className="absolute top-2 right-2 text-xl">{langFlag}</div>

        {/* Perks overlay (mysterious effect) */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 rounded-xl transition-all duration-300 ease-out
            ${showPerks ? 'bg-black/40 backdrop-blur-sm' : 'bg-transparent'}`}
        >
          {showPerks && (
            <div className="absolute left-4 bottom-4 p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/3 text-xs text-white max-w-xs shadow-lg animate-[float_6s_ease-in-out_infinite]">
              {event.basic_perk && <div className="mb-1">✨ <strong>Basic:</strong> {event.basic_perk}</div>}
              {event.advanced_perk && <div>🔮 <strong>Advanced:</strong> {event.advanced_perk}</div>}
              {!event.basic_perk && !event.advanced_perk && <div>✨ Special perks available at the event</div>}
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold mb-1 z-10">{event.name}</h3>
        <p className="text-xs text-gray-400 mb-3 z-10">
          📅 {new Date(event.datetime).toLocaleDateString()} · 📍 {event.city}
        </p>

        <p className="text-sm text-gray-300 mb-3 truncate z-10">{event.description?.split(' ').slice(0, 10).join(' ')}...</p>

        <div className="flex gap-2 mb-4 z-10">
          {[event.tag1, event.tag2, event.tag3, event.tag4].filter(Boolean).map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-600 text-white">{tag}</span>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-auto z-10">
          <a
            href={`/event/${event.id}`}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm text-center transition"
          >
            {t('MoreInfo')}
          </a>

          <div className="flex justify-between mt-2">
            <button
              onClick={() => (authUser ? setShowPolicyModal(true) : setShowAccountModal(true))}
              className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm"
            >
              {t('Book')}
            </button>

            <button onClick={handleRSVPClick} className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-black text-sm">
              {t('RSVP')}
            </button>

            <button onClick={handleHeartClick} className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm flex items-center gap-1">
              ❤️ {heartCount}
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-zinc-700 pt-2 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center text-xs text-gray-400 z-10 gap-1">
          <span>💰 {event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : t('Free')}</span>

          {/* Show global booked count together with user's own tickets */}
          <span>
            👥 {totalBooked} / {event.max_attendees || '∞'} booked {authUser ? ` · You: ${userTickets}` : ''}
          </span>
        </div>
      </div>

      {showPolicyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowPolicyModal(false)}>
          <div className="bg-zinc-900 rounded-lg p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <EventPolicy
              event={event}
              onBookingSuccess={(data) => {
                // data?.quantity is expected from EventPolicy
                setUserTickets((prev) => prev + (data?.quantity || 1))
                // bump refresh trigger to refresh counts across page
                setRefreshTrigger((p) => p + 1)
                setShowPolicyModal(false)
              }}
              onClose={() => setShowPolicyModal(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------
// Main Home Component
// ---------------------------
export default function Home() {
  const { t, lang, changeLang } = useTranslation()
  const { address } = useAccount()

  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetch('/api/dump').then(r => r.json()).then(setEvents).catch(() => setEvents([]))
  }, [])

  const filteredEvents = events.filter(e => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    const langMatch = selectedLanguage ? e.language === selectedLanguage : true
    return cityMatch && venueMatch && langMatch
  })

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">
        <header className="bg-zinc-900 rounded-3xl p-8 border border-zinc-700 shadow-lg text-center">
          <h1 className="text-4xl font-bold text-blue-400">{t("PlatformTitle")}</h1>

          <div className="mt-4 flex justify-center">
            <select className="bg-zinc-800 text-white p-2 rounded" value={lang} onChange={(e) => changeLang(e.target.value)}>
              <option value="en">🇬🇧 English</option>
              <option value="zh">🇨🇳 中文</option>
              <option value="hi">🇮🇳 हिंदी</option>
              <option value="es">🇪🇸 Español</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="pt">🇧🇷 Português</option>
              <option value="ru">🇷🇺 Русский</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="da">🇩🇰 Dansk</option>
            </select>
          </div>
        </header>

        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-400">{t("ExploreNetworkEvents")}</h2>
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="text-sm px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">
              {viewMode === 'grid' ? t("ListView") : t("GridView")}
            </button>
          </div>

          <div className="flex gap-4 mb-6 justify-center flex-wrap">
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedCity(e.target.value)} value={selectedCity}>
              <option value="">{t("AllCities")}</option>
              {[...new Set((events || []).map(e => e.city).filter(Boolean))].map((city, i) => (
                <option key={i} value={city}>{city}</option>
              ))}
            </select>

            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedVenueType(e.target.value)} value={selectedVenueType}>
              <option value="">{t("AllEventTypes")}</option>
              {[...new Set((events || []).map(e => e.venue_type).filter(Boolean))].map((type, i) => (
                <option key={i} value={type}>{type}</option>
              ))}
            </select>

            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedLanguage(e.target.value)} value={selectedLanguage}>
              <option value="">All Languages</option>
              {['English','Mandarin','Hindi','Spanish','Arabic','French','Portuguese','Russian','German','Danish'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">{t("NoEventsFound")}</p>
          ) : viewMode === 'grid' ? (
            <div className="grid md:grid-cols-3 gap-4">
              {filteredEvents.map(event => (
                <DynamicEventCard key={event.id} event={event} authUser={authUser} setShowAccountModal={setShowAccountModal} refreshTrigger={refreshTrigger} setRefreshTrigger={setRefreshTrigger}/>
              ))}
            </div>
          ) : (
            <div className="flex flex-col border border-zinc-700 rounded overflow-hidden">
              <div className="grid grid-cols-5 gap-2 py-2 px-3 bg-zinc-800 text-gray-400 font-bold text-sm border-b border-zinc-700">
                <span>{t("Type")}</span>
                <span>{t("Date")}</span>
                <span>{t("Name")}</span>
                <span>{t("City")}</span>
                <span>{t("Action")}</span>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-12 w-full max-w-3xl flex justify-center">
          <ConnectButton />
        </footer>

        {showAccountModal && (
          <YourAccountModal onClose={() => setShowAccountModal(false)} refreshTrigger={0} />
        )}
      </div>
    </main>
  )
}

