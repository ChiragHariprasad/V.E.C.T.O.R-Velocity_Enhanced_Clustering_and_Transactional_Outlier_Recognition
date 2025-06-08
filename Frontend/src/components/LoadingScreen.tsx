import React from 'react';
import { Activity } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="text-center">
        <Activity className="h-16 w-16 text-primary-500 mb-4 mx-auto animate-pulse-slow" />
        <h1 className="text-3xl font-bold text-primary-800 mb-2">V.E.C.T.O.R</h1>
        <p className="text-secondary-600 mb-8">Initializing fraud monitoring system...</p>
        
        <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full animate-pulse-slow loading-shimmer"></div>
        </div>
        
        <p className="mt-4 text-gray-500 text-sm">Connecting to database and loading transactions...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;