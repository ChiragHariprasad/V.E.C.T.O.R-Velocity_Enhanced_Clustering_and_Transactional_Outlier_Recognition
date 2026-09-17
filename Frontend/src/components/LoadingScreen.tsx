import React from 'react';
import { Activity } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-base)] transition-colors duration-300">
      <div className="text-center">
        <Activity className="h-16 w-16 text-[var(--accent-primary)] mb-4 mx-auto animate-pulse-slow drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-widest mb-2 font-mono">V.E.C.T.O.R</h1>
        <p className="text-[var(--text-muted)] mb-8 font-mono text-sm tracking-widest uppercase">Initializing Intelligence Engine...</p>
        
        <div className="w-64 h-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full overflow-hidden mx-auto shadow-inner">
          <div className="h-full bg-[var(--accent-primary)] rounded-full animate-pulse-slow loading-shimmer shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
        </div>
        
        <p className="mt-4 text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-widest">Connecting to network and loading intelligence...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;