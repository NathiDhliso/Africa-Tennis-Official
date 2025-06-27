describe('Authentication Flow', () => {
  // Test credentials
  const testUser = {
    email: 'nkosimano@gmail.com',
    password: 'Magnox271991!',
    username: 'nkosimano'
  };

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should redirect to login when not authenticated', () => {
    cy.url().should('include', '/login');
  });

  it('should display login form with all elements', () => {
    cy.visit('/login');
    
    // Check all form elements
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('contain', 'Sign In');
    cy.get('.checkbox-container').should('be.visible');
    cy.contains('Forgot Password').should('be.visible');
    cy.contains('Create Account').should('be.visible');
  });

  it('should validate login form inputs', () => {
    cy.visit('/login');
    
    // Test empty form submission
    cy.get('button[type="submit"]').click();
    cy.contains('Email is required').should('be.visible');
    
    // Test invalid email format
    cy.get('input[type="email"]').type('invalid-email');
    cy.get('button[type="submit"]').click();
    cy.contains('Please enter a valid email address').should('be.visible');
    
    // Test valid email but no password
    cy.get('input[type="email"]').clear().type('test@example.com');
    cy.get('button[type="submit"]').click();
    cy.contains('Password is required').should('be.visible');
    
    // Test valid email but short password
    cy.get('input[type="password"]').type('12345');
    cy.get('button[type="submit"]').click();
    cy.contains('Password must be at least 6 characters').should('be.visible');
  });

  it('should successfully login with valid credentials', () => {
    cy.visit('/login');
    
    // Fill in login form with valid credentials
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Verify successful login
    cy.url().should('include', '/dashboard', { timeout: 10000 });
    cy.contains('Welcome back').should('be.visible');
  });

  it('should navigate to signup page and back', () => {
    cy.visit('/login');
    cy.contains('Create Account').click();
    cy.url().should('include', '/signup');
    
    // Check signup form elements
    cy.get('input[id="username"], input[name="username"]').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    
    // Navigate back to login
    cy.contains('Sign In').click();
    cy.url().should('include', '/login');
  });

  it('should navigate to forgot password page and back', () => {
    cy.visit('/login');
    cy.contains('Forgot Password').click();
    cy.url().should('include', '/forgot-password');
    
    // Check forgot password form elements
    cy.get('input[type="email"]').should('be.visible');
    cy.contains('button', 'Send Reset Link').should('be.visible');
    
    // Navigate back to login
    cy.contains('Sign in').click();
    cy.url().should('include', '/login');
  });

  it('should logout successfully', () => {
    // Login first
    cy.visit('/login');
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Wait for dashboard to load
    cy.url().should('include', '/dashboard');
    
    // Logout
    cy.contains('Sign Out').click();
    
    // Verify redirect to login page
    cy.url().should('include', '/login');
  });
});