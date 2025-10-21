import React, { useState } from 'react';
import { Message, Role } from '../types';
import { DownloadIcon, UserIcon, QuestionMarkIcon, AlertTriangleIcon, PencilIcon, SparklesIcon, TrashIcon, BackgroundRemovalIcon } from './Icons';
import ImageViewerModal from './ImageViewerModal';

interface MessageBubbleProps {
    message: Message;
    onEdit?: (imageData: { imageUrl: string; mimeType: string; data: string; }) => void;
    onEnhance?: (imageData: { imageUrl: string; mimeType: string; data: string; }) => void;
    onRemoveBackground?: (imageData: { imageUrl: string; mimeType: string; data: string; }) => void;
    onDelete?: (messageId: string, dbId: number) => void;
    searchQuery?: string;
}

const dataURLToBlob = (dataURL: string): Blob | null => {
    const parts = dataURL.split(',');
    if (parts.length !== 2) {
        console.error("Invalid data URL format for blob conversion.");
        return null;
    }
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch || mimeMatch.length < 2) {
        console.error("Could not extract mime type from data URL.");
        return null;
    }
    const mimeString = mimeMatch[1];
    
    try {
        const byteString = atob(parts[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    } catch (e) {
        console.error("Error decoding base64 string:", e);
        return null;
    }
};

const buttonBaseStyle = "p-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1 focus:ring-offset-black/20";

const DownloadButton: React.FC<{ imageUrl: string, mimeType?: string }> = ({ imageUrl, mimeType }) => {
    const handleDownload = () => {
        const blob = dataURLToBlob(imageUrl);

        if (!blob) {
            alert("An error occurred preparing the download. Opening image in a new tab for manual saving.");
            const newWindow = window.open(imageUrl, '_blank');
            if (newWindow) {
                newWindow.focus();
            } else {
                alert("Please allow popups for this site to download the image.");
            }
            return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        let extension = 'png';
        if (mimeType) {
            const extPart = mimeType.split('/')[1];
            if (extPart && /^[a-z0-9+]+$/.test(extPart)) {
                extension = extPart.split('+')[0];
            }
        }

        link.download = `aura-lofi-image-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <button
            onClick={handleDownload}
            className={`${buttonBaseStyle} bg-gray-900/50 text-gray-200 hover:bg-gray-800 hover:scale-110`}
            aria-label="Download image"
            title="Download image"
        >
            <DownloadIcon className="w-5 h-5" />
        </button>
    );
};

const EditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`${buttonBaseStyle} bg-gray-900/50 text-gray-200 hover:bg-gray-800 hover:scale-110`}
            aria-label="Edit image"
            title="Edit image"
        >
            <PencilIcon className="w-5 h-5" />
        </button>
    );
}

const EnhanceButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`${buttonBaseStyle} bg-gray-900/50 text-gray-200 hover:bg-gray-800 hover:scale-110`}
            aria-label="Enhance image"
            title="Enhance image"
        >
            <SparklesIcon className="w-5 h-5" />
        </button>
    );
}

const RemoveBackgroundButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`${buttonBaseStyle} bg-gray-900/50 text-gray-200 hover:bg-gray-800 hover:scale-110`}
            aria-label="Remove background"
            title="Remove background"
        >
            <BackgroundRemovalIcon className="w-5 h-5" />
        </button>
    );
}

const DeleteButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`${buttonBaseStyle} bg-red-900/50 text-red-300 hover:bg-red-800/80 hover:scale-110`}
            aria-label="Delete image"
            title="Delete image"
        >
            <TrashIcon className="w-5 h-5" />
        </button>
    );
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onEdit, onEnhance, onRemoveBackground, onDelete, searchQuery }) => {
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const isUser = message.role === Role.USER;
    const isModel = message.role === Role.MODEL;
    const isError = message.role === Role.ERROR;

    const bubbleClasses = `max-w-xl p-4 rounded-xl shadow-md ${
        isUser ? 'bg-purple-500 text-white ml-auto' :
        isError ? 'bg-red-900/50 text-red-300' :
        'bg-gray-700 text-gray-100'
    }`;


    const handleEdit = () => {
        if (onEdit && message.imageUrl && message.imageMimeType) {
            const base64Data = message.imageUrl.split(',')[1];
            if (base64Data) {
                onEdit({
                    imageUrl: message.imageUrl,
                    mimeType: message.imageMimeType,
                    data: base64Data,
                });
            }
        }
    };
    
    const handleEnhance = () => {
        if (onEnhance && message.imageUrl && message.imageMimeType) {
            const base64Data = message.imageUrl.split(',')[1];
            if (base64Data) {
                onEnhance({
                    imageUrl: message.imageUrl,
                    mimeType: message.imageMimeType,
                    data: base64Data,
                });
            }
        }
    };

    const handleRemoveBackground = () => {
        if (onRemoveBackground && message.imageUrl && message.imageMimeType) {
            const base64Data = message.imageUrl.split(',')[1];
            if (base64Data) {
                onRemoveBackground({
                    imageUrl: message.imageUrl,
                    mimeType: message.imageMimeType,
                    data: base64Data,
                });
            }
        }
    };
    
    const handleDelete = () => {
        if (onDelete && message.id.startsWith('db-')) {
            const dbId = parseInt(message.id.replace('db-', ''), 10);
            if (!isNaN(dbId)) {
                onDelete(message.id, dbId);
            }
        }
    };

    const handleOpenViewer = () => {
        if (message.imageUrl) {
            setIsViewerOpen(true);
        }
    };

    const getHighlightedText = (text: string, highlight: string) => {
        if (!highlight.trim()) {
            return <>{text}</>;
        }
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-400/40 text-yellow-100 rounded-[3px] px-0.5 py-0">
                            {part}
                        </mark>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };
    
    const renderImage = () => {
        if (!message.imageUrl) return null;

        return (
            <div className={`group relative ${message.text ? 'mt-2' : ''}`}>
                <button 
                    onClick={handleOpenViewer} 
                    className="block w-full rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2" 
                    aria-label="View larger image"
                >
                    <img
                        src={message.imageUrl}
                        alt={isUser ? "User upload" : "Generated by AI"}
                        className="w-full h-auto cursor-zoom-in transition-transform group-hover:scale-105"
                        onLoad={(e) => e.currentTarget.style.opacity = '1'}
                        style={{opacity: 0, transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-in-out'}}
                    />
                </button>
                <div className="absolute bottom-3 right-3 flex items-center gap-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                    <div className="flex items-center gap-1.5 backdrop-blur-md bg-black/40 p-1.5 rounded-full shadow-lg">
                        <DownloadButton imageUrl={message.imageUrl} mimeType={message.imageMimeType} />
                        {isModel && onEdit && <EditButton onClick={handleEdit} />}
                        {isModel && onEnhance && <EnhanceButton onClick={handleEnhance} />}
                        {isModel && onRemoveBackground && <RemoveBackgroundButton onClick={handleRemoveBackground} />}
                        {isModel && onDelete && <DeleteButton onClick={handleDelete} />}
                    </div>
                </div>
            </div>
        );
    }

    const Icon = isUser ? UserIcon : isError ? AlertTriangleIcon : QuestionMarkIcon;
    const iconContainerClasses = `flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-gray-600' : isError ? 'bg-red-600' : 'bg-purple-600'
    }`;
    const iconColor = isUser ? "text-gray-200" : "text-white";
    
    return (
        <>
            <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={iconContainerClasses}>
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
                <div className={bubbleClasses}>
                    {message.text && <p className="whitespace-pre-wrap">{getHighlightedText(message.text, searchQuery || '')}</p>}
                    {renderImage()}
                </div>
            </div>
            <ImageViewerModal
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                imageUrl={message.imageUrl || null}
            />
        </>
    );
};

export default MessageBubble;