import { format } from 'date-fns';

describe('Live Scoring with Test Users', () => {
  // Test credentials
  const testUser = {
    email: 'nkosimano@gmail.com',
    password: 'Magnox271991!',
    username: 'nkosimano'
  };

  // Additional test users for matches
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
    
    // Navigate to umpire page
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
  });

  it('should display live scoring dashboard with test user matches', () => {
    // Check page title
    cy.contains('Live Scoring Dashboard').should('be.visible');
    
    // Check if there are active matches with test users
    let foundTestUserMatch = false;
    
    cy.get('body').then($body => {
      testUsers.forEach(user => {
        if ($body.find(`:contains("${user.username}")`).length > 0) {
          foundTestUserMatch = true;
          cy.log(`Found match with test user: ${user.username}`);
        }
      });
      
      if (!foundTestUserMatch) {
        cy.log('No active matches with test users found');
      }
    });
  });

  it('should create a match with test user for live scoring', () => {
    // Navigate to matches page to create a match
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Click create match button
    cy.contains('button', 'Create Match').click();
    
    // Verify modal is open
    cy.contains('Create New Match').should('be.visible');
    
    // Search for a test user
    cy.get('.search-input').type('dhilsob');
    cy.wait(1000); // Wait for search results
    
    // Select the test user if available
    cy.get('body').then($body => {
      if ($body.find('.player-search-item:contains("dhilsob")').length > 0) {
        cy.get('.player-search-item:contains("dhilsob")').first().click();
        
        // Fill in match details
        const today = new Date();
        
        // Format date as YYYY-MM-DD for input
        const formattedDate = format(today, 'yyyy-MM-dd');
        cy.get('input[type="date"]').type(formattedDate);
        
        // Set time to current time
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        cy.get('input[type="time"]').type(`${hours}:${minutes}`);
        
        // Set location
        cy.get('input#location').type('Live Scoring Test Court');
        
        // Select court type
        cy.get('select#courtType').select('hard');
        
        // Submit the form
        cy.contains('button', 'Create Match').click();
        
        // Verify match was created
        cy.contains('Live Scoring Test Court').should('exist');
        
        // Navigate back to umpire page
        cy.get('.sidebar-nav-item').contains('Live Scoring').click();
        cy.url().should('include', '/umpire');
      } else {
        // Try another test user
        cy.get('.search-input').clear().type('rabelani');
        cy.wait(1000);
        
        if ($body.find('.player-search-item:contains("rabelani")').length > 0) {
          cy.get('.player-search-item:contains("rabelani")').first().click();
          
          // Fill in match details
          const today = new Date();
          
          // Format date as YYYY-MM-DD for input
          const formattedDate = format(today, 'yyyy-MM-dd');
          cy.get('input[type="date"]').type(formattedDate);
          
          // Set time to current time
          const now = new Date();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          cy.get('input[type="time"]').type(`${hours}:${minutes}`);
          
          // Set location
          cy.get('input#location').type('Live Scoring Test Court');
          
          // Select court type
          cy.get('select#courtType').select('hard');
          
          // Submit the form
          cy.contains('button', 'Create Match').click();
          
          // Verify match was created
          cy.contains('Live Scoring Test Court').should('exist');
          
          // Navigate back to umpire page
          cy.get('.sidebar-nav-item').contains('Live Scoring').click();
          cy.url().should('include', '/umpire');
        } else {
          cy.log('No test users found in search results');
          // Close the modal
          cy.get('.modal-close').click();
          
          // Navigate back to umpire page
          cy.get('.sidebar-nav-item').contains('Live Scoring').click();
          cy.url().should('include', '/umpire');
        }
      }
    });
  });

  it('should score a match with test users', () => {
    // Check if there are active matches with test users
    let foundTestUserMatch = false;
    
    cy.get('body').then($body => {
      testUsers.forEach(user => {
        if ($body.find(`:contains("${user.username}")`).length > 0 && !foundTestUserMatch) {
          foundTestUserMatch = true;
          cy.log(`Found match with test user: ${user.username}`);
          
          // Try to find a match card with this user
          if ($body.find(`.umpire-match-card:contains("${user.username}")`).length > 0) {
            // Click on the match with this test user
            cy.get(`.umpire-match-card:contains("${user.username}")`).first().within(() => {
              if (cy.get('button:contains("Umpire Match")').length > 0) {
                cy.contains('button', 'Umpire Match').click();
              } else if (cy.get('button:contains("Continue Scoring")').length > 0) {
                cy.contains('button', 'Continue Scoring').click();
              }
            });
            
            // Test scoring interface
            cy.contains('Live Scoring').should('be.visible');
            
            // Test different point types
            const pointTypes = ['Ace', 'Double Fault', 'Winner', 'Forced Error', 'Unforced Error'];
            
            // Score 5 points with different point types
            for (let i = 0; i < 5; i++) {
              // Select point type
              cy.contains('Point Type').parent().within(() => {
                cy.contains('button', pointTypes[i % pointTypes.length]).click();
              });
              
              // Award point to alternating players
              if (i % 2 === 0) {
                cy.contains('button', /Point for/).first().click();
              } else {
                cy.contains('button', /Point for/).last().click();
              }
              
              // Wait for score update
              cy.wait(1000);
            }
            
            // Try undo if available
            cy.get('body').then($scoringBody => {
              if ($scoringBody.find('button:contains("Undo Last Point")').length > 0) {
                cy.contains('button', 'Undo Last Point').click();
                cy.wait(500);
              }
            });
            
            // Go back without ending match
            cy.contains('button', 'Back').click();
            cy.url().should('include', '/umpire');
          }
        }
      });
      
      if (!foundTestUserMatch) {
        cy.log('No active matches with test users found for live scoring');
      }
    });
  });

  it('should check tournament matches with test users', () => {
    // Check if there are tournaments
    cy.get('body').then($body => {
      if ($body.find('.umpire-tournament-card').length > 0) {
        // Check each tournament for test users
        let foundTournamentWithTestUsers = false;
        
        cy.get('.umpire-tournament-card').each($tournament => {
          // Check if this tournament might contain our test users
          let containsTestUser = false;
          testUsers.forEach(user => {
            if ($tournament.text().includes(user.username)) {
              containsTestUser = true;
            }
          });
          
          if (containsTestUser && !foundTournamentWithTestUsers) {
            foundTournamentWithTestUsers = true;
            
            // Click on the tournament
            cy.wrap($tournament).click();
            
            // Check tournament matches
            cy.contains('Tournament Matches').should('be.visible');
            
            // Check if there are matches with test users
            cy.get('body').then($tournamentBody => {
              testUsers.forEach(user => {
                if ($tournamentBody.find(`:contains("${user.username}")`).length > 0) {
                  cy.log(`Found matches with test user ${user.username} in tournament`);
                }
              });
            });
          }
        });
        
        if (!foundTournamentWithTestUsers) {
          cy.log('No tournaments with test users found');
        }
      } else {
        cy.log('No tournaments available');
      }
    });
  });

  it('should test tournament start with test users if possible', () => {
    // Find a tournament where the user is the organizer
    cy.get('body').then($body => {
      if ($body.find('.umpire-tournament-card:contains("Organizer")').length > 0) {
        // Check each organizer tournament for test users
        let foundTournamentWithTestUsers = false;
        
        cy.get('.umpire-tournament-card:contains("Organizer")').each($tournament => {
          // Check if this tournament might contain our test users
          let containsTestUser = false;
          testUsers.forEach(user => {
            if ($tournament.text().includes(user.username)) {
              containsTestUser = true;
            }
          });
          
          if (containsTestUser && !foundTournamentWithTestUsers) {
            foundTournamentWithTestUsers = true;
            
            // Click on the tournament
            cy.wrap($tournament).click();
            
            // Check if start tournament button exists
            cy.get('body').then($tournamentBody => {
              if ($tournamentBody.find('button:contains("Start Tournament")').length > 0) {
                // We won't actually click this as it would modify the tournament state
                cy.contains('button', 'Start Tournament').should('be.visible');
                cy.log('Tournament with test users can be started');
              }
            });
          }
        });
        
        if (!foundTournamentWithTestUsers) {
          cy.log('No tournaments with test users where user is organizer');
        }
      } else {
        cy.log('No tournaments where user is organizer');
      }
    });
  });
});