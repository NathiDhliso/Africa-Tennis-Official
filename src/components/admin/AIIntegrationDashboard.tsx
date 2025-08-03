import React, { useState, useEffect } from 'react';
import {
  Brain,
  Eye,
  BarChart3,
  Settings,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Target,
  Server,
  Wifi,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

interface AISystemStatus {
  id: string;
  name: string;
  type: 'umpire' | 'coach' | 'analytics' | 'video';
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  accuracy: number;
  uptime: number;
  lastUpdate: number;
  matchesServed: number;
  callsMade?: number;
  insightsGenerated?: number;
  processingTime: number;
  errorRate: number;
}

interface SystemMetrics {
  totalMatches: number;
  activeMatches: number;
  totalCalls: number;
  totalInsights: number;
  averageAccuracy: number;
  systemUptime: number;
  errorRate: number;
  processingSpeed: number;
}

interface AIIntegrationDashboardProps {
  tournamentId?: string;
  isAdmin: boolean;
}

const AIIntegrationDashboard: React.FC<AIIntegrationDashboardProps> = ({
  isAdmin
}) => {
  const [systems, setSystems] = useState<AISystemStatus[]>([
    {
      id: 'ai-umpire-1',
      name: 'AI Umpire System',
      type: 'umpire',
      status: 'active',
      accuracy: 95.2,
      uptime: 99.8,
      lastUpdate: Date.now() - 30000,
      matchesServed: 47,
      callsMade: 1247,
      processingTime: 45,
      errorRate: 0.8
    },
    {
      id: 'ai-coach-1',
      name: 'AI Tennis Coach',
      type: 'coach',
      status: 'active',
      accuracy: 92.7,
      uptime: 98.5,
      lastUpdate: Date.now() - 15000,
      matchesServed: 52,
      insightsGenerated: 834,
      processingTime: 120,
      errorRate: 1.2
    },
    {
      id: 'analytics-1',
      name: 'Real-Time Analytics',
      type: 'analytics',
      status: 'active',
      accuracy: 97.1,
      uptime: 99.9,
      lastUpdate: Date.now() - 5000,
      matchesServed: 63,
      processingTime: 25,
      errorRate: 0.3
    },
    {
      id: 'video-analysis-1',
      name: 'Video Analysis Engine',
      type: 'video',
      status: 'maintenance',
      accuracy: 94.8,
      uptime: 95.2,
      lastUpdate: Date.now() - 300000,
      matchesServed: 28,
      processingTime: 180,
      errorRate: 2.1
    }
  ]);
  
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalMatches: 63,
    activeMatches: 12,
    totalCalls: 1247,
    totalInsights: 834,
    averageAccuracy: 94.9,
    systemUptime: 98.6,
    errorRate: 1.1,
    processingSpeed: 92.5
  });
  
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
    system: string;
  }>>([]);

  // Fetch real-time data from API
  useEffect(() => {
    const fetchSystemData = async () => {
      try {
        const response = await fetch('/api/ai-systems/status');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSystems(data.systems || []);
            setMetrics(data.metrics || metrics);
            
            // Check for alerts based on real data
            data.systems?.forEach((system: AISystemStatus) => {
              if (system.accuracy < 90 || system.uptime < 95) {
                const alertId = `alert_${Date.now()}_${system.id}`;
                setAlerts(prevAlerts => {
                  const newAlert = {
                    id: alertId,
                    type: system.accuracy < 90 ? 'warning' as const : 'error' as const,
                    message: system.accuracy < 90 
                      ? `${system.name} accuracy dropped to ${system.accuracy.toFixed(1)}%`
                      : `${system.name} uptime dropped to ${system.uptime.toFixed(1)}%`,
                    timestamp: Date.now(),
                    system: system.name
                  };
                  return [newAlert, ...prevAlerts.slice(0, 9)];
                });
              }
            });
          }
        }
      } catch (error) {
        console.error('Error fetching AI system status:', error);
      }
    };

    fetchSystemData();
    const interval = setInterval(fetchSystemData, 5000);
    
    return () => clearInterval(interval);
  }, [metrics]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'inactive': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'maintenance': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get system icon
  const getSystemIcon = (type: string) => {
    switch (type) {
      case 'umpire': return Eye;
      case 'coach': return Brain;
      case 'analytics': return BarChart3;
      case 'video': return Play;
      default: return Activity;
    }
  };

  // Handle system control
  const handleSystemControl = (systemId: string, action: 'start' | 'stop' | 'restart') => {
    if (!isAdmin) return;
    
    setSystems(prev => prev.map(system => {
      if (system.id === systemId) {
        let newStatus = system.status;
        switch (action) {
          case 'start':
            newStatus = 'active';
            break;
          case 'stop':
            newStatus = 'inactive';
            break;
          case 'restart':
            newStatus = 'maintenance';
            setTimeout(() => {
              setSystems(current => current.map(s => 
                s.id === systemId ? { ...s, status: 'active' } : s
              ));
            }, 3000);
            break;
        }
        
        setAlerts(prev => [{
          id: `alert_${Date.now()}`,
          type: 'info',
          message: `${system.name} ${action} initiated`,
          timestamp: Date.now(),
          system: system.name
        }, ...prev.slice(0, 9)]);
        
        return { ...system, status: newStatus, lastUpdate: Date.now() };
      }
      return system;
    }));
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="ai-integration-dashboard p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-standard flex items-center gap-3">
            <Server className="h-8 w-8 text-quantum-cyan" />
            AI Systems Dashboard
          </h1>
          <p className="text-text-subtle mt-1">
            Monitor and manage AI-powered tennis analysis systems
          </p>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn btn-secondary"
          >
            <Settings className="h-5 w-5 mr-2" />
            Settings
          </button>
        )}
      </div>

      {/* System Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-5 w-5 text-quantum-cyan" />
            <span className="text-sm font-medium text-text-subtle">Active Matches</span>
          </div>
          <div className="text-2xl font-bold text-text-standard">{metrics.activeMatches}</div>
          <div className="text-xs text-text-subtle">of {metrics.totalMatches} total</div>
        </div>
        
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium text-text-subtle">Avg Accuracy</span>
          </div>
          <div className="text-2xl font-bold text-text-standard">{metrics.averageAccuracy.toFixed(1)}%</div>
          <div className="text-xs text-green-600">+0.3% from yesterday</div>
        </div>
        
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Wifi className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-text-subtle">System Uptime</span>
          </div>
          <div className="text-2xl font-bold text-text-standard">{metrics.systemUptime.toFixed(1)}%</div>
          <div className="text-xs text-blue-600">Last 24 hours</div>
        </div>
        
        <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span className="text-sm font-medium text-text-subtle">Processing Speed</span>
          </div>
          <div className="text-2xl font-bold text-text-standard">{metrics.processingSpeed.toFixed(1)}%</div>
          <div className="text-xs text-yellow-600">Optimal performance</div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {systems.map((system) => {
          const Icon = getSystemIcon(system.type);
          return (
            <div
              key={system.id}
              className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4 hover:border-quantum-cyan transition-colors cursor-pointer"
              onClick={() => setSelectedSystem(selectedSystem === system.id ? null : system.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 text-quantum-cyan" />
                  <div>
                    <h3 className="font-semibold text-text-standard">{system.name}</h3>
                    <p className="text-xs text-text-subtle capitalize">{system.type} system</p>
                  </div>
                </div>
                
                <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(system.status)}`}>
                  {system.status.toUpperCase()}
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="text-xs text-text-subtle mb-1">Accuracy</div>
                  <div className="text-lg font-bold text-text-standard">{system.accuracy.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-text-subtle mb-1">Uptime</div>
                  <div className="text-lg font-bold text-text-standard">{system.uptime.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-text-subtle mb-1">Matches</div>
                  <div className="text-lg font-bold text-text-standard">{system.matchesServed}</div>
                </div>
              </div>
              
              {selectedSystem === system.id && (
                <div className="border-t border-border-subtle pt-3 mt-3">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-text-subtle mb-1">Processing Time</div>
                      <div className="text-sm font-medium">{system.processingTime}ms avg</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-subtle mb-1">Error Rate</div>
                      <div className="text-sm font-medium">{system.errorRate.toFixed(1)}%</div>
                    </div>
                    {system.callsMade && (
                      <div>
                        <div className="text-xs text-text-subtle mb-1">Calls Made</div>
                        <div className="text-sm font-medium">{system.callsMade.toLocaleString()}</div>
                      </div>
                    )}
                    {system.insightsGenerated && (
                      <div>
                        <div className="text-xs text-text-subtle mb-1">Insights Generated</div>
                        <div className="text-sm font-medium">{system.insightsGenerated.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-text-subtle mb-3">
                    Last Update: {formatTimeAgo(system.lastUpdate)}
                  </div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSystemControl(system.id, 'start');
                        }}
                        className="btn btn-sm btn-secondary flex-1"
                        disabled={system.status === 'active'}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSystemControl(system.id, 'stop');
                        }}
                        className="btn btn-sm btn-secondary flex-1"
                        disabled={system.status === 'inactive'}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Stop
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSystemControl(system.id, 'restart');
                        }}
                        className="btn btn-sm btn-secondary flex-1"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restart
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alerts and Notifications */}
      <div className="bg-glass-bg backdrop-filter-blur border border-glass-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning-orange" />
          <h3 className="font-semibold text-text-standard">System Alerts</h3>
          <span className="text-xs bg-warning-orange bg-opacity-20 text-warning-orange px-2 py-1 rounded-full">
            {alerts.length}
          </span>
        </div>
        
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-text-subtle">All systems operating normally</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.type === 'error' ? 'bg-red-50 border-red-200' :
                  alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />}
                {alert.type === 'info' && <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />}
                
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-standard">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-text-subtle">{alert.system}</span>
                    <span className="text-xs text-text-subtle">•</span>
                    <span className="text-xs text-text-subtle">{formatTimeAgo(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIIntegrationDashboard;