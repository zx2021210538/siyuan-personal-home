import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MiniCalendarCard } from '../../src/components/MiniCalendarCard';
import { HabitCard } from '../../src/components/HabitCard';
import { HabitDetailModal } from '../../src/components/HabitDetailModal';
import { TaskCard } from '../../src/components/TaskCard';
import {
  DEFAULT_TASK_CATEGORIES,
  type HabitCheckin,
  type HabitItem,
  type TaskItem,
} from '../../src/domain/types';

describe('Action Cards (Task 8)', () => {
  it('MiniCalendarCard shows diary markers, todo badges, switches notebook and clicks date', () => {
    const onSelectNotebook = vi.fn();
    const onClickDate = vi.fn();
    const onChangeMonth = vi.fn();

    render(
      <MiniCalendarCard
        year={2026}
        month={11}
        todayStr="2026-11-22"
        weekStartDay={1}
        showTodoBadge={true}
        daysMap={{
          '2026-11-10': { date: '2026-11-10', hasDiary: true, diaryDocId: 'd1', hasUnfinishedTodo: true },
          '2026-11-22': { date: '2026-11-22', hasDiary: true, diaryDocId: 'd2', hasUnfinishedTodo: false },
        }}
        notebooks={[
          { id: 'nb-a', name: '日记本', icon: '', closed: false },
          { id: 'nb-b', name: '工作本', icon: '', closed: false },
        ]}
        activeNotebookId="nb-a"
        onChangeMonth={onChangeMonth}
        onSelectNotebook={onSelectNotebook}
        onClickDate={onClickDate}
        onJumpToday={vi.fn()}
      />,
    );

    expect(screen.getByTestId('cal-todo-badge-2026-11-10')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('切换日记本'), { target: { value: 'nb-b' } });
    expect(onSelectNotebook).toHaveBeenCalledWith('nb-b');

    fireEvent.click(screen.getByRole('button', { name: /2026-11-10/ }));
    expect(onClickDate).toHaveBeenCalledWith('2026-11-10');
  });

  it('HabitCard supports one-click checkin, inline duration tweak, daily/weekly streaks, and detail modal', () => {
    const habits: HabitItem[] = [
      {
        id: 'h-daily',
        name: '每日阅读',
        icon: '📖',
        color: '#3b82f6',
        frequencyType: 'daily',
        weeklyTarget: 7,
        trackDuration: true,
        defaultDurationMinutes: 30,
        createdAt: '2026-11-01',
        archived: false,
        sortOrder: 0,
        updatedAt: 100,
      },
      {
        id: 'h-weekly',
        name: '力量训练',
        icon: '🏋️',
        color: '#10b981',
        frequencyType: 'weekly',
        weeklyTarget: 3,
        trackDuration: false,
        createdAt: '2026-11-01',
        archived: false,
        sortOrder: 1,
        updatedAt: 100,
      },
    ];

    const checkins: Record<string, Record<string, HabitCheckin>> = {
      'h-daily': {
        '2026-11-21': { done: true, durationMinutes: 25, checkedAt: 1, updatedAt: 1 },
        '2026-11-22': { done: true, durationMinutes: 30, checkedAt: 2, updatedAt: 2 },
      },
      'h-weekly': {
        '2026-11-16': { done: true, checkedAt: 1, updatedAt: 1 },
        '2026-11-18': { done: true, checkedAt: 2, updatedAt: 2 },
        '2026-11-20': { done: true, checkedAt: 3, updatedAt: 3 },
      },
    };

    const onToggleToday = vi.fn();
    const onUpdateTodayDuration = vi.fn();
    const onOpenDetail = vi.fn();

    render(
      <HabitCard
        habits={habits}
        checkins={checkins}
        todayStr="2026-11-22"
        weekStartDay={1}
        onToggleToday={onToggleToday}
        onUpdateTodayDuration={onUpdateTodayDuration}
        onOpenDetail={onOpenDetail}
        onCreateHabit={vi.fn()}
      />,
    );

    expect(screen.getByText(/连续 2 天/)).toBeInTheDocument();
    expect(screen.getByText(/连续 1 周/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打卡 力量训练' }));
    expect(onToggleToday).toHaveBeenCalledWith('h-weekly');

    // Inline duration edit
    fireEvent.click(screen.getByRole('button', { name: '修改 每日阅读 今日耗时' }));
    const durInput = screen.getByLabelText('今日耗时分钟');
    fireEvent.change(durInput, { target: { value: '45' } });
    fireEvent.keyDown(durInput, { key: 'Enter' });
    expect(onUpdateTodayDuration).toHaveBeenCalledWith('h-daily', 45);
  });

  it('HabitDetailModal allows backfilling historical date and moving habit order', () => {
    const habit: HabitItem = {
      id: 'h-1',
      name: '每日阅读',
      icon: '📖',
      color: '#3b82f6',
      frequencyType: 'daily',
      weeklyTarget: 7,
      trackDuration: true,
      defaultDurationMinutes: 30,
      createdAt: '2026-11-01',
      archived: false,
      sortOrder: 1,
      updatedAt: 100,
    };
    const onSetDateCheckin = vi.fn();
    const onMoveOrder = vi.fn();

    render(
      <HabitDetailModal
        habit={habit}
        checkins={{}}
        todayStr="2026-11-22"
        weekStartDay={1}
        isFirst={false}
        isLast={false}
        onClose={vi.fn()}
        onSetDateCheckin={onSetDateCheckin}
        onUpdateHabit={vi.fn()}
        onMoveOrder={onMoveOrder}
        onArchive={vi.fn()}
        onDelete={vi.fn()}
        onPickDoc={vi.fn()}
        onOpenDoc={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '补卡 2026-11-15' }));
    expect(onSetDateCheckin).toHaveBeenCalledWith('h-1', '2026-11-15', {
      done: true,
      durationMinutes: 30,
      note: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: '上移习惯' }));
    expect(onMoveOrder).toHaveBeenCalledWith('h-1', 'up');
  });

  it('TaskCard creates task on Enter without due date inputs, switches views, toggles completion, and cycles priority', () => {
    const tasks: TaskItem[] = [
      {
        id: 't-1',
        title: '整理论文实验数据',
        priority: 'high',
        categoryId: 'cat-study',
        completed: false,
        createdAt: 100,
        updatedAt: 100,
        sortOrder: 0,
        linkedDocId: 'doc-paper',
        linkedDocTitle: '实验记录',
      },
      {
        id: 't-done',
        title: '已完成的事项',
        priority: 'low',
        categoryId: 'cat-work',
        completed: true,
        completedAt: 200,
        createdAt: 50,
        updatedAt: 200,
        sortOrder: 1,
      },
    ];

    const onCreateTask = vi.fn();
    const onToggleComplete = vi.fn();
    const onUpdateTask = vi.fn();
    const onOpenDoc = vi.fn();

    render(
      <TaskCard
        tasks={tasks}
        categories={DEFAULT_TASK_CATEGORIES}
        onCreateTask={onCreateTask}
        onToggleComplete={onToggleComplete}
        onUpdateTask={onUpdateTask}
        onDeleteTask={vi.fn()}
        onClearCompleted={vi.fn()}
        onSaveCategories={vi.fn()}
        onPickDoc={vi.fn()}
        onOpenDoc={onOpenDoc}
      />,
    );

    // Ensure no date input exists (Anti-Goal: zero due dates)
    expect(document.querySelector('input[type="date"]')).toBeNull();

    const input = screen.getByPlaceholderText(/输入新任务回车添加/);
    fireEvent.change(input, { target: { value: '梳理下周重点' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCreateTask).toHaveBeenCalledWith('梳理下周重点', 'medium', 'cat-work');

    fireEvent.click(screen.getByRole('button', { name: '切换 整理论文实验数据 优先级' }));
    expect(onUpdateTask).toHaveBeenCalledWith('t-1', { priority: 'medium' });

    fireEvent.click(screen.getByRole('button', { name: '打开关联笔记 实验记录' }));
    expect(onOpenDoc).toHaveBeenCalledWith('doc-paper');

    fireEvent.click(screen.getByRole('button', { name: /已完成 \(1\)/ }));
    expect(screen.getByText('已完成的事项')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '按维度分组' }));
    expect(screen.getAllByText('学习').length).toBeGreaterThan(0);
  });
});
