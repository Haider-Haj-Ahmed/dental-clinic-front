import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { cn } from '@/lib/utils'

const COLLAPSED_KEY = 'dental-sidebar-collapsed'

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })

  function toggle() {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0c14]">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <Topbar sidebarCollapsed={collapsed} />
      <main
        className={cn(
          'pt-14 min-h-screen transition-all duration-300',
          collapsed ? 'ml-16' : 'ml-60',
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
