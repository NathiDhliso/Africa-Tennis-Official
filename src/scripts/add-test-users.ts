import { supabase } from '../lib/supabase';

// Test users to add
const testUsers = [
  {
    email: 'm.j.motsusi@gmail.com',
    username: 'mjmotsusi',
    password: 'TestPassword123!',
    skill_level: 'intermediate',
    elo_rating: 1450,
    matches_played: 12,
    matches_won: 7,
    bio: 'Tennis enthusiast from Johannesburg. Loves to play on clay courts.'
  },
  {
    email: 'rabelani.ramaru822305@gmail.com',
    username: 'rabelani',
    password: 'TestPassword123!',
    skill_level: 'advanced',
    elo_rating: 1680,
    matches_played: 25,
    matches_won: 18,
    bio: 'Competitive player with 5 years of experience. Prefers hard courts.'
  },
  {
    email: 'nkosimano@gmail.com',
    username: 'nkosimano',
    password: 'TestPassword123!',
    skill_level: 'intermediate',
    elo_rating: 1520,
    matches_played: 15,
    matches_won: 9,
    bio: 'Tennis player from Pretoria. Specializes in serve and volley.'
  },
  {
    email: 'dhilsob@gmail.com',
    username: 'dhilsob',
    password: 'TestPassword123!',
    skill_level: 'beginner',
    elo_rating: 1320,
    matches_played: 8,
    matches_won: 3,
    bio: 'New to competitive tennis. Working on improving backhand.'
  },
  {
    email: '1hourphilss@gmail.com',
    username: '1hourphilss',
    password: 'TestPassword123!',
    skill_level: 'advanced',
    elo_rating: 1750,
    matches_played: 30,
    matches_won: 22,
    bio: 'Tournament player with strong baseline game. Prefers grass courts.'
  }
];

/**
 * Adds test users to the database
 */
async function addTestUsers() {
  console.log('Starting to add test users...');
  
  for (const user of testUsers) {
    try {
      console.log(`Processing user: ${user.email}`);
      
      // Create user in auth system
      console.log(`Creating auth user: ${user.email}`);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });
      
      if (authError) {
        // If user already exists, try to get existing user
        if (authError.message.includes('already registered')) {
          console.log(`User ${user.email} already exists in auth system.`);
          // For existing users, we'll need to get the user ID differently
          // Since we can't easily get by email, we'll skip this user
          console.log(`Skipping ${user.email} - cannot get existing user ID without email lookup`);
          continue;
        } else {
          console.error(`Error creating auth user ${user.email}:`, authError);
          continue;
        }
      }
      
      if (!authData?.user) {
        console.error(`No user data returned for ${user.email}`);
        continue;
      }
      
      const userId = authData.user.id;
      console.log(`Auth user created: ${userId}`);
      
      // userId is already set above
      
      // Check if profile already exists
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error(`Error checking profile for ${user.email}:`, profileCheckError);
        continue;
      }
      
      if (existingProfile) {
        console.log(`Profile for ${user.email} already exists. Updating...`);
        
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            username: user.username,
            elo_rating: user.elo_rating,
            matches_played: user.matches_played,
            matches_won: user.matches_won,
            skill_level: user.skill_level,
            bio: user.bio,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error(`Error updating profile for ${user.email}:`, updateError);
          continue;
        }
        
        console.log(`Profile updated for ${user.email}`);
      } else {
        console.log(`Creating profile for ${user.email}`);
        
        // Create profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            username: user.username,
            elo_rating: user.elo_rating,
            matches_played: user.matches_played,
            matches_won: user.matches_won,
            skill_level: user.skill_level,
            bio: user.bio,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error(`Error creating profile for ${user.email}:`, insertError);
          continue;
        }
        
        console.log(`Profile created for ${user.email}`);
      }
      
      console.log(`User ${user.email} processed successfully`);
    } catch (error) {
      console.error(`Unexpected error processing user ${user.email}:`, error);
    }
  }
  
  console.log('Finished adding test users');
}

// Run the function
addTestUsers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });