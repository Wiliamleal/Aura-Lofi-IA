export enum Role {
  USER = 'user',
  MODEL = 'model',
  ERROR = 'error',
}

export interface Message {
  id: string;
  role: Role;
  text?: string;
  imageUrl?: string;
  imageMimeType?: string;
  generationParams?: {
    aspectRatio: AspectRatio;
    style: GenerationStyle;
    negativePrompt: string;
  };
}

export interface ImageData {
  mimeType: string;
  data: string; // base64 encoded string without the data URL prefix
}

export type AspectRatio = '1:1' | '16:9' | '9:16';

export const aspectRatios: AspectRatio[] = ['1:1', '16:9', '9:16'];

export type GenerationStyle = 'Default' | 'Photorealistic' | 'Anime' | 'Illustration' | 'Aquarela' | 'Cyberpunk' | 'Fantasia' | 'Pixel Art' | 'Minimalista' | 'Modelo 3D' | 'Isométrico' | 'Arte Abstrata' | 'Arte Vintage' | 'Arte Noir';

export const generationStyles: GenerationStyle[] = ['Default', 'Photorealistic', 'Anime', 'Illustration', 'Aquarela', 'Cyberpunk', 'Fantasia', 'Pixel Art', 'Minimalista', 'Modelo 3D', 'Isométrico', 'Arte Abstrata', 'Arte Vintage', 'Arte Noir'];

// --- New Filter Types ---

export type FilterPreset = {
  name: string;
  style: string; // CSS filter string
};

export const filterPresets: FilterPreset[] = [
  { name: 'Original', style: 'none' },
  { name: 'Vintage', style: 'sepia(0.6) contrast(1.1) brightness(0.9) saturate(1.2)' },
  { name: 'Lomo', style: 'contrast(1.4) saturate(1.1) brightness(0.9) hue-rotate(-10deg) sepia(0.3)' },
  { name: 'Noir', style: 'grayscale(1) contrast(1.3) brightness(0.9)' },
  { name: 'Technicolor', style: 'contrast(1.5) brightness(1.1) saturate(1.8) hue-rotate(-20deg)' },
  { name: 'Pastel', style: 'saturate(0.7) contrast(0.9) brightness(1.1)' },
  { name: 'Vivid', style: 'saturate(1.5) contrast(1.2) brightness(1.05)' },
  { name: 'Cool', style: 'contrast(1.1) brightness(1.05) hue-rotate(-15deg) saturate(1.1)' },
  { name: 'Warm', style: 'sepia(0.2) contrast(1.05) brightness(1.05) hue-rotate(10deg)' },
];