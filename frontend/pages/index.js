export function DynamicEventCard({ event, authUser, setShowAccountModal, refreshTrigger, setRefreshTrigger }) {
  const [heartCount, setHeartCount] = useState(0)
  const [bookable, setBookable] = useState(event.is_confirmed)
  const [loading, setLoading] = useState(false)
  const [userTickets, setUserTickets] = useState(0)
  const [maxPerUser, setMaxPerUser] = useState(event.tag1 === 'group' ? 5 : 1)
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState(authUser?.email || '')
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const HEART_THRESHOLD = 0
  const reachedLimit = userTickets >= maxPerUser

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
  }, [event.id, event.is_confirmed])

  // --- fetch user tickets ---
  useEffect(() => {
    if (!authUser) return
    async function fetchMyTickets() {
      try {
        const token = localStorage.getItem('token')
        if (!token || token.split('.').length !== 3) return
        const res = await fetch('/api/user/myTickets', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (!res.ok) return
        const data = await res.json()
        const myTickets = (data.tickets || []).filter(t => t.event_id === event.id)
        const total = myTickets.reduce((sum, t) => sum + (t.quantity || 1), 0)
        setUserTickets(total)
        setMaxPerUser(event.tag1 === 'group' ? 5 : 1)
      } catch (err) {
        console.error('myTickets error:', err)
      }
    }
    fetchMyTickets()
  }, [authUser, event.id, event.tag1, refreshTrigger])

  // --- booking handler ---
  async function handleBooking() {
    if (!authUser) {
      setShowAccountModal(true)
      toast.error('⚠️ Please login to buy a ticket.')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ eventId: event.id, quantity, email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')

      setUserTickets(data.userTickets || userTickets + quantity)
      setRefreshTrigger(prev => prev + 1)

      if (event.price && Number(event.price) > 0) {
        if (data.clientSecret) {
          window.location.href = `/api/events/checkout?payment_intent_client_secret=${data.clientSecret}`
        } else {
          toast.error('⚠️ Payment could not be initiated')
        }
      } else {
        toast.success('✅ Ticket booked! Confirmation email sent.')
      }
    } catch (err) {
      console.error(err)
      toast.error('❌ Error registering')
    } finally {
      setLoading(false)
      setShowPolicyModal(false)
      setAgreed(false)
    }
  }

  // --- like handler ---
  async function handleHeartClick() {
    if (!authUser) {
      setShowAccountModal(true)
      toast.error('⚠️ Please login to like this event.')
      return
    }

    try {
      const token = localStorage.getItem('token') || ''
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/events/favorites', {
        method: 'POST',
        headers,
        body: JSON.stringify({ eventId: event.id })
      })

      if (!res.ok) throw new Error('Failed to like')
      const data = await res.json()
      if (data && typeof data.count === 'number') setHeartCount(data.count)

    } catch (err) {
      console.error('Like error:', err)
      toast.error('❌ Could not like event (try again later)')
    }
  }

  // --- RSVP handler ---
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
        body: JSON.stringify({ eventId: event.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to RSVP')

      toast.success('🎉 RSVP confirmed!')
      setRefreshTrigger(prev => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('❌ Could not save RSVP.')
    }
  }

  return (
    <>
      {/* Card */}
      <div className="border border-zinc-700 rounded-xl p-5 bg-gradient-to-b from-zinc-900 to-zinc-800 shadow-lg relative transition hover:shadow-2xl hover:border-blue-500 flex flex-col">
        <h3 className="text-lg font-bold mb-1">{event.name}</h3>
        <p className="text-xs text-gray-400 mb-3">
          📅 {new Date(event.datetime).toLocaleDateString()} · 📍 {event.city}
        </p>
        <p className="text-sm text-gray-300 mb-3 truncate">{event.description?.split(" ").slice(0,10).join(" ")}...</p>
        <div className="flex gap-2 mb-4">
          {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, idx) => (
            <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-600 text-white">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={() => setShowPolicyModal(true)}
            className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm transition"
          >
            More Info
          </button>

          <div className="flex justify-between mt-2">
            <button
              onClick={handleRSVPClick}
              className="px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-black text-sm"
            >
              📌 RSVP
            </button>
            <button
              onClick={handleHeartClick}
              className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm flex items-center gap-1"
            >
              ❤️ Like ({heartCount})
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-zinc-700 pt-2 flex justify-between items-center text-xs text-gray-400">
          <span>💰 {event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : 'Free'}</span>
          <span>👥 {userTickets} / {event.max_attendees || '∞'} booked</span>
        </div>
      </div>

      {/* Modal */}
      {showPolicyModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPolicyModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] text-white shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPolicyModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-2">{event.name}</h2>
            <p className="text-sm text-gray-400 mb-3">
              📅 {new Date(event.datetime).toLocaleDateString()} · 🕒{" "}
              {new Date(event.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <br />
              📍 {event.city}{event.venue_location ? `, ${event.venue_location}` : ""}
            </p>

            {event.image && (
              <img
                src={event.image}
                alt={event.name}
                className="w-full h-40 object-cover rounded mb-4"
              />
            )}

            <p className="text-gray-200 mb-4">{event.description}</p>

            {/* Price/Quantity */}
            <div className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Price per ticket:</span>
                <span>{event.price && Number(event.price) > 0 ? `${Number(event.price).toFixed(2)} USD` : "Free"}</span>
              </div>
              <div className="flex justify-between items-center">
                <label htmlFor="quantity">Quantity:</label>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min={1}
                  max={maxPerUser - userTickets}
                  className="w-16 p-1 rounded bg-zinc-800 border border-zinc-600 text-white text-center"
                />
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{event.price && Number(event.price) > 0 ? `${(Number(event.price) * quantity).toFixed(2)} USD` : "Free"}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 mb-6 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="form-checkbox"
              />
              I follow the guidelines of the event.
            </label>

            <div className="flex justify-end">
              <button
                onClick={handleBooking}
                disabled={!agreed || loading}
                className="px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {event.price && Number(event.price) > 0 ? "Get Ticket" : "Get Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

