import { ImageData } from '../types';

export const fileToImageData = (file: File): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(',');
      if (!header || !data) {
        reject(new Error("Invalid file format"));
        return;
      }
      
      const mimeTypeMatch = header.match(/:(.*?);/);
      if (!mimeTypeMatch || !mimeTypeMatch[1]) {
        reject(new Error("Could not determine MIME type"));
        return;
      }

      resolve({
        mimeType: mimeTypeMatch[1],
        data: data,
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

// --- Sound Effect Utilities ---

// Create a single AudioContext to be reused
let audioContext: AudioContext | null = null;
// Store nodes for the loading sound to stop them later
let loadingNodes: {
    oscillator: OscillatorNode;
    lfo: OscillatorNode;
    gainNode: GainNode;
} | null = null;


const getAudioContext = (): AudioContext | null => {
    if (audioContext) {
        // Resume context if it was suspended by browser policy
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    }
    try {
        // For browsers that support it.
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
           audioContext = new AudioContext();
           return audioContext;
        }
    } catch (e) {
        console.warn("Web Audio API is not supported in this browser.");
    }
    return null;
}

// A function to ensure the AudioContext is started by user interaction
export const initAudio = () => {
    if (!audioContext) {
        getAudioContext();
    }
}

/**
 * Plays a soft, low-frequency "swoosh" sound for sending actions.
 */
export const playSendSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Sound shape
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15); // Fast decay

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime); // Start frequency
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1); // Pitch drop

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
};

/**
 * Plays a gentle, positive "chime" sound for success actions.
 */
export const playSuccessSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Sound shape
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4); // Longer decay

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(700, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
};

/**
 * Plays a continuous, low-frequency humming sound for loading states.
 */
export const playLoadingSound = () => {
    const ctx = getAudioContext();
    if (!ctx || loadingNodes) return; // Don't start if already playing

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    // Low-frequency oscillator for a pulsing effect
    lfo.type = 'sine';
    lfo.frequency.value = 4; // 4Hz pulse
    lfoGain.gain.value = 0.05; // Pulse depth

    // Main oscillator for the hum
    oscillator.type = 'sine';
    oscillator.frequency.value = 100; // Low hum

    // Initial volume with fade-in
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.5);

    // Connect nodes: LFO -> LFO Gain -> Main Gain's Gain -> Destination
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    lfo.start();
    oscillator.start();

    loadingNodes = { oscillator, lfo, gainNode };
};

/**
 * Stops the loading sound with a fade-out.
 */
export const stopLoadingSound = () => {
    const ctx = getAudioContext();
    if (!ctx || !loadingNodes) return;

    const { gainNode, oscillator, lfo } = loadingNodes;
    
    // Fade out
    gainNode.gain.cancelScheduledValues(ctx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

    oscillator.stop(ctx.currentTime + 0.5);
    lfo.stop(ctx.currentTime + 0.5);
    
    loadingNodes = null;
};