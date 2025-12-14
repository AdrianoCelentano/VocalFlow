import { Note } from '../types';
import { getFrequencyFromMidi, noteStrings } from './audioUtils';

export const parseMusicXML = (xmlContent: string): Note[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
  const notes: Note[] = [];
  
  const noteElements = xmlDoc.getElementsByTagName("note");

  for (let i = 0; i < noteElements.length; i++) {
    const noteEl = noteElements[i];
    
    // Skip rests for now, or we could treat them as pauses
    if (noteEl.querySelector("rest")) continue;

    const pitchEl = noteEl.querySelector("pitch");
    if (!pitchEl) continue;

    const step = pitchEl.querySelector("step")?.textContent || "C";
    const octave = parseInt(pitchEl.querySelector("octave")?.textContent || "4", 10);
    const alter = parseInt(pitchEl.querySelector("alter")?.textContent || "0", 10);
    
    // Calculate MIDI
    let stepIndex = noteStrings.indexOf(step);
    // Adjust for alter (sharp/flat)
    // Note: musicXML step is just the letter. C, D, E...
    // We need to map standard C major scale to semitones.
    // C=0, D=2, E=4, F=5, G=7, A=9, B=11
    const stepToSemitone = {
      'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };
    
    let semitone = (stepToSemitone as any)[step] || 0;
    semitone += alter;

    const midi = (octave + 1) * 12 + semitone;
    const frequency = getFrequencyFromMidi(midi);

    // Duration is usually in 'divisions', relative.
    // For this simple app we might just take it as a raw value 
    // or look for <duration>.
    const duration = parseInt(noteEl.querySelector("duration")?.textContent || "1", 10);

    const lyric = noteEl.querySelector("lyric > text")?.textContent;

    // Construct pitch string (e.g. C#4)
    // We reverse map the semitone to our noteStrings array
    // normalize semitone to 0-11
    let normalizedSemitone = semitone;
    while(normalizedSemitone < 0) normalizedSemitone += 12;
    normalizedSemitone = normalizedSemitone % 12;
    
    const pitchStr = `${noteStrings[normalizedSemitone]}${octave}`;

    notes.push({
      id: `note-${i}-${Date.now()}`,
      pitch: pitchStr,
      midi,
      frequency,
      duration,
      lyric: lyric || undefined
    });
  }

  return notes;
};