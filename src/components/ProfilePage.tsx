import React, { useState, useRef } from 'react';
import { User, Edit3, Save, X, Camera, Upload, Check, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
    profilePicture: user?.profilePicture || null,
  });

  const handleInputChange = (field: string, value: string) => {
    if (field === 'bio' && value.length > 150) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setFormData(prev => ({ ...prev, profilePicture: imageUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (user) {
      updateUser({
        ...formData,
        username: formData.username || `player_${user.id.slice(-6)}`,
      });
      setIsEditing(false);
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      username: user?.username || '',
      phone: user?.phone || '',
      location: user?.location || '',
      bio: user?.bio || '',
      profilePicture: user?.profilePicture || null,
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Success Message */}
        {showSaveSuccess && (
          <div className="profile-success-message">
            <div className="profile-success-content">
              <Check size={20} />
              <span>Profile updated successfully!</span>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="profile-card">
          {/* Header Section */}
          <div className="profile-header">
            <div className="profile-header-info">
              <h1>Profile Settings</h1>
              <p>Manage your personal information and preferences</p>
            </div>
            
            <div className="profile-header-actions">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="profile-edit-btn"
                >
                  <Edit3 size={16} />
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="profile-cancel-btn"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="profile-save-btn"
                  >
                    <Save size={16} />
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="profile-picture-section">
            <div className="profile-picture-container">
              {formData.profilePicture ? (
                <img
                  src={formData.profilePicture}
                  alt="Profile"
                  className="profile-picture"
                />
              ) : (
                <div className="profile-picture-placeholder">
                  {getInitials(formData.name || 'User')}
                </div>
              )}
              
              {isEditing && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="profile-picture-edit"
                  aria-label="Change profile picture"
                >
                  <Camera size={20} />
                </button>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="profile-hidden-input"
            />
            
            {isEditing && (
              <p className="profile-picture-help">
                Click the camera icon to upload a new photo
              </p>
            )}
          </div>

          {/* Form Fields */}
          <div className="profile-form">
            {/* Full Name */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                <User size={16} />
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="profile-form-input"
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="profile-form-display">
                  {formData.name || 'Not set'}
                </div>
              )}
            </div>

            {/* Username */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                Username
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="profile-form-input"
                  placeholder="Choose a username"
                />
              ) : (
                <div className="profile-form-display">
                  @{formData.username || `player_${user.id.slice(-6)}`}
                </div>
              )}
            </div>

            {/* Email (Non-editable) */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                Email Address
                <span className="profile-verified-badge">
                  <Check size={12} />
                  Verified
                </span>
              </label>
              <div className="profile-form-display locked">
                {user.email}
              </div>
            </div>

            {/* Phone Number */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="profile-form-input"
                  placeholder="+1 (555) 123-4567"
                />
              ) : (
                <div className="profile-form-display">
                  {formData.phone || 'Not set'}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                Location
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="profile-form-input"
                  placeholder="City, State/Country"
                />
              ) : (
                <div className="profile-form-display">
                  {formData.location || 'Not set'}
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                About Me
                {isEditing && (
                  <span className="profile-character-count">
                    {formData.bio.length}/150
                  </span>
                )}
              </label>
              {isEditing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="profile-form-textarea"
                  placeholder="Tell other players about yourself..."
                  rows={3}
                  maxLength={150}
                />
              ) : (
                <div className="profile-form-display bio">
                  {formData.bio || 'No bio added yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;