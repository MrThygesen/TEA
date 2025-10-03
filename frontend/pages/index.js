//index.js   
'use client'      

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { toast } from 'react-hot-toast'
import YourAccountModal from '../components/YourAccountModal'
import Image from 'next/image'
//import AdminSBTManager from '../components/AdminSBTManager'


 // ---------------------------
// Helpers: Auth persistence Test
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
    }hea
    fetchMyTickets()
  }, [authUser, event.id, event.tag1, refreshTrigger])

  const reachedLimit = userTickets >= maxPerUser

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

async function handleHeartClick() {
  try {
    const token = localStorage.getItem('token') || ''
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch('/api/events/favorite', {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventId: event.id })
    })

    if (!res.ok) throw new Error('Failed to like')
    const data = await res.json()

    setHeartCount(data.count)       // update global counter
    if (data.count >= HEART_THRESHOLD) setBookable(true)

    toast.success('❤️ Liked!')
  } catch (err) {
    console.error(err)
    toast.error('❌ Error liking event')
  }
}

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

      toast.success('🎉 RSVP confirmed and added to Your Account!')
      setRefreshTrigger(prev => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('❌ Could not save RSVP. Maybe you already RSVPed?')
    }
  }

  return (
    <div className="border border-zinc-700 rounded-xl p-5 bg-gradient-to-b from-zinc-900 to-zinc-800 shadow-lg relative transition hover:shadow-2xl hover:border-blue-500 flex flex-col">
      {/* Heart counter top right */}
      <button
        onClick={handleHeartClick}
        className="absolute top-3 right-3 text-red-500 text-xl hover:scale-110 transition"
      >
        ❤️ {heartCount}
      </button>

      {/* Title + Date/City */}
      <h3 className="text-lg font-bold mb-1">{event.name}</h3>
      <p className="text-xs text-gray-400 mb-3">
        📅 {new Date(event.datetime).toLocaleDateString()} · 📍 {event.city}
      </p>

      {/* Short text */}
      <p className="text-sm text-gray-300 mb-3 truncate">{event.description?.split(" ").slice(0,10).join(" ")}...</p>

      {/* Tags */}
      <div className="flex gap-2 mb-4">
        {[event.tag1, event.tag2, event.tag3].filter(Boolean).map((tag, idx) => (
          <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-600 text-white">
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
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
            className="px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm"
          >
            ❤️ Like
          </button>
        </div>
      </div>

  {/* Policy / Details Modal */}
{showPolicyModal && (
  <div
    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    onClick={() => setShowPolicyModal(false)}
  >
    <div
      className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 overflow-auto max-h-[90vh] text-white shadow-xl relative"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        onClick={() => setShowPolicyModal(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-white"
      >
        ✕
      </button>

      {/* Title */}
      <h2 className="text-xl font-bold mb-2">{event.name}</h2>

      {/* Date, Time, Place, Venue */}
      <p className="text-sm text-gray-400 mb-3">
        📅 {new Date(event.datetime).toLocaleDateString()} · 🕒{" "}
        {new Date(event.datetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <br />
        📍 {event.city}{event.venue_location ? `, ${event.venue_location}` : ""}
      </p>

      {/* Image */}
      {event.image && (
        <img
          src={event.image}
          alt={event.name}
          className="w-full h-40 object-cover rounded mb-4"
        />
      )}

      {/* Text */}
      <p className="text-gray-200 mb-4">{event.description}</p>

      {/* Tags */}
      <div className="flex gap-2 mb-6">
        {[event.tag2, event.tag3].filter(Boolean).map((tag, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-600 text-white"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Price, Quantity, Total */}
      <div className="mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Price per ticket:</span>
          <span>
            {event.price && Number(event.price) > 0
              ? `${Number(event.price).toFixed(2)} DKK`
              : "Free"}
          </span>
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
          <span>
            {event.price && Number(event.price) > 0
              ? `${(Number(event.price) * quantity).toFixed(2)} DKK`
              : "Free"}
          </span>
        </div>
      </div>

      {/* Checkbox */}
      <label className="flex items-center gap-2 mb-6 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="form-checkbox"
        />
        I follow the guidelines of the event.
      </label>

      {/* Button */}
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
</div>
  )
}
/////////////////////////////// VIDEO ///////
function VideoHero() {
  const [open, setOpen] = useState(false);

  return (
    <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg mt-10 text-center">
      <h2 className="text-2xl font-semibold mb-6 text-blue-400">
        Watch How It Works
      </h2>
      <div
        className="relative mx-auto w-full max-w-4xl cursor-pointer rounded-lg overflow-hidden"
        onClick={() => setOpen(true)}
        aria-label="Play video"
        role="button"
      >
        <img
          src="/images/video-poster.jpg"
          alt="Video poster describing how it works"
          className="w-full h-64 object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="bg-black bg-opacity-60 text-white rounded-full p-3"
            style={{ boxShadow: '0 4px 14px rgba(0,0,0,.6)' }}
          >
            ▶
          </span>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          role="dialog"
          aria-label="Video modal"
        >
          <div className="relative w-full max-w-4xl aspect-video bg-black">
            <iframe
              className="w-full h-full rounded-lg"
              src="https://www.youtube.com/embed/FN_sOmPuuec?si=pNEvmL1ELtpqMRKD"
              title="Event Platform Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full p-2"
              aria-label="Close video"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}



// ---------------------------
// Event List Row
// ---------------------------
function EventListRow({ event, onPreview }) {
  return (
    <div className="grid grid-cols-5 gap-2 items-center py-2 px-3 border-b border-zinc-700 text-sm">
      <span className="truncate">{event.venue_type || '—'}</span>
      <span className="truncate">{new Date(event.datetime).toLocaleDateString()}</span>
      <span className="truncate">{event.name}</span>
      <span className="truncate">{event.city}</span>
      <button onClick={() => onPreview && onPreview(event)} className="justify-self-end text-blue-400 hover:underline">Preview</button>
    </div>
  )
}

// ---------------------------
// Main Home Component
// ---------------------------


export default function Home() {
  const { address } = useAccount()
//  const [adminAddr, setAdminAddr] = useState(null)
//  useEffect(() => { setAdminAddr(process.env.NEXT_PUBLIC_ADMIN?.toLowerCase?.() || null) }, [])
//  const isAdmin = !!(address && adminAddr && address.toLowerCase() === adminAddr)

  const [profilePasswordInput, setProfilePasswordInput] = useState('')
  const [profilePassword, setProfilePassword] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedVenueType, setSelectedVenueType] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const [authUser, setAuthUser] = useState(loadAuth())
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [authError, setAuthError] = useState('')

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [coupons, setCoupons] = useState([])
  const [prebookings, setPrebookings] = useState([])

  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0); 
  

  // --- fetch events ---
  useEffect(() => {
    fetch('/api/dump')
      .then((res) => res.json())
      .then(setEvents)
      .catch(() => setEvents([]))
  }, [])

  // --- load user data on auth ---
useEffect(() => {
  if (typeof window === 'undefined') return

  async function loadProfile() {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const res = await fetch('/api/user/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        // invalid token: clear auth
        localStorage.removeItem('token')
        clearAuth()
        setAuthUser(null)
        return
      }

      const data = await res.json()
      setProfileName(data.username || '')
      setProfileEmail(data.email || '')
      setCoupons(data.paid_coupons || [])
      setPrebookings(data.prebooked_events || [])

      const updatedUser = { ...authUser, ...data }
      setAuthUser(updatedUser)
      saveAuth(updatedUser)
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  }

  loadProfile()
}, [])

  // --- auth handlers ---
  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const username = form.get('username')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!username || !password) return setAuthError('Please enter username and password.')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        return setAuthError(j.error || 'Login failed')
      }

      const user = await res.json()
      setAuthUser(user)
      saveAuth(user)
      localStorage.setItem('token', user.token)
      setShowLoginModal(false)
    } catch (err) {
      setAuthError('Network error')
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setAuthError('')
    const form = new FormData(e.currentTarget)
    const username = form.get('username')?.toString().trim()
    const email = form.get('email')?.toString().trim()
    const password = form.get('password')?.toString()
    if (!username || !email || !password) return setAuthError('All fields are required.')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        return setAuthError(j.error || 'Sign up failed')
      }

      const user = await res.json()
      setAuthUser(user)
      saveAuth(user)
      localStorage.setItem('token', user.token)
      setShowSignupModal(false)
    } catch (err) {
      setAuthError('Network error')
    }
  }

  function handleLogout() {
    clearAuth()
    setAuthUser(null)
  }

  async function saveProfile(e) {
    e.preventDefault()
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const res = await fetch('/api/user/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username: profileName, email: profileEmail })
      })

      if (res.ok) {
        const updated = await res.json()
        setProfileName(updated.username)
        setProfileEmail(updated.email)
        const updatedUser = { ...authUser, ...updated }
        setAuthUser(updatedUser)
        saveAuth(updatedUser)
        alert('Profile updated successfully')
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Failed to update profile')
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    }
  }

  const filteredEvents = events.filter((e) => {
    const cityMatch = selectedCity ? e.city === selectedCity : true
    const venueMatch = selectedVenueType ? e.venue_type === selectedVenueType : true
    return cityMatch && venueMatch
  })

  function openPreview(event) {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  return (
    <main className="bg-black text-white min-h-screen flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-10">

        {/* HEADER */}
        <header className="bg-zinc-900 rounded-3xl p-8 border border-zinc-700 shadow-lg text-center">
          <h1 className="text-4xl font-bold text-blue-400">EDGY EVENT PLATFORM</h1>
          <p className="text-left text-gray-400 mb-6 mt-4">
            Our event platform and network is the spot where people, venues, and opportunities meet. Our guests receive curated experiences that blend business with social connections. We are happy to help you expanding your network and meet new connections in real life.
          </p>

 <div className="mt-6 flex gap-3 justify-center">
  {!authUser ? (
    <>
      <button onClick={() => setShowSignupModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">Create account</button>
      <button onClick={() => setShowLoginModal(true)} className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600">Log in</button>
    </>
  ) : (
    <>
      <span>Welcome, <span className="font-semibold text-white">{authUser.username}</span></span>
      <button onClick={() => setShowAccountModal(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700">Your Account</button>
      <button onClick={handleLogout} className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">Log out</button>
    </>
  )}
</div>
        </header>

{/* Video Section */} <VideoHero /> 


{/* Three Images Section */} <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg mt-10"> <h2 className="text-2xl font-semibold mb-6 text-center text-blue-400">Our Network Highlights</h2> <div className="grid md:grid-cols-3 gap-6"> <div className="flex flex-col items-center"> <img src="/images/image1.jpg" alt="Perks" className="w-full h-48 object-cover rounded-lg mb-2" /> <h3 className="text-lg font-semibold">Perks & Benefits</h3> <p className="text-gray-300 text-sm text-center">Enjoy curated perks at every event you join.</p> </div> <div className="flex flex-col items-center"> <img src="/images/image2.jpg" alt="Venues" className="w-full h-48 object-cover rounded-lg mb-2" /> <h3 className="text-lg font-semibold">Venue Partners</h3> <p className="text-gray-300 text-sm text-center">We collaborate with the best cafés, pubs, and event spaces.</p> </div> <div className="flex flex-col items-center"> <img src="/images/image3.jpg" alt="Organizers" className="w-full h-48 object-cover rounded-lg mb-2" /> <h3 className="text-lg font-semibold">Event Organizers</h3> <p className="text-gray-300 text-sm text-center">Connect with organizers who craft unique experiences.</p> </div> </div> </section>


        {/* Event Grid/List Section */}
        <section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-blue-400">Explore Network Events </h2>
            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="text-sm px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">{viewMode === 'grid' ? 'List view' : 'Grid view'}</button>
          </div>

          <div className="flex gap-4 mb-6 justify-center">
            <select className="bg-zinc-800 text-white p-2 rounded" onChange={(e) => setSelectedCity(e.target.value)} value={selectedCity}>
              <option value="">All Cities</option>
              {[...new Set((events || []).map(e => e.city).filter(Boolean))].map((city, i) => (
                <option key={i} value={city}>{city}</option>
              ))}
            </select>

            <select
  className="bg-zinc-800 text-white p-2 rounded"
  onChange={(e) => setSelectedVenueType(e.target.value)}
  value={selectedVenueType}
>
  <option value="">All Event Types</option>
  {[...new Set((events || []).map(e => e.venue_type).filter(Boolean))].map((type, i) => (
    <option key={i} value={type}>{type}</option>
  ))}
</select>

          </div>
          {filteredEvents.length === 0 ? (
            <p className="text-center text-gray-400">No events found</p>
          ) : viewMode === 'grid' ? (
            <div className="grid md:grid-cols-3 gap-4">
              {filteredEvents.map((event) => (
                <DynamicEventCard
                  key={event.id}
                  event={event}
                  authUser={authUser}
                  setShowAccountModal={setShowAccountModal}
            refreshTrigger={refreshTrigger}
setRefreshTrigger={setRefreshTrigger}    
   
     />
              ))}
            </div>
          ) : (
            <div className="flex flex-col border border-zinc-700 rounded overflow-hidden">
              <div className="grid grid-cols-5 gap-2 py-2 px-3 bg-zinc-800 text-gray-400 font-bold text-sm border-b border-zinc-700">
                <span>Type</span>
                <span>Date</span>
                <span>Name</span>
                <span>City</span>
                <span>Action</span>
              </div>
              {filteredEvents.map((event) => (
                <EventListRow key={event.id} event={event} onPreview={openPreview} />
              ))}
            </div>
          )}
        </section>
      </div>


{/* Telegram Bot Section */}
<section className="bg-zinc-900 border-zinc-700 text-white rounded-3xl p-8 border shadow-lg mt-8 text-center">
  <h2 className="text-2xl font-semibold text-blue-400 mb-4">Try Our Telegram Bot</h2>
  <p className="text-gray-300 mb-6">
    Manage your bookings, confirm attendance, and join group chats directly through Telegram.
  </p>
  <a
    href="https://t.me/TeaIsHereBot"
    target="_blank"
    rel="noopener noreferrer"
    className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-block"
  >
    Open Telegram Bot
  </a>
</section>


      {/* FOOTER */}
      <footer className="mt-12 w-full max-w-3xl flex justify-center">
        <ConnectButton />
      </footer>

{/* Account/Login/Signup Modals */}
{showAccountModal && (
  <YourAccountModal
    onClose={() => setShowAccountModal(false)}
    refreshTrigger={0} // or some dummy number if required
  />
)}





      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Log In</h2>
            {authError && <p className="text-red-500 text-sm mb-2">{authError}</p>}
            <form onSubmit={handleLogin} className="flex flex-col gap-2">
              <input name="username" placeholder="Username" className="p-2 rounded bg-zinc-800 text-white" />
              <input type="password" name="password" placeholder="Password" className="p-2 rounded bg-zinc-800 text-white" />
              <button type="submit" className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Log In</button>
            </form>
          </div>
        </div>
      )}

      {showSignupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowSignupModal(false)}>
          <div className="bg-zinc-900 rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Sign Up</h2>
            {authError && <p className="text-red-500 text-sm mb-2">{authError}</p>}
            <form onSubmit={handleSignup} className="flex flex-col gap-2">
              <input name="username" placeholder="Username" className="p-2 rounded bg-zinc-800 text-white" />
              <input name="email" type="email" placeholder="Email" className="p-2 rounded bg-zinc-800 text-white" />
              <input name="password" type="password" placeholder="Password" className="p-2 rounded bg-zinc-800 text-white" />
              <button type="submit" className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Sign Up</button>
            </form>
          </div>
        </div>
      )}

      {/* Event Preview Modal */}
      {showEventModal && selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEventModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-lg max-w-lg w-full p-6 overflow-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{selectedEvent.name}</h2>
            <img src={selectedEvent.image_url || '/default-event.jpg'} alt={selectedEvent.name} className="w-full h-56 object-contain rounded mb-4" />
            <p className="mb-2 text-sm text-gray-400">{new Date(selectedEvent.datetime).toLocaleString()} @ {selectedEvent.venue} ({selectedEvent.venue_type || 'N/A'})</p>
            <p className="mb-4">{selectedEvent.details}</p>

            {selectedEvent.basic_perk && <p className="text-sm text-gray-300"><strong>Basic Perk:</strong> {selectedEvent.basic_perk}</p>}
            {(selectedEvent.paid_count || 0) >= 10 && selectedEvent.advanced_perk && <p className="text-sm text-gray-300"><strong>Advanced Perk:</strong> {selectedEvent.advanced_perk}</p>}

            <button onClick={() => setShowEventModal(false)} className="mt-6 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Close</button>
          </div>
        </div>
      )}
    </main>
  )
}
