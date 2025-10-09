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
  const { t } = useTranslation()

  useEffect(() => {
    if (!id) return
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(setEvent)
      .catch(err => console.error('Failed to load event:', err))
  }, [id])

  async function handleBooking() {
    if (!agreed) return
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ eventId: event.id, quantity })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t("BookingFailed"))
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
      else alert(t("TicketBooked"))
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!event) {
    return (
      <main className="bg-black text-white flex items-center justify-center h-screen">
        <p className="text-gray-400 text-lg animate-pulse">{t("LoadingEvent")}</p>
      </main>
    )
  }

  // --- Helpers ---
  const tags = [event.tag1, event.tag2, event.tag3, event.tag4].filter(Boolean)
  const imgSrc = event.image_url?.startsWith('/')
    ? event.image_url
    : `/${event.image_url?.replace(/^frontend\/public\//, '')}`

  const eventDate = new Date(event.datetime)
  const perkInfo = event.basic_perk
    ? event.basic_perk
    : event.advanced_perk
    ? event.advanced_perk
    : t("NoPerk")

  // --- UI ---
  return (
    <main className="bg-gradient-to-b from-black via-zinc-900 to-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="bg-zinc-900/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-zinc-800">
        {/* HEADER IMAGE */}
        {imgSrc && (
          <div className="relative h-64 w-full overflow-hidden">
            <img
              src={imgSrc}
              alt={event.name}
              className="object-cover w-full h-full brightness-90 hover:brightness-100 transition"
            />
            <div className="absolute bottom-0 left-0 p-4 bg-gradient-to-t from-black/80 to-transparent w-full">
              <h1 className="text-3xl font-bold">{event.name}</h1>
              <p className="text-sm text-gray-400">
                📅 {eventDate.toLocaleDateString()} · 🕒{' '}
                {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-sm text-gray-400">
                📍 {event.city}
                {event.venue_location ? `, ${event.venue_location}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <div className="p-6 space-y-6">
          {/* TAGS */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <span
                  key={i}
                  className="bg-zinc-800 text-xs px-3 py-1 rounded-full border border-zinc-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* DESCRIPTION */}
          {event.description && (
            <p className="text-gray-300 leading-relaxed">{event.description}</p>
          )}
          {event.details && (
            <p className="text-gray-400 text-sm italic">{event.details}</p>
          )}

          {/* PERK BOX */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-sm">
            <h3 className="font-semibold text-green-400 mb-1">{t("Perks")}</h3>
            <p className="text-gray-300">{perkInfo}</p>
          </div>

          {/* BOOKING BOX */}
          <div className="border-t border-zinc-700 pt-4 space-y-4">
            <div className="flex justify-between text-sm">
              <span>{t("PricePerTicket")}</span>
              <span>
                {event.price && Number(event.price) > 0
                  ? `${Number(event.price).toFixed(2)} USD`
                  : t("Free")}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <label htmlFor="quantity">{t("Quantity")}</label>
              <input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min={1}
                max={event.max_attendees || 10}
                className="w-16 p-1 rounded bg-zinc-800 border border-zinc-600 text-white text-center"
              />
            </div>

            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="accent-green-600"
              />
              {t("Iagree")} — {t("VenuePolicy")}
            </label>

            <button
              onClick={handleBooking}
              disabled={!agreed || loading}
              className={`w-full mt-4 py-3 rounded-xl font-semibold transition ${
                !agreed || loading
                  ? 'bg-green-700/40 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? t("Processing") : t("GetTicket")}
            </button>

            <div className="text-gray-400 text-xs mt-4">
              <p>{t("ShowYourQR")}</p>
              <p>{t("EmailContainsPerk")}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

