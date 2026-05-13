import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import {login as saveAuth} from '../utils/auth'

 const Login = ()  => {


const [email,setEmail] = useState('')
const [password,setPassword]  = useState('')

const [loading,setLoading]  = useState(false)

const [error,setError] = useState('')

const navigate = useNavigate()

const handleSubmit = async (e)  => {
  e.preventDefault()
  setError('')

  if (!email || !password) {
    setError('Please enter both your password and email')
    return
  }

  setLoading(true)

  try {
    //Make post request to your login endpoint
    const response = await api.post('/auth/login', {
        email : email,
        password: password
    })
    const {token, user}  = response.data;

   // Save token and user info to localStorage using our helper function
    saveAuth(token, user);

  // Redirect to dashboard after successful login
    navigate('/dashboard')

  } catch(err)  {
     // If login fails, show the error message from backend
     const errorMessages = err.response?.data?.message ||  'Login failed. Please try again.'
     setError(errorMessages);
     setLoading(false);
  }
}


    return (
        <div>
            <div>
                <h1>
                    Employee Attendance System
                </h1>
              
              {error  &&  (
                <div>
                    {error}
                </div>
              )}

              <form  onSubmit={handleSubmit}>
                  <div>
                    <label>
                        Email
                    </label>
                    <input
                       type='email'
                       value ={email}
                       onChange={(e) => setEmail(e.target.value)}
                       placeholder='Enter your name'
                       disabled={loading}
                    
                    />
                  </div>

                  <div>
                    <label>
                        Password
                    </label>
                    <input  
                      type='password'
                      value={password}
                      onChange= {(e) => setPassword(e.target.value)}
                      placeholder='Enter your password'
                      disabled = {loading}
                    />
                  </div>
                   

                   <button
                   type='submit'
                   disabled={loading}
                   >

                      {loading ? 'Logging In' : 'Login'}
                   </button>
              </form>
            </div>
        </div>


    )
};


export default Login