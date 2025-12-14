import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Upload, Play, Check, AlertCircle, Wand2, Volume2, Settings2 } from 'lucide-react';
import { Song, Note, GameMode } from './types';
import { parseMusicXML } from './services/musicXmlParser';
import { generateSong } from './services/geminiService';
import { autoCorrelate, getNoteFromFrequency } from './services/audioUtils';
import GameCanvas from './components/GameCanvas';
import PitchVisualizer from './components/PitchVisualizer';

const App: React.FC = () => {
  // Game State
  const [song, setSong] = useState<Song | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.EASY);
  const [isListening, setIsListening] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // Audio Analysis State
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [centsOff, setCentsOff] = useState<number>(0);
  const [userMidi, setUserMidi] = useState<number | null>(null);

  // Gemini State
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for Audio Context
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const matchDurationRef = useRef<number>(0); // How long matched in ms

  // Initialize Audio
  const startListening = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      detectPitch();
    } catch (err) {
      console.error("Error accessing microphone", err);
      setError("Could not access microphone. Please allow permissions.");
    }
  };

  const stopListening = () => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    setIsListening(false);
    setCurrentFreq(0);
  };

  const detectPitch = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);

    const frequency = autoCorrelate(buffer, audioContextRef.current.sampleRate);
    
    // Only process valid frequencies roughly in vocal range
    if (frequency > 80 && frequency < 1200) {
      setCurrentFreq(frequency);
      
      const midiFloat = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
      const midiNote = Math.round(midiFloat);
      const cents = (midiFloat - midiNote) * 100;
      
      setUserMidi(midiNote);
      setCentsOff(cents);
    } else {
      // Decay visualizer if no sound
      setCurrentFreq(0);
      setUserMidi(null);
    }

    rafIdRef.current = requestAnimationFrame(detectPitch);
  }, []);

  // Game Loop Logic
  useEffect(() => {
    if (!song || completed || !isListening || userMidi === null) return;

    const targetNote = song.notes[currentIndex];
    if (!targetNote) return;

    // Logic: Match midi note. 
    // Easy mode: tolerance is handled in PitchVisualizer visual, but for logic here:
    // If rounded MIDI matches target MIDI, we checkcents.
    
    // If userMidi == targetNote.midi, we are on the right semitone.
    const noteMatch = userMidi === targetNote.midi;

    // Tolerance logic
    const tolerance = gameMode === GameMode.EASY ? 50 : 25; // Cents tolerance
    const isTuneOkay = Math.abs(centsOff) <= tolerance;

    if (noteMatch && isTuneOkay) {
      matchDurationRef.current += 16; // approx 60fps frame time
    } else {
      matchDurationRef.current = Math.max(0, matchDurationRef.current - 16);
    }

    // Required hold time to advance (prevents glitchy skipping)
    // Updated to be significantly faster (20ms for Easy, 80ms for Hard)
    const requiredHoldTime = gameMode === GameMode.EASY ? 20 : 80; // ms

    if (matchDurationRef.current > requiredHoldTime) {
      // Advance to next note
      matchDurationRef.current = 0;
      if (currentIndex < song.notes.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setCompleted(true);
        stopListening();
      }
    }

  }, [currentFreq, userMidi, centsOff, currentIndex, song, gameMode, isListening, completed]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsedNotes = parseMusicXML(content);
        if (parsedNotes.length > 0) {
          setSong({ title: file.name.replace(".xml", "").replace(".musicxml", ""), notes: parsedNotes });
          setCurrentIndex(0);
          setCompleted(false);
          setError(null);
        } else {
          setError("No notes found in XML.");
        }
      } catch (err) {
        setError("Invalid MusicXML file.");
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    setError(null);
    try {
      const generatedSong = await generateSong(prompt);
      setSong(generatedSong);
      setCurrentIndex(0);
      setCompleted(false);
    } catch (err) {
      setError("Failed to generate song. Check API Key or try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setCompleted(false);
    matchDurationRef.current = 0;
    if (!isListening) startListening();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Volume2 className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            VocalFlow
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setGameMode(prev => prev === GameMode.EASY ? GameMode.HARD : GameMode.EASY)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 text-sm font-medium"
          >
            <Settings2 className="w-4 h-4" />
            Mode: <span className={gameMode === GameMode.EASY ? "text-green-400" : "text-rose-400"}>{gameMode}</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-8">
        
        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/50 text-rose-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Setup Section (Only if no song) */}
        {!song && (
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* Upload */}
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-colors group">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-slate-800 rounded-full group-hover:bg-indigo-500/20 transition-colors">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">Upload MusicXML</h2>
                <p className="text-slate-400 text-sm">Have a .musicxml file? Drop it here to start practicing.</p>
                <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-600/20">
                  Select File
                  <input type="file" accept=".xml,.musicxml" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            {/* AI Generate */}
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-fuchsia-500/50 transition-colors group">
               <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-slate-800 rounded-full group-hover:bg-fuchsia-500/20 transition-colors">
                  <Wand2 className="w-8 h-8 text-fuchsia-400" />
                </div>
                <h2 className="text-xl font-semibold text-white">AI Generator</h2>
                <p className="text-slate-400 text-sm">Describe a vibe, and AI will write a melody for you.</p>
                <div className="w-full flex gap-2">
                  <input 
                    type="text" 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A happy birthday song"
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-fuchsia-500 outline-none"
                  />
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt}
                    className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-lg font-medium transition-all"
                  >
                    {isGenerating ? "..." : "Go"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Area */}
        {song && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-white">{song.title}</h2>
                <p className="text-slate-400">Note {currentIndex + 1} of {song.notes.length}</p>
              </div>
              
              <div className="flex gap-2">
                {!isListening && !completed && (
                  <button onClick={startListening} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-600/20 transition-all">
                    <Mic className="w-5 h-5" /> Start Singing
                  </button>
                )}
                {isListening && (
                   <button onClick={stopListening} className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-full font-bold shadow-lg shadow-rose-600/20 transition-all">
                    <Mic className="w-5 h-5" /> Stop
                  </button>
                )}
                <button onClick={() => setSong(null)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full font-medium transition-colors">
                  Change Song
                </button>
              </div>
            </div>

            {/* Victory Screen */}
            {completed ? (
              <div className="bg-gradient-to-br from-emerald-900/50 to-slate-900 border border-emerald-500/30 rounded-2xl p-12 text-center space-y-6">
                <div className="inline-flex p-4 rounded-full bg-emerald-500/20 mb-4">
                  <Check className="w-12 h-12 text-emerald-400" />
                </div>
                <h3 className="text-4xl font-bold text-white">Song Completed!</h3>
                <p className="text-slate-300 max-w-md mx-auto">Great job! You've mastered the notes for "{song.title}".</p>
                <button onClick={restart} className="px-8 py-3 bg-white text-emerald-900 font-bold rounded-full hover:bg-emerald-50 transition-colors">
                  Sing Again
                </button>
              </div>
            ) : (
              <>
                 {/* Staff / Game View */}
                 <GameCanvas 
                  notes={song.notes} 
                  currentIndex={currentIndex} 
                  userMidi={userMidi} 
                  centsOff={centsOff} 
                />

                {/* Pitch Feedback */}
                {isListening && song.notes[currentIndex] && (
                  <PitchVisualizer 
                    currentFreq={currentFreq}
                    targetFreq={song.notes[currentIndex].frequency}
                    targetMidi={song.notes[currentIndex].midi}
                    userMidi={userMidi}
                    mode={gameMode}
                    centsOff={centsOff}
                  />
                )}
              </>
            )}

            {/* Hint */}
            {!isListening && !completed && (
              <div className="text-center text-slate-500 text-sm">
                Press "Start Singing" and hum or sing into your microphone.
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default App;