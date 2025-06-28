import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Link, useNavigate } from 'react-router-dom';

export const SignUpForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    username?: string;
  }>({});
  
  const { signUp } = useAuthStore();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (
    field: 'email' | 'password' | 'confirmPassword' | 'username', 
    value: string
  ) => {
    if (field === 'email') setEmail(value);
    else if (field === 'password') setPassword(value);
    else if (field === 'confirmPassword') setConfirmPassword(value);
    else if (field === 'username') setUsername(value);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (message) setMessage('');
  };

  const validateForm = () => {
    const newErrors: {
      email?: string;
      password?: string;
      confirmPassword?: string;
      username?: string;
    } = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username required for player identification';
    } else if (username.length < 3) {
      newErrors.username = 'Username must contain at least 3 characters';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email address required for account creation';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Invalid email format detected';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password required for account security';
    } else if (password.length < 6) {
      newErrors.password = 'Password must contain at least 6 characters';
    }
    
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Password confirmation does not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setMessage('');

    try {
      await signUp(email, password, username);
      setMessage('Account created successfully! Initializing your tennis profile...');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      setMessage(error.message || 'Account creation failed. Please verify your information and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-page-modern">
      <div className="onboarding-container-modern">
        <div className="onboarding-card-modern">
          {/* Header Section */}
          <div className="onboarding-header-modern">
            <div className="onboarding-logo">
              <div className="logo-icon-modern">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.1"/>
                  <path d="M24 8L32 16L24 24L16 16L24 8Z" fill="currentColor"/>
                  <path d="M16 24L24 32L32 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <h1 className="onboarding-title-modern">
              Join Africa Tennis
            </h1>
            <p className="onboarding-subtitle-modern">
              Create your account to start your tennis journey
            </p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="onboarding-form-modern">
            {/* Username Field */}
            <div className="onboarding-field">
              <div className="field-header">
                <User size={20} className="field-icon" />
                <span className="field-label">Username</span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="onboarding-input-modern"
                placeholder="Choose a username"
                required
                disabled={isLoading}
              />
              {errors.username && (
                <span className="error-message" style={{ color: 'var(--error-pink)' }}>
                  {errors.username}
                </span>
              )}
            </div>

            {/* Email Field */}
            <div className="onboarding-field">
              <div className="field-header">
                <Mail size={20} className="field-icon" />
                <span className="field-label">Email Address</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="onboarding-input-modern"
                placeholder="Enter your email"
                required
                disabled={isLoading}
              />
              {errors.email && (
                <span className="error-message" style={{ color: 'var(--error-pink)' }}>
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="onboarding-field">
              <div className="field-header">
                <Lock size={20} className="field-icon" />
                <span className="field-label">Password</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="onboarding-input-modern"
                  placeholder="Create a password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: 'var(--text-subtle)' }}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <span className="error-message" style={{ color: 'var(--error-pink)' }}>
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="onboarding-field">
              <div className="field-header">
                <Lock size={20} className="field-icon" />
                <span className="field-label">Confirm Password</span>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="onboarding-input-modern"
                  placeholder="Confirm your password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: 'var(--text-subtle)' }}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-message" style={{ color: 'var(--error-pink)' }}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* Message Display */}
            {message && (
              <div 
                className="p-4 rounded-lg text-center" 
                style={{ 
                  backgroundColor: message.includes('success') ? 'rgba(0, 255, 170, 0.1)' : 'rgba(255, 51, 102, 0.1)',
                  color: message.includes('success') ? 'var(--success-green)' : 'var(--error-pink)'
                }}
              >
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="onboarding-submit-modern"
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner-modern"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center mt-4">
              <p style={{ color: 'var(--text-subtle)' }}>
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="font-medium"
                  style={{ color: 'var(--quantum-cyan)' }}
                >
                  Sign In
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};