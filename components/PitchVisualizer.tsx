import React from 'react';
import { GameMode } from '../types';

interface PitchVisualizerProps {
  currentFreq: number | null;
  targetFreq: number;
  targetMidi: number;
  userMidi: number | null;
  mode: GameMode;
  centsOff: number;
}

const PitchVisualizer: React.FC<PitchVisualizerProps> = ({ 
  currentFreq, 
  targetFreq, 
  targetMidi, 
  userMidi, 
  mode,
  centsOff 
}) => {
  // Visual range +/- 100 cents (1 semitone)
  const range = 100;
  const clampedCents = Math.max(-range, Math.min(range, centsOff));
  const percent = ((clampedCents + range) / (range * 2)) * 100;

  // Tolerance zones
  // Easy: +/- 50 cents (approx)
  // Hard: +/- 20 cents
  const tolerance = mode === GameMode.EASY ? 50 : 20;
  const tolerancePercent = (tolerance / range) * 50; // half width in percent

  const isMatch = Math.abs(centsOff) <= tolerance && userMidi !== null;

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-4 bg-slate-800/50 rounded-xl backdrop-blur-sm border border-slate-700">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <span>Flat (b)</span>
        <span className={isMatch ? "text-green-400 font-bold" : "text-white"}>
          {isMatch ? "PERFECT" : "SING"}
        </span>
        <span>Sharp (#)</span>
      </div>
      
      <div className="relative h-12 bg-slate-900 rounded-full overflow-hidden border border-slate-700 shadow-inner">
        {/* Center Marker (Target) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-500 transform -translate-x-1/2 z-10"></div>
        
        {/* Tolerance Zone */}
        <div 
          className={`absolute top-0 bottom-0 bg-white/5 left-1/2 transform -translate-x-1/2 transition-all duration-300`}
          style={{ width: `${(tolerance / range) * 100}%` }}
        ></div>

        {/* User Cursor */}
        {currentFreq && currentFreq > 0 && (
          <div 
            className={`absolute top-1 bottom-1 w-4 rounded-full shadow-lg transform -translate-x-1/2 transition-all duration-75 ease-out z-20 ${
              isMatch ? 'bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.6)]' : 'bg-rose-500'
            }`}
            style={{ left: `${percent}%` }}
          >
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 -translate-y-full text-[10px] font-mono text-white whitespace-nowrap">
              {userMidi ? (centsOff > 0 ? `+${Math.round(centsOff)}` : Math.round(centsOff)) : ''}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between items-center text-sm font-mono">
         <div className="text-slate-400">Target: <span className="text-white">{Math.round(targetFreq)}Hz</span></div>
         <div className="text-slate-400">You: <span className={isMatch ? "text-green-400" : "text-rose-400"}>
            {currentFreq && currentFreq > 0 ? `${Math.round(currentFreq)}Hz` : '---'}
          </span></div>
      </div>
    </div>
  );
};

export default PitchVisualizer;