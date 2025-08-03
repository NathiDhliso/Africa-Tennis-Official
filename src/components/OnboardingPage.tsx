import React, { useState } from 'react';
import { User, Trophy, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const OnboardingPage: React.FC = () => {
  const [name, setName] = useState('');
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    
    updateProfile({
      username: name.trim(),
      skill_level: skillLevel.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
    });
    
    setIsLoading(false);
  };

  const skillLevels = [
    { 
      value: 'Beginner', 
      description: 'New to competitive tennis', 
      rating: '1000-1400',
      color: 'var(--skill-beginner)'
    },
    { 
      value: 'Intermediate', 
      description: 'Regular player with solid fundamentals', 
      rating: '1400-1700',
      color: 'var(--skill-intermediate)'
    },
    { 
      value: 'Advanced', 
      description: 'Experienced competitive player', 
      rating: '1700+',
      color: 'var(--skill-advanced)'
    },
  ] as const;

  return (
    <div className="onboarding-page-modern">
      <div className="onboarding-container-modern">
        <div className="onboarding-card-modern">
          {/* Header Section */}
          <div className="onboarding-header-modern">
            <div className="onboarding-logo">
              <div className="logo-icon-modern">
                <Trophy size={48} />
              </div>
            </div>
            <h1 className="onboarding-title-modern">
              Welcome to Africa Tennis
            </h1>
            <p className="onboarding-subtitle-modern">
              Complete your profile to start challenging players
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="onboarding-form-modern">
            {/* Name Input */}
            <div className="onboarding-field">
              <div className="field-header">
                <User size={20} className="field-icon" />
                <span className="field-label">Your Name</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="onboarding-input-modern"
                placeholder="Enter your name"
                required
                disabled={isLoading}
                maxLength={50}
              />
            </div>

            {/* Skill Level Selection */}
            <div className="onboarding-field">
              <div className="field-header">
                <Trophy size={20} className="field-icon" />
                <span className="field-label">Skill Level</span>
              </div>
              
              <div className="skill-options-modern">
                {skillLevels.map((level) => (
                  <label
                    key={level.value}
                    className={`skill-option-modern ${skillLevel === level.value ? 'selected' : ''}`}
                    style={{
                      '--skill-color': level.color
                    } as React.CSSProperties}
                  >
                    <input
                      type="radio"
                      name="skillLevel"
                      value={level.value}
                      checked={skillLevel === level.value}
                      onChange={(e) => setSkillLevel(e.target.value as typeof skillLevel)}
                      disabled={isLoading}
                      className="skill-radio"
                    />
                    <div className="skill-content-modern">
                      <div className="skill-main">
                        <div className="skill-name-modern">{level.value}</div>
                        <div className="skill-description-modern">{level.description}</div>
                      </div>
                      <div className="skill-rating-modern">{level.rating}</div>
                    </div>
                    <div className="skill-indicator"></div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="onboarding-submit-modern"
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner-modern"></div>
                  <span>Setting up your profile...</span>
                </>
              ) : (
                <>
                  <span>Enter the Arena</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;