import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, AlertTriangle, Target, Smartphone, Monitor, Info, Eye, Square } from 'lucide-react';

interface CameraCalibrationGuideProps {
  isVisible: boolean;
  onClose: () => void;
  onCalibrationComplete: (calibrationData: CalibrationData) => void;
}

interface CalibrationData {
  courtBounds: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
    bottomRight: { x: number; y: number };
  };
  serviceLine: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  centerLine: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  netPosition: {
    start: { x: number; y: number };
    end: { x: number; y: number };
  };
  cameraAngle: number;
  distanceFromCourt: number;
  isCompleted: boolean;
}

const CameraCalibrationGuide: React.FC<CameraCalibrationGuideProps> = ({
  isVisible,
  onClose,
  onCalibrationComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationData>({
    courtBounds: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 }
    },
    serviceLine: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    centerLine: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    netPosition: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    cameraAngle: 0,
    distanceFromCourt: 0,
    isCompleted: false
  });

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkDevice();
  }, []);

  const calibrationSteps = [
    {
      title: "Camera Positioning Setup",
      icon: <Camera className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Optimal Camera Position
            </h4>
            <ul className="space-y-2 text-blue-800">
              <li>• <strong>Height:</strong> 2-3 meters above ground level</li>
              <li>• <strong>Distance:</strong> 5-8 meters from the court center</li>
              <li>• <strong>Angle:</strong> 15-30 degrees downward tilt</li>
              <li>• <strong>Position:</strong> Side of the court, not behind baseline</li>
            </ul>
          </div>
          
          {isMobile && (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
                <Smartphone className="w-5 h-5 mr-2" />
                Mobile Device Setup
              </h4>
              <ul className="space-y-2 text-amber-800">
                <li>• Hold phone horizontally (landscape mode)</li>
                <li>• Use a tripod or stable mount if available</li>
                <li>• Ensure good lighting - avoid direct sunlight</li>
                <li>• Keep device plugged in for extended monitoring</li>
              </ul>
            </div>
          )}
        </div>
      )
    },
    {
      title: "Court Boundary Calibration",
      icon: <Square className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-3">Mark Court Boundaries</h4>
            <p className="text-green-800 mb-3">
              You'll need to mark the four corners of the tennis court in the camera view:
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-green-800">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
                <span>Top-Left Corner</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                <span>Top-Right Corner</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-2"></div>
                <span>Bottom-Left Corner</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                <span>Bottom-Right Corner</span>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Visual Guidelines
            </h4>
            <ul className="space-y-1 text-purple-800 text-sm">
              <li>• Ensure all court lines are clearly visible</li>
              <li>• The entire court should fit within camera frame</li>
              <li>• Avoid shadows covering court lines</li>
              <li>• Net should be clearly visible</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Line Detection Setup",
      icon: <Target className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <h4 className="font-semibold text-indigo-900 mb-3">Critical Lines for AI Umpire</h4>
            <div className="space-y-3">
              <div className="border-l-4 border-red-500 pl-3">
                <h5 className="font-medium text-indigo-900">Service Lines</h5>
                <p className="text-sm text-indigo-700">
                  Mark both service lines for accurate serve call detection
                </p>
              </div>
              <div className="border-l-4 border-blue-500 pl-3">
                <h5 className="font-medium text-indigo-900">Baseline</h5>
                <p className="text-sm text-indigo-700">
                  Essential for in/out calls on groundstrokes
                </p>
              </div>
              <div className="border-l-4 border-green-500 pl-3">
                <h5 className="font-medium text-indigo-900">Sidelines</h5>
                <p className="text-sm text-indigo-700">
                  Critical for wide ball detection
                </p>
              </div>
              <div className="border-l-4 border-yellow-500 pl-3">
                <h5 className="font-medium text-indigo-900">Center Service Line</h5>
                <p className="text-sm text-indigo-700">
                  Required for service box call accuracy
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "AI Umpire Call Settings",
      icon: <AlertTriangle className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-900 mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Call Accuracy Settings
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-red-800 mb-1">
                  Ball Detection Sensitivity
                </label>
                <input 
                  type="range" 
                  min="0.3" 
                  max="0.9" 
                  step="0.1" 
                  defaultValue="0.7"
                  className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-red-600 mt-1">
                  <span>Less Sensitive</span>
                  <span>More Sensitive</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-red-800 mb-1">
                  Line Call Tolerance (cm)
                </label>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1" 
                  defaultValue="3"
                  className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-red-600 mt-1">
                  <span>Strict (1cm)</span>
                  <span>Lenient (10cm)</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h4 className="font-semibold text-yellow-900 mb-2">Call Types Enabled</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-yellow-800">In/Out calls on baseline and sidelines</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-yellow-800">Service line calls</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" defaultChecked className="mr-2" />
                <span className="text-yellow-800">Net touch detection</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-yellow-800">Foot fault detection (experimental)</span>
              </label>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Calibration Complete",
      icon: <CheckCircle className="w-6 h-6" />,
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-3 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              AI Umpire Ready!
            </h4>
            <p className="text-green-800 mb-3">
              Your camera is now calibrated for tennis match monitoring. The AI will:
            </p>
            <ul className="space-y-1 text-green-800 text-sm">
              <li>✓ Track ball position in real-time</li>
              <li>✓ Make accurate in/out calls</li>
              <li>✓ Monitor service box violations</li>
              <li>✓ Detect net touches</li>
              <li>✓ Record highlight moments</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
              <Info className="w-5 h-5 mr-2" />
              Usage Tips
            </h4>
            <ul className="space-y-1 text-blue-800 text-sm">
              <li>• Keep the camera stable during matches</li>
              <li>• Recalibrate if camera position changes</li>
              <li>• Check AI calls against obvious shots initially</li>
              <li>• Use manual override for disputed calls</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const handleNextStep = () => {
    if (currentStep < calibrationSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const completedCalibration = {
      ...calibrationData,
      isCompleted: true
    };
    setCalibrationData(completedCalibration);
    onCalibrationComplete(completedCalibration);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                {calibrationSteps[currentStep].icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Camera Calibration for Tennis AI Umpire
                </h2>
                <p className="text-sm text-gray-600">
                  Step {currentStep + 1} of {calibrationSteps.length}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {calibrationSteps[currentStep].title}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(((currentStep + 1) / calibrationSteps.length) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / calibrationSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Content */}
          <div className="mb-8">
            {calibrationSteps[currentStep].content}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <button
              onClick={handlePrevStep}
              disabled={currentStep === 0}
              className={`px-4 py-2 rounded-lg font-medium ${
                currentStep === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>
            
            {currentStep === calibrationSteps.length - 1 ? (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Start AI Monitoring
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCalibrationGuide; 