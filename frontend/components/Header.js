'use client'

export default function Header({ address, onToggleDarkMode, darkMode, onOpenEmailModal }) {
  return (
    <header className="relative overflow-hidden rounded-2xl p-6 mb-6 border shadow bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      {/* Background animation layer */}
      <div
        className="absolute inset-0 -z-10 animate-pulse-slow opacity-30 blur-md"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, #5eead4 10%, transparent 30%),
                            radial-gradient(circle at 70% 60%, #818cf8 10%, transparent 30%),
                            radial-gradient(circle at 50% 80%, #f472b6 10%, transparent 30%)`,
          backgroundSize: '200% 200%',
          backgroundRepeat: 'no-repeat',
        }}
      />

      {/* Content */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-semibold">Join the network and grab the perks below</h1>
        <div className="flex gap-3 items-center">
          {address && (
            <button
              onClick={onOpenEmailModal}
              className="px-3 py-1 text-sm border border-white/20 bg-white/10 rounded hover:bg-white/20 transition"
            >
              📧 Email Notifications
            </button>
          )}
          <button
            onClick={onToggleDarkMode}
            className="px-3 py-1 text-sm border border-white/20 bg-white/10 rounded hover:bg-white/20 transition"
          >
            {darkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
          </button>
          <div className="w-32 h-10 border border-white/20 bg-white/10 rounded flex items-center justify-center text-sm text-white/80">
            Wallet
          </div>
        </div>
      </div>
    </header>
  )
}

