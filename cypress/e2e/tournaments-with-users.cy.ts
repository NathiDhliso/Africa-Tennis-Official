describe('Tournaments with Test Users', () => {
  // Test credentials
  const testUser = {
    email: 'nkosimano@gmail.com',
    password: 'Magnox271991!',
    username: 'nkosimano'
  };

  // Additional test users for tournaments
  const testUsers = [
    { email: 'rabelani.ramaru822305@gmail.com', username: 'rabelani' },
    { email: 'dhilsob@gmail.com', username: 'dhilsob' },
    { email: '1hourphilss@gmail.com', username: '1hourphilss' },
    { email: 'm.j.motsusi@gmail.com', username: 'mjmotsusi' }
  ];

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

  it('should create a tournament with specific test users in mind', () => {
    // Click create tournament button
    cy.contains('button', 'Create Tournament').click();
    
    // Verify modal is open
    cy.contains('Create Tournament').should('be.visible');
    
    // Fill in tournament details
    const tournamentName = `Test Users Tournament ${Date.now().toString().slice(-6)}`;
    cy.get('input#name').type(tournamentName);
    cy.get('textarea#description').type(`This tournament is specifically created for testing with users: ${testUsers.map(u => u.username).join(', ')}`);
    
    // Set tournament schedule
    cy.contains('button', /Set Tournament Schedule|Modify Schedule/).click();
    
    // Select dates in the calendar
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
    
    // Select tournament format (Round Robin works well for testing with specific users)
    cy.contains('Round Robin').click();
    
    // Set max participants to match our test users plus organizer
    cy.get('select#maxParticipants').select('8');
    
    // Set location
    cy.get('input#location').type('Test Users Tennis Club, Johannesburg');
    
    // Submit the form
    cy.contains('button', 'Create Tournament').click();
    
    // Verify tournament was created (may take a moment)
    cy.contains(tournamentName).should('exist');
  });

  it('should search for tournaments containing test users', () => {
    // Search for tournaments that might contain our test users
    testUsers.forEach(user => {
      cy.get('.tournaments-search-input').clear().type(user.username);
      cy.wait(500);
      
      // Check if any tournaments with this user are found
      cy.get('body').then($body => {
        if ($body.find('.tournament-card-minimal').length > 0) {
          cy.log(`Found tournaments related to test user: ${user.username}`);
        }
      });
    });
    
    // Clear search
    cy.get('.tournaments-search-input').clear();
  });

  it('should check tournament participants for test users', () => {
    // Check if any tournaments exist
    cy.get('body').then($body => {
      if ($body.find('.tournaments-grid .tournament-card-minimal').length > 0) {
        // Click on the first tournament
        cy.get('.tournaments-grid .tournament-card-minimal').first().within(() => {
          cy.contains('button', 'Details').click();
        });
        
        // Navigate to participants tab
        cy.contains('button', 'Players').click();
        
        // Check if any of our test users are participants
        let foundTestUsers = false;
        cy.get('body').then($detailsBody => {
          testUsers.forEach(user => {
            if ($detailsBody.find(`:contains("${user.username}")`).length > 0) {
              cy.log(`Found test user ${user.username} as participant`);
              foundTestUsers = true;
            }
          });
          
          if (!foundTestUsers) {
            cy.log('None of the test users are participants in this tournament');
          }
        });
        
        // Go back to tournaments list
        cy.contains('button', /Back|Go Back/).click();
        cy.url().should('include', '/tournaments');
      } else {
        cy.log('No tournaments available to check participants');
      }
    });
  });

  it('should manually start a tournament with test users if possible', () => {
    // Find a tournament where the user is the organizer
    cy.get('body').then($body => {
      if ($body.find('.tournaments-grid .tournament-card-minimal').length > 0) {
        // Click on tournaments to check if user is organizer
        cy.get('.tournaments-grid .tournament-card-minimal').each($card => {
          // Check if this tournament might contain our test users
          let containsTestUser = false;
          testUsers.forEach(user => {
            if ($card.text().includes(user.username)) {
              containsTestUser = true;
            }
          });
          
          if (containsTestUser) {
            cy.wrap($card).within(() => {
              cy.contains('button', 'Details').click();
            });
            
            // Check if organizer actions are available
            cy.get('body').then($detailsBody => {
              const isOrganizer = $detailsBody.find('button:contains("Close Registration")').length > 0 || 
                                $detailsBody.find('button:contains("Generate Bracket")').length > 0 ||
                                $detailsBody.find('button:contains("Start Tournament")').length > 0;
              
              if (isOrganizer) {
                cy.log('User is an organizer for this tournament with test users');
                
                // Check if we can start the tournament
                if ($detailsBody.find('button:contains("Close Registration")').length > 0) {
                  // Note: We won't actually click this as it would modify the tournament state
                  cy.contains('button', 'Close Registration').should('be.visible');
                  cy.log('Tournament with test users can be started');
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
          }
        });
      } else {
        cy.log('No tournaments available to test with test users');
      }
    });
  });

  it('should check tournament brackets for matches with test users', () => {
    // Find tournaments in progress
    cy.get('body').then($body => {
      if ($body.find('.tournament-card-minimal:contains("In Progress")').length > 0) {
        // Click on the first in-progress tournament
        cy.get('.tournament-card-minimal:contains("In Progress")').first().within(() => {
          cy.contains('button', 'Details').click();
        });
        
        // Check if this tournament has bracket or matches tab
        cy.get('body').then($detailsBody => {
          if ($detailsBody.find('button:contains("Bracket")').length > 0) {
            cy.contains('button', 'Bracket').click();
            
            // Check if any matches contain our test users
            testUsers.forEach(user => {
              if ($detailsBody.find(`:contains("${user.username}")`).length > 0) {
                cy.log(`Found test user ${user.username} in tournament bracket`);
              }
            });
          } else if ($detailsBody.find('button:contains("Matches")').length > 0) {
            cy.contains('button', 'Matches').click();
            
            // Check if any matches contain our test users
            testUsers.forEach(user => {
              if ($detailsBody.find(`:contains("${user.username}")`).length > 0) {
                cy.log(`Found test user ${user.username} in tournament matches`);
              }
            });
          }
        });
        
        // Go back to tournaments list
        cy.contains('button', /Back|Go Back/).click();
        cy.url().should('include', '/tournaments');
      } else {
        cy.log('No in-progress tournaments to check for test users in brackets');
      }
    });
  });
});