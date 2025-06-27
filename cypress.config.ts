import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    setupNodeEvents() {
      // implement node event listeners here
    },
    env: {
      // Use environment variables for Supabase credentials
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://ppuqbimzeplznqdchvve.supabase.co',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MzcyNjEsImV4cCI6MjA2NTIxMzI2MX0.Yd_QJtBnUYz8GJZHLHYnHDXVzU-ScLKutJhXWRr_qiQ'
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