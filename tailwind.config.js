/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        Fraunces: ['Fraunces', 'serif'],
        GeneralSans: ['General Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}