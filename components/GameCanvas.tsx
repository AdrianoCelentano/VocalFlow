import React, { useEffect, useRef } from 'react';
import { Note } from '../types';

interface GameCanvasProps {
  notes: Note[];
  currentIndex: number;
  userMidi: number | null;
  centsOff: number;
}

const NOTE_SPACING = 120; // Width per note
const STAFF_HEIGHT = 200;
const STEP_HEIGHT = 10; // Vertical pixels per diatonic step (1/2 spacing)
const C4_Y = 160; // Y position of Middle C (Ledger line below staff)
// Staff lines are at E4, G4, B4, D5, F5.
// C4=0 steps. E4=2 steps.
// Y(E4) = C4_Y - 2*10 = 140.
// Y(F5) = C4_Y - 10*10 = 60.

const GameCanvas: React.FC<GameCanvasProps> = ({ notes, currentIndex, userMidi, centsOff }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Helper: Map MIDI to diatonic steps from C4 (Middle C, MIDI 60)
  const getStepsFromC4 = (midi: number) => {
    const octave = Math.floor(midi / 12);
    const semitone = midi % 12;
    // Map semitone index (0-11) to diatonic step index (0-6)
    // C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6
    const stepMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const stepInOctave = stepMap[semitone];
    
    // Calculate total diatonic steps relative to C4 (Octave 4)
    // (octave - 4) * 7 steps per octave + step within octave
    return (octave - 4) * 7 + stepInOctave;
  };

  const getNoteY = (midi: number) => {
    const steps = getStepsFromC4(midi);
    return C4_Y - (steps * STEP_HEIGHT);
  };

  const isSharp = (pitch: string) => pitch.includes('#');

  // Center the view on the current index
  // Assuming the container is roughly 800px wide, center is ~400px.
  // We want: (currentIndex * NOTE_SPACING) + translateX = Center
  // translateX = Center - (currentIndex * NOTE_SPACING)
  const containerWidth = containerRef.current?.clientWidth || 800;
  const centerOffset = containerWidth / 2 - (NOTE_SPACING / 2);
  const translateX = centerOffset - (currentIndex * NOTE_SPACING);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-80 overflow-hidden bg-slate-900 rounded-xl border border-slate-700 shadow-2xl"
    >
      <svg className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        {/* Gradients */}
        <defs>
          <linearGradient id="noteGradientCurrent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="noteGradientDone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="glow">
             <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
             <feMerge>
                 <feMergeNode in="coloredBlur"/>
                 <feMergeNode in="SourceGraphic"/>
             </feMerge>
          </filter>
        </defs>

        {/* Moving Content Group */}
        <g 
          className="transition-transform duration-500 ease-out" 
          style={{ transform: `translateX(${translateX}px)` }}
        >
          {/* Staff Lines (Drawn long enough to cover the song) */}
          <g transform={`translate(-500, 0)`}> 
             {/* Draw lines relative to C4_Y. 
                 Lines at steps 2, 4, 6, 8, 10 relative to C4. 
                 E4, G4, B4, D5, F5 */}
             {[2, 4, 6, 8, 10].map(step => (
               <line 
                 key={step}
                 x1="0" 
                 y1={C4_Y - step * STEP_HEIGHT} 
                 x2={Math.max(2000, notes.length * NOTE_SPACING + 1000)} 
                 y2={C4_Y - step * STEP_HEIGHT} 
                 stroke="#475569" 
                 strokeWidth="2" 
               />
             ))}
          </g>

          {/* Notes */}
          {notes.map((note, idx) => {
            const y = getNoteY(note.midi);
            const isCurrent = idx === currentIndex;
            const isDone = idx < currentIndex;
            const hasSharp = isSharp(note.pitch);
            const steps = getStepsFromC4(note.midi);

            // Ledger Lines logic
            // Middle C (step 0) needs line.
            // A5 (step 12) needs line.
            // General rule: even steps outside range (2..10) need lines?
            // Actually, usually lines are at 0 (C4), -2 (A3)... and 12 (A5), 14 (C6)...
            const ledgerLines = [];
            if (steps <= 0) {
                for (let s = 0; s >= steps; s -= 2) ledgerLines.push(s);
            }
            if (steps >= 12) {
                for (let s = 12; s <= steps; s += 2) ledgerLines.push(s);
            }

            return (
              <g key={note.id} transform={`translate(${idx * NOTE_SPACING}, 0)`}>
                {/* Lyric */}
                <text 
                  x={NOTE_SPACING / 2} 
                  y={40} 
                  textAnchor="middle" 
                  className={`text-sm font-bold ${isCurrent ? "fill-white" : "fill-slate-500"}`}
                >
                  {note.lyric}
                </text>

                {/* Ledger Lines */}
                {ledgerLines.map(s => (
                  <line 
                    key={s}
                    x1={NOTE_SPACING/2 - 20} 
                    x2={NOTE_SPACING/2 + 20} 
                    y1={C4_Y - s * STEP_HEIGHT} 
                    y2={C4_Y - s * STEP_HEIGHT} 
                    stroke="#94a3b8" 
                    strokeWidth="2" 
                  />
                ))}

                {/* Note Stem (simple vertical line) - usually goes up for low notes, down for high */}
                <line 
                  x1={NOTE_SPACING/2 + 10} 
                  y1={y} 
                  x2={NOTE_SPACING/2 + 10} 
                  y2={y - 35} 
                  stroke={isCurrent ? "white" : isDone ? "#34d399" : "#cbd5e1"} 
                  strokeWidth="2" 
                />

                {/* Note Head */}
                <ellipse 
                  cx={NOTE_SPACING / 2} 
                  cy={y} 
                  rx="12" 
                  ry="9" 
                  transform={`rotate(-15 ${NOTE_SPACING/2} ${y})`}
                  fill={isCurrent ? "url(#noteGradientCurrent)" : isDone ? "url(#noteGradientDone)" : "#cbd5e1"}
                  filter={isCurrent ? "url(#glow)" : ""}
                  className="transition-colors duration-300"
                />

                {/* Sharp Symbol */}
                {hasSharp && (
                  <text 
                    x={NOTE_SPACING/2 - 25} 
                    y={y + 5} 
                    fill={isCurrent ? "white" : "#cbd5e1"} 
                    fontSize="20" 
                    fontWeight="bold"
                  >
                    #
                  </text>
                )}
                
                {/* Note Name Label (Optional helper) */}
                {isCurrent && (
                   <text 
                     x={NOTE_SPACING/2} 
                     y={y + 30} 
                     textAnchor="middle" 
                     className="fill-indigo-300 text-xs font-mono"
                   >
                     {note.pitch}
                   </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Static Overlay Elements (Clef, User Cursor) */}
        
        {/* Treble Clef (Simplified visual representation) */}
        <text x="20" y={145} fontSize="80" fill="#475569" style={{ fontFamily: 'serif' }}>𝄞</text>

        {/* User Singing Cursor (Real-time feedback) */}
        {userMidi && (
           <g 
             transform={`translate(${centerOffset + (NOTE_SPACING/2)}, ${getNoteY(userMidi)})`} 
             className="transition-transform duration-100 ease-linear"
            >
             <circle r="8" fill="#f43f5e" filter="url(#glow)" opacity="0.8" />
             <text x="12" y="4" fill="#f43f5e" fontSize="10" fontWeight="bold">YOU</text>
             {/* Cents indicator line */}
             <line x1="0" y1="0" x2="0" y2={-centsOff * 0.2} stroke="#f43f5e" strokeWidth="2" opacity="0.5" />
           </g>
        )}

      </svg>
      
      {/* Center Line Indicator */}
      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-indigo-500/20 -translate-x-1/2 pointer-events-none"></div>
    </div>
  );
};

export default GameCanvas;