import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Card, Schedule, ReviewLog } from '@/types';

interface HachimonDB extends DBSchema {
  cards: {
    key: string;
    value: Card;
    indexes: { 'by-deck': string };
  };
  schedules: {
    key: string;
    value: Schedule;
  };
  reviewLog: {
    key: number;
    value: ReviewLog;
    indexes: { 'by-card': string; 'by-session': string };
  };
  settings: {
    key: string;
    value: { key: string; value: string };
  };
}

let dbInstance: IDBPDatabase<HachimonDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<HachimonDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<HachimonDB>('hachimon', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('by-deck', 'deck');

        db.createObjectStore('schedules', { keyPath: 'cardId' });

        const logStore = db.createObjectStore('reviewLog', {
          keyPath: 'id',
          autoIncrement: true,
        });
        logStore.createIndex('by-card', 'cardId');
        logStore.createIndex('by-session', 'sessionId');

        db.createObjectStore('settings', { keyPath: 'key' });
      }
      // v1 → v2: 스토어 스키마 변경 없음. schedules 값(Schedule)은 schema-less이며
      // SM-2 → FSRS 데이터 변환은 앱 레이어 migrateToFsrs()가 수행한다.
    },
  });

  return dbInstance;
}
