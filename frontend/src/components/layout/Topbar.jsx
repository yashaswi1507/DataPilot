import { Search, Bell, Moon, Sun, User, ChevronDown } from "lucide-react";
import { useState } from "react";
import useStore from "../../store/useStore";

export default function Topbar() {
  const [dark, setDark] = useState(false);
  const rawData = useStore((s) => s.rawData);

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 fixed top-0 left-52 right-0 z-30">

      {/* Left — page title */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="text-xs text-gray-400">Welcome back, Ankit! 👋</p>
      </div>

      {/* Center — search */}
      <div className="flex-1 max-w-md mx-6">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-9 pr-16 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
            Ctrl K
          </span>
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-3">

        {/* Theme toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-all"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-all">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
        </button>

        {/* Plan badge */}
        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
          Free Plan
        </span>

        {/* Profile */}
        <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 leading-tight">Ankit Verma</p>
            <p className="text-xs text-purple-500 leading-tight">Free Plan</p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

      </div>
    </header>
  );
}
