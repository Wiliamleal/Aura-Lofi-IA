import React, { useState, useEffect, useRef, useMemo, FC } from 'react';
import ChatInterface from './components/ChatInterface';
import { TrashIcon, DownloadCloudIcon, SearchIcon, XIcon, UploadIcon, LogoutIcon, ViewGridIcon } from './components/Icons';
import { Logo } from './components/Logo';
import { initAudio, playSuccessSound, playLoadingSound, stopLoadingSound } from './utils/fileUtils';
import ConfirmationModal from './components/ConfirmationModal';
import { Message, ImageData, AspectRatio, GenerationStyle, Role } from './types';
import { generateImage, enhanceImage, removeBackground } from './services/geminiService';
import ImageEditorModal from './components/ImageEditorModal';
import { fileToImageData } from './utils/fileUtils';
import LoginScreen from './components/LoginScreen';
import { useConversationHistory } from './hooks/useConversationHistory';
import { initDB, getAllMessagesFromDB } from './utils/db';
import VisualHistoryPanel from './components/VisualHistoryPanel';
import ImageDetailsModal from './components/ImageDetailsModal';

// Allow TypeScript to recognize the JSZip library loaded from the CDN
declare const JSZip: any;

interface ImageGeneratorAppProps {
  onLogout: () => void;
}

