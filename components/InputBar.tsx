import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { SendIcon, LightBulbIcon, CogIcon, SparklesIcon } from './Icons';
import { ImageData, AspectRatio, aspectRatios, GenerationStyle, generationStyles } from '../types';
import { playSendSound } from '../utils/fileUtils';

interface InputBarProps {
    onSendMessage: (prompt: string, aspectRatio: AspectRatio, style: GenerationStyle, negativePrompt: string) => void;
    isGenerating: boolean;
}

const suggestions = [
    'Photograph of an astronaut riding a horse, realistic',
    'A Corgi dog dressed as a king, sitting on a throne, digital art',
    'Anime girl sitting by the window on a rainy day, lo-fi aesthetic',
    'A misty cyberpunk city with neon skyscrapers and flying cars',
    'Breathtaking fantasy landscape in the style of Studio Ghibli',
    'Close-up of a human eye with a galaxy reflected in it, cinematic, 4K',
    'A majestic dragon flying over a medieval castle, epic painting',
    'Minimalist logo for a coffee shop, a stylized coffee bean, vector design',
    'A cozy room with a fireplace, plants, and a sleeping cat, watercolor',
    'Portrait of a beautiful woman with hair made of flowers, fantasy art',
    'A cute robot serving tea in a Japanese garden, illustration style',
    'An enchanted forest at night, with bioluminescent mushrooms and fireflies',
    'A spaceship exploring a colorful nebula in outer space',
    'A juicy gourmet burger, food photography, studio lighting',
    'A knight in shining armor on a mountain, at sunset',
    'Illustration of a detailed treehouse in a giant forest',
    'A white tiger among cherry blossoms, Japanese ink painting',
    'Portrait of an old wizard with a long white beard, holding a glowing staff',
];

const InputBar: React.FC<InputBarProps> = ({ onSendMessage, isGenerating }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
    const [style, setStyle] = useState<GenerationStyle>('Default');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const suggestionsContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const handleSendMessage = () => {
        if (!prompt.trim() || isGenerating) {
            return;
        }
        
        playSendSound();
        onSendMessage(prompt.trim(), selectedAspectRatio, style, negativePrompt);
        setPrompt('');
    };

    const handleFormSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        handleSendMessage();
    };
    
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    const handleSurpriseMe = () => {
        const randomIndex = Math.floor(Math.random() * suggestions.length);
        setPrompt(suggestions[randomIndex]);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsContainerRef.current && !suggestionsContainerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const maxHeight = 200;
            
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [prompt]);

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm pt-4 pb-4 px-4 border-t border-white/10">
            <div className="max-w-2xl mx-auto">
                <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm text-gray-300 font-medium">Aspect Ratio:</span>
                    <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
                        {aspectRatios.map((ratio) => (
                            <button
                                key={ratio}
                                type="button"
                                onClick={() => setSelectedAspectRatio(ratio)}
                                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                    selectedAspectRatio === ratio 
                                        ? 'bg-purple-600 text-white shadow-md' 
                                        : 'text-gray-300 hover:bg-white/20'
                                }`}
                                disabled={isGenerating}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>
                {showAdvanced && (
                   <div className="mb-3 p-3 bg-white/5 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="style-select" className="block text-xs font-medium text-gray-400 mb-1">Style</label>
                            <select 
                                id="style-select"
                                value={style}
                                onChange={(e) => setStyle(e.target.value as GenerationStyle)}
                                className="w-full bg-gray-600 text-gray-100 text-sm rounded-md p-2 border border-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                disabled={isGenerating}
                            >
                                {generationStyles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="negative-prompt" className="block text-xs font-medium text-gray-400 mb-1">Negative Prompt</label>
                            <input
                                type="text"
                                id="negative-prompt"
                                value={negativePrompt}
                                onChange={(e) => setNegativePrompt(e.target.value)}
                                placeholder="e.g., text, low quality"
                                className="w-full bg-gray-600 text-gray-100 text-sm placeholder-gray-400 rounded-md p-2 border border-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                disabled={isGenerating}
                            />
                        </div>
                   </div>
                )}
                <form onSubmit={handleFormSubmit} className="flex items-start gap-3">
                    <div className="relative flex-grow" ref={suggestionsContainerRef}>
                        {showSuggestions && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 max-h-60 overflow-y-auto bg-gray-700/90 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-lg z-20">
                                <p className="text-xs text-gray-400 px-2 pb-1 font-semibold">Prompt suggestions</p>
                                <ul className="space-y-1">
                                    {suggestions.map((suggestion, index) => (
                                        <li key={index}>
                                            <button
                                                type="button"
                                                className="w-full text-left text-sm text-gray-200 hover:bg-purple-500/20 p-2 rounded-md transition-colors"
                                                onClick={() => {
                                                    setPrompt(suggestion);
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {suggestion}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe the image you want to generate... (Shift+Enter for new line)"
                            className="w-full bg-gray-600 text-gray-100 placeholder-gray-400 outline-none px-4 py-3 pr-28 rounded-lg focus:ring-2 focus:ring-purple-500 transition-all duration-150 resize-none"
                            rows={1}
                            disabled={isGenerating}
                        />
                        <div className="absolute right-3 bottom-2.5 flex items-center gap-1">
                             <button
                                type="button"
                                onClick={handleSurpriseMe}
                                className="text-gray-400 hover:text-purple-400 transition-colors disabled:opacity-50 p-1 rounded-full"
                                aria-label="Surprise me"
                                disabled={isGenerating}
                            >
                                <SparklesIcon className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSuggestions(s => !s)}
                                className="text-gray-400 hover:text-purple-400 transition-colors disabled:opacity-50 p-1 rounded-full"
                                aria-label="Show suggestions"
                                disabled={isGenerating}
                            >
                                <LightBulbIcon className="w-5 h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(s => !s)}
                                className={`transition-colors disabled:opacity-50 p-1 rounded-full ${showAdvanced ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-purple-400'}`}
                                aria-label="Advanced settings"
                                disabled={isGenerating}
                            >
                                <CogIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!prompt.trim() || isGenerating}
                        className="bg-purple-600 p-3 rounded-full text-white disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors flex-shrink-0"
                        aria-label="Send"
                    >
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default InputBar;