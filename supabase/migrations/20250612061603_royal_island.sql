/*
  # Remove Social Tables

  1. Changes
    - Drop clubs, club_members, and followers tables
    - Remove related foreign keys and constraints
    - Remove related policies

  This migration removes the social features tables that are not needed for the core functionality.
*/

-- Drop club_members table (must be dropped first due to foreign key constraints)
DROP TABLE IF EXISTS public.club_members;

-- Drop clubs table
DROP TABLE IF EXISTS public.clubs;

-- Drop followers table
DROP TABLE IF EXISTS public.followers;

-- Remove related indexes (if they still exist)
DROP INDEX IF EXISTS idx_club_members_club;
DROP INDEX IF EXISTS idx_club_members_user;
DROP INDEX IF EXISTS idx_followers_follower;
DROP INDEX IF EXISTS idx_followers_followed;

-- Note: The triggers for these tables are automatically dropped when the tables are dropped