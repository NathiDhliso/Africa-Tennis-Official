# Using Supabase Generated Types

This guide shows how to use the newly generated Supabase types in your application.

## Import the Types

```typescript
import type { Database } from './types/supabase-generated'
```

## Common Type Definitions

```typescript
// Table row types
type Profile = Database['public']['Tables']['profiles']['Row']
type Match = Database['public']['Tables']['matches']['Row']
type Tournament = Database['public']['Tables']['tournaments']['Row']

// Insert types (for creating new records)
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
type MatchInsert = Database['public']['Tables']['matches']['Insert']
type TournamentInsert = Database['public']['Tables']['tournaments']['Insert']

// Update types (for updating existing records)
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type MatchUpdate = Database['public']['Tables']['matches']['Update']
type TournamentUpdate = Database['public']['Tables']['tournaments']['Update']

// JSON type for metadata fields
type Json = Database['public']['Tables']['matches']['Row']['score']
```

## Usage Examples

### Creating a New Profile

```typescript
const createProfile = async (profileData: ProfileInsert) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert(profileData)
    .select()
  
  if (error) throw error
  return data
}
```

### Fetching Matches with Type Safety

```typescript
const getMatches = async (): Promise<Match[]> => {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
  
  if (error) throw error
  return data || []
}
```

### Updating a Tournament

```typescript
const updateTournament = async (id: string, updates: TournamentUpdate) => {
  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
  
  if (error) throw error
  return data
}
```

## Benefits

- **Type Safety**: All database operations are now fully type-safe
- **IntelliSense**: Get autocomplete for all table columns and relationships
- **Error Prevention**: Catch type mismatches at compile time
- **Documentation**: Types serve as living documentation of your database schema

## Files Updated

The following files have been updated to use the new generated types:

- `src/lib/supabase.ts` - Main Supabase client
- `src/stores/authStore.ts` - Authentication store
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/hooks/useMatchMutations.ts` - Match mutations hook
- `src/hooks/useTournamentMutations.ts` - Tournament mutations hook
- `src/hooks/useMatches.ts` - Matches hook
- `src/components/profile/ProfileForm.tsx` - Profile form component
- `src/components/matches/CreateMatchModal.tsx` - Create match modal
- `src/components/matches/MatchDetails.tsx` - Match details component
- `src/components/matches/MatchScoring.tsx` - Match scoring component
- `src/components/tournaments/TournamentDetails.tsx` - Tournament details
- `src/components/ai-coach/PlayerAnalysisSection.tsx` - AI coach component
- `src/components/video/VideoTrackingPanel.tsx` - Video tracking panel
- `src/pages/AICoachPage.tsx` - AI coach page
- `src/pages/UmpirePage.tsx` - Umpire page

## Regenerating Types

To regenerate types after database schema changes:

```bash
npx supabase gen types typescript --project-id ppuqbimzeplznqdchvve > src/types/supabase-generated.ts
```