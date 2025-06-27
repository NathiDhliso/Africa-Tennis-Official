import { format } from 'date-fns';

describe('Africa Tennis Platform E2E Test', () => {
  // Test credentials
  const testUser = {
    email: 'nkosimano@gmail.com',
    password: 'Magnox271991!',
    username: 'nkosimano'
  };

  // Additional test users for tournaments and matches
  const testUsers = [
    { email: 'rabelani.ramaru822305@gmail.com', username: 'rabelani' },
    { email: 'dhilsob@gmail.com', username: 'dhilsob' },
    { email: '1hourphilss@gmail.com', username: '1hourphilss' },
    { email: 'm.j.motsusi@gmail.com', username: 'mjmotsusi' }
  ];

  // Reusable function to login
  const login = () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Wait for login to complete and redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome back').should('be.visible');
  };

  beforeEach(() => {
    // Clear local storage between tests
    cy.clearLocalStorage();
  });

  it('should successfully login with valid credentials', () => {
    cy.visit('/login');
    
    // Check login form elements
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
    
    // Fill in login form
    cy.get('input[type="email"]').type(testUser.email);
    cy.get('input[type="password"]').type(testUser.password);
    cy.get('button[type="submit"]').click();
    
    // Verify successful login
    cy.url().should('include', '/dashboard');
    cy.contains('Welcome back').should('be.visible');
  });

  it('should show validation errors with invalid login credentials', () => {
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

  it('should navigate through the sidebar menu', () => {
    login();
    
    // Check sidebar navigation
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    cy.get('.sidebar-nav-item').contains('Tournaments').click();
    cy.url().should('include', '/tournaments');
    
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
    
    cy.get('.sidebar-nav-item').contains('Ratings & Rankings').click();
    cy.url().should('include', '/rankings');
    
    cy.get('.sidebar-nav-item').contains('Dashboard').click();
    cy.url().should('include', '/dashboard');
  });

  it('should toggle theme between light and dark mode', () => {
    login();
    
    // Check initial theme (likely dark by default)
    cy.get('body').should('have.class', 'theme-dark');
    
    // Toggle theme
    cy.get('.sidebar-theme-button').click();
    cy.get('body').should('have.class', 'theme-light');
    
    // Toggle back
    cy.get('.sidebar-theme-button').click();
    cy.get('body').should('have.class', 'theme-dark');
  });

  it('should create a new match with test users', () => {
    login();
    
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Click create match button
    cy.contains('button', 'Create Match').click();
    
    // Verify modal is open
    cy.contains('Create New Match').should('be.visible');
    
    // Search for one of our test users
    cy.get('.search-input').type('rabelani');
    cy.wait(1000); // Wait for search results
    
    // Select the test user if available
    cy.get('body').then($body => {
      if ($body.find('.player-search-item:contains("rabelani")').length > 0) {
        cy.get('.player-search-item:contains("rabelani")').first().click();
        
        // Fill in match details
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Format date as YYYY-MM-DD for input
        const formattedDate = format(tomorrow, 'yyyy-MM-dd');
        cy.get('input[type="date"]').type(formattedDate);
        
        // Set time to 10:00 AM
        cy.get('input[type="time"]').type('10:00');
        
        // Set location
        cy.get('input#location').type('Center Court, Johannesburg');
        
        // Select court type
        cy.get('select#courtType').select('clay');
        
        // Submit the form
        cy.contains('button', 'Create Match').click();
        
        // Verify match was created (may take a moment)
        cy.contains('Center Court, Johannesburg').should('exist');
      } else {
        // Try another test user
        cy.get('.search-input').clear().type('dhilsob');
        cy.wait(1000);
        
        if ($body.find('.player-search-item:contains("dhilsob")').length > 0) {
          cy.get('.player-search-item:contains("dhilsob")').first().click();
          
          // Fill in match details
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          // Format date as YYYY-MM-DD for input
          const formattedDate = format(tomorrow, 'yyyy-MM-dd');
          cy.get('input[type="date"]').type(formattedDate);
          
          // Set time to 10:00 AM
          cy.get('input[type="time"]').type('10:00');
          
          // Set location
          cy.get('input#location').type('Center Court, Johannesburg');
          
          // Select court type
          cy.get('select#courtType').select('clay');
          
          // Submit the form
          cy.contains('button', 'Create Match').click();
          
          // Verify match was created (may take a moment)
          cy.contains('Center Court, Johannesburg').should('exist');
        } else {
          cy.log('No test users found in search results');
          // Close the modal
          cy.get('.modal-close').click();
        }
      }
    });
  });

  it('should create a tournament with test users as participants', () => {
    login();
    
    // Navigate to tournaments page
    cy.get('.sidebar-nav-item').contains('Tournaments').click();
    cy.url().should('include', '/tournaments');
    
    // Click create tournament button
    cy.contains('button', 'Create Tournament').click();
    
    // Verify modal is open
    cy.contains('Create Tournament').should('be.visible');
    
    // Fill in tournament details
    const tournamentName = `Test Tournament with Users ${Date.now().toString().slice(-6)}`;
    cy.get('input#name').type(tournamentName);
    cy.get('textarea#description').type('This is a test tournament with specific test users as participants');
    
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
    
    // Select tournament format
    cy.contains('Round Robin').click();
    
    // Set max participants to include our test users
    cy.get('select#maxParticipants').select('8');
    
    // Set location
    cy.get('input#location').type('Johannesburg Tennis Club - Test Court');
    
    // Submit the form
    cy.contains('button', 'Create Tournament').click();
    
    // Verify tournament was created (may take a moment)
    cy.contains(tournamentName).should('exist');
  });

  it('should view and filter matches with test users', () => {
    login();
    
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Test search functionality for test users
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

  it('should test live scoring with test users', () => {
    login();
    
    // Navigate to umpire page
    cy.get('.sidebar-nav-item').contains('Live Scoring').click();
    cy.url().should('include', '/umpire');
    
    // Check if there are active matches with test users
    cy.get('body').then($body => {
      testUsers.forEach(user => {
        if ($body.find(`.umpire-match-player:contains("${user.username}")`).length > 0) {
          cy.log(`Found match with test user: ${user.username}`);
          
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
          
          return false; // Break the forEach loop
        }
      });
    });
  });

  it('should view tournament participants including test users', () => {
    login();
    
    // Navigate to tournaments page
    cy.get('.sidebar-nav-item').contains('Tournaments').click();
    cy.url().should('include', '/tournaments');
    
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
        cy.get('body').then($detailsBody => {
          testUsers.forEach(user => {
            if ($detailsBody.find(`:contains("${user.username}")`).length > 0) {
              cy.log(`Found test user ${user.username} as participant`);
            }
          });
        });
        
        // Go back to tournaments list
        cy.contains('button', /Back|Go Back/).click();
        cy.url().should('include', '/tournaments');
      } else {
        cy.log('No tournaments available to check participants');
      }
    });
  });

  it('should view rankings and find test users', () => {
    login();
    
    // Navigate to rankings page
    cy.get('.sidebar-nav-item').contains('Ratings & Rankings').click();
    cy.url().should('include', '/rankings');
    
    // Search for each test user in rankings
    testUsers.forEach(user => {
      cy.get('.search-input').clear().type(user.username);
      cy.wait(500);
      
      // Check if user is found in rankings
      cy.get('body').then($body => {
        if ($body.find(`.player-name:contains("${user.username}")`).length > 0) {
          cy.log(`Found test user ${user.username} in rankings`);
        }
      });
    });
    
    // Clear search
    cy.get('.search-input').clear();
  });

  it('should test match summary generation with test users', () => {
    login();
    
    // Navigate to matches page
    cy.get('.sidebar-nav-item').contains('My Matches').click();
    cy.url().should('include', '/matches');
    
    // Find a completed match with a test user
    let foundTestUserMatch = false;
    
    cy.get('body').then($body => {
      // Check for completed matches with test users
      testUsers.forEach(user => {
        if ($body.find(`.card:contains("${user.username}"):contains("Completed")`).length > 0 && !foundTestUserMatch) {
          foundTestUserMatch = true;
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
      
      if (!foundTestUserMatch) {
        cy.log('No completed matches with test users found');
      }
    });
  });

  it('should sign out successfully', () => {
    login();
    
    // Click sign out button
    cy.contains('Sign Out').click();
    
    // Verify redirect to login page
    cy.url().should('include', '/login');
    
    // Verify login form is visible
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });
});