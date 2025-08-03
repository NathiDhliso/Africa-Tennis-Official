import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar, Clock, Check } from 'lucide-react';
import '../styles/components/multi-select-calendar.css';

interface CalendarDate {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  selectionType?: 'start' | 'end';
  isInRange?: boolean;
  isDisabled: boolean;
}

interface MultiSelectCalendarProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  minSelectableDates?: number;
  maxSelectableDates?: number;
  disabledDates?: Date[];
  className?: string;
}

const MultiSelectCalendar: React.FC<MultiSelectCalendarProps> = ({
  selectedDates,
  onDatesChange,
  disabledDates = [],
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeSelection, setActiveSelection] = useState<'start' | 'end'>('start');
  const [showTimeSelector, setShowTimeSelector] = useState<{type: 'start' | 'end', date: Date} | null>(null);
  
  // Local state to track temporary selections before saving
  const [tempStartDate, setTempStartDate] = useState<Date | null>(selectedDates[0] || null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(selectedDates[selectedDates.length - 1] || null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const generateCalendarDates = (): CalendarDate[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    
    const dates: CalendarDate[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = date.getMonth() === month;
      const isToday = date.getTime() === today.getTime();
      
      let isSelected = false;
      let selectionType: 'start' | 'end' | undefined;
      let isInRange = false;
      let isDisabled = false;

      // Check if date matches any selected dates (using temp state)
      if (tempStartDate && isSameDay(date, tempStartDate)) {
        isSelected = true;
        selectionType = 'start';
      } else if (tempEndDate && isSameDay(date, tempEndDate)) {
        isSelected = true;
        selectionType = 'end';
      }

      // Check if date is in range between start and end
      if (tempStartDate && tempEndDate && date > tempStartDate && date < tempEndDate) {
        isInRange = true;
      }

      // Check if date is disabled
      if (disabledDates.some(d => isSameDay(d, date))) {
        isDisabled = true;
      }

      dates.push({
        date,
        isCurrentMonth,
        isToday,
        isSelected,
        selectionType,
        isInRange,
        isDisabled
      });
    }

    return dates;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const isDateDisabled = (date: Date): boolean => {
    return date < today;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    // Set time to current time or a default time
    const dateWithTime = new Date(date);
    const now = new Date();
    dateWithTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    setShowTimeSelector({ type: activeSelection, date: dateWithTime });
  };

  const handleTimeConfirm = (hours: number, minutes: number) => {
    if (showTimeSelector) {
      const finalDate = new Date(showTimeSelector.date);
      finalDate.setHours(hours, minutes, 0, 0);
      
      // Update temporary state
      if (showTimeSelector.type === 'start') {
        setTempStartDate(finalDate);
      } else if (showTimeSelector.type === 'end') {
        setTempEndDate(finalDate);
      }
      
      setShowTimeSelector(null);
      
      // Auto-advance to next selection
      if (showTimeSelector.type === 'start') {
        setActiveSelection('end');
      }
    }
  };

  const handleSaveChanges = () => {
    console.log('=== CALENDAR SAVE CHANGES ===');
    console.log('Temp start date:', tempStartDate);
    console.log('Temp end date:', tempEndDate);
    
    // Apply all changes to the parent component
    const datesToSave = [];
    if (tempStartDate) {
      datesToSave.push(tempStartDate);
    }
    if (tempEndDate) {
      datesToSave.push(tempEndDate);
    }
    
    console.log('Dates to save:', datesToSave);
    onDatesChange(datesToSave);
    
    // Close the modal
    setShowTimeSelector(null);
  };

  const handleCancel = () => {
    // Reset temporary state to original values
    setTempStartDate(selectedDates[0] || null);
    setTempEndDate(selectedDates[selectedDates.length - 1] || null);
    
    // Close the modal
    setShowTimeSelector(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getSelectionTypeColor = (type: 'start' | 'end') => {
    switch (type) {
      case 'start':
        return 'var(--quantum-cyan)';
      case 'end':
        return 'var(--success-green)';
    }
  };

  const getSelectionTypeLabel = (type: 'start' | 'end') => {
    switch (type) {
      case 'start':
        return 'Tournament Start';
      case 'end':
        return 'Tournament End';
    }
  };

  const calendarDates = generateCalendarDates();

  // Check if we have all required dates selected
  const hasAllDates = tempStartDate && tempEndDate;
  const hasChanges = 
    (tempStartDate?.getTime() !== selectedDates[0]?.getTime()) ||
    (tempEndDate?.getTime() !== selectedDates[selectedDates.length - 1]?.getTime());

  return (
    <div className="calendar-modal-backdrop">
      <div className="calendar-modal">
        <button onClick={handleCancel} className="calendar-modal-close">
          <X size={20} />
        </button>

        <div className="calendar-header">
          <h2 className="calendar-title">
            <Calendar size={24} />
            Tournament Schedule
          </h2>
          <p className="calendar-subtitle">
            Select start date and end date for your tournament
          </p>
        </div>

        {/* Selection Type Tabs */}
        <div className="calendar-selection-tabs">
          {(['start', 'end'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActiveSelection(type)}
              className={`calendar-tab ${activeSelection === type ? 'active' : ''}`}
              style={{
                '--tab-color': getSelectionTypeColor(type)
              } as React.CSSProperties}
            >
              <div className="calendar-tab-label">{getSelectionTypeLabel(type)}</div>
              <div className="calendar-tab-date">
                {type === 'start' && tempStartDate && (
                  <span>{tempStartDate.toLocaleDateString()}</span>
                )}
                {type === 'end' && tempEndDate && (
                  <span>{tempEndDate.toLocaleDateString()}</span>
                )}
                {((type === 'start' && !tempStartDate) ||
                  (type === 'end' && !tempEndDate)) && (
                  <span className="calendar-tab-placeholder">Select date</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Calendar Navigation */}
        <div className="calendar-nav">
          <button
            onClick={() => navigateMonth('prev')}
            className="calendar-nav-btn"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="calendar-nav-title">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            className="calendar-nav-btn"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="calendar-grid">
          {/* Day Headers */}
          <div className="calendar-day-headers">
            {dayNames.map(day => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Dates */}
          <div className="calendar-dates">
            {calendarDates.map((calendarDate, index) => (
              <button
                key={index}
                onClick={() => handleDateClick(calendarDate.date)}
                disabled={isDateDisabled(calendarDate.date) || calendarDate.isDisabled}
                className={`calendar-date ${
                  !calendarDate.isCurrentMonth ? 'other-month' : ''
                } ${
                  calendarDate.isToday ? 'today' : ''
                } ${
                  calendarDate.isSelected ? 'selected' : ''
                } ${
                  calendarDate.isInRange ? 'in-range' : ''
                } ${
                  isDateDisabled(calendarDate.date) ? 'disabled' : ''
                }`}
                style={{
                  '--selection-color': calendarDate.selectionType 
                    ? getSelectionTypeColor(calendarDate.selectionType)
                    : 'transparent'
                } as React.CSSProperties}
              >
                <span className="calendar-date-number">
                  {calendarDate.date.getDate()}
                </span>
                {calendarDate.isSelected && (
                  <div className="calendar-date-indicator" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Time Selector Modal */}
        {showTimeSelector && (
          <div className="time-selector-backdrop">
            <div className="time-selector-modal">
              <div className="time-selector-header">
                <h3 className="time-selector-title">
                  <Clock size={20} />
                  Set Time for {getSelectionTypeLabel(showTimeSelector.type)}
                </h3>
                <p className="time-selector-date">
                  {showTimeSelector.date.toLocaleDateString()}
                </p>
              </div>

              <TimeSelector
                initialHours={showTimeSelector.date.getHours()}
                initialMinutes={showTimeSelector.date.getMinutes()}
                onConfirm={handleTimeConfirm}
                onCancel={() => setShowTimeSelector(null)}
              />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="calendar-summary">
          <div className="calendar-summary-item">
            <div className="calendar-summary-label">Tournament starts:</div>
            <div className="calendar-summary-value">
              {tempStartDate 
                ? tempStartDate.toLocaleString()
                : 'Not selected'
              }
            </div>
          </div>
          <div className="calendar-summary-item">
            <div className="calendar-summary-label">Tournament ends:</div>
            <div className="calendar-summary-value">
              {tempEndDate 
                ? tempEndDate.toLocaleString()
                : 'Not selected'
              }
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="calendar-actions">
          <button
            onClick={handleCancel}
            className="btn btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={!hasAllDates}
            className="btn btn-primary btn-glare flex-1"
          >
            <Check size={16} />
            {hasChanges ? 'Save Changes' : 'Confirm Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface TimeSelectorProps {
  initialHours: number;
  initialMinutes: number;
  onConfirm: (hours: number, minutes: number) => void;
  onCancel: () => void;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({
  initialHours,
  initialMinutes,
  onConfirm,
  onCancel
}) => {
  const [hours, setHours] = useState(initialHours);
  const [minutes, setMinutes] = useState(initialMinutes);

  const handleConfirm = () => {
    onConfirm(hours, minutes);
  };

  return (
    <div className="time-selector">
      <div className="time-inputs">
        <div className="time-input-group">
          <label className="time-input-label">Hours</label>
          <select
            value={hours}
            onChange={(e) => setHours(parseInt(e.target.value))}
            className="time-input"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        
        <div className="time-separator">:</div>
        
        <div className="time-input-group">
          <label className="time-input-label">Minutes</label>
          <select
            value={minutes}
            onChange={(e) => setMinutes(parseInt(e.target.value))}
            className="time-input"
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="time-selector-actions">
        <button onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
        <button onClick={handleConfirm} className="btn btn-primary">
          Confirm Time
        </button>
      </div>
    </div>
  );
};

export default MultiSelectCalendar;