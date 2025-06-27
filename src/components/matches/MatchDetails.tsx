import React, { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, MapPin, Trophy, Clock, Target, ChevronRight, CheckCircle, Play, Award, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../LoadingSpinner'
import { useAuthStore } from '../../stores/authStore'
import { apiClient } from '../../lib/aws'
import type { Database } from '../../types/database'

type Match = Database['public']['Tables']['matches']['Row'] & {
  player1?: { username: string; elo_rating: number }
  player2?: { username: string; elo_rating: number }
  winner?: { username: string }
}

interface MatchDetailsProps {
  matchId: string
  onBack: () => void
}

export const MatchDetails: React.FC<MatchDetailsProps> = ({ matchId, onBack }) => {
  const [match, setMatch] = useState<Match | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [player1, setPlayer1] = useState<any>(null)
  const [player2, setPlayer2] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistered, setIsRegistered] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'matches'>('overview')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isUnregistering, setIsUnregistering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingBracket, setIsGeneratingBracket] = useState(false)
  const [bracketGenerationSuccess, setBracketGenerationSuccess] = useState(false)
  const [isClosingRegistration, setIsClosingRegistration] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  
  const user = useAuthStore(state => state.user)

  useEffect(() => {
    const fetchMatchDetails = async () => {
      setLoading(true)
      setError(null)
      try {
        // Fetch match data
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select(`
            *,
            player1:profiles!matches_player1_id_fkey(username, elo_rating),
            player2:profiles!matches_player2_id_fkey(username, elo_rating),
            winner:profiles!matches_winner_id_fkey(username)
          `)
          .eq('id', matchId)
          .single()

        if (matchError) throw matchError
        setMatch(matchData)
        setSummary(matchData.summary)

        // Fetch player profiles
        if (matchData) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', [matchData.player1_id, matchData.player2_id])

          if (profiles) {
            setPlayer1(profiles.find(p => p.user_id === matchData.player1_id))
            setPlayer2(profiles.find(p => p.user_id === matchData.player2_id))
          }

          // Fetch match events
          const { data: eventsData } = await supabase
            .from('match_events')
            .select('*')
            .eq('match_id', matchId)
            .order('timestamp', { ascending: true })

          setEvents(eventsData || [])
        }
      } catch (error: any) {
        console.error('Error fetching match details:', error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchMatchDetails()

    // Set up real-time subscription for match updates
    const matchSubscription = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        fetchMatchDetails
      )
      .subscribe()
      
    // Set up real-time subscription for match events
    const eventsSubscription = supabase
      .channel(`match-events-${matchId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        fetchMatchDetails
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(matchSubscription)
      supabase.removeChannel(eventsSubscription)
    }
  }, [matchId, user])

  const handleGenerateSummary = async () => {
    if (!match) return
    
    setIsGeneratingSummary(true)
    setError(null)
    
    try {
      const response = await apiClient.generateMatchSummary(matchId)
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to generate match summary')
      }
      
      setSummary(response.data.summary)
    } catch (error: any) {
      console.error('Error generating match summary:', error)
      setError(`Failed to generate summary: ${error.message}`)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner 
          size="large" 
          text="Loading match details..." 
          subtext="Retrieving match information"
        />
      </div>
    )
  }

  if (error && !match) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-error-pink">Error: {error}</h3>
        <button
          onClick={onBack}
          className="mt-4 btn btn-primary"
        >
          Go Back
        </button>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-text-standard">Match not found</h3>
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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-standard)' }}>{match.player1?.username} vs {match.player2?.username}</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(match.status)}`}>
            {formatStatus(match.status)}
          </span>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <Calendar className="h-4 w-4 mr-2" />
            {new Date(match.date).toLocaleDateString()} at {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="flex items-center text-sm" style={{ color: 'var(--text-subtle)' }}>
            <MapPin className="h-4 w-4 mr-2" />
            {match.location}
          </div>
        </div>
        
        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Match Summary Section */}
      {match.status === 'completed' && (
        <div className="p-6 border-b border-glass-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-standard)' }}>
              <Sparkles className="h-5 w-5 text-quantum-cyan" />
              AI Match Summary
            </h2>
            
            {!summary && !isGeneratingSummary && (
              <button 
                onClick={handleGenerateSummary}
                className="btn btn-primary btn-sm"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Generate Summary
              </button>
            )}
          </div>
          
          {isGeneratingSummary ? (
            <div className="bg-bg-elevated rounded-lg p-6 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-quantum-cyan" />
              <p className="text-text-standard">Generating match summary with AI...</p>
              <p className="text-text-subtle text-sm mt-2">This may take a few moments</p>
            </div>
          ) : summary ? (
            <div className="bg-bg-elevated rounded-lg p-6">
              <div className="relative">
                <div className="absolute -left-2 top-0 bottom-0 w-1 bg-quantum-cyan rounded-full"></div>
                <div className="pl-4">
                  <p className="text-text-standard leading-relaxed">{summary}</p>
                  <div className="mt-4 text-right">
                    <span className="text-xs text-text-subtle italic">Generated by AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-bg-elevated rounded-lg p-6 text-center">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-text-muted" />
              <h3 className="text-lg font-medium text-text-standard mb-2">No Summary Available</h3>
              <p className="text-text-subtle mb-4">Generate an AI-powered summary of this match to get insights and highlights.</p>
              <button 
                onClick={handleGenerateSummary}
                className="btn btn-primary"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Match Summary
              </button>
            </div>
          )}
        </div>
      )}

      {/* Match Details */}
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-standard)' }}>Match Details</h2>
        
        {/* Score Display */}
        {match.status === 'completed' && match.score && (
          <div className="bg-bg-elevated rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Final Score</h3>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-text-inverse font-medium">
                  {match.player1?.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>
                    {match.player1?.username}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Rating: {match.player1?.elo_rating}
                  </div>
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'var(--quantum-cyan)' }}>
                  {typeof match.score === 'string' ? match.score : 
                   match.score && typeof match.score === 'object' && match.score.sets ? 
                   match.score.sets.map((set: any) => `${set.player1_games}-${set.player2_games}`).join(', ') : 
                   'Score unavailable'}
                </div>
                {match.winner && (
                  <div className="mt-2 flex items-center justify-center text-sm font-medium" style={{ color: 'var(--success-green)' }}>
                    <Trophy className="h-4 w-4 mr-1" />
                    {match.winner.username} won
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-lg font-medium text-right" style={{ color: 'var(--text-standard)' }}>
                    {match.player2?.username}
                  </div>
                  <div className="text-sm text-right" style={{ color: 'var(--text-subtle)' }}>
                    Rating: {match.player2?.elo_rating}
                  </div>
                </div>
                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-text-inverse font-medium">
                  {match.player2?.username.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Match Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-bg-elevated rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-quantum-cyan" />
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>Date & Time</h3>
            </div>
            <p style={{ color: 'var(--text-subtle)' }}>
              {new Date(match.date).toLocaleDateString()} at {new Date(match.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          
          <div className="bg-bg-elevated rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-quantum-cyan" />
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>Location</h3>
            </div>
            <p style={{ color: 'var(--text-subtle)' }}>{match.location}</p>
          </div>
          
          <div className="bg-bg-elevated rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-quantum-cyan" />
              <h3 className="text-lg font-medium" style={{ color: 'var(--text-standard)' }}>Status</h3>
            </div>
            <p style={{ color: 'var(--text-subtle)' }}>{formatStatus(match.status)}</p>
          </div>
        </div>
        
        {/* Match Events */}
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-standard)' }}>Match Timeline</h3>
          
          {events.length === 0 ? (
            <div className="text-center py-8 bg-bg-elevated rounded-lg">
              <Clock className="mx-auto h-12 w-12 text-text-muted" />
              <h3 className="mt-2 text-sm font-medium text-text-standard">No events recorded</h3>
              <p className="mt-1 text-sm text-text-subtle">
                Events will appear here during the match.
              </p>
            </div>
          ) : (
            <div className="border-l-2 border-glass-border ml-3 space-y-6 py-2">
              {events.map((event, index) => (
                <div key={event.id} className="relative pl-8 pb-2">
                  <div className="absolute -left-2 mt-1.5 w-4 h-4 rounded-full bg-quantum-cyan"></div>
                  <div className="text-sm text-text-subtle mb-1">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="font-medium text-text-standard capitalize">
                    {event.event_type.replace('_', ' ')}
                  </div>
                  <div className="text-text-subtle">{event.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}