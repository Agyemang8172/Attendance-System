import {AuthUser, Role}  from '../types'


// Save token and user to localStorage after login
export const login = (token:string, user: AuthUser): void => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Clear everything on logout
export const logout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

// Returns true if token exists, false if not
export const isAuthenticated = () : boolean => {
    return localStorage.getItem('token') !== null;
}

// Returns the full user object or null
export const getCurrentUser = () : AuthUser | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Returns the raw JWT token string or null
export const getToken = () : string | null => {
    return localStorage.getItem('token');
}

// The role's landing route — the single source of truth for where each role
// belongs (S15 uses it for the bounce when a password is already set).
export const roleHome = (role?: Role): string => {
    if (role === 'HR') return '/hr-dashboard';
    if (role === 'SUPERADMIN') return '/superadmin-dashboard';
    return '/dashboard';
}

// Merge a partial update (e.g. mustChangePassword: false) back into the
// stored session after the server has cleared the flag.
export const updateCurrentUser = (patch: Partial<AuthUser>): void => {
    const user = getCurrentUser();
    if (!user) return;
    localStorage.setItem('user', JSON.stringify({ ...user, ...patch }));
}