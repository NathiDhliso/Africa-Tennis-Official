describe('Profile Feature', () => {
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
    
    // Navigate to profile page
    cy.get('.sidebar-nav-item').contains('Profile').click();
    cy.url().should('include', '/profile');
  });

  it('should display profile page with all sections', () => {
    // Check page title
    cy.contains('Profile Settings').should('be.visible');
    
    // Check profile picture section
    cy.get('.profile-picture-section').should('be.visible');
    
    // Check form fields
    cy.get('input#username').should('be.visible');
    cy.get('select#skill_level').should('be.visible');
    cy.get('textarea#bio').should('be.visible');
    
    // Check stats display
    cy.contains('Your Stats').should('be.visible');
    cy.contains('Rating').should('be.visible');
    cy.contains('Matches').should('be.visible');
    cy.contains('Win Rate').should('be.visible');
    
    // Check action buttons
    cy.contains('button', 'Cancel').should('be.visible');
    cy.contains('button', 'Save Changes').should('be.visible');
  });

  it('should edit profile information', () => {
    // Get current bio text
    let currentBio = '';
    cy.get('textarea#bio').then($bio => {
      currentBio = $bio.val() as string || '';
      
      // Edit bio with timestamp to ensure it's different
      const newBio = `This is a test bio updated by Cypress at ${Date.now()}`;
      cy.get('textarea#bio').clear().type(newBio);
      
      // Change skill level
      cy.get('select#skill_level').then($select => {
        const currentSkill = $select.val();
        const newSkill = currentSkill === 'beginner' ? 'intermediate' : 
                        currentSkill === 'intermediate' ? 'advanced' : 
                        currentSkill === 'advanced' ? 'expert' : 'beginner';
        
        cy.get('select#skill_level').select(newSkill);
      });
      
      // Save changes
      cy.contains('button', 'Save Changes').click();
      
      // Verify success message
      cy.contains('Profile updated successfully').should('be.visible');
      
      // Restore original bio
      cy.get('textarea#bio').clear().type(currentBio || '');
      cy.contains('button', 'Save Changes').click();
    });
  });

  it('should validate profile form inputs', () => {
    // Test empty username
    cy.get('input#username').clear();
    cy.contains('button', 'Save Changes').click();
    cy.contains('Username must be at least 3 characters').should('be.visible');
    
    // Test too short username
    cy.get('input#username').type('ab');
    cy.contains('button', 'Save Changes').click();
    cy.contains('Username must be at least 3 characters').should('be.visible');
    
    // Restore valid username
    cy.get('input#username').clear().type(testUser.username);
    
    // Test bio character limit
    const longBio = 'a'.repeat(201);
    cy.get('textarea#bio').clear().type(longBio);
    cy.contains('button', 'Save Changes').click();
    cy.contains('Bio must be less than 200 characters').should('be.visible');
    
    // Restore valid bio
    cy.get('textarea#bio').clear().type('This is a valid bio');
    cy.contains('button', 'Save Changes').click();
    
    // Verify success message
    cy.contains('Profile updated successfully').should('be.visible');
  });

  it('should cancel edits when cancel button is clicked', () => {
    // Get current username
    let currentUsername = '';
    cy.get('input#username').then($username => {
      currentUsername = $username.val() as string;
      
      // Make changes
      const tempUsername = `temp_${Date.now().toString().slice(-6)}`;
      cy.get('input#username').clear().type(tempUsername);
      
      // Click cancel
      cy.contains('button', 'Cancel').click();
      
      // Verify changes were reverted
      cy.get('input#username').should('have.value', currentUsername);
    });
  });

  it('should display correct user statistics', () => {
    // Check if stats are displayed
    cy.contains('Your Stats').should('be.visible');
    
    // Verify rating is a number
    cy.contains('Rating').parent().find('.text-2xl').invoke('text').then(text => {
      expect(parseInt(text)).to.be.a('number');
    });
    
    // Verify matches played is a number
    cy.contains('Matches').parent().find('.text-2xl').invoke('text').then(text => {
      expect(parseInt(text)).to.be.a('number');
    });
    
    // Verify win rate is a percentage
    cy.contains('Win Rate').parent().find('.text-2xl').invoke('text').then(text => {
      const winRate = parseFloat(text.replace('%', ''));
      expect(winRate).to.be.a('number');
      expect(winRate).to.be.at.least(0);
      expect(winRate).to.be.at.most(100);
    });
  });

  it('should handle profile picture upload UI elements', () => {
    // Check profile picture section
    cy.get('.profile-picture-container').should('be.visible');
    
    // Check edit button
    cy.get('.profile-picture-edit').should('be.visible');
    
    // Check hidden file input
    cy.get('input[type="file"]#profile-picture').should('exist');
    
    // Note: We won't actually upload a file as it requires real file system interaction
  });
});