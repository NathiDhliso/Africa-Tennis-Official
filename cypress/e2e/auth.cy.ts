describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('should redirect to login when not authenticated', () => {
    cy.url().should('include', '/login')
  })

  it('should display login form', () => {
    cy.visit('/login')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('contain', 'Sign In')
  })

  it('should show validation errors for invalid input', () => {
    cy.visit('/login')
    cy.get('button[type="submit"]').click()
    cy.get('.error-message').should('be.visible')
  })

  it('should navigate to signup page', () => {
    cy.visit('/login')
    cy.contains('Create Account').click()
    cy.url().should('include', '/signup')
  })

  it('should display signup form', () => {
    cy.visit('/signup')
    cy.get('input[name="username"], input[id="username"]').should('be.visible')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
    cy.get('button[type="submit"]').should('be.visible')
  })
})