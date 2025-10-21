import React, { useRef, useEffect } from 'react';
import { Message, Role, AspectRatio, GenerationStyle } from '../types';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import Spinner from './Spinner';
import { QuestionMarkIcon, SearchIcon } from './Icons';

interface ChatInterfaceProps {
    messages: Message[];
    isLoading: boolean;
    searchQuery: string;
    onSendMessage: (prompt: string, aspectRatio: AspectRatio, style: GenerationStyle, negativePrompt: string) => void;
    onStartEdit: (imageData: { imageUrl: string, mimeType: string, data: string }) => void;
    onStartEnhance: (imageData: { imageUrl: string, mimeType: string, data: string }) => void;
    onStartRemoveBackground: (imageData: { imageUrl: string, mimeType: string, data: string }) => void;
    onDeleteImage: (messageId: string, dbId: number) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    isLoading,
    searchQuery,
    onSendMessage,
    onStartEdit,
    onStartEnhance,
    onStartRemoveBackground,
    onDeleteImage,
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        // Only scroll to bottom on new messages, not when filtering
        if (!searchQuery) {
            scrollToBottom();
        }
    }, [messages, searchQuery]);

    return (
        <div className="flex flex-col h-full flex-grow relative">
            {messages.length <= 1 && !isLoading && !searchQuery && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                    <h2 className="text-[12vw] md:text-9xl font-serif font-bold text-white/10 select-none tracking-widest">
                        AURA LOFI
                    </h2>
                </div>
            )}
            <div className="flex-grow p-4 md:p-6 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-6">
                    {messages.map((msg) => (
                        <MessageBubble 
                            key={msg.id} 
                            message={msg}
                            onEdit={msg.role === Role.MODEL && msg.imageUrl ? onStartEdit : undefined}
                            onEnhance={msg.role === Role.MODEL && msg.imageUrl ? onStartEnhance : undefined}
                            onRemoveBackground={msg.role === Role.MODEL && msg.imageUrl ? onStartRemoveBackground : undefined}
                            onDelete={msg.role === Role.MODEL && msg.imageUrl && msg.id.startsWith('db-') ? onDeleteImage : undefined}
                            searchQuery={searchQuery}
                        />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-600">
                                    <QuestionMarkIcon className="w-5 h-5 text-white" />
                                </div>
                                <div className="bg-gray-700 backdrop-blur-sm p-4 rounded-xl shadow-md">
                                    <Spinner />
                                </div>
                             </div>
                        </div>
                    )}
                     {searchQuery && messages.length === 0 && !isLoading && (
                        <div className="text-center text-gray-400 py-10 px-4 bg-gray-800/50 rounded-lg backdrop-blur-sm">
                            <SearchIcon className="w-12 h-12 mx-auto text-gray-500" />
                            <p className="font-semibold mt-4">No results found</p>
                            <p className="text-sm mt-1">Your search for "{searchQuery}" did not match any messages.</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <InputBar onSendMessage={onSendMessage} isGenerating={isLoading} />
        </div>
    );
};

export default ChatInterface;