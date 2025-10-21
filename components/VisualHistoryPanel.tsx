import React, { useMemo } from 'react';
import { Message, Role } from '../types';
import { ImageIcon } from './Icons';

interface VisualHistoryPanelProps {
    isOpen: boolean;
    messages: Message[];
    onThumbnailClick: (message: Message) => void;
}

const VisualHistoryPanel: React.FC<VisualHistoryPanelProps> = ({ isOpen, messages, onThumbnailClick }) => {
    const imageMessages = useMemo(() => {
        return messages.filter(msg => msg.role === Role.MODEL && msg.imageUrl).reverse();
    }, [messages]);

    if (!isOpen) {
        return null;
    }

    return (
        <aside className="w-64 bg-gray-800/50 backdrop-blur-sm border-r border-white/10 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out">
            <h3 className="p-4 font-bold text-lg text-white border-b border-white/10 flex-shrink-0">Image History</h3>
            <div className="flex-grow overflow-y-auto p-2">
                {imageMessages.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {imageMessages.map(msg => (
                            <button
                                key={msg.id}
                                onClick={() => onThumbnailClick(msg)}
                                className="aspect-square bg-gray-700 rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-purple-500"
                                aria-label="View image details"
                            >
                                <img
                                    src={msg.imageUrl}
                                    alt="Generated image thumbnail"
                                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                    loading="lazy"
                                />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 p-4">
                        <ImageIcon className="w-12 h-12 mb-2" />
                        <p className="text-sm font-medium">No images generated yet.</p>
                        <p className="text-xs">Your generated images will appear here.</p>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default VisualHistoryPanel;
