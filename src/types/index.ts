export interface User {
  id: number
  name: string
  email: string
  role: string
  email_verified_at: string | null
  two_factor_enabled: boolean
  force_password_change: boolean
}

export interface AuthResponse {
  token: string
  user: User
  requires_2fa?: boolean
  two_factor_token?: string
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}
