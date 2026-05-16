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
      <div  className='min-h-screen bg-gray-100 flex items-center justify-center'>
        <div className='bg-white w-full max-w-md rounded-2xl overflow-hidden'>
            <div className='px-8 py-8 text-center bg-[#0f172a]'>
                <h1 className='text-2xl font-bold text-white tracking-wide'>
                    Attend Pro
                </h1>
                <p className='text-blue-300 text-sm mt-1'>
                   Employee Attendance System
                </p>
                </div>



               {/* Form Section */}
             <div className='px-8 py-8'>
               <h2 className='text-gray-800 text-xl font-semibold mb-6'>
                   Sign in to your acount
               </h2>

                
              {error && (
            <div className="bg-red-50 border border-red-300 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )
                }

              <form  onSubmit={handleSubmit} className='space-y-5'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Email
                    </label>
                    <input
                       type='email'
                       value ={email}
                       onChange={(e) => setEmail(e.target.value)}
                       placeholder='Enter your email'
                       disabled={loading}
                       className='w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition'
                    
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>
                        Password
                    </label>

                    <input  
                      type='password'
                      value={password}
                      onChange= {(e) => setPassword(e.target.value)}
                      placeholder='Enter your password'
                      disabled = {loading}
                      className='w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition'
                      
                    />
                  </div>
                   

                   <button
                   type='submit'
                   disabled={loading}
                   className='w-full bg-[#0f172a] hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:bg-gray-400 disabled:cursor-not-allowed'
                   >

                      {loading ? 'Logging In' : 'Login'}
                   </button>
              </form>
          </div>

          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            © 2026 AttendPro. All rights reserved.
          </p>
        </div>
            </div>
        </div>



    )
};


export default Login