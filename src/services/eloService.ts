/**
 * ELO Rating Service
 * 
 * This service provides functions for calculating ELO ratings based on match results.
 * It's used as a client-side reference, but the actual ELO calculations are performed
 * server-side in Supabase functions for data integrity.
 */

// K-factor determines how much ratings change after each game
// Higher K-factor means more volatile ratings
const DEFAULT_K_FACTOR = 32

/**
 * Calculate the expected score for a player based on ratings
 * @param playerRating The player's current rating
 * @param opponentRating The opponent's current rating
 * @returns Expected score (between 0 and 1)
 */
export const calculateExpectedScore = (playerRating: number, opponentRating: number): number => {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))
}

/**
 * Calculate the new ELO rating for a player
 * @param currentRating The player's current rating
 * @param expectedScore The expected score calculated from ratings
 * @param actualScore The actual score (1 for win, 0.5 for draw, 0 for loss)
 * @param kFactor The K-factor to use (default: 32)
 * @returns The new rating
 */
export const calculateNewRating = (
  currentRating: number,
  expectedScore: number,
  actualScore: number,
  kFactor: number = DEFAULT_K_FACTOR
): number => {
  const newRating = Math.round(currentRating + kFactor * (actualScore - expectedScore))
  
  // Ensure rating doesn't go below 100
  return Math.max(100, newRating)
}

/**
 * Calculate new ratings for both players after a match
 * @param player1Rating Player 1's current rating
 * @param player2Rating Player 2's current rating
 * @param result 1 if player 1 won, 0.5 for draw, 0 if player 2 won
 * @param kFactor The K-factor to use (default: 32)
 * @returns Object containing new ratings for both players
 */
export const calculateMatchRatings = (
  player1Rating: number,
  player2Rating: number,
  result: number,
  kFactor: number = DEFAULT_K_FACTOR
): { player1NewRating: number; player2NewRating: number } => {
  const player1Expected = calculateExpectedScore(player1Rating, player2Rating)
  const player2Expected = calculateExpectedScore(player2Rating, player1Rating)
  
  const player1NewRating = calculateNewRating(player1Rating, player1Expected, result, kFactor)
  const player2NewRating = calculateNewRating(player2Rating, player2Expected, 1 - result, kFactor)
  
  return { player1NewRating, player2NewRating }
}

/**
 * Estimate rating change for a match result
 * @param playerRating Player's current rating
 * @param opponentRating Opponent's current rating
 * @param result 1 for win, 0.5 for draw, 0 for loss
 * @returns The estimated rating change
 */
export const estimateRatingChange = (
  playerRating: number,
  opponentRating: number,
  result: number
): number => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating)
  const newRating = calculateNewRating(playerRating, expectedScore, result)
  return newRating - playerRating
}

/**
 * Calculate win probability based on ratings
 * @param playerRating Player's current rating
 * @param opponentRating Opponent's current rating
 * @returns Win probability as a percentage
 */
export const calculateWinProbability = (
  playerRating: number,
  opponentRating: number
): number => {
  const expectedScore = calculateExpectedScore(playerRating, opponentRating)
  return Math.round(expectedScore * 100)
}