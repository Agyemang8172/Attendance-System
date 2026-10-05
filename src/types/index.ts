// The three roles in AttendPro (uppercase to match Prisma enum)
export type Role = 'STAFF' | 'HR' | 'SUPERADMIN'

// A session can only be open or closed (uppercase to match Prisma enum)
export type SessionStatus = 'OPEN' | 'CLOSED'

// Attendance status options (uppercase to match Prisma enum)
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'

// The user object stored in localStorage after login
// This is what getCurrentUser() returns
export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: Role
  mustChangePassword: boolean
  employeeCode?: string
  department?: string
}

// A full user object from the /users endpoint
export interface StaffUser {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  email: string
  department: string
  role: Role
  phoneNumber?: string
  jobTitle?: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

// One attendance record from the API
export interface AttendanceRecord {
  id: string
  user?: {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
    department?: string
    role?: string
  } | null
  clockIn: string
  clockOut?: string | null
  date: string
  status: AttendanceStatus
  sessionStatus: SessionStatus
  hoursWorked: number
  checkInIp?: string
  checkInLat?: number
  checkInLng?: number
  remarks?: string | null
  createdAt: string
  updatedAt: string
  autoClosedOut?: boolean
  alertDismissed?: boolean
}

// What the login API sends back on success
export interface LoginResponse {
  success: boolean
  token: string
  user: AuthUser
}

// What the API sends back when creating a new staff member
export interface CreateUserResponse {
  success: boolean
  data: StaffUser
  tempPassword: string
}

// Pagination info the /users endpoint returns
export interface Pagination {
  currentPage: number
  totalPages: number
  totalUsers: number
}

// The full /users response shape
export interface UsersResponse {
  success: boolean
  data: StaffUser[]
  pagination: Pagination
}

// Chart data point — used in HoursChart and SessionsChart
export interface ChartDataPoint {
  day: string
  hours: number
}

// Sessions chart data point
export interface SessionChartPoint {
  name: string
  value: number
}

// KpiCard color options
export type ColorScheme = 'blue' | 'gold' | 'green' | 'red'

// Generic paginated response
export interface PaginatedResponse<T> {
  success: boolean
  count: number
  total: number
  page: number
  data: T[]
}

// Generic API list response (for users)
export interface ListResponse<T> {
  success: boolean
  data: T[]
  pagination: Pagination
}

// Attendance list response
export type AttendanceListResponse = PaginatedResponse<AttendanceRecord>