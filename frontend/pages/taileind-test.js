export default function TailwindTest() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6">
      <h1 className="text-3xl font-bold mb-4">🎨 Tailwind + Dark Mode</h1>
      <p className="mb-6">This page is styled using Tailwind CSS.</p>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => {
          document.documentElement.classList.toggle('dark')
        }}
      >
        Toggle Dark Mode
      </button>
    </div>
  )
}

