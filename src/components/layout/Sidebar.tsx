import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Trophy, 
  BarChart3, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  Gavel,
  Swords,
  LogOut,
  Sparkles,
  Video,
  Server
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAuthStore } from '../../stores/authStore';
import { useIntelligentPreload } from '../../hooks/useIntelligentPreload';

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { preloadOnHover } = useIntelligentPreload();

  // Navigation items without the Profile button
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'matches', label: 'My Matches', icon: Swords, path: '/matches' },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy, path: '/tournaments' },
    { id: 'umpire', label: 'Live Scoring', icon: Gavel, path: '/umpire' },
    { id: 'rankings', label: 'Ratings & Rankings', icon: BarChart3, path: '/rankings' },
    { id: 'ai-coach', label: 'AI Coach', icon: Sparkles, path: '/ai-coach' },
    { id: 'ai-integration', label: 'AI Systems', icon: Server, path: '/ai-integration' },
    { id: 'video-analysis', label: 'Video Analysis', icon: Video, path: '/video-analysis' },
  ];

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="sidebar-mobile-trigger"
        aria-label="Open navigation menu"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          {!isCollapsed && (
            <div className="sidebar-brand">
              <Trophy size={32} style={{ color: 'var(--quantum-cyan)' }} />
              <span className="sidebar-brand-text">Africa Tennis</span>
            </div>
          )}
          
          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="sidebar-toggle desktop-only"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="sidebar-close mobile-only"
            aria-label="Close navigation menu"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Profile Button - This whole block is a clickable link */}
        {!isCollapsed && profile && (
          <Link
            to="/profile"
            className="user-profile-button block"
            onClick={() => setIsMobileOpen(false)}
            onMouseEnter={() => preloadOnHover('/profile')}
          >
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                {profile.profile_picture_url ? (
                  <img 
                    src={profile.profile_picture_url} 
                    alt={profile.username} 
                    className="player-avatar w-10 h-10 text-sm"
                  />
                ) : (
                  <div className="player-avatar w-10 h-10 text-sm">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="ml-3">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-standard)' }}>{profile?.username || 'User'}</div>
                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Rating: {profile?.elo_rating || 1200}</div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          <ul className="sidebar-nav-list">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMobileOpen(false)}
                    onMouseEnter={() => preloadOnHover(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={20} className="sidebar-nav-icon" />
                    {!isCollapsed && (
                      <span className="sidebar-nav-label">{item.label}</span>
                    )}
                    {isActive && <div className="sidebar-nav-indicator" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Theme Toggle Section */}
        <div className="sidebar-theme-section">
          <div className={`sidebar-theme-container ${isCollapsed ? 'collapsed' : ''}`}>
            <ThemeToggle isInSidebar={true} isCollapsed={isCollapsed} />
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="mt-auto p-4">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
            style={{ 
              color: 'var(--error-pink)', 
              backgroundColor: 'rgba(255, 51, 102, 0.1)' 
            }}
          >
            {isSigningOut ? (
              <>
                <div className="loading-spinner w-4 h-4"></div>
                {!isCollapsed && <span>Signing Out...</span>}
              </>
            ) : (
              <>
                <LogOut size={16} />
                {!isCollapsed && <span>Sign Out</span>}
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="sidebar-footer">
            <div className="sidebar-footer-content">
              <p className="sidebar-footer-text">Africa Tennis</p>
              <p className="sidebar-footer-version">v1.0.0</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;