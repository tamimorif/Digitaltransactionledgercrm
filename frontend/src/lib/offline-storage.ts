import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
    requests: {
        key: number;
        value: {
            id?: number;
            method: string;
            url: string;
            data: any;
            headers: any;
            timestamp: number;
            retryCount: number;
        };
        indexes: { 'by-timestamp': number };
    };
}

const DB_NAME = 'crm-offline-db';
const STORE_NAME = 'requests';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>>;

export const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    store.createIndex('by-timestamp', 'timestamp');
                }
            },
        });
    }
    return dbPromise;
};

export const saveRequestToQueue = async (request: {
    method: string;
    url: string;
    data: any;
    headers: any;
}) => {
    const db = await initDB();
    return db.add(STORE_NAME, {
        ...request,
        timestamp: Date.now(),
        retryCount: 0,
    });
};

export const getQueuedRequests = async () => {
    const db = await initDB();
    return db.getAllFromIndex(STORE_NAME, 'by-timestamp');
};

export const removeRequestFromQueue = async (id: number) => {
    const db = await initDB();
    return db.delete(STORE_NAME, id);
};

export const clearQueue = async () => {
    const db = await initDB();
    return db.clear(STORE_NAME);
};
