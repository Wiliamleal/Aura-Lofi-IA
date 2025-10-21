import React, { useState, useEffect, useRef, FC, useCallback } from 'react';
import { ImageData, FilterPreset, filterPresets } from '../types';
import { XIcon, DownloadIcon, CheckIcon, BrushIcon, UndoIcon, RedoIcon, OpacityIcon, CropIcon, RotateRightIcon, FlipHorizontalIcon, FlipVerticalIcon, ZoomInIcon, ZoomOutIcon, ResetViewIcon, SlidersIcon, TransformIcon, ArrowsPointingOutIcon, WandSparklesIcon, BackgroundRemovalIcon, TrashIcon } from './Icons';
import { editImage, removeBackground } from '../services/geminiService';
import Spinner from './Spinner';
import { playSendSound, playSuccessSound, playLoadingSound, stopLoadingSound } from '../utils/fileUtils';

type EditorTool = 'brush' | 'transform' | 'adjust' | 'expand' | 'filters' | 'removeBackground' | 'aiFilters';
type CropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const aiFilterPresets = [
  { name: 'Ghibli', prompt: 'Redraw this image in the style of a Studio Ghibli anime film, with soft lighting and beautiful painted backgrounds.' },
  { name: 'Pixel Art', prompt: 'Convert this image into detailed pixel art.' },
  { name: 'Van Gogh', prompt: 'Repaint this image in the expressive, post-impressionist style of Vincent van Gogh, with thick, swirling brushstrokes.' },
  { name: 'Neon Noir', prompt: 'Transform this image into a neon noir art style, with dramatic shadows, glowing neon highlights, and a cinematic feel.' },
  { name: 'Claymation', prompt: 'Recreate this image as if it were made of clay, in a stop-motion animation style (claymation).' },
  { name: 'Comic Book', prompt: 'Make this image look like a vintage comic book panel, with halftone dots, bold outlines, and a limited color palette.' },
  { name: 'Fantasy', prompt: 'Turn this image into a high-fantasy digital painting, with epic lighting and magical elements.' },
  { name: 'Watercolor', prompt: 'Transform this image into a delicate and vibrant watercolor painting.' },
];

interface ImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEditComplete: (prompt: string, originalImage: ImageData, newImage: ImageData) => void;
    onClientEditSave: (newImage: ImageData) => void;
    imageData: ImageData | null;
}

