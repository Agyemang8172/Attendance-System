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

// Returns true only when a token AND a user with a known role are stored.
// A leftover token on its own is not a session: without a role the guards
// cannot decide a destination, so it must be treated as signed out.
export const isAuthenticated = () : boolean => {
    if (localStorage.getItem('token') === null) return false;
    const role = getCurrentUser()?.role;
    return role === 'STAFF' || role === 'HR' || role === 'SUPERADMIN';
}

// Returns the full user object or null. Never throws: a corrupt or legacy
// `user` value reads back as null so callers fall through to the login guard.
export const getCurrentUser = () : AuthUser | null => {
    const user = localStorage.getItem('user');
    if (!user) return null;
    try {
        return JSON.parse(user);
    } catch {
        return null;
    }
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