describe('Matches with Test Users', () => {
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
    
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
  });

  it('should create matches with each test user', () => {
    // Try to create a match with each test user
    testUsers.forEach((user, index) => {
      // Only test the first two users to avoid creating too many matches
      if (index < 2) {
        // Click create match button
        cy.contains('button', 'Create Match').click();
        
        // Verify modal is open
        cy.contains('Create New Match').should('be.visible');
        
        // Search for the test user
        cy.get('.search-input').type(user.username);
        cy.wait(1000); // Wait for search results
        
        // Check if user is found
        cy.get('body').then($body => {
          if ($body.find(`.player-search-item:contains("${user.username}")`).length > 0) {
            // Select the user
            cy.get(`.player-search-item:contains("${user.username}")`).first().click();
            
            // Fill in match details
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1 + index); // Different day for each user
            
            // Format date as YYYY-MM-DD for input
            const formattedDate = format(tomorrow, 'yyyy-MM-dd');
            cy.get('input[type="date"]').type(formattedDate);
            
            // Set time
            cy.get('input[type="time"]').type(`1${index}:00`); // Different time for each user
            
            // Set location
            cy.get('input#location').type(`Test Match with ${user.username}, Court ${index + 1}`);
            
            // Select court type
            const courtTypes = ['hard', 'clay', 'grass', 'indoor'];
            cy.get('select#courtType').select(courtTypes[index % courtTypes.length]);
            
            // Add notes
            cy.get('textarea#notes').type(`Test match with ${user.username} created by Cypress`);
            
            // Submit the form
            cy.contains('button', 'Create Match').click();
            
            // Verify match was created
            cy.contains(`Test Match with ${user.username}`).should('exist');
          } else {
            cy.log(`Test user ${user.username} not found in search results`);
            // Close the modal
            cy.get('.modal-close').click();
          }
        });
      }
    });
  });

  it('should search for matches with test users', () => {
    // Search for matches with each test user
    testUsers.forEach(user => {
      cy.get('.search-input').clear().type(user.username);
      cy.wait(500);
      
      // Check if any matches with this user are found
      cy.get('body').then($body => {
        if ($body.find(`.card:contains("${user.username}")`).length > 0) {
          cy.log(`Found matches with test user: ${user.username}`);
        }
      });
    });
    
    // Clear search
    cy.get('.search-input').clear();
  });

  it('should view match details with test users', () => {
    // Find matches with test users
    let foundTestUserMatch = false;
    
    testUsers.forEach(user => {
      if (!foundTestUserMatch) {
        cy.get('.search-input').clear().type(user.username);
        cy.wait(500);
        
        cy.get('body').then($body => {
          if ($body.find(`.card:contains("${user.username}")`).length > 0 && !foundTestUserMatch) {
            foundTestUserMatch = true;
            
            // Click on the match
            cy.get(`.card:contains("${user.username}")`).first().click();
            
            // Verify match details page
            cy.contains(user.username).should('be.visible');
            cy.contains('Match Details').should('be.visible');
            
            // Check match information sections
            cy.contains('Date & Time').should('be.visible');
            cy.contains('Location').should('be.visible');
            cy.contains('Status').should('be.visible');
            
            // Go back to matches list
            cy.contains('button', /Back|Go Back/).click();
            cy.url().should('include', '/matches');
          }
        });
      }
    });
    
    if (!foundTestUserMatch) {
      cy.log('No matches with test users found to view details');
    }
  });

  it('should handle match actions with test users', () => {
    // Find pending matches with test users where current user is challenged
    let foundPendingMatch = false;
    
    testUsers.forEach(user => {
      if (!foundPendingMatch) {
        cy.get('.search-input').clear().type(user.username);
        cy.wait(500);
        
        cy.get('body').then($body => {
          // Look for pending matches where the test user challenged the current user
          if ($body.find(`.card:contains("${user.username}"):contains("Pending"):contains("Challenged you")`).length > 0 && !foundPendingMatch) {
            foundPendingMatch = true;
            
            // Click on the match
            cy.get(`.card:contains("${user.username}"):contains("Pending"):contains("Challenged you")`).first().click();
            
            // Check if accept/decline buttons are present
            cy.get('body').then($matchBody => {
              if ($matchBody.find('button:contains("Accept Match")').length > 0) {
                // Test accept match functionality
                cy.contains('button', 'Accept Match').click();
                cy.contains('In Progress').should('be.visible');
              }
            });
            
            // Go back to matches list
            cy.contains('button', /Back|Go Back/).click();
            cy.url().should('include', '/matches');
          }
        });
      }
    });
    
    if (!foundPendingMatch) {
      cy.log('No pending matches with test users found to test actions');
    }
  });

  it('should test live scoring with test users', () => {
    // Navigate to umpire page
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
    
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
            
            // Select a point type
            cy.contains('Point Type').parent().within(() => {
              cy.contains('button', 'Ace').click();
            });
            
            // Award a point to a player
            cy.contains('button', /Point for/).first().click();
            
            // Go back
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

  it('should generate match summary for completed matches with test users', () => {
    // Find completed matches with test users
    let foundCompletedMatch = false;
    
    testUsers.forEach(user => {
      if (!foundCompletedMatch) {
        cy.get('.search-input').clear().type(user.username);
        cy.wait(500);
        
        cy.get('body').then($body => {
          if ($body.find(`.card:contains("${user.username}"):contains("Completed")`).length > 0 && !foundCompletedMatch) {
            foundCompletedMatch = true;
            cy.log(`Found completed match with test user: ${user.username}`);
            
            // Click on the match
            cy.get(`.card:contains("${user.username}"):contains("Completed")`).first().click();
            
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
          }
        });
      }
    });
    
    if (!foundCompletedMatch) {
      cy.log('No completed matches with test users found to test summary generation');
    }
  });

  it('should report score for matches with test users', () => {
    // Find in-progress matches with test users
    let foundInProgressMatch = false;
    
    testUsers.forEach(user => {
      if (!foundInProgressMatch) {
        cy.get('.search-input').clear().type(user.username);
        cy.wait(500);
        
        cy.get('body').then($body => {
          if ($body.find(`.card:contains("${user.username}"):contains("In Progress")`).length > 0 && !foundInProgressMatch) {
            foundInProgressMatch = true;
            cy.log(`Found in-progress match with test user: ${user.username}`);
            
            // Click on Report Score button
            cy.get(`.card:contains("${user.username}"):contains("In Progress")`).first().within(() => {
              if (cy.get('button:contains("Report Score")').length > 0) {
                cy.contains('button', 'Report Score').click();
              }
            });
            
            // Check if score modal appears
            cy.get('body').then($modalBody => {
              if ($modalBody.find('.modal:contains("Report Match Score")').length > 0) {
                // Set scores
                // Increase score for current user
                cy.get('.modal').within(() => {
                  cy.get('button:contains("+")').first().click().click().click();
                  
                  // Increase score for opponent (but less)
                  cy.get('button:contains("+")').eq(2).click();
                  
                  // Don't actually submit to avoid changing match state
                  cy.get('button:contains("Cancel")').click();
                });
              }
            });
          }
        });
      }
    });
    
    if (!foundInProgressMatch) {
      cy.log('No in-progress matches with test users found to test score reporting');
    }
  });
});