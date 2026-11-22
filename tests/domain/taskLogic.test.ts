import { describe, expect, it } from 'vitest';
import {
  cyclePriority,
  getActiveTasks,
  getCompletedTasks,
  groupTasksByCategory,
  moveItemOrder,
  sortTasksByPriority,
} from '../../src/domain/taskLogic';
import { DEFAULT_TASK_CATEGORIES, type TaskCategory, type TaskItem } from '../../src/domain/types';

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 't-1',
    title: '任务',
    priority: 'medium',
    categoryId: 'cat-work',
    completed: false,
    createdAt: 1000,
    updatedAt: 1000,
    sortOrder: 0,
    ...overrides,
  };
}

describe('taskLogic', () => {
  it('filters out soft-deleted tasks and splits active vs completed', () => {
    const tasks: TaskItem[] = [
      makeTask({ id: '1', completed: false }),
      makeTask({ id: '2', completed: true, completedAt: 2000 }),
      makeTask({ id: '3', completed: false, deleted: true }),
      makeTask({ id: '4', completed: false, categoryId: 'cat-study' }),
    ];

    expect(getActiveTasks(tasks).map((t) => t.id)).toEqual(['1', '4']);
    expect(getActiveTasks(tasks, 'cat-study').map((t) => t.id)).toEqual(['4']);
    expect(getCompletedTasks(tasks).map((t) => t.id)).toEqual(['2']);
  });

  it('sorts tasks by priority high -> medium -> low, breaking ties by newer createdAt', () => {
    const tasks: TaskItem[] = [
      makeTask({ id: 'low-new', priority: 'low', createdAt: 5000 }),
      makeTask({ id: 'high-old', priority: 'high', createdAt: 1000 }),
      makeTask({ id: 'med-1', priority: 'medium', createdAt: 3000 }),
      makeTask({ id: 'high-new', priority: 'high', createdAt: 4000 }),
    ];

    expect(sortTasksByPriority(tasks).map((t) => t.id)).toEqual([
      'high-new',
      'high-old',
      'med-1',
      'low-new',
    ]);
  });

  it('groups tasks by non-deleted categories and falls back orphan tasks into first valid category', () => {
    const categories: TaskCategory[] = [
      ...DEFAULT_TASK_CATEGORIES.slice(0, 2),
      { id: 'cat-removed', name: '已删', color: '#000', sortOrder: 2, updatedAt: 1, deleted: true },
    ];
    const tasks: TaskItem[] = [
      makeTask({ id: 't-work', categoryId: 'cat-work', priority: 'low' }),
      makeTask({ id: 't-orphan', categoryId: 'cat-removed', priority: 'high' }),
      makeTask({ id: 't-study', categoryId: 'cat-study', priority: 'medium' }),
    ];

    const groups = groupTasksByCategory(tasks, categories);
    expect(groups.map((g) => g.category.id)).toEqual(['cat-work', 'cat-study']);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t-orphan', 't-work']);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['t-study']);
  });

  it('cycles priority high -> medium -> low -> high', () => {
    expect(cyclePriority('high')).toBe('medium');
    expect(cyclePriority('medium')).toBe('low');
    expect(cyclePriority('low')).toBe('high');
  });

  it('reorders items up and down via sortOrder and updates timestamps cleanly', () => {
    const items = [
      { id: 'a', sortOrder: 0, updatedAt: 10 },
      { id: 'b', sortOrder: 1, updatedAt: 10 },
      { id: 'c', sortOrder: 2, updatedAt: 10 },
    ];

    const movedUp = moveItemOrder(items, 'b', 'up', 999);
    expect(movedUp.map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(movedUp.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(movedUp[0].updatedAt).toBe(999);
    expect(movedUp[1].updatedAt).toBe(999);
    expect(movedUp[2].updatedAt).toBe(10);

    // Edge no-op
    const edge = moveItemOrder(items, 'a', 'up', 999);
    expect(edge.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