const ToolButton: FC<{icon: React.ElementType; label: string; onClick: () => void; isActive: boolean;}> = ({ icon: Icon, label, onClick, isActive }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1 w-16 md:w-full aspect-square rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive ? 'bg-purple-500/30 text-purple-300' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
        }`}
        title={label}
    >
        <Icon className="w-6 h-6" />
        <span className="text-[10px] leading-tight">{label}</span>
    </button>
);

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, onEditComplete, onClientEditSave, imageData }) => {
    const [prompt, setPrompt] = useState('');
    const [editedImageData, setEditedImageData] = useState<ImageData | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTool, setActiveTool] = useState<EditorTool>('brush');
    
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [committedImage, setCommittedImage] = useState<HTMLImageElement | null>(null);

    const [brushSize, setBrushSize] = useState(40);
    const [brushOpacity, setBrushOpacity] = useState(0.7);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [rotation, setRotation] = useState(0);
    const [uniformScale, setUniformScale] = useState(1);
    const [flipScale, setFlipScale] = useState({ x: 1, y: 1 });
    const [activeFilter, setActiveFilter] = useState<string>('none');
    
    const [isCropping, setIsCropping] = useState(false);
    const [cropBox, setCropBox] = useState<{x: number, y: number, width: number, height: number} | null>(null);
    const [draggingHandle, setDraggingHandle] = useState<CropHandle | null>(null);
    const [dragStartPos, setDragStartPos] = useState({x: 0, y: 0});
    
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    const baseCanvasRef = useRef<HTMLCanvasElement>(null);
    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef({x: 0, y: 0});
    const renderRequestRef = useRef<number | null>(null);
    
    const resetAllState = () => {
        setPrompt('');
        setEditedImageData(null);
        setIsGenerating(false);
        setError(null);
        setActiveTool('brush');
        setHistory([]);
        setHistoryIndex(-1);
        setCommittedImage(null);
        resetTransformsAndAdjustments();
        setBrushSize(40);
        setBrushOpacity(0.7);
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    };

    const resetTransformsAndAdjustments = () => {
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
        setRotation(0);
        setUniformScale(1);
        setFlipScale({ x: 1, y: 1 });
        setIsCropping(false);
        setCropBox(null);
        setActiveFilter('none');
    };

    const redrawMask = useCallback(() => {
        const drawingCanvas = drawingCanvasRef.current;
        if (!drawingCanvas) return;
        const ctx = drawingCanvas.getContext('2d');
        if (!ctx) return;
        
        const dataUrl = history[historyIndex];
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        
        if (dataUrl) {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                if (drawingCanvasRef.current) {
                    ctx.drawImage(img, 0, 0, drawingCanvas.width, drawingCanvas.height);
                }
            };
        }
    }, [history, historyIndex]);

    const renderCanvas = useCallback(() => {
        const baseCanvas = baseCanvasRef.current;
        const drawingCanvas = drawingCanvasRef.current;
        const container = canvasContainerRef.current;
        const imageToDraw = committedImage;
        if (!baseCanvas || !drawingCanvas || !container || !imageToDraw) return;
        
        const baseCtx = baseCanvas.getContext('2d');
        if (!baseCtx) return;

        const rad = rotation * Math.PI / 180;
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        
        const imgWidth = imageToDraw.naturalWidth * uniformScale;
        const imgHeight = imageToDraw.naturalHeight * uniformScale;

        const rotatedWidth = imgWidth * absCos + imgHeight * absSin;
        const rotatedHeight = imgWidth * absSin + imgHeight * absCos;
        
        const containerRect = container.getBoundingClientRect();
        const maxWidth = containerRect.width - 40;
        const maxHeight = containerRect.height - 40;

        if (rotatedWidth === 0 || rotatedHeight === 0) return;
        
        const displayScale = Math.min(maxWidth / rotatedWidth, maxHeight / rotatedHeight);
        
        const canvasWidth = rotatedWidth * displayScale;
        const canvasHeight = rotatedHeight * displayScale;
        
        if (baseCanvas.width !== canvasWidth || baseCanvas.height !== canvasHeight) {
            baseCanvas.width = drawingCanvas.width = canvasWidth;
            baseCanvas.height = drawingCanvas.height = canvasHeight;
            redrawMask();
        }
        
        baseCtx.save();
        baseCtx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);

        baseCtx.translate(panOffset.x, panOffset.y);
        baseCtx.scale(zoom, zoom);
        
        baseCtx.translate(baseCanvas.width / (2 * zoom), baseCanvas.height / (2 * zoom));
        baseCtx.rotate(rad);
        baseCtx.scale(flipScale.x, flipScale.y);
        
        baseCtx.filter = `${activeFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        
        const finalDrawWidth = imgWidth * displayScale / zoom;
        const finalDrawHeight = imgHeight * displayScale / zoom;
        baseCtx.drawImage(imageToDraw, -finalDrawWidth / 2, -finalDrawHeight / 2, finalDrawWidth, finalDrawHeight);
        
        baseCtx.restore();
    }, [committedImage, rotation, uniformScale, flipScale, brightness, contrast, saturation, zoom, panOffset, redrawMask, activeFilter]);

    const queueRender = useCallback(() => {
        if (renderRequestRef.current) {
            cancelAnimationFrame(renderRequestRef.current);
        }
        renderRequestRef.current = requestAnimationFrame(() => {
            if (baseCanvasRef.current) {
                renderCanvas();
            }
        });
    }, [renderCanvas]);

    useEffect(() => {
        queueRender();
        const handleResize = () => queueRender();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [queueRender]);

    useEffect(() => {
        if (isOpen && imageData) {
            resetAllState();
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.src = `data:${imageData.mimeType};base64,${imageData.data}`;
            image.onload = () => {
                setCommittedImage(image);
            };
        }
    }, [isOpen, imageData]);

    useEffect(() => {
        if (committedImage && history.length === 0 && drawingCanvasRef.current) {
            queueRender();
            const timeoutId = setTimeout(() => {
                if (drawingCanvasRef.current) {
                    const blankData = drawingCanvasRef.current.toDataURL();
                    if (blankData !== 'data:,') {
                        setHistory([blankData]);
                        setHistoryIndex(0);
                    }
                }
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [committedImage, history.length, queueRender]);

    useEffect(() => {
        if (historyIndex >= 0) {
            redrawMask();
        }
    }, [historyIndex, redrawMask]);

    useEffect(() => { if (isGenerating) playLoadingSound(); else stopLoadingSound(); return () => stopLoadingSound(); }, [isGenerating]);

    const saveState = () => {
        const drawingCanvas = drawingCanvasRef.current;
        if (!drawingCanvas) return;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(drawingCanvas.toDataURL());
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
        }
    };
    const redo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
        }
    };

    const getMousePos = (e: React.MouseEvent | MouseEvent) => {
        const canvas = baseCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top),
        };
    };

    const startDrawing = (e: React.MouseEvent) => {
        if (activeTool !== 'brush' || isCropping) return;
        const context = drawingCanvasRef.current?.getContext('2d');
        if (!context) return;
        
        isDrawing.current = true;
        const pos = getMousePos(e);
        lastPos.current = pos;
        
        context.beginPath();
        context.moveTo(pos.x, pos.y);
    };
    
    const stopDrawing = () => {
        if (isDrawing.current) {
            const context = drawingCanvasRef.current?.getContext('2d');
            context?.beginPath();
            isDrawing.current = false;
            saveState();
            playSendSound();
        }
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing.current) return;
        const context = drawingCanvasRef.current?.getContext('2d');
        const pos = getMousePos(e);
        if (!context) return;

        context.beginPath();
        context.moveTo(lastPos.current.x, lastPos.current.y);
        context.lineTo(pos.x, pos.y);
    
        context.strokeStyle = `rgba(139, 92, 246, ${brushOpacity})`;
        context.lineWidth = brushSize;
        context.lineCap = 'round';
        context.lineJoin = 'round';
    
        context.stroke();
    
        lastPos.current = pos;
    };
    
    const handleClearMask = () => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
    };

    const handleStartCrop = () => {
        if (!baseCanvasRef.current) return;
        setIsCropping(true);
        const canvas = baseCanvasRef.current;
        const initialWidth = canvas.width * 0.8;
        const initialHeight = canvas.height * 0.8;
        setCropBox({
            x: (canvas.width - initialWidth) / 2,
            y: (canvas.height - initialHeight) / 2,
            width: initialWidth,
            height: initialHeight,
        });
    };

    const handleCancelCrop = () => {
        setIsCropping(false);
        setCropBox(null);
    };

    const handleApplyCrop = async () => {
        if (!committedImage || !cropBox || !baseCanvasRef.current) return;

        const displayCanvas = baseCanvasRef.current;
        
        const transformedCanvas = document.createElement('canvas');
        const transformedCtx = transformedCanvas.getContext('2d');
        if(!transformedCtx) return;
        
        const rad = rotation * Math.PI / 180;
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        const newWidth = committedImage.naturalWidth * absCos + committedImage.naturalHeight * absSin;
        const newHeight = committedImage.naturalWidth * absSin + committedImage.naturalHeight * absCos;

        transformedCanvas.width = newWidth;
        transformedCanvas.height = newHeight;
        
        transformedCtx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        transformedCtx.translate(newWidth / 2, newHeight / 2);
        transformedCtx.rotate(rad);
        transformedCtx.scale(flipScale.x, flipScale.y);
        transformedCtx.drawImage(committedImage, -committedImage.naturalWidth/2, -committedImage.naturalHeight/2);

        const scaleBetweenDisplayAndBaked = newWidth / (displayCanvas.width / zoom);
        const sx = cropBox.x * scaleBetweenDisplayAndBaked;
        const sy = cropBox.y * scaleBetweenDisplayAndBaked;
        const sWidth = cropBox.width * scaleBetweenDisplayAndBaked;
        const sHeight = cropBox.height * scaleBetweenDisplayAndBaked;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = sWidth;
        finalCanvas.height = sHeight;
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) return;

        finalCtx.drawImage(transformedCanvas, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

        const dataUrl = finalCanvas.toDataURL('image/png');
        const newImage = new Image();
        newImage.src = dataUrl;
        newImage.onload = () => {
            setCommittedImage(newImage);
            resetTransformsAndAdjustments();
        };
    };
    
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isCropping || !draggingHandle || !cropBox) return;
            const pos = getMousePos(e);
            const dx = pos.x - dragStartPos.x;
            const dy = pos.y - dragStartPos.y;

            let newBox = { ...cropBox };

            if (draggingHandle === 'move') {
                newBox.x += dx;
                newBox.y += dy;
            } else {
                if (draggingHandle.includes('n')) { newBox.y += dy; newBox.height -= dy; }
                if (draggingHandle.includes('s')) { newBox.height += dy; }
                if (draggingHandle.includes('w')) { newBox.x += dx; newBox.width -= dx; }
                if (draggingHandle.includes('e')) { newBox.width += dx; }
            }
            if (newBox.width < 0) {
                newBox.x += newBox.width;
                newBox.width = Math.abs(newBox.width);
            }
             if (newBox.height < 0) {
                newBox.y += newBox.height;
                newBox.height = Math.abs(newBox.height);
            }

            setCropBox(newBox);
            setDragStartPos(pos);
        };
        const handleMouseUp = () => setDraggingHandle(null);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isCropping, draggingHandle, cropBox, dragStartPos]);

    const hasUnappliedChanges = useCallback(() => {
        return (
            brightness !== 100 ||
            contrast !== 100 ||
            saturation !== 100 ||
            rotation !== 0 ||
            uniformScale !== 1 ||
            flipScale.x !== 1 ||
            flipScale.y !== 1 ||
            activeFilter !== 'none'
        );
    }, [brightness, contrast, saturation, rotation, uniformScale, flipScale, activeFilter]);

    const getBakedImageData = (): ImageData | null => {
        if (!committedImage) return null;

        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        if (!finalCtx) return null;

        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const w = committedImage.naturalWidth * uniformScale;
        const h = committedImage.naturalHeight * uniformScale;
        const newWidth = Math.abs(w * cos) + Math.abs(h * sin);
        const newHeight = Math.abs(w * sin) + Math.abs(h * cos);

        finalCanvas.width = newWidth;
        finalCanvas.height = newHeight;
        
        finalCtx.filter = `${activeFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        
        finalCtx.translate(newWidth / 2, newHeight / 2);
        finalCtx.rotate(rad);
        finalCtx.scale(flipScale.x, flipScale.y);
        finalCtx.drawImage(committedImage, -w / 2, -h / 2, w, h);
        
        const dataUrl = finalCanvas.toDataURL('image/png');
        const [_, data] = dataUrl.split(',');
        if (!data) return null;
        
        return { mimeType: 'image/png', data };
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isGenerating || !imageData || !committedImage) return;
        playSendSound();
        setIsGenerating(true);
        setError(null);

        try {
            let imageToSend: ImageData;
            let maskToSend: ImageData | undefined = undefined;

            const bakedImage = getBakedImageData();
            if (!bakedImage) {
                throw new Error("Could not process current image state.");
            }

            const bakedImageElement = new Image();
            bakedImageElement.src = `data:${bakedImage.mimeType};base64,${bakedImage.data}`;
            await new Promise((resolve, reject) => {
                bakedImageElement.onload = resolve;
                bakedImageElement.onerror = reject;
            });
            
            if (activeTool === 'brush') {
                imageToSend = bakedImage;
                const maskCanvas = drawingCanvasRef.current;
                if (maskCanvas) {
                    const maskTempCanvas = document.createElement('canvas');
                    maskTempCanvas.width = bakedImageElement.width;
                    maskTempCanvas.height = bakedImageElement.height;
                    const maskCtx = maskTempCanvas.getContext('2d');
                    if (!maskCtx) throw new Error("Could not create mask context");
                    maskCtx.drawImage(maskCanvas, 0, 0, bakedImageElement.width, bakedImageElement.height);
                    const maskDataUrl = maskTempCanvas.toDataURL('image/png');
                    const maskBase64 = maskDataUrl.split(',')[1];
                    if (!maskBase64) throw new Error("Failed to create mask data");
                    maskToSend = { mimeType: 'image/png', data: maskBase64 };
                }
            } else if (activeTool === 'expand') {
                const expandedCanvas = document.createElement('canvas');
                const newWidth = bakedImageElement.width * 1.5;
                const newHeight = bakedImageElement.height * 1.5;
                expandedCanvas.width = newWidth;
                expandedCanvas.height = newHeight;
                const expandedCtx = expandedCanvas.getContext('2d');
                if (!expandedCtx) throw new Error("Could not create expanded canvas context");
                
                const offsetX = (newWidth - bakedImageElement.width) / 2;
                const offsetY = (newHeight - bakedImageElement.height) / 2;
                expandedCtx.drawImage(bakedImageElement, offsetX, offsetY);

                const expandedDataUrl = expandedCanvas.toDataURL('image/png');
                const expandedBase64 = expandedDataUrl.split(',')[1];
                 if (!expandedBase64) throw new Error("Failed to create expanded image data");
                imageToSend = { mimeType: 'image/png', data: expandedBase64 };
            } else {
                setIsGenerating(false);
                return;
            }
            
            const result = await editImage(prompt, imageToSend, maskToSend);
            playSuccessSound();
            setEditedImageData(result);

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleRemoveBackgroundClick = async () => {
        if (isGenerating || !committedImage) return;
        
        playSendSound();
        setIsGenerating(true);
        setError(null);
        
        try {
            const imageToSend = getBakedImageData();
            if (!imageToSend) {
                throw new Error("Could not process current image state.");
            }
            const result = await removeBackground(imageToSend);
            playSuccessSound();
            setEditedImageData(result);
            setPrompt("Remove background"); 

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleApplyAIFilter = async (preset: { name: string, prompt: string }) => {
        if (isGenerating || !committedImage) return;

        playSendSound();
        setIsGenerating(true);
        setError(null);
        
        try {
            const imageToSend = getBakedImageData();
             if (!imageToSend) {
                throw new Error("Could not process current image state.");
            }

            const result = await editImage(preset.prompt, imageToSend);
            playSuccessSound();
            setEditedImageData(result);
            setPrompt(preset.name);

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDone = () => {
        if (editedImageData && imageData) {
            onEditComplete(prompt || "AI edit", imageData, editedImageData);
        } else if (!editedImageData && hasUnappliedChanges()) {
            const newImage = getBakedImageData();
            if (newImage) {
                onClientEditSave(newImage);
            }
        }
        onClose();
    };
    
    if (!isOpen || !imageData) return null;
    const resultImageUrl = editedImageData ? `data:${editedImageData.mimeType};base64,${editedImageData.data}` : null;

    const SliderControl: FC<{label: string, value: number, min?: number, max?: number, step?: number, onChange: (val: number) => void}> = ({label, value, min = 0, max = 200, step=1, onChange}) => (
      <div>
        <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-medium text-gray-400">{label}</label>
            <span className="text-xs text-gray-400">{value}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500" disabled={isGenerating} />
      </div>
    );

    const FilterPreview: FC<{ preset: FilterPreset; imageUrl: string; onClick: () => void; isActive: boolean; }> = ({ preset, imageUrl, onClick, isActive }) => (
        <button onClick={onClick} className={`w-full text-center space-y-1 focus:outline-none rounded-md p-1 transition-all ${isActive ? 'ring-2 ring-purple-500' : 'hover:bg-gray-700'}`}>
            <div 
                className="w-full aspect-square rounded-md bg-cover bg-center"
                style={{ backgroundImage: `url(${imageUrl})`, filter: preset.style }}
            />
            <span className={`text-xs font-medium ${isActive ? 'text-purple-300' : 'text-gray-400'}`}>{preset.name}</span>
        </button>
    );

    const renderCropOverlay = () => {
      if (!isCropping || !cropBox || !baseCanvasRef.current) return null;
      const handles: {pos: CropHandle, x: number, y: number}[] = [
          {pos: 'nw', x: cropBox.x, y: cropBox.y},
          {pos: 'ne', x: cropBox.x + cropBox.width, y: cropBox.y},
          {pos: 'sw', x: cropBox.x, y: cropBox.y + cropBox.height},
          {pos: 'se', x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height},
          {pos: 'n', x: cropBox.x + cropBox.width / 2, y: cropBox.y},
          {pos: 's', x: cropBox.x + cropBox.width / 2, y: cropBox.y + cropBox.height},
          {pos: 'w', x: cropBox.x, y: cropBox.y + cropBox.height / 2},
          {pos: 'e', x: cropBox.x + cropBox.width, y: cropBox.y + cropBox.height / 2},
      ];
      
      const handleMouseDown = (e: React.MouseEvent, handle: CropHandle) => {
          e.stopPropagation();
          setDraggingHandle(handle);
          setDragStartPos(getMousePos(e));
      };

      return (
        <div className="absolute inset-0 z-10" onMouseDown={(e) => handleMouseDown(e, 'move')}>
            <div className="absolute inset-0 bg-black/50" style={{
                clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropBox.x}px ${cropBox.y}px, ${cropBox.x}px ${cropBox.y + cropBox.height}px, ${cropBox.x + cropBox.width}px ${cropBox.y + cropBox.height}px, ${cropBox.x + cropBox.width}px ${cropBox.y}px, ${cropBox.x}px ${cropBox.y}px)`
            }}></div>
             <div className="absolute border-2 border-white/80" style={{
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.width,
                height: cropBox.height,
                cursor: 'move',
            }}>
                {handles.map(({pos, x, y}) => {
                    const cursor = pos.length === 2 ? `${pos}-resize` : pos === 'n' || pos === 's' ? 'ns-resize' : 'ew-resize';
                    return (
                        <div key={pos} onMouseDown={(e) => handleMouseDown(e, pos)} className="absolute w-3 h-3 bg-white rounded-full border-2 border-gray-500" style={{
                            left: x - 6,
                            top: y - 6,
                            cursor: cursor,
                        }}/>
                    )
                })}
            </div>
        </div>
      );
    }
    
    const renderSettingsPanel = () => (
        <div className="w-full md:w-72 bg-gray-900 md:border-l border-white/10 p-4 space-y-6 overflow-y-auto flex-shrink-0 order-2 md:order-3 max-h-[50vh] md:max-h-full">
            {resultImageUrl ? (
                <div className="space-y-4">
                   <h3 className="font-semibold text-gray-100">Generated Result</h3>
                    <div className="group relative">
                        <img src={resultImageUrl} alt="Edited result" className="rounded-lg object-contain w-full"/>
                    </div>
                </div>
            ) : (
                <>
                    {activeTool === 'brush' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-100">AI Edit Brush</h3>
                            <div className="flex items-center gap-2">
                                <div className="flex-grow">
                                    <SliderControl label="Size" value={brushSize} min={5} max={100} onChange={setBrushSize} />
                                </div>
                                <button onClick={handleClearMask} className="p-2 mt-4 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600" title="Clear mask"><TrashIcon className="w-5 h-5"/></button>
                            </div>
                            <SliderControl label="Opacity" value={brushOpacity * 100} min={10} max={100} onChange={v => setBrushOpacity(v / 100)} />
                        </div>
                    )}
                    {activeTool === 'aiFilters' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-100">AI Filters</h3>
                            <p className="text-sm text-gray-400">Apply unique artistic styles to your image. This will use AI and may replace unsaved edits.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {aiFilterPresets.map(preset => (
                                    <button 
                                        key={preset.name}
                                        onClick={() => handleApplyAIFilter(preset)}
                                        disabled={isGenerating}
                                        className="p-2 text-sm font-medium text-center bg-gray-700 rounded-md hover:bg-gray-600 disabled:opacity-50"
                                    >
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTool === 'transform' && (
                         <div className="space-y-4">
                            <h3 className="font-semibold text-gray-100">Transform</h3>
                            {isCropping ? (
                                <div>
                                    <p className="text-sm text-gray-400 mb-4">Adjust the box to crop the image.</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleCancelCrop} className="w-full p-2 text-sm bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                                        <button onClick={handleApplyCrop} className="w-full p-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700">Apply Crop</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <SliderControl label="Rotate" value={rotation} min={-180} max={180} onChange={setRotation} />
                                    <SliderControl label="Scale" value={Math.round(uniformScale * 100)} min={50} max={200} onChange={v => setUniformScale(v / 100)} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setRotation(r => (r + 90) % 360)} className="flex items-center justify-center gap-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600"><RotateRightIcon className="w-5 h-5" /> Rotate 90°</button>
                                        <button onClick={() => setFlipScale(s => ({ ...s, x: s.x * -1 }))} className="flex items-center justify-center gap-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600"><FlipHorizontalIcon className="w-5 h-5" /> Flip H</button>
                                        <button onClick={() => setFlipScale(s => ({ ...s, y: s.y * -1 }))} className="flex items-center justify-center gap-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600"><FlipVerticalIcon className="w-5 h-5" /> Flip V</button>
                                        <button onClick={handleStartCrop} className="flex items-center justify-center gap-2 p-2 bg-gray-700 rounded-md hover:bg-gray-600"><CropIcon className="w-5 h-5" /> Crop</button>
                                    </div>
                                    <button onClick={() => { setRotation(0); setUniformScale(1); setFlipScale({x:1, y:1}); }} className="w-full text-sm text-purple-400 font-medium p-2 hover:bg-purple-500/10 rounded-md">Reset Transforms</button>
                                </>
                            )}
                        </div>
                    )}
                    {activeTool === 'adjust' && (
                         <div className="space-y-4">
                            <h3 className="font-semibold text-gray-100">Adjustments</h3>
                            <SliderControl label="Brightness" value={brightness} onChange={setBrightness} />
                            <SliderControl label="Contrast" value={contrast} onChange={setContrast} />
                            <SliderControl label="Saturation" value={saturation} min={0} max={300} onChange={setSaturation} />
                        </div>
                    )}
                    {activeTool === 'filters' && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-100">Color Filters</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {filterPresets.map(preset => (
                                    <FilterPreview
                                        key={preset.name}
                                        preset={preset}
                                        imageUrl={`data:${imageData.mimeType};base64,${imageData.data}`}
                                        onClick={() => setActiveFilter(preset.style)}
                                        isActive={activeFilter === preset.style}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTool === 'expand' && (
                        <div>
                            <h3 className="font-semibold text-gray-100">Expand Image</h3>
                            <p className="text-sm text-gray-400 mt-2">Describe what you'd like to see in the expanded areas of the image. The AI will attempt to continue the existing scene.</p>
                        </div>
                    )}
                    {activeTool === 'removeBackground' && (
                        <div>
                            <h3 className="font-semibold text-gray-100">Remove Background</h3>
                            <p className="text-sm text-gray-400 mt-2">The AI will detect the main subject and remove the background, making it transparent.</p>
                            <button 
                                onClick={handleRemoveBackgroundClick} 
                                disabled={isGenerating} 
                                className="w-full mt-4 bg-purple-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-purple-700 disabled:bg-gray-500 flex items-center justify-center"
                            >
                                {isGenerating ? <Spinner /> : 'Remove Background'}
                            </button>
                        </div>
                    )}
                    {(activeTool === 'brush' || activeTool === 'expand') && (
                        <form onSubmit={handleSubmit} className="space-y-2">
                            <label htmlFor="edit-prompt" className="text-sm font-medium text-gray-300">
                                {activeTool === 'brush' ? "Describe what to do in the painted area" : "Describe the scene expansion"}
                            </label>
                            <textarea id="edit-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., 'add a starry sky'" className="w-full bg-gray-700 text-gray-100 rounded-md p-2 border border-gray-600 focus:ring-2 focus:ring-purple-500" rows={3} disabled={isGenerating} />
                        </form>
                    )}
                </>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-0 md:p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col">
                <header className="p-3 flex-shrink-0 border-b border-white/10 bg-gray-900 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <h2 className="text-lg font-bold text-gray-100">Image Editor</h2>
                       <div className="hidden sm:flex items-center gap-2">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 disabled:opacity-50" aria-label="Undo"><UndoIcon className="w-5 h-5" /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 disabled:opacity-50" aria-label="Redo"><RedoIcon className="w-5 h-5" /></button>
                       </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><XIcon className="w-6 h-6" /></button>
                </header>
                
                <main className="flex-grow flex flex-col md:flex-row min-h-0">
                    <div className="hidden md:flex w-20 bg-gray-900 border-r border-white/10 p-2 flex-col items-center gap-2">
                        <ToolButton icon={BrushIcon} label="AI Edit" onClick={() => setActiveTool('brush')} isActive={activeTool === 'brush'} />
                        <ToolButton icon={WandSparklesIcon} label="AI Filters" onClick={() => setActiveTool('aiFilters')} isActive={activeTool === 'aiFilters'} />
                        <ToolButton icon={TransformIcon} label="Transform" onClick={() => setActiveTool('transform')} isActive={activeTool === 'transform'} />
                        <ToolButton icon={SlidersIcon} label="Adjust" onClick={() => setActiveTool('adjust')} isActive={activeTool === 'adjust'} />
                        <ToolButton icon={OpacityIcon} label="Color" onClick={() => setActiveTool('filters')} isActive={activeTool === 'filters'} />
                        <ToolButton icon={ArrowsPointingOutIcon} label="Expand" onClick={() => setActiveTool('expand')} isActive={activeTool === 'expand'} />
                        <ToolButton icon={BackgroundRemovalIcon} label="BG" onClick={() => setActiveTool('removeBackground')} isActive={activeTool === 'removeBackground'} />
                    </div>

                    <div ref={canvasContainerRef} className="flex-grow bg-gray-700/50 flex items-center justify-center relative overflow-hidden order-1 md:order-2">
                        <div
                            className="relative"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        >
                            <canvas ref={baseCanvasRef} />
                            <canvas ref={drawingCanvasRef} className={`absolute top-0 left-0 ${activeTool === 'brush' && !isCropping ? 'cursor-crosshair' : ''}`} />
                            {renderCropOverlay()}
                        </div>
                         <div className="absolute bottom-2 left-2 bg-black/40 p-1 rounded-full flex items-center gap-1 z-20 backdrop-blur-sm">
                            <button onClick={() => setZoom(z => Math.max(z / 1.25, 0.2))} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Zoom out"><ZoomOutIcon className="w-5 h-5" /></button>
                            <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Reset view"><ResetViewIcon className="w-5 h-5" /></button>
                            <button onClick={() => setZoom(z => Math.min(z * 1.25, 8))} className="p-2 text-white hover:bg-white/20 rounded-full transition-colors" aria-label="Zoom in"><ZoomInIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:contents">
                        {renderSettingsPanel()}

                        <div className="md:hidden order-3 w-full flex-shrink-0 bg-gray-900 border-t border-white/10 flex justify-around p-1">
                            <ToolButton icon={BrushIcon} label="AI Edit" onClick={() => setActiveTool('brush')} isActive={activeTool === 'brush'} />
                            <ToolButton icon={WandSparklesIcon} label="AI Filters" onClick={() => setActiveTool('aiFilters')} isActive={activeTool === 'aiFilters'} />
                            <ToolButton icon={TransformIcon} label="Transform" onClick={() => setActiveTool('transform')} isActive={activeTool === 'transform'} />
                            <ToolButton icon={SlidersIcon} label="Adjust" onClick={() => setActiveTool('adjust')} isActive={activeTool === 'adjust'} />
                            <ToolButton icon={OpacityIcon} label="Color" onClick={() => setActiveTool('filters')} isActive={activeTool === 'filters'} />
                        </div>
                    </div>
                </main>
                <footer className="p-2 md:p-4 border-t border-white/10 bg-gray-900 flex-shrink-0 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div>
                        {error && <p className="text-xs sm:text-sm text-red-400 mr-auto text-center sm:text-left">{error}</p>}
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600">
                            Cancel
                        </button>
                        {editedImageData ? (
                             <button type="button" onClick={handleDone} className="flex-1 sm:flex-none bg-cyan-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-cyan-700 flex items-center justify-center gap-2">
                                <CheckIcon className="w-5 h-5" /> Save
                             </button>
                        ) : (activeTool === 'brush' || activeTool === 'expand') ? (
                            <button onClick={handleSubmit} disabled={isGenerating || !prompt.trim()} className="flex-1 sm:flex-none bg-purple-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center min-w-[100px] justify-center">
                                {isGenerating ? <Spinner /> : 'Generate'}
                            </button>
                        ) : (
                            <button type="button" onClick={handleDone} disabled={!hasUnappliedChanges()} className="flex-1 sm:flex-none bg-purple-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-purple-700 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed">
                                <CheckIcon className="w-5 h-5" /> Apply & Save
                            </button>
                        )}
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default ImageEditorModal;