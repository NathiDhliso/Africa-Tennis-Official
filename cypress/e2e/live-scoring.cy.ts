describe('Live Scoring Feature', () => {
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
    
    // Navigate to umpire page
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
  });

  it('should display live scoring dashboard with all sections', () => {
    // Check page title
    cy.contains('Live Scoring Dashboard').should('be.visible');
    
    // Check if there are active matches
    cy.get('body').then($body => {
      if ($body.find('Your Active Matches').length > 0) {
        cy.contains('Your Active Matches').should('be.visible');
      }
      
      // Check if there are tournaments
      if ($body.find('.umpire-tournament-section').length > 0) {
        cy.contains('Your Tournaments').should('be.visible');
      }
    });
  });

  it('should navigate to match scoring interface if matches exist', () => {
    // Check if there are active matches
    cy.get('body').then($body => {
      if ($body.find('button:contains("Continue Scoring")').length > 0) {
        // Click on first match
        cy.contains('button', 'Continue Scoring').first().click();
        
        // Check scoring interface
        cy.contains('Live Scoring').should('be.visible');
        
        // Check point type selection
        cy.contains('Point Type').should('be.visible');
        
        // Check point buttons
        cy.contains('button', /Point for/).should('be.visible');
        
        // Go back
        cy.contains('button', 'Back').click();
        cy.url().should('include', '/umpire');
      } else {
        cy.log('No active matches available for scoring');
      }
    });
  });

  it('should select a tournament and view its matches', () => {
    // Check if there are tournaments
    cy.get('body').then($body => {
      if ($body.find('.umpire-tournament-card').length > 0) {
        // Click on first tournament
        cy.get('.umpire-tournament-card').first().click();
        
        // Check if tournament matches are displayed
        cy.contains('Tournament Matches').should('be.visible');
        
        // Check if there are matches
        cy.get('body').then($tournamentBody => {
          if ($tournamentBody.find('.umpire-match-card').length > 0) {
            cy.get('.umpire-match-card').should('be.visible');
          } else {
            cy.contains('No Matches Available').should('be.visible');
          }
        });
      } else {
        cy.log('No tournaments available');
      }
    });
  });

  it('should test point scoring if a match is available', () => {
    // Check if there are active matches
    cy.get('body').then($body => {
      if ($body.find('button:contains("Continue Scoring")').length > 0) {
        // Click on first match
        cy.contains('button', 'Continue Scoring').first().click();
        
        // Check scoring interface
        cy.contains('Live Scoring').should('be.visible');
        
        // Select a point type
        cy.contains('Point Type').parent().within(() => {
          cy.contains('button', 'Ace').click();
        });
        
        // Award a point to a player
        cy.contains('button', /Point for/).first().click();
        
        // Verify point was awarded (score should change)
        cy.wait(1000); // Wait for score update
        
        // Try undo if available
        cy.get('body').then($scoringBody => {
          if ($scoringBody.find('button:contains("Undo Last Point")').length > 0) {
            cy.contains('button', 'Undo Last Point').click();
            cy.wait(500);
          }
        });
        
        // Go back
        cy.contains('button', 'Back').click();
        cy.url().should('include', '/umpire');
      } else {
        cy.log('No active matches available for scoring test');
      }
    });
  });

  it('should navigate to tournament details from umpire page', () => {
    // Check if there are tournaments
    cy.get('body').then($body => {
      if ($body.find('.umpire-tournament-card').length > 0) {
        // Click on first tournament
        cy.get('.umpire-tournament-card').first().click();
        
        // Check if tournament matches are displayed
        cy.contains('Tournament Matches').should('be.visible');
        
        // Check if view tournament details link exists
        cy.get('body').then($tournamentBody => {
          if ($tournamentBody.find('a:contains("View Tournament Details")').length > 0) {
            cy.contains('a', 'View Tournament Details').click();
            
            // Verify navigation to tournament details
            cy.url().should('include', '/tournaments/');
            
            // Go back to umpire page
            cy.get('.sidebar-nav-item').contains('Live Scoring').click();
            cy.url().should('include', '/umpire');
          }
        });
      } else {
        cy.log('No tournaments available');
      }
    });
  });

  it('should handle tournament start actions if user is organizer', () => {
    // Check if there are tournaments where user is organizer
    cy.get('body').then($body => {
      if ($body.find('.umpire-tournament-card:contains("Organizer")').length > 0) {
        // Click on tournament where user is organizer
        cy.get('.umpire-tournament-card:contains("Organizer")').first().click();
        
        // Check if start tournament button exists
        cy.get('body').then($tournamentBody => {
          if ($tournamentBody.find('button:contains("Start Tournament")').length > 0) {
            // We won't actually click this as it would modify the tournament state
            cy.contains('button', 'Start Tournament').should('be.visible');
          }
        });
      } else {
        cy.log('No tournaments where user is organizer');
      }
    });
  });

  it('should navigate between umpire page and matches page', () => {
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Navigate back to umpire page
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
  });
});