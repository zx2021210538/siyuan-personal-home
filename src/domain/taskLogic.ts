import type { TaskCategory, TaskItem, TaskPriority } from './types';

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function getActiveTasks(tasks: TaskItem[], categoryId?: string | 'all'): TaskItem[] {
  return tasks.filter(
    (t) =>
      !t.deleted &&
      !t.completed &&
      (!categoryId || categoryId === 'all' || t.categoryId === categoryId),
  );
}

export function getCompletedTasks(tasks: TaskItem[], categoryId?: string | 'all'): TaskItem[] {
  return tasks
    .filter(
      (t) =>
        !t.deleted &&
        t.completed &&
        (!categoryId || categoryId === 'all' || t.categoryId === categoryId),
    )
    .sort((a, b) => (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt));
}

export function sortTasksByPriority(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.sortOrder - b.sortOrder;
  });
}

export function groupTasksByCategory(
  tasks: TaskItem[],
  categories: TaskCategory[],
): Array<{ category: TaskCategory; tasks: TaskItem[] }> {
  const validCategories = categories
    .filter((c) => !c.deleted)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (validCategories.length === 0) {
    return [];
  }

  const bucketMap = new Map<string, TaskItem[]>();
  for (const cat of validCategories) {
    bucketMap.set(cat.id, []);
  }
  const fallbackId = validCategories[0].id;

  for (const task of tasks) {
    if (task.deleted) continue;
    const bucket = bucketMap.get(task.categoryId) ?? bucketMap.get(fallbackId)!;
    bucket.push(task);
  }

  return validCategories.map((category) => ({
    category,
    tasks: sortTasksByPriority(bucketMap.get(category.id) ?? []),
  }));
}

export function cyclePriority(current: TaskPriority): TaskPriority {
  if (current === 'high') return 'medium';
  if (current === 'medium') return 'low';
  return 'high';
}

export function moveItemOrder<T extends { id: string; sortOrder: number; updatedAt: number }>(
  items: T[],
  id: string,
  direction: 'up' | 'down',
  now: number,
): T[] {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((item) => item.id === id);
  if (idx === -1) return sorted;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= sorted.length) {
    return sorted;
  }

  const swapped = [...sorted];
  const currentItem = swapped[idx];
  const neighborItem = swapped[targetIdx];
  swapped[idx] = { ...neighborItem, updatedAt: now };
  swapped[targetIdx] = { ...currentItem, updatedAt: now };

  return swapped.map((item, i) => ({
    ...item,
    sortOrder: i,
  }));
}
