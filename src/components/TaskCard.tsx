import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  ListTodo,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import {
  cyclePriority,
  getActiveTasks,
  getCompletedTasks,
  groupTasksByCategory,
  moveItemOrder,
  sortTasksByPriority,
} from '../domain/taskLogic';
import type { TaskCategory, TaskItem, TaskPriority } from '../domain/types';

export interface TaskCardProps {
  tasks: TaskItem[];
  categories: TaskCategory[];
  onCreateTask: (title: string, priority: TaskPriority, categoryId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (taskId: string, patch: Partial<TaskItem>) => void;
  onDeleteTask: (taskId: string) => void;
  onClearCompleted: () => void;
  onSaveCategories: (categories: TaskCategory[]) => void;
  onPickDoc: (taskId: string) => void;
  onOpenDoc: (docId: string) => void;
}

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high: { label: '高', color: '#e11d48', bg: 'rgba(225, 29, 72, 0.12)' },
  medium: { label: '中', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  low: { label: '低', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
};

const CAT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6b7280'];

export const TaskCard: React.FC<TaskCardProps> = ({
  tasks,
  categories,
  onCreateTask,
  onToggleComplete,
  onUpdateTask,
  onDeleteTask,
  onClearCompleted,
  onSaveCategories,
  onPickDoc,
  onOpenDoc,
}) => {
  const validCategories = useMemo(
    () => categories.filter((c) => !c.deleted).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const categoryMap = useMemo(
    () => new Map(validCategories.map((c) => [c.id, c])),
    [validCategories],
  );

  const [viewMode, setViewMode] = useState<'priority' | 'category'>('priority');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newCategoryId, setNewCategoryId] = useState<string>('');
  const [showCompleted, setShowCompleted] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catNameDrafts, setCatNameDrafts] = useState<Record<string, string>>({});

  const validCatIds = useMemo(() => new Set(validCategories.map((c) => c.id)), [validCategories]);
  const effectiveNewCategoryId =
    (newCategoryId && validCatIds.has(newCategoryId) ? newCategoryId : '') ||
    (filterCat !== 'all' && validCatIds.has(filterCat) ? filterCat : '') ||
    validCategories[0]?.id ||
    'cat-work';

  const activeTasks = useMemo(
    () => sortTasksByPriority(getActiveTasks(tasks, filterCat)),
    [tasks, filterCat],
  );
  const completedTasks = useMemo(
    () => getCompletedTasks(tasks, filterCat),
    [tasks, filterCat],
  );
  const categoryGroups = useMemo(
    () =>
      groupTasksByCategory(
        getActiveTasks(tasks, filterCat),
        filterCat === 'all'
          ? validCategories
          : validCategories.filter((c) => c.id === filterCat),
      ).filter((g) => g.tasks.length > 0),
    [tasks, validCategories, filterCat],
  );

  const handleAddTask = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onCreateTask(trimmed, newPriority, effectiveNewCategoryId);
    setNewTitle('');
  };

