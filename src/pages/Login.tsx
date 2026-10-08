import React, { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { login as saveAuth } from '../utils/auth'
import { LoginResponse } from '../types'
import MeridianArt from '../assets/meridian.svg'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

const Login = () => {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [showPassword, setShowPassword] = useState<boolean>(false)

  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter both your email and password.')
      return
    }

    setLoading(true)

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      })

      const { token, user } = response.data

      saveAuth(token, user)

      if (user.mustChangePassword) {
        navigate('/set-password')
        return
      }

      if (user.role === 'HR') {
        navigate('/hr-dashboard')
      } else if (user.role === 'SUPERADMIN') {
        navigate('/superadmin-dashboard')
      } else {
        navigate('/dashboard')
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Login failed. Please try again.'
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sans bg-auth-canvas">

      {/* ─────────────────────────────────────────
          LEFT PANEL — Brand / visual side
          Hidden on mobile, 45% width on desktop
      ───────────────────────────────────────── */}
      <div
        className="
          hidden md:flex w-[45%] min-h-screen
          bg-auth-canvas
          flex-col
          items-center
          justify-center
          px-12
          relative
          overflow-hidden
          border-r border-auth-hairline
        "
      >
        {/* SVG Art */}
        <div className="w-48 h-48 mb-10 opacity-90">
          <img
            src={MeridianArt}
            alt="AttendPro visual"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-4xl font-bold tracking-tight text-auth-accent mb-3 font-serif">
          AttendPro
        </h1>

        {/* Tagline */}
        <p className="text-sm text-auth-ink-muted tracking-widest uppercase font-sans">
          Employee Attendance System
        </p>

        {/* Bottom decorative accent rule */}
        <div className="absolute bottom-10 left-12 right-12 h-px bg-auth-accent opacity-20" />

        {/* Corner accent top-right */}
        <div className="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-auth-accent opacity-30 rounded-tr-sm" />

        {/* Corner accent bottom-left */}
        <div className="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-auth-accent opacity-30 rounded-bl-sm" />
      </div>

      {/* ─────────────────────────────────────────
          RIGHT PANEL
          Full width on mobile, 55% on desktop
          White background with subtle warm surface
      ───────────────────────────────────────── */}
      <div
        className="
          flex-1
          min-h-screen
          bg-auth-canvas
          flex
          flex-col
          justify-center
          px-8 sm:px-16 lg:px-24
          relative
        "
      >
        {/* Mobile-only brand header (left panel is hidden on mobile) */}
        <div className="flex md:hidden items-center gap-2 mb-10">
          <span className="text-2xl font-bold text-auth-ink font-serif">
            AttendPro
          </span>
          <span className="text-xs text-auth-ink-muted uppercase tracking-widest mt-1 font-sans">
            / Attendance
          </span>
        </div>

        {/* Form container — max width keeps it readable on large screens */}
        <div className="w-full max-w-sm">

          {/* Heading */}
          <h2 className="text-3xl font-bold text-auth-ink mb-2 leading-tight font-serif">
            Welcome back.
          </h2>

          {/* Subheading */}
          <p className="text-sm text-auth-ink-muted mb-8 font-sans">
            Sign in to continue to your workspace.
          </p>

          {/* Accent rule under heading */}
          <div className="w-10 h-0.5 bg-auth-accent mb-8" />

          {/* ── ERROR BAR ── */}
          {error && (
            <div
              className="
                flex items-start gap-3
                bg-error/10 border border-error/20
                text-error text-sm
                px-4 py-3 rounded-lg mb-6
                font-sans
              "
            >
              {/* Warning icon */}
              <svg
                className="w-4 h-4 mt-0.5 shrink-0 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* ── FORM ── */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-eyebrow text-auth-ink mb-2 font-sans"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                className="input-auth"
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-eyebrow text-auth-ink mb-2 font-sans"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="input-auth pr-11"
                />

                {/* Show / hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="
                    absolute right-3 top-1/2 -translate-y-1/2
                    text-auth-ink-muted hover:text-auth-ink
                    transition duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-auth-accent
                  "
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <FaEyeSlash className="w-4 h-4" />
                  ) : (
                    <FaEye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-auth w-full"
            >
              {loading ? (
                <>
                  {/* Spinner */}
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="absolute bottom-8 left-8 sm:left-16 lg:left-24 text-caption text-auth-ink-muted font-sans">
          © 2026 AttendPro. All rights reserved.
        </div>
      </div>
    </div>
  )
}

export default Login