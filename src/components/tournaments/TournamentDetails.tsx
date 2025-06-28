import React, { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, MapPin, Trophy, Users, Clock, Target, ChevronRight, CheckCircle, Play, Award, AlertTriangle, Info } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../LoadingSpinner'
import { useAuthStore } from '../../stores/authStore'
import { apiClient } from '../../lib/aws'
import ErrorDisplay from '../ErrorDisplay'
import type { Database } from '../../types/database'

type Tournament = Database['public']['Tables']['tournaments']['Row'] & {
  organizer?: { username: string; elo_rating: number }
}
type TournamentParticipant = Database['public']['Tables']['tournament_participants']['Row'] & {
  player?: { username: string; elo_rating: number }
}
type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string }
  player2?: { username: string }
  winner?: { username: string }
}

interface TournamentDetailsProps {
  tournamentId: string
  onBack: () => void
}

interface ErrorState {
  visible: boolean;
  title: string;
  message: string;
  details?: string;
  type: 'error' | 'warning' | 'info';
}

export const TournamentDetails: React.FC<TournamentDetailsProps> = ({ tournamentId, onBack }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [organizer, setOrganizer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'matches'>('overview')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isUnregistering, setIsUnregistering] = useState(false)
  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false)
  const [bracketGenerationSuccess, setBracketGenerationSuccess] = useState(false)
  const [isClosingRegistration, setIsClosingRegistration] = useState(false)
  const [error, setError] = useState<ErrorState>({
    visible: false,
    title: '',
    message: '',
    details: '',
    type: 'error'
  });
  
  const user = useAuthStore(state => state.user)

  useEffect(() => {
    const fetchTournamentDetails = async () => {
      setLoading(true)
      setError({...error, visible: false})
      try {
        // Fetch tournament data
        const { data: tournamentData, error: tournamentError } = await supabase
          .from('tournaments')
          .select(`
            *,
            organizer:profiles!tournaments_organizer_id_fkey(username, elo_rating)
          `)
          .eq('id', tournamentId)
          .single()

        if (tournamentError) throw tournamentError
        setTournament(tournamentData)
        setOrganizer(tournamentData.organizer)

        // Fetch participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('tournament_participants')
          .select(`
            *,
            player:profiles!tournament_participants_player_id_fkey(username, elo_rating)
          `)
          .eq('tournament_id', tournamentId)
          .order('seed', { ascending: true })

        if (participantsError) throw participantsError
        setParticipants(participantsData || [])

        // Check if user is registered
        if (user) {
          const isUserRegistered = (participantsData || []).some(
            p => p.player_id === user.id
          )
          setIsRegistered(isUserRegistered)
        }

        // Fetch tournament matches
        const { data: matchesData, error: matchesError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(username),
            player2:profiles!matches_player2_id_fkey(username),
            winner:profiles!matches_winner_id_fkey(username)
          `)
          .eq('tournament_id', tournamentId)
          .order('date', { ascending: true })

        if (matchesError) throw matchesError
        setMatches(matchesData || [])
      } catch (error: any) {
        console.error('Error fetching tournament details:', error)
        setError({
          visible: true,
          title: 'Error Loading Tournament',
          message: 'We couldn\'t load the tournament details.',
          details: error.message,
          type: 'error'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTournamentDetails()

    // Set up real-time subscription for tournament updates
    const tournamentSubscription = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe()
      
    // Set up real-time subscription for participants updates
    const participantsSubscription = supabase
      .channel(`tournament-participants-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe()
      
    // Set up real-time subscription for matches updates
    const matchesSubscription = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournamentId}` },
        fetchTournamentDetails
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(tournamentSubscription)
      supabase.removeChannel(participantsSubscription)
      supabase.removeChannel(matchesSubscription)
    }
  }, [tournamentId, user])

  const handleRegister = async () => {
    if (!user || !tournament) return
    setIsRegistering(true)
    setError({...error, visible: false})

    try {
      // Check if tournament is full
      if (participants.length >= tournament.max_participants) {
        throw new Error('Tournament is full')
      }

      // Check if tournament is still open for registration
      if (tournament.status !== 'registration_open') {
        throw new Error('Registration is closed for this tournament')
      }

      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          player_id: user.id
        })

      if (error) throw error

      setIsRegistered(true)
    } catch (error: any) {
      console.error('Error registering for tournament:', error)
      setError({
        visible: true,
        title: 'Registration Failed',
        message: `We couldn't register you for this tournament: ${error.message}`,
        details: error.message,
        type: 'error'
      })
    } finally {
      setIsRegistering(false)
    }
  }

  const handleUnregister = async () => {
    if (!user || !tournament) return
    setIsUnregistering(true)
    setError({...error, visible: false})

    try {
      // Check if tournament is still open for registration
      if (tournament.status !== 'registration_open') {
        throw new Error('You cannot withdraw from this tournament as it has already started')
      }

      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('player_id', user.id)

      if (error) throw error

      setIsRegistered(false)
    } catch (error: any) {
      console.error('Error unregistering from tournament:', error)
      setError({
        visible: true,
        title: 'Withdrawal Failed',
        message: `We couldn't withdraw you from this tournament: ${error.message}`,
        details: error.message,
        type: 'error'
      })
    } finally {
      setIsUnregistering(false)
    }
  }

  const handleCloseRegistration = async () => {
    if (!tournament) return
    setIsClosingRegistration(true)
    setError({...error, visible: false})

    try {
      // Update tournament status to registration_closed
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'registration_closed' })
        .eq('id', tournament.id)

      if (error) throw error

      // Wait for a moment to let the status update propagate
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Now generate the bracket
      await handleGenerateBracket()
    } catch (error: any) {
      console.error('Error closing registration:', error)
      setError({
        visible: true,
        title: 'Failed to Close Registration',
        message: `We couldn't close registration for this tournament: ${error.message}`,
        details: error.message,
        type: 'error'
      })
    } finally {
      setIsClosingRegistration(false)
    }
  }

  const handleGenerateBracket = async () => {
    if (!tournament) return
    setIsGeneratingBracket(true)
    setError({...error, visible: false})
    setBracketGenerationSuccess(false)

    try {
      // Call the AWS Lambda function to generate the tournament bracket
      const response = await apiClient.generateTournamentBracket(tournament.id)
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate bracket')
      }
      
      setBracketGenerationSuccess(true)
      
      // Refresh tournament data after a short delay
      setTimeout(() => {
        setBracketGenerationSuccess(false)
      }, 3000)
    } catch (error: any) {
      console.error('Error generating bracket:', error);
      
      // Set user-friendly error message
      setError({
        visible: true,
        title: 'Bracket Generation Failed',
        message: getTournamentErrorMessage(error.message),
        details: error.message,
        type: 'error'
      })
    } finally {
      setIsGeneratingBracket(false)
    }
  }

  // Function to get user-friendly error messages
  const getTournamentErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes('Tournament needs at least 2 participants')) {
      return 'This tournament needs at least 2 registered participants before the bracket can be generated.';
    }
    
    if (errorMessage.includes('not in registration_closed status')) {
      return 'The tournament must be in "Registration Closed" status before generating the bracket.';
    }
    
    if (errorMessage.includes('already in progress')) {
      return 'This tournament is already in progress.';
    }
    
    if (errorMessage.includes('already completed')) {
      return 'This tournament has already been completed.';
    }
    
    // Default message
    return 'We encountered an issue generating the tournament bracket. Please try again or contact support if the problem persists.';
  };

  const handleManuallyStartTournament = async () => {
    if (!tournament) return
    setIsGeneratingBracket(true)
    setError({...error, visible: false})
    setBracketGenerationSuccess(false)

    try {
      // Call the manually_start_tournament function via RPC
      const { data, error } = await supabase.rpc('manually_start_tournament', {
        tournament_id: tournament.id
      })
      
      if (error) throw error
      
      if (!data.success) {
        throw new Error(data.error || 'We encountered an issue starting the tournament. Please try again or contact support if the problem persists.')
      }
      
      setBracketGenerationSuccess(true)
      
      // Refresh tournament data after a short delay
      setTimeout(() => {
        setBracketGenerationSuccess(false)
      }, 3000)
    } catch (error: any) {
      console.error('Error starting tournament:', error)
      setError({
        visible: true,
        title: 'Tournament Start Failed',
        message: getTournamentErrorMessage(error.message),
        details: error.message,
        type: 'error'
      })
    } finally {
      setIsGeneratingBracket(false)
    }
  }

  const dismissError = () => {
    setError({...error, visible: false});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration_open':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'registration_closed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const isTournamentFull = tournament && participants.length >= tournament.max_participants
  const isUserOrganizer = tournament && user && tournament.organizer_id === user.id
  const canGenerateBracket = isUserOrganizer && 
                            tournament && 
                            (tournament.status === 'registration_closed' || 
                             (tournament.status === 'registration_open' && isTournamentFull)) && 
                            matches.length === 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner 
          size="large" 
          text="Loading tournament details..." 
          subtext="Retrieving tournament information"
        />
      </div>
    )
  }

  if (error.visible && !tournament) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-error-pink">Error: {error.message}</h3>
        <button
          onClick={onBack}
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-text-standard">Tournament not found</h3>
        <button
          onClick={onBack}
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-glass-border">
        <div className="flex items-center mb-4">
          <button
            onClick={onBack}
            className="mr-4 p-2 rounded-full hover:bg-hover-bg"
            style={{ color: 'var(--text-subtle)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-standard)' }}>{tournament.name}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(tournament.status)}`}>
            {formatStatus(tournament.status)}
            {isTournamentFull && tournament.status === 'registration_open' && ' (Full)'}
          </span>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <Calendar className="h-4 w-4 mr-2" />
            {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
          </div>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <MapPin className="h-4 w-4 mr-2" />
            {tournament.location}
          </div>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <Users className="h-4 w-4 mr-2" />
            {participants.length}/{tournament.max_participants} participants
          </div>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <Trophy className="h-4 w-4 mr-2" />
            <span className="capitalize">{tournament.format.replace('_', ' ')} format</span>
          </div>
        </div>
        
        <p style={{ color: 'var(--text-subtle)' }}>{tournament.description}</p>

        {/* Error message */}
        {error.visible && (
          <div className="mt-4">
            <ErrorDisplay
              type={error.type}
              title={error.title}
              message={error.message}
              details={error.details}
              onDismiss={dismissError}
            />
          </div>
        )}

        {/* Success message for bracket generation */}
        {bracketGenerationSuccess && (
          <div className="mt-4 p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-sm text-green-800 dark:text-green-400 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>Tournament bracket generated successfully! The tournament is now in progress.</span>
          </div>
        )}

        {/* Organizer Actions */}
        {isUserOrganizer && tournament.status === 'registration_open' && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-medium text-blue-800 dark:text-blue-400 mb-2">Organizer Actions</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              As the tournament organizer, you can manually close registration and generate the bracket.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCloseRegistration}
                disabled={isClosingRegistration || isGeneratingBracket || participants.length < 2}
                className={`btn btn-primary ${participants.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isClosingRegistration ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Closing Registration...
                  </div>
                ) : (
                  <>
                    <Clock className="h-5 w-5 mr-2" />
                    Close Registration & Generate Bracket
                  </>
                )}
              </button>
              
              <button
                onClick={handleManuallyStartTournament}
                disabled={isGeneratingBracket || isClosingRegistration || participants.length < 2}
                className={`btn btn-secondary ${participants.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingBracket ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Starting Tournament...
                  </div>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start Tournament
                  </>
                )}
              </button>
            </div>
            
            {participants.length < 2 && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-500">
                    At least 2 participants are required to start a tournament. Currently there {participants.length === 1 ? 'is' : 'are'} only {participants.length} {participants.length === 1 ? 'participant' : 'participants'}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate Bracket Button for Organizers */}
        {canGenerateBracket && (
          <div className="mt-4">
            <button
              onClick={handleGenerateBracket}
              disabled={isGeneratingBracket || participants.length < 2}
              className={`btn btn-primary ${participants.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isGeneratingBracket ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating Bracket...
                </div>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Generate Tournament Bracket
                </>
              )}
            </button>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              As the tournament organizer, you can manually generate the bracket to start the tournament.
            </p>
            
            {participants.length < 2 && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-500">
                    At least 2 participants are required to generate a bracket. Currently there {participants.length === 1 ? 'is' : 'are'} only {participants.length} {participants.length === 1 ? 'participant' : 'participants'}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-glass-border">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-quantum-cyan text-quantum-cyan'
                : 'text-text-subtle hover:text-text-standard hover:border-glass-border'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'participants'
                ? 'border-b-2 border-quantum-cyan text-quantum-cyan'
                : 'text-text-subtle hover:text-text-standard hover:border-glass-border'
            }`}
          >
            Participants ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'matches'
                ? 'border-b-2 border-quantum-cyan text-quantum-cyan'
                : 'text-text-subtle hover:text-text-standard hover:border-glass-border'
            }`}
          >
            Matches ({matches.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Tournament Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-elevated rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Tournament Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-subtle)' }}>Format:</span>
                    <span className="font-medium capitalize" style={{ color: 'var(--text-standard)' }}>{tournament.format.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-subtle)' }}>Organizer:</span>
                    <span className="font-medium" style={{ color: 'var(--text-standard)' }}>{organizer?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-subtle)' }}>Registration:</span>
                    <span className="font-medium" style={{ color: 'var(--text-standard)' }}>
                      {tournament.status === 'registration_open' ? 'Open' : 'Closed'}
                      {isTournamentFull && tournament.status === 'registration_open' && ' (Full)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-bg-elevated rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Registration Status</h3>
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span style={{ color: 'var(--text-subtle)' }}>Participants:</span>
                    <span className="font-medium" style={{ color: 'var(--text-standard)' }}>
                      {participants.length}/{tournament.max_participants}
                    </span>
                  </div>
                  <div className="w-full bg-bg-surface-gray rounded-full h-2.5">
                    <div 
                      className="h-2.5 rounded-full" 
                      style={{ 
                        width: `${(participants.length / tournament.max_participants) * 100}%`,
                        backgroundColor: 'var(--quantum-cyan)'
                      }}
                    ></div>
                  </div>
                </div>
                
                {isRegistered ? (
                  <div className="text-center">
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 dark:bg-green-900/20 dark:border-green-800">
                      <p className="text-green-800 font-medium dark:text-green-400">You are registered for this tournament</p>
                    </div>
                    {tournament.status === 'registration_open' && (
                      <button
                        onClick={handleUnregister}
                        disabled={isUnregistering}
                        className="btn btn-secondary"
                      >
                        {isUnregistering ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </div>
                        ) : (
                          'Withdraw from Tournament'
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    {tournament.status === 'registration_open' && !isTournamentFull ? (
                      <button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="btn btn-primary"
                      >
                        {isRegistering ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Registering...
                          </div>
                        ) : (
                          <>
                            <Target className="h-5 w-5 mr-2" />
                            Register for Tournament
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="bg-bg-surface-gray border border-glass-border rounded-md p-3">
                        <p style={{ color: 'var(--text-subtle)' }}>
                          {isTournamentFull
                            ? 'Tournament is full'
                            : 'Registration is closed'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-bg-elevated rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Tournament Schedule</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-quantum-cyan bg-opacity-10 flex items-center justify-center text-quantum-cyan">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium" style={{ color: 'var(--text-standard)' }}>Tournament Start</h4>
                    <p style={{ color: 'var(--text-subtle)' }}>
                      {new Date(tournament.start_date).toLocaleDateString()} at{' '}
                      {new Date(tournament.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-success-green bg-opacity-10 flex items-center justify-center text-success-green">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <h4 className="text-base font-medium" style={{ color: 'var(--text-standard)' }}>Tournament End</h4>
                    <p style={{ color: 'var(--text-subtle)' }}>
                      {new Date(tournament.end_date).toLocaleDateString()} at{' '}
                      {new Date(tournament.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-generation notice */}
            <div className="bg-bg-elevated rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Bracket Generation</h3>
              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-warning-orange bg-opacity-10 flex items-center justify-center text-warning-orange">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="ml-4">
                  <h4 className="text-base font-medium" style={{ color: 'var(--text-standard)' }}>Automatic Bracket Generation</h4>
                  <p style={{ color: 'var(--text-subtle)' }} className="mb-2">
                    The tournament bracket will be automatically generated when:
                  </p>
                  <ul className="list-disc pl-5 space-y-1" style={{ color: 'var(--text-subtle)' }}>
                    <li>The maximum number of participants ({tournament.max_participants}) is reached</li>
                    <li>Or when the tournament organizer manually starts the tournament</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'participants' && (
          <div>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Registered Participants</h3>
            
            {participants.length === 0 ? (
              <div className="text-center py-12 bg-bg-elevated rounded-lg">
                <Users className="mx-auto h-12 w-12" style={{ color: 'var(--text-muted)' }} />
                <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-standard)' }}>No participants yet</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-subtle)' }}>
                  Be the first to register for this tournament.
                </p>
                {tournament.status === 'registration_open' && !isRegistered && !isTournamentFull && (
                  <div className="mt-6">
                    <button
                      onClick={handleRegister}
                      disabled={isRegistering}
                      className="btn btn-primary"
                    >
                      {isRegistering ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Registering...
                        </div>
                      ) : (
                        'Register Now'
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-glass-bg border border-glass-border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-glass-border">
                  <thead className="bg-bg-elevated">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
                        Seed
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
                        Player
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
                        Rating
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
                        Registered
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {participants.map((participant, index) => (
                      <tr key={participant.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {participant.seed || index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-text-inverse font-medium">
                              {participant.player?.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium" style={{ color: 'var(--text-standard)' }}>
                                {participant.player?.username}
                              </div>
                              {participant.player_id === user?.id && (
                                <div className="text-xs text-quantum-cyan">You</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {participant.player?.elo_rating}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {new Date(participant.registered_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Tournament Matches</h3>
            
            {matches.length === 0 ? (
              <div className="text-center py-12 bg-bg-elevated rounded-lg">
                <Trophy className="mx-auto h-12 w-12 text-text-muted" />
                <h3 className="mt-2 text-sm font-medium text-text-standard">No matches scheduled yet</h3>
                <p className="mt-1 text-sm text-text-subtle">
                  {tournament.status === 'registration_open' 
                    ? 'Matches will be created when the tournament is full or registration closes.'
                    : 'Matches will be created when the tournament begins.'}
                </p>
                
                {/* Show Generate Bracket button for organizers if appropriate */}
                {isUserOrganizer && tournament.status === 'registration_open' && (
                  <div className="mt-6">
                    <button
                      onClick={handleCloseRegistration}
                      disabled={isClosingRegistration || isGeneratingBracket || participants.length < 2}
                      className={`btn btn-primary ${participants.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isClosingRegistration ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Closing Registration...
                        </div>
                      ) : (
                        <>
                          <Clock className="h-5 w-5 mr-2" />
                          Close Registration & Generate Bracket
                        </>
                      )}
                    </button>
                    
                    {participants.length < 2 && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-700 dark:text-yellow-500">
                            At least 2 participants are required to start a tournament. Currently there {participants.length === 1 ? 'is' : 'are'} only {participants.length} {participants.length === 1 ? 'participant' : 'participants'}.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
                      As the tournament organizer, you can manually close registration and generate the bracket.
                    </p>
                  </div>
                )}
                
                {canGenerateBracket && (
                  <div className="mt-6">
                    <button
                      onClick={handleGenerateBracket}
                      disabled={isGeneratingBracket || participants.length < 2}
                      className={`btn btn-primary ${participants.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isGeneratingBracket ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generating Bracket...
                        </div>
                      ) : (
                        <>
                          <Play className="h-5 w-5 mr-2" />
                          Generate Tournament Bracket
                        </>
                      )}
                    </button>
                    
                    {participants.length < 2 && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-700 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-700 dark:text-yellow-500">
                            At least 2 participants are required to generate a bracket. Currently there {participants.length === 1 ? 'is' : 'are'} only {participants.length} {participants.length === 1 ? 'participant' : 'participants'}.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
                      As the tournament organizer, you can manually generate the bracket to start the tournament.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="border border-glass-border rounded-lg p-4 hover:bg-hover-bg transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium" style={{ color: 'var(--text-standard)' }}>
                        {match.player1?.username || 'TBD'} vs {match.player2?.username || 'TBD'}
                      </div>
                      <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                        match.status === 'completed' ? 'bg-success-green bg-opacity-10 text-success-green' :
                        match.status === 'in_progress' ? 'bg-quantum-cyan bg-opacity-10 text-quantum-cyan' :
                        'bg-warning-orange bg-opacity-10 text-warning-orange'
                      }`}>
                        {match.status === 'completed' && <CheckCircle className="inline-block h-3 w-3 mr-1" />}
                        {match.status === 'in_progress' && <Play className="inline-block h-3 w-3 mr-1" />}
                        {match.status.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="flex items-center text-sm mb-2" style={{ color: 'var(--text-subtle)' }}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(match.date).toLocaleDateString()} at{' '}
                      {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
                      <MapPin className="h-4 w-4 mr-2" />
                      {match.location}
                    </div>
                    {match.status === 'completed' && match.score && (
                      <div className="mt-2 text-sm font-medium">
                        Score: <span style={{ color: 'var(--quantum-cyan)' }}>{typeof match.score === 'string' ? match.score : 'Score available'}</span>
                        {match.winner && (
                          <span className="ml-2" style={{ color: 'var(--success-green)' }}>
                            <Award className="inline-block h-4 w-4 mr-1" />
                            {match.winner.username} won
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button className="text-quantum-cyan hover:text-quantum-cyan-dark text-sm font-medium flex items-center">
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}