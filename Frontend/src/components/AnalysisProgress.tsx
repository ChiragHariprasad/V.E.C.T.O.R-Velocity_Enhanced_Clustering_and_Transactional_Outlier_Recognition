import React, { useState, useEffect } from 'react';
import { Database, Search, Cpu, BrainCircuit, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
  targetAddress: string;
}

const steps = [
  { id: 'query', label: 'Querying Graph Database', icon: Database, duration: 1500 },
  { id: 'trace', label: 'Tracing Multi-Hop Paths', icon: Search, duration: 2000 },
  { id: 'ml', label: 'Running Behavioral ML Models', icon: Cpu, duration: 2500 },
  { id: 'risk', label: 'Synthesizing Risk Heuristics', icon: BrainCircuit, duration: 1800 },
  { id: 'final', label: 'Assembling Intelligence Profile', icon: CheckCircle2, duration: 1200 }
];

const AnalysisProgress: React.FC<Props> = ({ onComplete, targetAddress }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (currentStep < steps.length) {
      const stepDuration = steps[currentStep].duration;
      const startTime = Date.now();
      
      const animateProgress = () => {
        const elapsed = Date.now() - startTime;
        const p = Math.min((elapsed / stepDuration) * 100, 100);
        setProgress(p);
        
        if (p < 100) {
          timer = setTimeout(animateProgress, 50);
        } else {
          setCurrentStep(s => s + 1);
        }
      };
      
      animateProgress();
    } else {
      setTimeout(onComplete, 500);
    }
    
    return () => clearTimeout(timer);
  }, [currentStep, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--network-cyan)]/10 text-[var(--network-cyan)] mb-4 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Wallet Intelligence Engine</h2>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-2">Target: {targetAddress}</p>
        </div>

        <div className="space-y-6">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const StepIcon = step.icon;

            return (
              <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${
                isCompleted ? 'opacity-100' : isCurrent ? 'opacity-100 scale-105' : 'opacity-40'
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isCompleted 
                    ? 'bg-[var(--success)]/20 text-[var(--success)]' 
                    : isCurrent 
                      ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30' 
                      : 'bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-muted)]'
                }`}>
                  <StepIcon className="w-5 h-5" />
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-semibold ${
                      isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                    }`}>
                      {step.label}
                    </span>
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />}
                    {isCurrent && <span className="text-xs font-mono text-[var(--accent-primary)]">{Math.round(progress)}%</span>}
                  </div>
                  
                  {isCurrent && (
                    <div className="h-1 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent-primary)] transition-all duration-75"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalysisProgress;
