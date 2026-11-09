import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import LoginPage from '@/pages/auth/LoginPage'
import TwoFactorPage from '@/pages/auth/TwoFactorPage'
import AppShell from '@/components/layout/AppShell'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import PatientsPage from '@/pages/patients/PatientsPage'
import PatientDetailPage from '@/pages/patients/PatientDetailPage'
import AppointmentsPage from '@/pages/appointments/AppointmentsPage'
import ProvidersPage from '@/pages/providers/ProvidersPage'
import InvoicesPage from '@/pages/invoices/InvoicesPage'
import InventoryPage from '@/pages/inventory/InventoryPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function Soon({ title }: { title: string }) {
  return <div className="flex items-center justify-center h-64"><p className="text-zinc-600 text-sm">{title} — coming soon</p></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa"   element={<TwoFactorPage />} />
        <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/patients"        element={<PatientsPage />} />
          <Route path="/patients/:id"    element={<PatientDetailPage />} />
          <Route path="/appointments"    element={<AppointmentsPage />} />
          <Route path="/providers"       element={<ProvidersPage />} />
          <Route path="/invoices"        element={<InvoicesPage />} />
          <Route path="/inventory"       element={<InventoryPage />} />
          <Route path="/encounters"      element={<Soon title="Encounters" />} />
          <Route path="/treatment-plans" element={<Soon title="Treatment Plans" />} />
          <Route path="/prescriptions"   element={<Soon title="Prescriptions" />} />
          <Route path="/payments"        element={<Soon title="Payments" />} />
          <Route path="/suppliers"       element={<Soon title="Suppliers" />} />
          <Route path="/reports"         element={<Soon title="Reports" />} />
          <Route path="/users"           element={<Soon title="Staff" />} />
          <Route path="/settings"        element={<Soon title="Settings" />} />
          <Route path="/audit-logs"      element={<Soon title="Audit Logs" />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
