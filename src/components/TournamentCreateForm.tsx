import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Users, Trophy, User, Award, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import MultiSelectCalendar from './MultiSelectCalendar';

interface TournamentCreateFormProps {
  onClose: () => void;
  onTournamentCreated: () => void;
}

const TournamentCreateForm: React.FC<TournamentCreateFormProps> = ({ onClose, onTournamentCreated }) => {
  const { user } = useAuthStore();
  const [showCalendar, setShowCalendar] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    registrationDeadline: null as Date | null,
    startDate: null as Date | null,
    endDate: null as Date | null,
    format: 'single_elimination' as string,
    location: '',
    maxParticipants: 16,
    umpireId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAutoGenerateInfo, setShowAutoGenerateInfo] = useState(false);

  // Get available umpires (all users for now)
  const [availableUmpires, setAvailableUmpires] = useState<{
    user_id: string;
    username: string;
    elo_rating: number | null;
  }[]>([]);
  
  useEffect(() => {
    // Fetch available users who could be umpires
    const fetchUmpires = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, username, elo_rating')
          .order('elo_rating', { ascending: false })
          .limit(20);
          
        if (error) throw error;
        setAvailableUmpires(data || []);
      } catch (err) {
        console.error('Error fetching umpires:', err);
      }
    };
    
    fetchUmpires();
  }, []);

  // Tournament format options with availability status
  const tournamentFormats = [
    {
      value: 'single_elimination' as const,
      label: 'Single Elimination',
      description: 'Traditional knockout format - lose once and you\'re out',
      available: true,
      icon: Trophy,
      details: 'Fast-paced tournament where players are eliminated after one loss. Perfect for quick competitions with clear winners.'
    },
    {
      value: 'double_elimination' as const,
      label: 'Double Elimination', 
      description: 'Two-loss elimination format - more forgiving for players',
      available: true,
      icon: Award,
      details: 'Players must lose twice to be eliminated. Provides second chances while maintaining competitive structure. Features winners and losers brackets.'
    },
    {
      value: 'round_robin' as const,
      label: 'Round Robin',
      description: 'Everyone plays everyone - fair and comprehensive',
      available: true,
      icon: RotateCcw,
      details: 'Every player competes against all other players. Most fair format ensuring maximum court time for all participants.'
    }
  ];

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Show auto-generate info when changing max participants
    if (field === 'maxParticipants') {
      setShowAutoGenerateInfo(true);
      setTimeout(() => setShowAutoGenerateInfo(false), 5000);
    }
  };



  const isPowerOfTwo = (n: number): boolean => {
    return n > 0 && (n & (n - 1)) === 0;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Tournament name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate && formData.startDate >= formData.endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (formData.maxParticipants < 3) {
      newErrors.maxParticipants = 'Minimum 3 participants required';
    }

    if (formData.maxParticipants > 128) {
      newErrors.maxParticipants = 'Maximum 128 participants allowed';
    }

    // Format-specific validation
    if (formData.format === 'single_elimination' || formData.format === 'double_elimination') {
      if (!isPowerOfTwo(formData.maxParticipants)) {
        newErrors.maxParticipants = `For ${formData.format === 'single_elimination' ? 'single' : 'double'} elimination, participants must be a power of 2 (4, 8, 16, 32, 64, 128)`;
      }
    } else if (formData.format === 'round_robin') {
      if (formData.maxParticipants > 20) {
        newErrors.maxParticipants = 'Round Robin tournaments are limited to 20 participants for practical scheduling';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !validateForm()) return;

    setIsSubmitting(true);

    try {
      // Create tournament in Supabase
      const { error } = await supabase
        .from('tournaments')
        .insert({
          name: formData.name,
          description: formData.description,
          organizer_id: user?.id,
          start_date: formData.startDate!.toISOString(),
          end_date: formData.endDate!.toISOString(),
          format: formData.format,
          max_participants: formData.maxParticipants,
          location: formData.location,
          status: 'registration_open',
          brackets_generated: false
        })
        .select()
        .single();
        
      if (error) throw error;

      onTournamentCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create tournament:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Not selected';
    return date.toLocaleString();
  };

  const getParticipantOptions = () => {
    if (formData.format === 'single_elimination' || formData.format === 'double_elimination') {
      return [4, 8, 16, 32, 64, 128];
    } else if (formData.format === 'round_robin') {
      return Array.from({ length: 18 }, (_, i) => i + 3); // 3 to 20 participants
    }
    return [4, 8, 16, 32, 64, 128]; // Default
  };

  const getFormatInfo = () => {
    const format = tournamentFormats.find(f => f.value === formData.format);
    if (!format) return null;

    let additionalInfo = '';
    if (formData.format === 'round_robin' && formData.maxParticipants > 0) {
      const totalMatches = (formData.maxParticipants * (formData.maxParticipants - 1)) / 2;
      additionalInfo = `Total matches: ${totalMatches}`;
    } else if (formData.format === 'single_elimination' && formData.maxParticipants > 0) {
      const totalMatches = formData.maxParticipants - 1;
      const rounds = Math.ceil(Math.log2(formData.maxParticipants));
      additionalInfo = `${rounds} rounds, ${totalMatches} total matches`;
    } else if (formData.format === 'double_elimination' && formData.maxParticipants > 0) {
      // Double elimination has winners bracket + losers bracket + grand final
      const winnersMatches = formData.maxParticipants - 1;
      const losersMatches = formData.maxParticipants - 2;
      const totalMatches = winnersMatches + losersMatches + 1; // +1 for grand final
      const rounds = Math.ceil(Math.log2(formData.maxParticipants)) * 2 - 1; // Approximate rounds
      additionalInfo = `${rounds} rounds, ${totalMatches} total matches (Winners + Losers brackets)`;
    }

    return { ...format, additionalInfo };
  };

  return (
    <>
      <div className="modal-backdrop fade-in">
        <div className="modal modal-large scale-in">
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <Trophy size={48} className="mx-auto mb-4" style={{ color: 'var(--quantum-cyan)' }} />
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-standard)' }}>
              Create Tournament
            </h2>
            <p style={{ color: 'var(--text-subtle)' }}>
              Set up a new tournament for players to compete
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tournament Name */}
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                <Trophy size={16} className="inline mr-2" />
                Tournament Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., Midrand Open 2025"
                required
              />
              {errors.name && <p className="text-error-pink text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="form-textarea"
                placeholder="Describe the tournament, rules, prizes, etc."
                rows={3}
                required
              />
              {errors.description && <p className="text-error-pink text-sm mt-1">{errors.description}</p>}
            </div>

            {/* Tournament Schedule */}
            <div className="form-group">
              <label className="form-label">
                <Calendar size={16} className="inline mr-2" />
                Tournament Schedule
              </label>
              
              <div className="tournament-schedule-display">
                <div className="schedule-item">
                  <div className="schedule-label">Tournament Start:</div>
                  <div className="schedule-value">
                    {formatDateTime(formData.startDate)}
                  </div>
                </div>
                <div className="schedule-item">
                  <div className="schedule-label">Tournament End:</div>
                  <div className="schedule-value">
                    {formatDateTime(formData.endDate)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                className="btn btn-secondary w-full mt-3"
              >
                <Calendar size={16} />
                {formData.startDate || formData.endDate 
                  ? 'Modify Schedule' 
                  : 'Set Tournament Schedule'
                }
              </button>

              {(errors.startDate || errors.endDate) && (
                <div className="mt-2">
                  {errors.startDate && <p className="text-error-pink text-sm">{errors.startDate}</p>}
                  {errors.endDate && <p className="text-error-pink text-sm">{errors.endDate}</p>}
                </div>
              )}
            </div>

            {/* Enhanced Format Selection */}
            <div className="form-group">
              <label className="form-label">Tournament Format</label>
              <div className="format-options-grid">
                {tournamentFormats.map((format) => {
                  const Icon = format.icon;
                  const isSelected = formData.format === format.value;
                  return (
                    <label
                      key={format.value}
                      className={`format-option ${
                        isSelected ? 'selected' : ''
                      } ${!format.available ? 'disabled' : ''}`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={format.value}
                        checked={isSelected}
                        onChange={(e) => format.available && handleInputChange('format', e.target.value)}
                        disabled={!format.available}
                        className="format-radio"
                      />
                      
                      <div className="format-content">
                        <div className="format-header">
                          <Icon size={20} className="format-icon" />
                          <span className="format-name">{format.label}</span>
                        </div>
                        <p className="format-description">{format.description}</p>
                        <p className="format-details">{format.details}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              
              {/* Format Information */}
              {(() => {
                const formatInfo = getFormatInfo();
                return formatInfo && (
                  <div className="format-info-display">
                    <div className="format-info-header">
                      <formatInfo.icon size={16} />
                      <span>{formatInfo.label} Details</span>
                    </div>
                    <p className="format-info-text">{formatInfo.details}</p>
                    {formatInfo.additionalInfo && (
                      <p className="format-info-additional">{formatInfo.additionalInfo}</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Participants */}
            <div className="form-group">
              <label htmlFor="maxParticipants" className="form-label">
                <Users size={16} className="inline mr-2" />
                Max Participants
              </label>
              <select
                id="maxParticipants"
                value={formData.maxParticipants}
                onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                className="form-select"
                required
              >
                {getParticipantOptions().map(num => (
                  <option key={num} value={num}>
                    {num} Players
                    {formData.format === 'round_robin' && num > 0 && 
                      ` (${(num * (num - 1)) / 2} matches)`
                    }
                    {formData.format === 'double_elimination' && num > 0 && 
                      ` (${(num - 1) + (num - 2) + 1} matches)`
                    }
                  </option>
                ))}
              </select>
              {errors.maxParticipants && <p className="text-error-pink text-sm mt-1">{errors.maxParticipants}</p>}
              
              {showAutoGenerateInfo && (
                <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-quantum-cyan flex-shrink-0 mt-0.5" />
                    <p className="text-quantum-cyan">
                      The tournament bracket will be automatically generated when the maximum number of participants is reached.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="form-group">
              <label htmlFor="location" className="form-label">
                <MapPin size={16} className="inline mr-2" />
                Venue/Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="form-input"
                placeholder="Tennis club or court location"
                required
              />
              {errors.location && <p className="text-error-pink text-sm mt-1">{errors.location}</p>}
            </div>

            {/* Umpire Selection */}
            <div className="form-group">
              <label htmlFor="umpireId" className="form-label">
                <User size={16} className="inline mr-2" />
                Tournament Umpire (Optional)
              </label>
              <select
                id="umpireId"
                value={formData.umpireId}
                onChange={(e) => handleInputChange('umpireId', e.target.value)}
                className="form-select"
              >
                <option value="">Select an umpire (optional)</option>
                {availableUmpires.map((umpire) => (
                  <option key={umpire.user_id} value={umpire.user_id}>
                    {umpire.username} (Rating: {umpire.elo_rating})
                  </option>
                ))}
              </select>
              {errors.umpireId && <p className="text-error-pink text-sm mt-1">{errors.umpireId}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary btn-glare flex-1"
              >
                {isSubmitting ? (
                  <div className="loading-spinner w-5 h-5"></div>
                ) : (
                  <>
                    <Trophy size={16} />
                    Create Tournament
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Multi-Select Calendar Modal */}
      {showCalendar && (
        <MultiSelectCalendar
          selectedDates={[formData.startDate, formData.endDate].filter(Boolean) as Date[]}
          onDatesChange={(dates: Date[]) => {
            if (dates.length > 0) {
              setFormData(prev => ({ 
                ...prev, 
                startDate: dates[0] || null,
                endDate: dates[1] || null
              }));
            }
            setShowCalendar(false);
          }}
          maxSelectableDates={2}
          className="tournament-calendar"
        />
      )}
    </>
  );
};

export default TournamentCreateForm;