const ImageGeneratorApp: FC<ImageGeneratorAppProps> = ({ onLogout }) => {
  const { messages, addMessage, addTempMessage, deleteMessage, clearHistory } = useConversationHistory();

  const [isDownloading, setIsDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ messageId: string; dbId: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [editorState, setEditorState] = useState<{ isOpen: boolean; imageData: ImageData | null }>({ isOpen: false, imageData: null });
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [selectedHistoryMessage, setSelectedHistoryMessage] = useState<Message | null>(null);

  useEffect(() => {
    const initializeAudioContext = () => {
      initAudio();
      window.removeEventListener('click', initializeAudioContext);
      window.removeEventListener('keydown', initializeAudioContext);
    };
    window.addEventListener('click', initializeAudioContext);
    window.addEventListener('keydown', initializeAudioContext);

    return () => {
      window.removeEventListener('click', initializeAudioContext);
      window.removeEventListener('keydown', initializeAudioContext);
    };
  }, []);
  
  useEffect(() => {
      if (isLoading) {
          playLoadingSound();
      } else {
          stopLoadingSound();
      }
      return () => {
          stopLoadingSound();
      };
  }, [isLoading]);

  const handleSendMessage = async (prompt: string, aspectRatio: AspectRatio, style: GenerationStyle, negativePrompt: string) => {
      setIsLoading(true);
      const userMessageData: Omit<Message, 'id'> = {
          // FIX: Use Role enum instead of string literal.
          role: Role.USER,
          text: prompt,
          generationParams: {
            aspectRatio,
            style,
            negativePrompt,
          },
      };

      // The addMessage hook updates the state for the UI, and returns the newly created message.
      const newUserMessage = await addMessage(userMessageData);
      
      // If saving the message failed, newUserMessage will be null. The hook handles showing an error.
      if (!newUserMessage) {
        setIsLoading(false);
        return;
      }

      // The `messages` state variable is from the previous render cycle.
      // We create a new array with the latest user message for the AI service.
      const historyForAI = [...messages, newUserMessage];

      try {
          const resultImage = await generateImage(prompt, aspectRatio, style, negativePrompt, historyForAI);
          await addMessage({
               // FIX: Use Role enum instead of string literal.
               role: Role.MODEL,
               imageUrl: `data:${resultImage.mimeType};base64,${resultImage.data}`,
               imageMimeType: resultImage.mimeType,
          });
          playSuccessSound();
      } catch (error) {
          // The service layer throws a user-friendly error.
          // FIX: Use Role enum instead of string literal.
          addTempMessage({ role: Role.ERROR, text: (error as Error).message || "An unknown error occurred." });
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleStartEnhance = async (imageDataToEnhance: { imageUrl: string, mimeType: string, data: string }) => {
      setIsLoading(true);
      await addMessage({
          // FIX: Use Role enum instead of string literal.
          role: Role.USER,
          text: "Enhance this image",
          imageUrl: imageDataToEnhance.imageUrl,
          imageMimeType: imageDataToEnhance.mimeType,
      });

      try {
          const originalImageData: ImageData = { mimeType: imageDataToEnhance.mimeType, data: imageDataToEnhance.data };
          const resultImage = await enhanceImage(originalImageData);
          await addMessage({
               // FIX: Use Role enum instead of string literal.
               role: Role.MODEL,
               imageUrl: `data:${resultImage.mimeType};base64,${resultImage.data}`,
               imageMimeType: resultImage.mimeType,
          });
          playSuccessSound();
      } catch (error) {
          // FIX: Use Role enum instead of string literal.
          addTempMessage({ role: Role.ERROR, text: (error as Error).message || "An unknown error occurred." });
      } finally {
          setIsLoading(false);
      }
  };

  const handleStartRemoveBackground = async (imageDataToProcess: { imageUrl: string, mimeType: string, data: string }) => {
      setIsLoading(true);
      await addMessage({
          // FIX: Use Role enum instead of string literal.
          role: Role.USER,
          text: "Remove the background of this image",
          imageUrl: imageDataToProcess.imageUrl,
          imageMimeType: imageDataToProcess.mimeType,
      });

      try {
          const originalImageData: ImageData = { mimeType: imageDataToProcess.mimeType, data: imageDataToProcess.data };
          const resultImage = await removeBackground(originalImageData);
          await addMessage({
               // FIX: Use Role enum instead of string literal.
               role: Role.MODEL,
               imageUrl: `data:${resultImage.mimeType};base64,${resultImage.data}`,
               imageMimeType: resultImage.mimeType,
          });
          playSuccessSound();
      } catch (error) {
          // FIX: Use Role enum instead of string literal.
          addTempMessage({ role: Role.ERROR, text: (error as Error).message || "An unknown error occurred." });
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleDeleteRequest = (messageId: string, dbId: number) => {
      setDeleteTarget({ messageId, dbId });
  };
  
  const confirmDeleteMessage = async () => {
    if (!deleteTarget) return;
    await deleteMessage(deleteTarget.dbId);
    setDeleteTarget(null);
  };

  const handleStartEdit = (imageDataToEdit: { imageUrl: string, mimeType: string, data: string }) => {
      setEditorState({
          isOpen: true,
          imageData: { mimeType: imageDataToEdit.mimeType, data: imageDataToEdit.data }
      });
  };

  const handleEditComplete = async (prompt: string, originalImage: ImageData, newImage: ImageData) => {
      await addMessage({
          // FIX: Use Role enum instead of string literal.
          role: Role.USER,
          text: prompt,
          imageUrl: `data:${originalImage.mimeType};base64,${originalImage.data}`,
          imageMimeType: originalImage.mimeType,
      });
      await addMessage({
           // FIX: Use Role enum instead of string literal.
           role: Role.MODEL,
           imageUrl: `data:${newImage.mimeType};base64,${newImage.data}`,
           imageMimeType: newImage.mimeType,
      });
      playSuccessSound();
  };
  
  const handleSaveClientEdit = async (newImage: ImageData) => {
      await addMessage({
           // FIX: Use Role enum instead of string literal.
           role: Role.MODEL,
           imageUrl: `data:${newImage.mimeType};base64,${newImage.data}`,
           imageMimeType: newImage.mimeType,
           text: "Image saved with adjustments applied.",
      });
      playSuccessSound();
  };

  const handleCloseEditor = () => {
      setEditorState({ isOpen: false, imageData: null });
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          try {
              const imageData = await fileToImageData(file);
              setEditorState({ isOpen: true, imageData: imageData });
          } catch (error) {
              console.error("Failed to read file:", error);
              alert("Failed to load image file.");
          }
      }
      event.target.value = '';
  };

  const handleClearAll = () => setIsConfirmModalOpen(true);

  const confirmClearAll = async () => {
    await clearHistory();
    setIsConfirmModalOpen(false);
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      await initDB(); // Ensure DB is initialized before accessing
      // This will now only fetch messages for the current session via the hook's scope
      const messagesWithImages = messages.filter(msg => msg.imageUrl);
      
      if (messagesWithImages.length === 0) {
        alert("There are no images to download.");
        setIsDownloading(false);
        return;
      }
      const zip = new JSZip();
      messagesWithImages.forEach((imageMsg, index) => {
        if (imageMsg.imageUrl) {
            const [header, data] = imageMsg.imageUrl.split(',');
            if (data && imageMsg.imageMimeType) {
                const extension = imageMsg.imageMimeType.split('/')[1] || 'png';
                const timestamp = imageMsg.id.startsWith('db-') 
                    ? new Date().getTime() + index // fallback for new messages
                    : imageMsg.id; 
                const fileName = `aura-lofi-${timestamp}.${extension}`;
                zip.file(fileName, data, { base64: true });
            }
        }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `aura-lofi-images-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Failed to download images:", error);
      alert("Failed to download the images.");
    } finally {
      setIsDownloading(false);
    }
  };
  
  const handleHistoryImageSelect = (message: Message) => {
    setSelectedHistoryMessage(message);
  };

  const filteredMessages = useMemo(() => {
      if (!searchQuery.trim()) return messages;
      const lowercasedQuery = searchQuery.toLowerCase();
      return messages.filter(msg => msg.text && msg.text.toLowerCase().includes(lowercasedQuery));
  }, [messages, searchQuery]);

  return (
    <div className="bg-gray-900 text-gray-100 h-full font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-white/10 p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center gap-4 max-w-7xl mx-auto">
           <div className="flex items-center gap-3 flex-shrink-0">
              <Logo className="w-8 h-8" />
              <h1 className="text-xl font-bold tracking-wider hidden md:block text-white">
                AURA LOFI
              </h1>
           </div>
           
           <div className="relative flex-grow min-w-0 mx-2 sm:mx-4">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-700 border border-transparent rounded-full pl-10 pr-10 py-2 text-sm text-gray-100 placeholder-gray-400 focus:bg-gray-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
              {searchQuery && (
                  <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      aria-label="Clear search"
                  >
                      <XIcon className="w-4 h-4" />
                  </button>
              )}
          </div>

           <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
              className={`flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors ${isHistoryPanelOpen ? 'text-purple-400' : 'text-gray-300'}`}
              aria-label="Toggle history panel"
              title="Toggle history panel"
            >
              <ViewGridIcon className="w-5 h-5" />
            </button>
            <button
                onClick={handleUploadClick}
                className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-purple-400 rounded-full transition-colors"
                aria-label="Upload image"
                title="Upload image"
              >
                <UploadIcon className="w-5 h-5" />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
            <button
                onClick={handleDownloadAll}
                className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-blue-400 rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait"
                aria-label="Download all"
                disabled={isDownloading}
              >
                {isDownloading ? 
                  <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div> : 
                  <DownloadCloudIcon className="w-5 h-5" />}
            </button>
            <button
                onClick={handleClearAll}
                className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-red-400 rounded-full transition-colors"
                aria-label="Clear history"
              >
                <TrashIcon className="w-5 h-5" />
            </button>
            <button
                onClick={onLogout}
                className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                aria-label="Logout"
                title="Logout"
              >
                <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-grow min-h-0">
        <VisualHistoryPanel
            isOpen={isHistoryPanelOpen}
            messages={messages}
            onThumbnailClick={handleHistoryImageSelect}
        />
        <main className="flex-grow flex flex-col min-h-0">
          <ChatInterface
              messages={filteredMessages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onStartEdit={handleStartEdit}
              onStartEnhance={handleStartEnhance}
              onStartRemoveBackground={handleStartRemoveBackground}
              onDeleteImage={handleDeleteRequest}
              searchQuery={searchQuery}
          />
        </main>
      </div>
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmClearAll}
        title="Delete all history?"
        message="This action cannot be undone and will permanently remove all generated images and prompts from this device."
        confirmText="Delete All"
      />
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteMessage}
        title="Delete this message?"
        message="This action cannot be undone and will permanently remove this message from your history."
        confirmText="Delete Message"
      />
      <ImageEditorModal 
          isOpen={editorState.isOpen}
          onClose={handleCloseEditor}
          onEditComplete={handleEditComplete}
          onClientEditSave={handleSaveClientEdit}
          imageData={editorState.imageData}
      />
       <ImageDetailsModal
          isOpen={!!selectedHistoryMessage}
          onClose={() => setSelectedHistoryMessage(null)}
          selectedMessage={selectedHistoryMessage}
          messages={messages}
      />
    </div>
  );
}

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    return <ImageGeneratorApp onLogout={handleLogout} />;
};


export default App;
