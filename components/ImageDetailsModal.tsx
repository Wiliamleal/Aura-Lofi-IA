import React, { useMemo, FC } from 'react';
import { Message, Role } from '../types';
import { XIcon, DownloadIcon } from './Icons';

interface ImageDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedMessage: Message | null;
    messages: Message[];
}

const dataURLToBlob = (dataURL: string): Blob | null => {
    const parts = dataURL.split(',');
    if (parts.length !== 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
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
        return null;
    }
};

const DownloadButton: FC<{ imageUrl: string, mimeType?: string }> = ({ imageUrl, mimeType }) => {
    const handleDownload = () => {
        const blob = dataURLToBlob(imageUrl);
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = mimeType?.split('/')[1] || 'png';
        link.download = `aura-lofi-image-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors"
        >
            <DownloadIcon className="w-5 h-5" />
            Download
        </button>
    );
};

const DetailItem: FC<{ label: string; value: string | undefined }> = ({ label, value }) => {
    if (!value || value.trim() === '') return null;
    return (
        <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-sm text-gray-200 bg-white/5 p-2 rounded-md mt-1 whitespace-pre-wrap">{value}</p>
        </div>
    );
};


const ImageDetailsModal: FC<ImageDetailsModalProps> = ({ isOpen, onClose, selectedMessage, messages }) => {
    
    const associatedPrompt = useMemo(() => {
        if (!selectedMessage) return null;
        const modelMsgIndex = messages.findIndex(m => m.id === selectedMessage.id);
        if (modelMsgIndex > 0) {
            for (let i = modelMsgIndex - 1; i >= 0; i--) {
                if (messages[i].role === Role.USER) {
                    return messages[i];
                }
            }
        }
        return null;
    }, [selectedMessage, messages]);
    
    if (!isOpen || !selectedMessage || !selectedMessage.imageUrl) {
        return null;
    }

    const params = associatedPrompt?.generationParams;

    return (
        <div
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-details-title"
        >
            <div
                className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-grow bg-gray-900 flex items-center justify-center p-4 md:p-6">
                    <img
                        src={selectedMessage.imageUrl}
                        alt="Generated image details"
                        className="max-w-full max-h-full object-contain rounded-md"
                    />
                </div>
                <div className="w-full md:w-80 flex-shrink-0 bg-gray-800 p-6 flex flex-col border-t md:border-t-0 md:border-l border-white/10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 id="image-details-title" className="text-xl font-bold text-white">Image Details</h3>
                         <button onClick={onClose} className="text-gray-500 hover:text-white"><XIcon className="w-6 h-6" /></button>
                    </div>
                    <div className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-4">
                        <DetailItem label="Prompt" value={associatedPrompt?.text} />
                        <DetailItem label="Style" value={params?.style} />
                        <DetailItem label="Aspect Ratio" value={params?.aspectRatio} />
                        <DetailItem label="Negative Prompt" value={params?.negativePrompt} />
                    </div>
                     <div className="mt-6 flex-shrink-0">
                        <DownloadButton imageUrl={selectedMessage.imageUrl} mimeType={selectedMessage.imageMimeType} />
                     </div>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ImageDetailsModal;