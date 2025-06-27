import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    env: {
      // Use environment variables for Supabase credentials
      SUPABASE_URL: Cypress.env('SUPABASE_URL') || 'your_supabase_url',
      SUPABASE_ANON_KEY: Cypress.env('SUPABASE_ANON_KEY') || 'your_supabase_anon_key'
    }
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
  viewportWidth: 1280,
  viewportHeight: 800,
  video: false, // Disable video recording by default to save space
  screenshotOnRunFailure: true,
})