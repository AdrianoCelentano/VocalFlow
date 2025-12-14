import { GoogleGenAI, Type } from "@google/genai";
import { Note, Song } from "../types";
import { getFrequencyFromMidi } from "./audioUtils";

// NOTE: In a real app, strict validation would happen here.
// We assume the model follows instructions well.

export const generateSong = async (topic: string): Promise<Song> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Create a simple, singable melody about: "${topic}".
    The melody should be simple, suitable for a beginner singer.
    Keep it between 5 to 10 notes maximum.
    Return the result as a JSON object with a title and a list of notes.
    Each note needs a midi number (integer between 48 and 72) and an optional lyric word.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          notes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                midi: { type: Type.INTEGER, description: "MIDI note number (48-84)" },
                lyric: { type: Type.STRING, description: "One word lyric for this note" },
                duration: { type: Type.INTEGER, description: "Relative duration, default 4" }
              },
              required: ["midi"]
            }
          }
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  const data = JSON.parse(response.text);
  
  const parsedNotes: Note[] = data.notes.map((n: any, index: number) => {
    const midi = n.midi;
    const frequency = getFrequencyFromMidi(midi);
    // Simple reverse mapping for display
    const octave = Math.floor(midi / 12) - 1;
    const semitone = midi % 12;
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const pitch = `${noteNames[semitone]}${octave}`;

    return {
      id: `gen-note-${index}`,
      midi,
      frequency,
      pitch,
      duration: n.duration || 4,
      lyric: n.lyric
    };
  });

  return {
    title: data.title || "AI Melody",
    notes: parsedNotes
  };
};