describe('Matches Feature', () => {
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
    
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
  });

  it('should display matches page with all sections', () => {
    // Check page title
    cy.contains('Matches').should('be.visible');
    
    // Check create match button
    cy.contains('button', 'Create Match').should('be.visible');
    
    // Check live scoring link
    cy.contains('Live Scoring Dashboard').should('be.visible');
    
    // Check search and filter controls
    cy.get('.search-input').should('be.visible');
    cy.get('select').should('have.length.at.least', 2);
  });

  it('should create a new match', () => {
    // Click create match button
    cy.contains('button', 'Create Match').click();
    
    // Verify modal is open
    cy.contains('Create New Match').should('be.visible');
    
    // Search for an opponent
    cy.get('.search-input').type('d');
    cy.wait(1000); // Wait for search results
    
    // Select the first opponent from search results
    cy.get('.player-search-item').first().click();
    
    // Fill in match details
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    cy.get('input[type="date"]').type(formattedDate);
    cy.get('input[type="time"]').type('10:00');
    cy.get('input#location').type('Test Court, Johannesburg');
    
    // Select court type
    cy.get('select#courtType').select('clay');
    
    // Add notes
    cy.get('textarea#notes').type('This is a test match created by Cypress');
    
    // Submit the form
    cy.contains('button', 'Create Match').click();
    
    // Verify match was created
    cy.contains('Test Court, Johannesburg').should('exist');
  });

  it('should filter matches by status and search', () => {
    // Test status filter
    cy.get('select').first().select('pending');
    cy.wait(500);
    
    // Check if any matches are displayed
    cy.get('body').then($body => {
      if ($body.find('.match-grid .card').length > 0) {
        // Verify all visible matches have "Pending" status
        cy.get('.match-grid .card').each($card => {
          cy.wrap($card).contains('Pending').should('be.visible');
        });
      } else {
        cy.contains('No matches found').should('be.visible');
      }
    });
    
    // Reset filter
    cy.get('select').first().select('all');
    
    // Test search functionality
    cy.get('.search-input').type('court');
    cy.wait(500);
    
    // Check if search results contain the term
    cy.get('body').then($body => {
      if ($body.find('.match-grid .card').length > 0) {
        // At least one match should contain "court" in its text
        cy.get('.match-grid .card').should('contain.text', 'court');
      } else {
        cy.contains('No matches found').should('be.visible');
      }
    });
    
    // Clear search
    cy.get('.search-input').clear();
  });

  it('should view match details', () => {
    // Check if any matches exist
    cy.get('body').then($body => {
      if ($body.find('.match-grid .card').length > 0) {
        // Click on the first match
        cy.get('.match-grid .card').first().click();
        
        // Verify match details page
        cy.contains('Match Details').should('be.visible');
        cy.contains('Date & Time').should('be.visible');
        cy.contains('Location').should('be.visible');
        cy.contains('Status').should('be.visible');
        cy.contains('Match Timeline').should('be.visible');
        
        // Go back to matches list
        cy.contains('button', /Back|Go Back/).click();
        cy.url().should('include', '/matches');
      } else {
        cy.log('No matches available to test details view');
      }
    });
  });

  it('should test match summary generation for completed matches', () => {
    // Find a completed match
    cy.get('body').then($body => {
      // Check if there are any completed matches
      const hasCompletedMatches = $body.find('.card:contains("Completed")').length > 0;
      
      if (hasCompletedMatches) {
        // Click on the first completed match
        cy.get('.card:contains("Completed")').first().click();
        
        // Check if summary exists or needs to be generated
        cy.get('body').then($matchBody => {
          if ($matchBody.find('button:contains("Generate Summary")').length > 0) {
            // Generate summary if button exists
            cy.contains('button', 'Generate Summary').click();
            
            // Wait for summary generation (this might take time)
            cy.contains('Generating match summary', { timeout: 10000 }).should('be.visible');
            
            // Wait for summary to appear (may take longer in real environment)
            cy.contains('Generated by AI', { timeout: 30000 }).should('be.visible');
          } else {
            // If summary already exists
            cy.contains('AI Match Summary').should('be.visible');
          }
        });
        
        // Go back to matches
        cy.contains('button', /Back|Go Back/).click();
      } else {
        cy.log('No completed matches found to test summary generation');
      }
    });
  });

  it('should handle match actions based on status', () => {
    // Check for pending matches where user is challenged
    cy.get('body').then($body => {
      const hasPendingMatches = $body.find('.card:contains("Pending")').length > 0;
      
      if (hasPendingMatches) {
        // Find a pending match where the current user is challenged
        cy.get('.card:contains("Pending")').each($card => {
          if ($card.text().includes('Challenged you')) {
            cy.wrap($card).within(() => {
              // Check if accept/decline buttons are present
              if (cy.get('button:contains("Accept Match")').length > 0) {
                // Test accept match functionality
                cy.contains('button', 'Accept Match').click();
                cy.contains('In Progress').should('be.visible');
              }
            });
            return false; // Break the each loop
          }
        });
      } else {
        cy.log('No pending matches found to test actions');
      }
    });
  });

  it('should navigate to live scoring from matches page', () => {
    // Click on live scoring dashboard link
    cy.contains('Live Scoring Dashboard').click();
    
    // Verify navigation to umpire page
    cy.url().should('include', '/umpire');
    cy.contains('Live Scoring Dashboard').should('be.visible');
    
    // Go back to matches
    cy.get('.sidebar-nav-item').contains('My Matches').click();
  });
});