// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Import the Supabase client
import { createClient } from '@supabase/supabase-js'

// Declare global Cypress namespace to add custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login via Supabase Auth
       * @example cy.login('test@example.com', 'password123')
       */
      login(email: string, password: string): Chainable<void>
      
      /**
       * Custom command to create a test user
       * @example cy.createTestUser('test@example.com', 'password123', 'TestUser')
       */
      createTestUser(email: string, password: string, username: string): Chainable<void>
      
      /**
       * Custom command to clean up test user
       * @example cy.cleanupTestUser('test@example.com')
       */
      cleanupTestUser(email: string): Chainable<void>
    }
  }
}

// Initialize Supabase client
const supabaseUrl = Cypress.env('SUPABASE_URL') || 'https://ppuqbimzeplznqdchvve.supabase.co'
const supabaseKey = Cypress.env('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdXFiaW16ZXBsem5xZGNodnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MzcyNjEsImV4cCI6MjA2NTIxMzI2MX0.Yd_QJtBnUYz8GJZHLHYnHDXVzU-ScLKutJhXWRr_qiQ'
const supabase = createClient(supabaseUrl, supabaseKey)

// Login command
Cypress.Commands.add('login', (email, password) => {
  cy.log(`Logging in as ${email}`)
  
  return cy.wrap(
    supabase.auth.signInWithPassword({
      email,
      password
    })
  ).then(response => {
    if (response.error) {
      throw new Error(`Login failed: ${response.error.message}`)
    }
    
    // Store the session in localStorage
    const authData = {
      state: {
        user: response.data.user,
        session: response.data.session
      },
      version: 0
    }
    
    window.localStorage.setItem('auth-storage', JSON.stringify(authData))
    
    // Fetch profile data
    return cy.wrap(
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', response.data.user.id)
        .single()
    ).then(profileResponse => {
      if (profileResponse.error) {
        throw new Error(`Failed to fetch profile: ${profileResponse.error.message}`)
      }
      
      // Update auth storage with profile
      authData.state.profile = profileResponse.data
      window.localStorage.setItem('auth-storage', JSON.stringify(authData))
    })
  })
})

// Create test user command
Cypress.Commands.add('createTestUser', (email, password, username) => {
  cy.log(`Creating test user: ${email}`)
  
  return cy.wrap(
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    })
  ).then(response => {
    if (response.error) {
      throw new Error(`Failed to create user: ${response.error.message}`)
    }
    
    cy.log('Test user created successfully')
    return response.data
  })
})

// Clean up test user command
Cypress.Commands.add('cleanupTestUser', (email) => {
  cy.log(`Cleaning up test user: ${email}`)
  
  // This requires admin access, so it's better to handle cleanup via a separate process
  // For testing purposes, you might want to use a dedicated test database
  cy.log('Note: User cleanup requires admin access and is not implemented in this command')
})

// Example of overwriting an existing command
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })