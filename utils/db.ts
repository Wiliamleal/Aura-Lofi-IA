import { Message, Role, AspectRatio, GenerationStyle } from '../types';

const DB_NAME = 'AIImageGallery';
const DB_VERSION = 3; // Incremented version for schema change
const STORE_NAME = 'messages';
const OLD_STORE_NAME = 'images';

// This will be the shape of objects in the DB
export interface StoredMessage {
    id?: number;
    sessionId: string;
    role: Role;
    text?: string;
    imageUrl?: string; // Storing the full data URL
    imageMimeType?: string;
    timestamp: number;
    generationParams?: {
        aspectRatio: AspectRatio;
        style: GenerationStyle;
        negativePrompt: string;
    };
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Database error:', request.error);
                reject('Error opening DB');
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const dbInstance = (event.target as IDBOpenDBRequest).result;
                const transaction = (event.target as IDBOpenDBRequest).transaction;

                // Migration from version < 2
                if (event.oldVersion < 2 && dbInstance.objectStoreNames.contains(OLD_STORE_NAME)) {
                    dbInstance.deleteObjectStore(OLD_STORE_NAME);
                }
                
                let store;
                // Create the new 'messages' store if it doesn't exist
                if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                    store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                } else {
                    store = transaction!.objectStore(STORE_NAME);
                }

                // Add sessionId index for version 3
                if (event.oldVersion < 3) {
                    if (!store.indexNames.contains('sessionId')) {
                        store.createIndex('sessionId', 'sessionId', { unique: false });
                    }
                }
            };
        });
    }
    return dbPromise;
};


export const initDB = async (): Promise<boolean> => {
  try {
      await getDB();
      return true;
  } catch {
      return false;
  }
};

export const addMessageToDB = async (message: Omit<Message, 'id'>, sessionId: string): Promise<number> => {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const storedMessage: Omit<StoredMessage, 'id'> = {
        ...message,
        sessionId,
        timestamp: Date.now()
    };

    return new Promise<number>((resolve, reject) => {
        const request = store.add(storedMessage);

        request.onsuccess = () => {
            resolve(request.result as number);
        };

        request.onerror = () => {
            console.error('Error adding message:', request.error);
            reject('Could not add message');
        };
    });
};

export const getAllMessagesFromDB = async (sessionId: string): Promise<StoredMessage[]> => {
    const db = await getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const sessionIndex = store.index('sessionId'); 
    
    return new Promise((resolve, reject) => {
        const request = sessionIndex.getAll(sessionId);
        
        request.onsuccess = () => {
            // Ensure results are sorted by time, as getAll doesn't guarantee order from index
            const sortedResult = request.result.sort((a, b) => a.timestamp - b.timestamp);
            resolve(sortedResult);
        };
        request.onerror = () => {
            console.error('Error getting messages:', request.error);
            reject('Could not retrieve messages');
        };
    });
};

export const deleteMessageFromDB = async (id: number): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        transaction.oncomplete = () => {
            resolve();
        };
        
        transaction.onerror = (event) => {
            console.error('Error deleting message:', (event.target as IDBTransaction).error);
            reject('Could not delete message');
        };

        store.delete(id);
    });
};

export const clearAllMessages = async (sessionId: string): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('sessionId');
        // Use a key cursor to find and delete all messages for the current session
        const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            }
        };

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = (event) => {
            console.error('Error clearing store for session:', (event.target as IDBTransaction).error);
            reject('Could not clear object store for session');
        };
    });
};
