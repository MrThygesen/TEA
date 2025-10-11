// frontend/pages/event/[id].js
'use client'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import useTranslation from '../../utils/useTranslation'

export default function EventPage() {
  const router = useRouter()
  const { id } = router.query
  const [event, setEvent] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [debug, setDebug] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`API error ${res.status}: ${txt}`)
        }
        const data = await res.json()
        setEvent(data)
        console.log('Loaded event:', data)
      })
      .catch((err) => {
        console.error('Failed to load event:', err)
        setEvent(null)
      })
  }, [id])

  async function handleBooking() {
    if (!agreed) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ eventId: event.id, quantity })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('BookingFailed'))
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else alert(t('TicketBooked'))
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  // === helpers ===
  function resolveImageUrl(url) {
    if (!url) return null
    // Absolute URL: use as-is
    if (/^https?:\/\//i.test(url) || /^\/\//.test(url)) return url
    // remove local dev prefixes that may have been stored accidentally
    let p = url.replace(/^frontend\/public\//i, '').replace(/^public\//i, '')
    if (!p.startsWith('/')) p = '/' + p
    return p
  }

  if (!event) {
    return (
      <main className="bg-black text-white flex items-center justify-center min-h-screen p-6">
        <p className="text-gray-400 text-lg animate-pulse">{t('LoadingEvent') || 'Loading event...'}</p>
      </main>
    )
  }

  const imgSrc = resolveImageUrl(event.image_url)
  const eventDate = event.datetime ? new Date(event.datetime) : null
  const tags = [event.tag1, event.tag2, event.tag3, event.tag4].filter(Boolean)

  // Try several possible field names for "how many are booked" — adapt to your API
  const bookedCount = Number(
    event.registrations_count ??
    event.registrations ??
    event.tickets_sold ??
    event.total_booked ??
    event.booked_count ??
    event.registered_count ??
    event.bookings ??
    0
  )

  const maxAtt = Number(event.max_attendees ?? 100)
 const minNeeded = Number(event.min_attendees ?? 0)
const showBasicPerk = bookedCount >= minNeeded && !!event.basic_perk
const showAdvancedPerk = bookedCount < minNeeded && !!event.advanced_perk

  return (
    <main className="bg-gradient-to-b from-black via-zinc-900 to-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="bg-zinc-900/90 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-zinc-800">
        {/* HEADER */}
        <div className="relative h-72 w-full bg-zinc-800/40">
          {imgSrc && !imgError ? (
            // native <img> is simplest here (no next/image restrictions)
            <img
              src={imgSrc}
              alt={event.name || 'Event image'}
              onError={(e) => {
                console.warn('Image failed to load:', imgSrc)
                setImgError(true)
                e.currentTarget.src = '/placeholder-event.png' // provide this fallback in public/
              }}
              className="object-cover w-full h-full brightness-90 transition"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-semibold">{event.name}</div>
                <div className="text-sm text-gray-400 mt-2">Image not available</div>
                {imgSrc && (
                  <div className="text-xs text-gray-500 mt-1 break-all">{imgSrc}</div>
                )}
              </div>
            </div>
          )}

          {/* overlay title */}
          <div className="absolute bottom-0 left-0 p-4 w-full bg-gradient-to-t from-black/80 to-transparent">
            <h1 className="text-3xl font-bold truncate">{event.name}</h1>
            {eventDate && (
              <p className="text-sm text-gray-400">
                📅 {eventDate.toLocaleDateString()} · 🕒 {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <p className="text-sm text-gray-400">
              📍 {event.city}{event.venue ? ` · ${event.venue}` : event.venue_location ? ` · ${event.venue_location}` : ''}
            </p>
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">
          {/* tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tname, i) => (
                <span key={i} className="bg-zinc-800 text-xs px-3 py-1 rounded-full border border-zinc-700">#{tname}</span>
              ))}
            </div>
          )}

          {/* description/details */}
          {event.description && <p className="text-gray-300 leading-relaxed">{event.description}</p>}
          {event.details && <p className="text-gray-400 text-sm italic">{event.details}</p>}

          {/* perks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <h3 className="font-semibold text-green-400 mb-1">Basic perk</h3>
              {showBasicPerk ? (
                <p className="text-gray-300">{event.basic_perk}</p>
              ) : (
                <p className="text-gray-500 text-sm">
                  {event.basic_perk ? 'Basic perk not available due to current bookings.' : 'No basic perk defined.'}
                </p>
              )}
            </div>

            <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <h3 className="font-semibold text-amber-300 mb-1">Advanced perk</h3>
              {showAdvancedPerk ? (
                <p className="text-gray-300">{event.advanced_perk}</p>
              ) : (
                <p className="text-gray-500 text-sm">
                  {event.advanced_perk ? 'Advanced perk not active (requires fewer than 5 bookings).' : 'No advanced perk defined.'}
                </p>
              )}
            </div>
          </div>

          {/* booking */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Price</span>
              <span>{event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : 'Free'}</span>
            </div>

            <div className="flex justify-between items-center">
              <label htmlFor="quantity" className="text-sm">Quantity</label>
              <input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))} min={1} max={event.max_attendees || 10} className="w-20 p-2 rounded bg-zinc-800 border border-zinc-600 text-white text-center"/>
            </div>

            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-green-500" />
              I agree to the event policy
            </label>

            <button onClick={handleBooking} disabled={!agreed || loading} className={`w-full mt-4 py-3 rounded-xl font-semibold transition ${(!agreed || loading) ? 'bg-green-700/40 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>
              {loading ? 'Processing...' : 'Get ticket'}
            </button>

            <div className="text-gray-400 text-xs mt-3">
              <p>Show the QR code from the email at the venue.</p>
              <p>If you paid, you will receive a confirmation email with the perk information.</p>
            </div>
          </div>

          {/* small debug area */}
          <div className="mt-2 text-right">
            <button onClick={() => setDebug((s) => !s)} className="text-xs text-gray-400 hover:underline">
              {debug ? 'Hide debug' : 'Show debug'}
            </button>
            {debug && (
              <pre className="mt-2 p-3 bg-black/60 text-xs text-gray-300 rounded max-h-64 overflow-auto">
                {JSON.stringify(event, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

