import { useState } from 'react';
import { NavLink } from 'react-router-dom';

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
      isActive
        ? 'border-blue-500 text-gray-900'
        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2 text-sm font-medium ${
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  return (
    <nav className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          <div className="flex-shrink-0 flex items-center mr-8">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Clinical Quality Dashboard</h1>
          </div>
          <div className="hidden sm:flex sm:space-x-8">
            <NavLink to="/overview" className={desktopLinkClass}>Study Overview</NavLink>
            <NavLink to="/quality" className={desktopLinkClass}>Quality Dashboard</NavLink>
            <NavLink to="/participants" className={desktopLinkClass}>Participant Summary</NavLink>
          </div>
          <div className="ml-auto sm:hidden">
            <button
              onClick={() => setMobileOpen(p => !p)}
              className="p-2 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="space-y-1 pb-3 pt-2">
            <NavLink to="/overview" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>Study Overview</NavLink>
            <NavLink to="/quality" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>Quality Dashboard</NavLink>
            <NavLink to="/participants" className={mobileLinkClass} onClick={() => setMobileOpen(false)}>Participant Summary</NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
