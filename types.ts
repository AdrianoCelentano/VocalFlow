export enum GameMode {
  EASY = 'EASY',
  HARD = 'HARD'
}

export interface Note {
  pitch: string; // e.g., "C4", "F#5"
  frequency: number;
  midi: number;
  duration: number; // in beats or relative units
  lyric?: string;
  id: string;
}

export interface Song {
  title: string;
  notes: Note[];
}

export interface AudioConfig {
  sampleRate: number;
  fftSize: number;
}