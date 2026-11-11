import Dexie, { type EntityTable } from 'dexie';
import type { CourseItem, AutomationLog } from '../types';

export class StudyDatabase extends Dexie {
  items!: EntityTable<CourseItem, 'id'>;
  logs!: EntityTable<AutomationLog, 'id'>;

  constructor() {
    super('CourseraStudyDB');
    this.version(1).stores({
      items: '++id, courseId, itemId, itemType, status, url',
      logs: '++id, timestamp, level'
    });
  }
}

export const db = new StudyDatabase();
export { DEFAULT_SETTINGS } from '../types';
