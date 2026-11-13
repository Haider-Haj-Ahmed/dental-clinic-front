import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PortalPatient {
  id: number; first_name: string; last_name: string
  email: string | null; phone: string | null
}

interface PortalAuthState {
  token: string | null
  patient: PortalPatient | null
  isAuthenticated: boolean
  setAuth: (token: string, patient: PortalPatient) => void
  logout: () => void
}

export const usePortalAuthStore = create<PortalAuthState>()(
  persist(
    set => ({
      token: null, patient: null, isAuthenticated: false,
      setAuth: (token, patient) => set({ token, patient, isAuthenticated: true }),
      logout: () => set({ token: null, patient: null, isAuthenticated: false }),
    }),
    { name: 'dental-portal-auth' },
  ),
)
