export default function Navbar() {
  return (
    <nav className="bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-600 py-4 px-6 sticky top-0 z-50 w-full">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-neutral-500 flex items-center justify-center">
              <span className="text-neutral-50 font-bold text-sm">E</span>
            </div>
            <h1 className="text-xl font-bold text-neutral-50">Exness</h1>
          </div>
          <div className="hidden md:flex space-x-6 ml-8">
            <a href="/" className="text-neutral-400 hover:text-neutral-50 transition-colors">
              Home
            </a>
            <a href="/trading" className="text-neutral-400 hover:text-neutral-50 transition-colors">
              Trading
            </a>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="bg-neutral-500 hover:bg-neutral-400 text-neutral-50 px-4 py-2 rounded-md transition-colors text-sm font-medium">
            DEMO
          </button>
        </div>
      </div>
    </nav>
  );
}
