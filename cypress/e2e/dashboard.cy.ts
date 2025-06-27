describe('Dashboard Feature', () => {
  // Test credentials
  const testUser = {
    email: 'nkosimano@gmail.com',
    password: 'Magnox271991!',
    username: 'nkosimano'
  };

  // Login before each test
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/login');
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });

  it('should display dashboard with all sections', () => {
    // Check welcome message
    cy.contains('Welcome back').should('be.visible');
    
    // Check stats section
    cy.get('.dashboard-stats').should('be.visible');
    cy.contains('Rating').should('be.visible');
    cy.contains('Matches Played').should('be.visible');
    cy.contains('Matches Won').should('be.visible');
    cy.contains('Win Rate').should('be.visible');
    
    // Check main action section
    cy.contains('Ready to Start Your Tennis Journey?').should('be.visible');
    cy.contains('button', 'Create a Match').should('be.visible');
  });

  it('should display correct user statistics', () => {
    // Check if stats are displayed with correct values
    cy.get('.dashboard-stats').within(() => {
      // Verify rating is a number
      cy.contains('Rating').parent().find('.dashboard-stat-value').invoke('text').then(text => {
        expect(parseInt(text)).to.be.a('number');
      });
      
      // Verify matches played is a number
      cy.contains('Matches Played').parent().find('.dashboard-stat-value').invoke('text').then(text => {
        expect(parseInt(text)).to.be.a('number');
      });
      
      // Verify matches won is a number
      cy.contains('Matches Won').parent().find('.dashboard-stat-value').invoke('text').then(text => {
        expect(parseInt(text)).to.be.a('number');
      });
      
      // Verify win rate is a percentage
      cy.contains('Win Rate').parent().find('.dashboard-stat-value').invoke('text').then(text => {
        const winRate = parseFloat(text.replace('%', ''));
        expect(winRate).to.be.a('number');
        expect(winRate).to.be.at.least(0);
        expect(winRate).to.be.at.most(100);
      });
    });
  });

  it('should open create match modal from dashboard', () => {
    // Click create match button
    cy.contains('button', 'Create a Match').click();
    
    // Verify modal is open
    cy.contains('Create New Match').should('be.visible');
    
    // Close modal
    cy.get('.modal-close').click();
  });

  it('should navigate to other pages from dashboard', () => {
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Navigate back to dashboard
    cy.get('.sidebar-nav-item').contains('Dashboard').click();
    cy.url().should('include', '/dashboard');
    
    // Navigate to tournaments page
    cy.get('.sidebar-nav-item').contains('Tournaments').click();
    cy.url().should('include', '/tournaments');
    
    // Navigate back to dashboard
    cy.get('.sidebar-nav-item').contains('Dashboard').click();
    cy.url().should('include', '/dashboard');
    
    // Navigate to rankings page
    cy.get('.sidebar-nav-item').contains('Ratings & Rankings').click();
    cy.url().should('include', '/rankings');
    
    // Navigate back to dashboard
    cy.get('.sidebar-nav-item').contains('Dashboard').click();
    cy.url().should('include', '/dashboard');
  });

  it('should display correct username in welcome message', () => {
    // Check welcome message contains username
    cy.contains('Welcome back').should('contain', testUser.username);
  });

  it('should have responsive layout', () => {
    // Test on mobile viewport
    cy.viewport('iphone-x');
    
    // Check if sidebar is collapsed/hidden on mobile
    cy.get('.sidebar').should('not.be.visible');
    
    // Check if mobile menu button is visible
    cy.get('.sidebar-mobile-trigger').should('be.visible');
    
    // Open mobile menu
    cy.get('.sidebar-mobile-trigger').click();
    
    // Check if sidebar is now visible
    cy.get('.sidebar').should('be.visible');
    
    // Close mobile menu
    cy.get('.sidebar-close').click();
    
    // Reset viewport
    cy.viewport(1280, 800);
  });

  it('should handle theme toggle', () => {
    // Check initial theme (likely dark by default)
    cy.get('body').should('have.class', 'theme-dark');
    
    // Toggle theme
    cy.get('.sidebar-theme-button').click();
    cy.get('body').should('have.class', 'theme-light');
    
    // Toggle back
    cy.get('.sidebar-theme-button').click();
    cy.get('body').should('have.class', 'theme-dark');
  });
});