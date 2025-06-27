describe('Tournaments Feature', () => {
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
    
    // Navigate to tournaments page
    cy.get('.sidebar-nav-item').contains('Tournaments').click();
    cy.url().should('include', '/tournaments');
  });

  it('should display tournaments page with all sections', () => {
    // Check page title
    cy.contains('Tournaments').should('be.visible');
    
    // Check create tournament button
    cy.contains('button', 'Create Tournament').should('be.visible');
    
    // Check search and filter controls
    cy.get('.tournaments-search-input').should('be.visible');
    cy.get('.tournaments-filter-select').should('be.visible');
  });

  it('should create a new tournament', () => {
    // Click create tournament button
    cy.contains('button', 'Create Tournament').click();
    
    // Verify modal is open
    cy.contains('Create Tournament').should('be.visible');
    
    // Fill in tournament details
    const tournamentName = `Cypress Test Tournament ${Date.now().toString().slice(-6)}`;
    cy.get('input#name').type(tournamentName);
    cy.get('textarea#description').type('This is a test tournament created by Cypress');
    
    // Set tournament schedule
    cy.contains('button', /Set Tournament Schedule|Modify Schedule/).click();
    
    // Select dates in the calendar
    // This is complex due to the custom calendar, so we'll use a simplified approach
    cy.get('.calendar-date').not('.disabled').not('.other-month').first().click();
    
    // Set time in the time selector
    cy.get('.time-input').first().select('10');
    cy.get('.time-input').eq(1).select('00');
    cy.contains('button', 'Confirm Time').click();
    
    // Select end date (a week later)
    cy.get('.calendar-tab').eq(1).click(); // Click on End Date tab
    cy.get('.calendar-date').not('.disabled').not('.other-month').eq(7).click();
    
    // Set time for end date
    cy.get('.time-input').first().select('18');
    cy.get('.time-input').eq(1).select('00');
    cy.contains('button', 'Confirm Time').click();
    
    // Save the schedule
    cy.contains('button', /Save Changes|Confirm Schedule/).click();
    
    // Select tournament format
    cy.contains('Single Elimination').click();
    
    // Set max participants
    cy.get('select#maxParticipants').select('8');
    
    // Set location
    cy.get('input#location').type('Johannesburg Tennis Club');
    
    // Submit the form
    cy.contains('button', 'Create Tournament').click();
    
    // Verify tournament was created (may take a moment)
    cy.contains(tournamentName).should('exist');
  });

  it('should filter tournaments by status and search', () => {
    // Test status filter
    cy.get('.tournaments-filter-select').select('registration_open');
    cy.wait(500);
    
    // Check if any tournaments are displayed
    cy.get('body').then($body => {
      if ($body.find('.tournaments-grid .tournament-card-minimal').length > 0) {
        // Verify all visible tournaments have "Open" status
        cy.get('.tournaments-grid .tournament-card-minimal').each($card => {
          cy.wrap($card).contains('Open').should('be.visible');
        });
      } else {
        cy.contains('No Tournaments Found').should('be.visible');
      }
    });
    
    // Reset filter
    cy.get('.tournaments-filter-select').select('all');
    
    // Test search functionality
    cy.get('.tournaments-search-input').type('tennis');
    cy.wait(500);
    
    // Clear search
    cy.get('.tournaments-search-input').clear();
  });

  it('should view tournament details and navigate through tabs', () => {
    // Check if any tournaments exist
    cy.get('body').then($body => {
      if ($body.find('.tournaments-grid .tournament-card-minimal').length > 0) {
        // Click on the first tournament
        cy.get('.tournaments-grid .tournament-card-minimal').first().within(() => {
          cy.contains('button', 'Details').click();
        });
        
        // Verify tournament details page
        cy.contains('Tournament Schedule').should('be.visible');
        
        // Navigate through tabs
        cy.contains('button', 'Players').click();
        cy.contains('Players').should('be.visible');
        
        // Check if tournament has bracket or matches tab
        cy.get('body').then($detailsBody => {
          if ($detailsBody.find('button:contains("Bracket")').length > 0) {
            cy.contains('button', 'Bracket').click();
            cy.wait(500);
          } else if ($detailsBody.find('button:contains("Matches")').length > 0) {
            cy.contains('button', 'Matches').click();
            cy.wait(500);
          }
        });
        
        // Go back to overview tab
        cy.contains('button', 'Overview').click();
        
        // Go back to tournaments list
        cy.contains('button', /Back|Go Back/).click();
        cy.url().should('include', '/tournaments');
      } else {
        cy.log('No tournaments available to test details view');
      }
    });
  });

  it('should register for a tournament if available', () => {
    // Find a tournament with open registration that user is not registered for
    cy.get('body').then($body => {
      // Check if there are any open registration tournaments
      const hasOpenTournaments = $body.find('.tournament-card-minimal:contains("Open")').length > 0;
      
      if (hasOpenTournaments) {
        // Find a tournament that doesn't show "Registered" badge
        cy.get('.tournament-card-minimal:contains("Open")').each($card => {
          if (!$card.text().includes('Registered')) {
            // Check if it has a Register button
            if ($card.find('button:contains("Register")').length > 0) {
              cy.wrap($card).within(() => {
                cy.contains('button', 'Register').click();
              });
              
              // Verify registration (should show Registered badge or success message)
              cy.contains('Registered').should('be.visible');
              return false; // Break the each loop
            }
          }
        });
      } else {
        cy.log('No open tournaments available for registration');
      }
    });
  });

  it('should test tournament organizer actions if applicable', () => {
    // Find a tournament where the user is the organizer
    cy.get('body').then($body => {
      // Check if there are any tournaments where user might be organizer
      if ($body.find('.tournaments-grid .tournament-card-minimal').length > 0) {
        // Click on tournaments to check if user is organizer
        cy.get('.tournaments-grid .tournament-card-minimal').each($card => {
          cy.wrap($card).within(() => {
            cy.contains('button', 'Details').click();
          });
          
          // Check if organizer actions are available
          cy.get('body').then($detailsBody => {
            const isOrganizer = $detailsBody.find('button:contains("Close Registration")').length > 0 || 
                               $detailsBody.find('button:contains("Generate Bracket")').length > 0 ||
                               $detailsBody.find('button:contains("Start Tournament")').length > 0;
            
            if (isOrganizer) {
              cy.log('User is an organizer for this tournament');
              
              // Test organizer actions if available
              if ($detailsBody.find('button:contains("Generate Bracket")').length > 0) {
                cy.contains('button', 'Generate Bracket').should('be.visible');
                // Note: We won't actually click this as it would modify the tournament state
              }
              
              // Go back to tournaments list
              cy.contains('button', /Back|Go Back/).click();
              cy.url().should('include', '/tournaments');
              return false; // Break the each loop
            } else {
              // Go back to tournaments list
              cy.contains('button', /Back|Go Back/).click();
              cy.url().should('include', '/tournaments');
            }
          });
        });
      } else {
        cy.log('No tournaments available to test organizer actions');
      }
    });
  });
});