  const renderTaskRow = (task: TaskItem) => {
    const pMeta = PRIORITY_META[task.priority];
    const cat = categoryMap.get(task.categoryId) ?? validCategories[0];
    const isEditing = editingTaskId === task.id;

    return (
      <div
        key={task.id}
        className="group sph-doc-row px-3 py-2.5 flex items-center gap-2.5 text-[13px]"
        style={{ opacity: task.completed ? 0.6 : 1 }}
      >
        <button
          type="button"
          aria-label={`完成任务 ${task.title}`}
          onClick={() => onToggleComplete(task.id)}
          className="w-[18px] h-[18px] rounded-[6px] flex items-center justify-center shrink-0 transition-all"
          style={{
            backgroundColor: task.completed ? 'var(--sph-accent)' : 'transparent',
            border: `1.5px solid ${task.completed ? 'var(--sph-accent)' : 'var(--sph-border-strong)'}`,
            color: 'var(--sph-accent-fg)',
          }}
        >
          {task.completed && <Check size={11} strokeWidth={3} />}
        </button>

        <button
          type="button"
          aria-label={`切换 ${task.title} 优先级`}
          title={`优先级：${pMeta.label}（点击切换）`}
          onClick={() => onUpdateTask(task.id, { priority: cyclePriority(task.priority) })}
          className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: pMeta.bg, color: pMeta.color }}
        >
          {pMeta.label}
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            autoFocus
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={() => {
              const trimmed = editingTitle.trim();
              if (trimmed && trimmed !== task.title) {
                onUpdateTask(task.id, { title: trimmed });
              }
              setEditingTaskId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                const trimmed = editingTitle.trim();
                if (trimmed && trimmed !== task.title) {
                  onUpdateTask(task.id, { title: trimmed });
                }
                setEditingTaskId(null);
              }
              if (e.key === 'Escape') setEditingTaskId(null);
            }}
            className="sph-input flex-1 py-0.5 text-xs"
          />
        ) : (
          <span
            onDoubleClick={() => {
              setEditingTaskId(task.id);
              setEditingTitle(task.title);
            }}
            className={`flex-1 min-w-0 truncate ${task.completed ? 'line-through' : ''}`}
            title="双击修改标题"
          >
            {task.title}
          </span>
        )}

        {viewMode === 'priority' && cat && (
          <button
            type="button"
            title="点击切换维度"
            onClick={() => {
              if (validCategories.length <= 1) return;
              const idx = validCategories.findIndex((c) => c.id === cat.id);
              const nextCat = validCategories[(idx + 1) % validCategories.length];
              onUpdateTask(task.id, { categoryId: nextCat.id });
            }}
            className="px-2 py-0.5 rounded-md text-[10.5px] font-medium shrink-0 transition-colors"
            style={{
              backgroundColor: 'var(--sph-card)',
              color: 'var(--sph-muted)',
              border: '1px solid var(--sph-border)',
            }}
          >
            {cat.name}
          </button>
        )}

        {task.linkedDocId && (
          <button
            type="button"
            aria-label={`打开关联笔记 ${task.linkedDocTitle || task.title}`}
            title={task.linkedDocTitle || '打开关联笔记'}
            onClick={() => onOpenDoc(task.linkedDocId!)}
            className="p-1 rounded-md shrink-0 transition-colors hover:opacity-80"
            style={{ color: 'var(--sph-accent)' }}
          >
            <ExternalLink size={12} />
          </button>
        )}

        <button
          type="button"
          aria-label={`关联笔记 ${task.title}`}
          title="关联思源笔记"
          onClick={() => onPickDoc(task.id)}
          className="sph-action-reveal p-1 rounded-md shrink-0"
          style={{ color: 'var(--sph-muted)' }}
        >
          <Link2 size={12} />
        </button>

        <button
          type="button"
          aria-label={`删除任务 ${task.title}`}
          onClick={() => onDeleteTask(task.id)}
          className="sph-action-reveal p-1 rounded-md shrink-0"
          style={{ color: 'var(--sph-muted)' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const now = Date.now();
    const nextCat: TaskCategory = {
      id: `cat-${now}`,
      name: trimmed,
      color: CAT_COLORS[validCategories.length % CAT_COLORS.length],
      sortOrder: validCategories.length,
      updatedAt: now,
    };
    onSaveCategories([...categories, nextCat]);
    setNewCatName('');
  };

  const handleMoveCat = (id: string, dir: 'up' | 'down') => {
    const now = Date.now();
    const deleted = categories.filter((c) => c.deleted);
    const reordered = moveItemOrder(validCategories, id, dir, now);
    onSaveCategories([...reordered, ...deleted]);
  };

  const handleDeleteCat = (id: string) => {
    if (validCategories.length <= 1) return;
    const now = Date.now();
    onSaveCategories(
      categories.map((c) => (c.id === id ? { ...c, deleted: true, updatedAt: now } : c)),
    );
    if (filterCat === id) setFilterCat('all');
    if (newCategoryId === id) setNewCategoryId('');
  };

  const commitCatRename = (cat: TaskCategory) => {
    const draft = catNameDrafts[cat.id];
    setCatNameDrafts((prev) => {
      const next = { ...prev };
      delete next[cat.id];
      return next;
    });
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (!trimmed || trimmed === cat.name) return;
    const now = Date.now();
    onSaveCategories(
      categories.map((c) => (c.id === cat.id ? { ...c, name: trimmed, updatedAt: now } : c)),
    );
  };

  return (
    <section className="sph-card p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--sph-accent-soft)', color: 'var(--sph-accent)' }}
          >
            <ListTodo size={14} />
          </span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold">轻量任务</h2>
            <span className="text-xs sph-tabular" style={{ color: 'var(--sph-muted)' }}>
              {activeTasks.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div
            className="inline-flex rounded-lg p-0.5 gap-0.5"
            style={{ backgroundColor: 'var(--sph-tile)' }}
          >
            <button
              type="button"
              onClick={() => setViewMode('priority')}
              className="px-2 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                backgroundColor: viewMode === 'priority' ? 'var(--sph-card)' : 'transparent',
                color: viewMode === 'priority' ? 'var(--sph-text)' : 'var(--sph-muted)',
                boxShadow: viewMode === 'priority' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              按优先级
            </button>
            <button
              type="button"
              onClick={() => setViewMode('category')}
              className="px-2 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                backgroundColor: viewMode === 'category' ? 'var(--sph-card)' : 'transparent',
                color: viewMode === 'category' ? 'var(--sph-text)' : 'var(--sph-muted)',
                boxShadow: viewMode === 'category' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              按维度分组
            </button>
          </div>
          <button
            type="button"
            className="sph-btn-ghost !p-1.5"
            aria-label="管理维度"
            title="管理维度"
            onClick={() => setManagingCats((v) => !v)}
          >
            <Settings2 size={14} />
          </button>
        </div>
      </div>

      {/* Unified quick add bar (strictly no due dates) */}
      <div
        className="rounded-xl p-1.5 flex items-center gap-1.5"
        style={{
          backgroundColor: 'var(--sph-tile)',
          border: '1px solid var(--sph-border)',
        }}
      >
        <input
          type="text"
          placeholder="输入新任务回车添加..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddTask();
          }}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none px-2 py-1 text-[12.5px]"
          style={{ color: 'var(--sph-text)' }}
        />
        <button
          type="button"
          title="切换新任务优先级"
          onClick={() => setNewPriority((p) => cyclePriority(p))}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0"
          style={{
            backgroundColor: PRIORITY_META[newPriority].bg,
            color: PRIORITY_META[newPriority].color,
          }}
        >
          {PRIORITY_META[newPriority].label}
        </button>
        <select
          aria-label="新任务维度"
          value={effectiveNewCategoryId}
          onChange={(e) => setNewCategoryId(e.target.value)}
          className="sph-select !py-1 !pl-2 !pr-6 !text-[11px] max-w-[82px]"
        >
          {validCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="添加任务"
          className="sph-btn sph-btn-primary !p-1.5 shrink-0"
          onClick={handleAddTask}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilterCat('all')}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
          style={{
            backgroundColor: filterCat === 'all' ? 'var(--sph-accent)' : 'var(--sph-tile)',
            color: filterCat === 'all' ? 'var(--sph-accent-fg)' : 'var(--sph-muted)',
          }}
        >
          全部
        </button>
        {validCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilterCat(cat.id)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: filterCat === cat.id ? 'var(--sph-accent)' : 'var(--sph-tile)',
              color: filterCat === cat.id ? 'var(--sph-accent-fg)' : 'var(--sph-muted)',
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Inline category manager */}
      {managingCats && (
        <div
          className="rounded-xl p-3 flex flex-col gap-2 text-xs"
          style={{ backgroundColor: 'var(--sph-tile)', border: '1px solid var(--sph-border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">维度管理</span>
            <button
              type="button"
              className="sph-btn-ghost !p-1"
              onClick={() => setManagingCats(false)}
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {validCategories.map((cat, idx) => (
              <div key={cat.id} className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label={`重命名维度 ${cat.name}`}
                  value={catNameDrafts[cat.id] ?? cat.name}
                  onChange={(e) =>
                    setCatNameDrafts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                  }
                  onBlur={() => commitCatRename(cat)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      commitCatRename(cat);
                    }
                    if (e.key === 'Escape') {
                      setCatNameDrafts((prev) => {
                        const next = { ...prev };
                        delete next[cat.id];
                        return next;
                      });
                    }
                  }}
                  className="sph-input flex-1 py-1 text-xs"
                />
                <button
                  type="button"
                  className="sph-btn !p-1"
                  disabled={idx === 0}
                  onClick={() => handleMoveCat(cat.id, 'up')}
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  className="sph-btn !p-1"
                  disabled={idx === validCategories.length - 1}
                  onClick={() => handleMoveCat(cat.id, 'down')}
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  type="button"
                  className="sph-btn !p-1"
                  disabled={validCategories.length <= 1}
                  onClick={() => handleDeleteCat(cat.id)}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <input
              type="text"
              placeholder="新增维度名称..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddCategory();
              }}
              className="sph-input flex-1 py-1 text-xs"
            />
            <button type="button" className="sph-btn sph-btn-primary px-3" onClick={handleAddCategory}>
              新增
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {activeTasks.length === 0 ? (
        <div
          className="rounded-xl py-6 px-4 text-center text-xs"
          style={{
            backgroundColor: 'var(--sph-tile)',
            color: 'var(--sph-muted)',
          }}
        >
          当前没有待办事项，轻松一下或随时在上方记一条。
        </div>
      ) : viewMode === 'priority' ? (
        <div className="flex flex-col gap-1.5">{activeTasks.map(renderTaskRow)}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {categoryGroups.map((group) => (
            <div key={group.category.id} className="flex flex-col gap-1.5">
              <div
                className="text-[11px] font-semibold px-1 flex items-center gap-1.5"
                style={{ color: 'var(--sph-muted)' }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: group.category.color }}
                />
                <span>{group.category.name}</span>
                <span className="sph-tabular" style={{ color: 'var(--sph-subtle)' }}>
                  ({group.tasks.length})
                </span>
              </div>
              {group.tasks.map(renderTaskRow)}
            </div>
          ))}
        </div>
      )}

      {/* Completed collapsible section */}
      {completedTasks.length > 0 && (
        <div className="pt-2" style={{ borderTop: '1px solid var(--sph-border)' }}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="sph-btn-ghost px-1 py-0.5 text-xs"
            >
              {showCompleted ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>已完成 ({completedTasks.length})</span>
            </button>
            {showCompleted && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="sph-btn-ghost px-1.5 py-0.5 text-[11px]"
              >
                清空已完成
              </button>
            )}
          </div>
          {showCompleted && (
            <div className="flex flex-col gap-1.5 mt-2">{completedTasks.map(renderTaskRow)}</div>
          )}
        </div>
      )}
    </section>
  );
};
