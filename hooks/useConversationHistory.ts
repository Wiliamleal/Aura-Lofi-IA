import { useState, useEffect, useCallback, useMemo } from 'react';
import { initDB, getAllMessagesFromDB, addMessageToDB, deleteMessageFromDB, clearAllMessages, StoredMessage } from '../utils/db';
import { getSessionId } from '../utils/sessionId';
import { Message, Role } from '../types';

export const useConversationHistory = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'initial',
            role: Role.MODEL,
            text: "Hello! Describe an image you'd like me to create for you, or upload an image to edit.",
        }
    ]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    const sessionId = useMemo(() => getSessionId(), []);

    useEffect(() => {
        const loadHistory = async () => {
            setIsLoadingHistory(true);
            try {
                await initDB();
                const storedMessages: StoredMessage[] = await getAllMessagesFromDB(sessionId);
                
                if (storedMessages.length > 0) {
                    const historyMessages: Message[] = storedMessages.map(msg => ({
                        id: `db-${msg.id}`,
                        role: msg.role,
                        text: msg.text,
                        imageUrl: msg.imageUrl,
                        imageMimeType: msg.imageMimeType,
                        generationParams: msg.generationParams,
                    }));
                    // Keep the initial message and add loaded history
                    setMessages(prev => [prev[0], ...historyMessages]);
                }
            } catch (error) {
                console.error("Failed to load message history from DB:", error);
                // Add a temporary error message to the UI
                const errorMsg: Message = {
                    id: `error-${Date.now()}`,
                    role: Role.ERROR,
                    text: "Could not load saved conversation history."
                };
                setMessages(prev => [...prev, errorMsg]);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        loadHistory();
    }, [sessionId]);

    const addMessage = useCallback(async (messageData: Omit<Message, 'id'>): Promise<Message | null> => {
        try {
            const dbId = await addMessageToDB(messageData, sessionId);
            const newMessage: Message = { ...messageData, id: `db-${dbId}` };
            setMessages(prev => [...prev, newMessage]);
            return newMessage;
        } catch (error) {
            console.error("Failed to save message:", error);
            const errorMsg: Message = {
                id: `error-${Date.now()}`,
                role: Role.ERROR,
                text: "Failed to save your message."
            };
            setMessages(prev => [...prev, errorMsg]);
            return null;
        }
    }, [sessionId]);
    
    const addTempMessage = useCallback((messageData: Omit<Message, 'id'>) => {
        const id = `${Date.now()}-${Math.random()}`;
        const tempMessage: Message = { ...messageData, id };
        setMessages(prev => [...prev, tempMessage]);
    }, []);

    const deleteMessage = useCallback(async (dbId: number) => {
        const messageIdToDelete = `db-${dbId}`;
        try {
            await initDB(); // ensure DB is ready
            await deleteMessageFromDB(dbId);
            setMessages(prev => prev.filter(msg => msg.id !== messageIdToDelete));
        } catch (error) {
            console.error("Failed to delete message:", error);
            addTempMessage({ role: Role.ERROR, text: "Failed to delete the message." });
        }
    }, [addTempMessage]);
    
    const clearHistory = useCallback(async () => {
        try {
            await initDB();
            await clearAllMessages(sessionId);
            // Keep only the initial message
            setMessages(prev => prev.filter(msg => msg.id === 'initial'));
        }
        catch (error)
        {
            console.error("Failed to clear history:", error);
            addTempMessage({ role: Role.ERROR, text: "Failed to clear history." });
        }
    }, [sessionId, addTempMessage]);


    return {
        messages,
        isLoadingHistory,
        addMessage,
        addTempMessage,
        deleteMessage,
        clearHistory
    };
};
