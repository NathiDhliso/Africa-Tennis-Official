describe('Rankings Feature', () => {
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
    
    // Navigate to rankings page
    cy.get('.sidebar-nav-item').contains('Ratings & Rankings').click();
    cy.url().should('include', '/rankings');
  });

  it('should display rankings page with all sections', () => {
    // Check page title
    cy.contains('Ratings & Rankings').should('be.visible');
    
    // Check search and filter controls
    cy.get('.search-input').should('be.visible');
    cy.get('.filter-group').should('have.length', 3);
    
    // Check rankings table
    cy.get('.rankings-table-header').should('be.visible');
    cy.get('.rankings-table-body').should('be.visible');
  });

  it('should search for players by name', () => {
    // Search for a player
    cy.get('.search-input').type('n');
    cy.wait(500);
    
    // Check if search results contain players with 'n' in their name
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 0) {
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.player-name').invoke('text').then(text => {
            expect(text.toLowerCase()).to.include('n');
          });
        });
      } else {
        cy.contains('No players found').should('be.visible');
      }
    });
    
    // Clear search
    cy.get('.search-input').clear();
  });

  it('should filter players by skill level', () => {
    // Filter by beginner skill level
    cy.get('.filter-group').eq(0).find('select').select('beginner');
    cy.wait(500);
    
    // Check if filtered players are all beginners
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 0) {
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.player-skill').invoke('text').then(text => {
            expect(text.toLowerCase()).to.include('beginner');
          });
        });
      } else {
        cy.contains('No players found').should('be.visible');
      }
    });
    
    // Reset filter
    cy.get('.filter-group').eq(0).find('select').select('all');
  });

  it('should sort players by different criteria', () => {
    // Sort by username
    cy.get('.filter-group').eq(1).find('select').select('username');
    cy.wait(500);
    
    // Check if players are sorted alphabetically
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 1) {
        let previousName = '';
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.player-name').invoke('text').then(text => {
            if (previousName) {
              // In descending order, current name should come before previous
              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              expect(text.toLowerCase() <= previousName.toLowerCase()).to.be.true;
            }
            previousName = text;
          });
        });
      }
    });
    
    // Change sort order to ascending
    cy.get('.filter-group').eq(2).find('select').select('asc');
    cy.wait(500);
    
    // Check if sort order changed
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 1) {
        let previousName = '';
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.player-name').invoke('text').then(text => {
            if (previousName) {
              // In ascending order, current name should come after previous
              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              expect(text.toLowerCase() >= previousName.toLowerCase()).to.be.true;
            }
            previousName = text;
          });
        });
      }
    });
    
    // Reset sorting
    cy.get('.filter-group').eq(1).find('select').select('elo_rating');
    cy.get('.filter-group').eq(2).find('select').select('desc');
  });

  it('should display player details correctly', () => {
    // Check if any players exist
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 0) {
        // Check first player's details
        cy.get('.rankings-table-row').first().within(() => {
          // Check rank
          cy.get('.rank-col').should('be.visible');
          
          // Check player info
          cy.get('.player-avatar').should('be.visible');
          cy.get('.player-name').should('be.visible');
          cy.get('.player-skill').should('be.visible');
          
          // Check rating
          cy.get('.rating-value').should('be.visible');
          
          // Check matches
          cy.get('.matches-played').should('be.visible');
          
          // Check win rate
          cy.get('.winrate-value').should('be.visible');
        });
      } else {
        cy.contains('No players found').should('be.visible');
      }
    });
  });

  it('should handle empty search results gracefully', () => {
    // Search for a player that doesn't exist
    cy.get('.search-input').type('xyznonexistentplayer');
    cy.wait(500);
    
    // Check empty state
    cy.contains('No players found').should('be.visible');
    
    // Clear search
    cy.get('.search-input').clear();
  });

  it('should combine multiple filters', () => {
    // Apply multiple filters
    cy.get('.filter-group').eq(0).find('select').select('intermediate');
    cy.get('.filter-group').eq(1).find('select').select('matches_played');
    cy.get('.filter-group').eq(2).find('select').select('desc');
    cy.wait(500);
    
    // Check if filtered players are all intermediate
    cy.get('body').then($body => {
      if ($body.find('.rankings-table-row').length > 0) {
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.player-skill').invoke('text').then(text => {
            expect(text.toLowerCase()).to.include('intermediate');
          });
        });
        
        // Check if sorted by matches played in descending order
        let previousMatches = Number.MAX_SAFE_INTEGER;
        cy.get('.rankings-table-row').each($row => {
          cy.wrap($row).find('.matches-played').invoke('text').then(text => {
            const matches = parseInt(text);
            expect(matches).to.be.at.most(previousMatches);
            previousMatches = matches;
          });
        });
      } else {
        cy.contains('No players found').should('be.visible');
      }
    });
    
    // Reset filters
    cy.get('.filter-group').eq(0).find('select').select('all');
    cy.get('.filter-group').eq(1).find('select').select('elo_rating');
    cy.get('.filter-group').eq(2).find('select').select('desc');
  });
});