// Save token and user to localStorage after login
export const login = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}

// Clear everything on logout
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

// Returns true if token exists, false if not
export const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
}

// Returns the full user object or null
export const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

// Returns the raw JWT token string or null
export const getToken = () => {
    return localStorage.getItem('token');
}