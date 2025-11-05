/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        muted: {
          DEFAULT: "#f3f4f6"
        }
      }
    },
  },
  plugins: [],
}
