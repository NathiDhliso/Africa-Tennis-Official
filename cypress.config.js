import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    pageLoadTimeout: 60000,
    video: false,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 0
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
      return config
    },
    env: {
      // Supabase credentials
      SUPABASE_URL: 'https://ppuqbimzeplznqdchvve.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MzcyNjEsImV4cCI6MjA2NTIxMzI2MX0.Yd_QJtBnUYz8GJZHLHYnHDXVzU-ScLKutJhXWRr_qiQ',
      
      // Test user credentials
      TEST_USER_EMAIL: 'nkosimano@gmail.com',
      TEST_USER_PASSWORD: 'Magnox271991!',
      TEST_USER_USERNAME: 'nkosimano'
    }
  },
  
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    viewportWidth: 1280,
    viewportHeight: 800,
  },
})