import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  isInSidebar?: boolean;
  isCollapsed?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isInSidebar = false, isCollapsed = false }) => {
  const { theme, toggleTheme } = useTheme();

  if (isInSidebar) {
    return (
      <div className={`sidebar-theme-toggle ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed && (
          <span className="sidebar-theme-label">Theme</span>
        )}
        <button
          onClick={toggleTheme}
          className="sidebar-theme-button"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <div className="sidebar-theme-icons">
            <Sun 
              size={16} 
              className={`theme-icon ${theme === 'light' ? 'active' : ''}`}
            />
            <Moon 
              size={16} 
              className={`theme-icon ${theme === 'dark' ? 'active' : ''}`}
            />
          </div>
          
          <div className="sidebar-theme-switch">
            <div className={`sidebar-theme-knob ${theme === 'dark' ? 'active' : ''}`}></div>
          </div>
        </button>
      </div>
    );
  }

  // Original theme toggle for non-sidebar usage (fallback)
  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${theme === 'dark' ? 'active' : ''}`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Moon size={16} style={{ color: 'var(--text-subtle)' }} />
      ) : (
        <Sun size={16} style={{ color: 'var(--text-subtle)' }} />
      )}
      
      <div className="theme-toggle-switch">
        <div className="theme-toggle-knob"></div>
      </div>
      
      {theme === 'light' ? (
        <Moon size={16} style={{ color: 'var(--text-subtle)' }} />
      ) : (
        <Sun size={16} style={{ color: 'var(--text-subtle)' }} />
      )}
    </button>
  );
};

export default ThemeToggle;