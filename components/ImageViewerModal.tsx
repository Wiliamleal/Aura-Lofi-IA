import React, { useState, useEffect, useRef } from 'react';
import { XIcon, ZoomInIcon, ZoomOutIcon, ResetViewIcon } from './Icons';

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string | null;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, imageUrl }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
    const imageContainerRef = useRef<HTMLDivElement>(null);

    // Reset state when modal is opened or image changes
    useEffect(() => {
        if (isOpen) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen, imageUrl]);

    // Handle keyboard events for accessibility
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    const handleZoomIn = () => setScale(s => Math.min(s * 1.25, 8));
    const handleZoomOut = () => setScale(s => Math.max(s / 1.25, 0.1));
    const handleReset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const zoomIntensity = 0.2;
        const newScale = Math.min(Math.max(scale + delta * zoomIntensity * scale, 0.1), 8);
        
        if (imageContainerRef.current) {
            const rect = imageContainerRef.current.getBoundingClientRect();
            // Mouse position relative to the container
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate the position of the point under the mouse before the transform
            const pointX = (mouseX - position.x) / scale;
            const pointY = (mouseY - position.y) / scale;

            // The new position is calculated to keep the point under the mouse stationary
            const newX = mouseX - pointX * newScale;
            const newY = mouseY - pointY * newScale;

            setScale(newScale);
            setPosition({ x: newX, y: newY });
        }
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (scale <= 1) return; // Only allow dragging when zoomed
        setIsDragging(true);
        setStartDrag({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            setPosition({
                x: e.clientX - startDrag.x,
                y: e.clientY - startDrag.y,
            });
        }
    };

    if (!isOpen || !imageUrl) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
        >
            <div 
                ref={imageContainerRef}
                className="w-full h-full flex items-center justify-center overflow-hidden"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
            >
                <img
                    src={imageUrl}
                    alt="Zoomed view"
                    className="max-w-none max-h-none block rounded-sm"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        cursor: isDragging ? 'grabbing' : (scale > 1 ? 'grab' : 'default'),
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    }}
                    draggable="false"
                />
            </div>

            <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white z-50 transition-colors" aria-label="Close viewer">
                <XIcon className="w-8 h-8" />
            </button>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 p-2 rounded-full flex items-center gap-2 z-50 backdrop-blur-sm">
                <button onClick={handleZoomOut} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Zoom out"><ZoomOutIcon className="w-6 h-6" /></button>
                <button onClick={handleReset} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Reset view"><ResetViewIcon className="w-6 h-6" /></button>
                <button onClick={handleZoomIn} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Zoom in"><ZoomInIcon className="w-6 h-6" /></button>
            </div>
        </div>
    );
};

export default ImageViewerModal;