export const login = (token, user)  =>  {
   localStorage.setItem('token', token);
   localStorage.setItem('user', JSON.stringify(user));
}    

// Remove token and user data when logging out
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };


  // Check if user is currently logged in
  export const isAuthenticated  = ()  => {
    return localStorage.getItem('token') !== null;
  }

  // Get the current logged-in user's info

  export const getCurrentUser = ()  => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user)  : null;
  }

  // Get the JWT token
 export const getToken = ()  =>  {
    localStorage.getItem('token');
 }
