import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  
  const { signIn } = useAuthStore();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInputChange = (field: 'email' | 'password', value: string) => {
    if (field === 'email') {
      setEmail(value);
      if (errors.email) {
        setErrors(prev => ({ ...prev, email: undefined }));
      }
    } else {
      setPassword(value);
      if (errors.password) {
        setErrors(prev => ({ ...prev, password: undefined }));
      }
    }
    if (message) setMessage('');
  };

  const validateForm = () => {
    const newErrors: {email?: string; password?: string} = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email address required for system access';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Invalid email format detected';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password required for authentication';
    } else if (password.length < 6) {
      newErrors.password = 'Password must contain at least 6 characters';
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
      // First check if the user exists in auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        // Provide a friendlier message when the credentials don't match
        if (authError.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error(
            "Authentication failed: Invalid credentials detected. Please verify your login information and try again."
          );
        }
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('System error: Authentication process failed. Please try again later.');
      }
      
      // Check if the user has a profile
      const { error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();
      
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // No profile found for this user
          throw new Error('Profile data not found. Please contact system administration for assistance.');
        }
        throw profileError;
      }
      
      // If we get here, both auth and profile exist
      await signIn(email, password);
      setMessage('Authentication successful! Initializing your tennis dashboard...');
      navigate('/dashboard');
    } catch (error: unknown) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication error: Unable to establish secure connection. Please try again.';
      setMessage(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-modern">
      <div className="login-container-modern">
        <div className="login-card">
          {/* Logo Section */}
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.1"/>
                  <path d="M24 8L32 16L24 24L16 16L24 8Z" fill="currentColor"/>
                  <path d="M16 24L24 32L32 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 className="logo-text">Africa Tennis</h1>
            </div>
            <p className="login-subtitle">Welcome back to your tennis journey</p>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="login-form-modern" noValidate>
            {/* Email Field */}
            <div className="form-field">
              <label htmlFor="email" className="form-label-modern">
                Email Address
              </label>
              <div className="input-container">
                <Mail size={20} className="input-icon" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={`form-input-modern ${errors.email ? 'error' : ''}`}
                  placeholder="Enter your email"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <span className="error-message" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password Field */}
            <div className="form-field">
              <label htmlFor="password" className="form-label-modern">
                Password
              </label>
              <div className="input-container">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={`form-input-modern ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle"
                  disabled={isLoading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <span className="error-message" role="alert">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="form-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                <span className="checkmark"></span>
                <span className="checkbox-label">Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-password-link">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim()}
              className="login-button-modern"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="loading-icon" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>

            {/* Message Display */}
            {message && (
              <div className={`message ${message.includes('successful') ? 'success' : 'error'}`} role="alert">
                {message}
              </div>
            )}
          </form>

          {/* Create Account Section */}
          <div className="signup-section">
            <p className="signup-text">
              Don't have an account?{' '}
              <Link to="/signup" className="signup-link">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};