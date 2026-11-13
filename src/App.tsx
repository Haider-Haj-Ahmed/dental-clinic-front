import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePortalAuthStore } from '@/portal/store/portalAuthStore'

// Staff pages
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
import SuppliersPage from '@/pages/suppliers/SuppliersPage'
import StaffPage from '@/pages/users/StaffPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import PaymentsPage from '@/pages/payments/PaymentsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import AuditLogsPage from '@/pages/audit/AuditLogsPage'
import EncountersPage from '@/pages/encounters/EncountersPage'
import TreatmentPlansPage from '@/pages/treatment-plans/TreatmentPlansPage'
import PrescriptionsPage from '@/pages/prescriptions/PrescriptionsPage'

// Portal pages
import PortalLoginPage from '@/portal/pages/auth/PortalLoginPage'
import PortalShell from '@/portal/layout/PortalShell'
import PortalHomePage from '@/portal/pages/home/PortalHomePage'
import PortalAppointmentsPage from '@/portal/pages/appointments/PortalAppointmentsPage'
import PortalInvoicesPage from '@/portal/pages/invoices/PortalInvoicesPage'
import PortalPrescriptionsPage from '@/portal/pages/prescriptions/PortalPrescriptionsPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PortalPrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = usePortalAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/portal/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Staff ─────────────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa"   element={<TwoFactorPage />} />
        <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/patients"        element={<PatientsPage />} />
          <Route path="/patients/:id"    element={<PatientDetailPage />} />
          <Route path="/appointments"    element={<AppointmentsPage />} />
          <Route path="/providers"       element={<ProvidersPage />} />
          <Route path="/encounters"      element={<EncountersPage />} />
          <Route path="/treatment-plans" element={<TreatmentPlansPage />} />
          <Route path="/prescriptions"   element={<PrescriptionsPage />} />
          <Route path="/invoices"        element={<InvoicesPage />} />
          <Route path="/payments"        element={<PaymentsPage />} />
          <Route path="/inventory"       element={<InventoryPage />} />
          <Route path="/suppliers"       element={<SuppliersPage />} />
          <Route path="/users"           element={<StaffPage />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="/reports"         element={<ReportsPage />} />
          <Route path="/audit-logs"      element={<AuditLogsPage />} />
        </Route>

        {/* ── Patient Portal ────────────────────────────────────────── */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route element={<PortalPrivateRoute><PortalShell /></PortalPrivateRoute>}>
          <Route path="/portal"               element={<PortalHomePage />} />
          <Route path="/portal/appointments"  element={<PortalAppointmentsPage />} />
          <Route path="/portal/invoices"      element={<PortalInvoicesPage />} />
          <Route path="/portal/prescriptions" element={<PortalPrescriptionsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
