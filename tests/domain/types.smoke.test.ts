import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_TASK_CATEGORIES } from '../../src/domain/types';

describe('domain types defaults', () => {
  it('provides clean default settings and 4 initial task categories', () => {
    expect(DEFAULT_SETTINGS.version).toBe(1);
    expect(DEFAULT_SETTINGS.autoOpenOnStart).toBe(true);
    expect(DEFAULT_SETTINGS.weekStartDay).toBe(1);
    expect(DEFAULT_SETTINGS.topBarPosition).toBe('left');
    expect(DEFAULT_TASK_CATEGORIES.map((c) => c.name)).toEqual([
      '工作',
      '学习',
      '生活',
      '随手记',
    ]);
  });
});
