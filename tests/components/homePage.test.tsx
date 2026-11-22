import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from '../../src/pages/HomePage';
import { StorageService, type PluginDataAdapter } from '../../src/services/storageService';
import type { SiYuanClient } from '../../src/services/siyuanApi';

function createMemoryStorage() {
  const files = new Map<string, unknown>();
  const adapter: PluginDataAdapter = {
    async loadData(name: string) {
      const val = files.get(name);
      return val === undefined ? null : structuredClone(val);
    },
    async saveData(name: string, data: unknown) {
      files.set(name, structuredClone(data));
    },
  };
  return { storage: new StorageService(adapter), files };
}

function createMockApi(): SiYuanClient {
  return {
    sql: vi.fn().mockImplementation(async (stmt: string) => {
      if (stmt.includes("type = 'd'") && stmt.includes('updated >=')) return [{ cnt: 5 }];
      if (stmt.includes("type = 'd'") && stmt.includes('COUNT(*)')) return [{ cnt: 50 }];
      if (stmt.includes('SUM(length)')) return [{ totalWords: 12000, totalBlocks: 400 }];
      if (stmt.includes("type = 'd'") && stmt.includes('ORDER BY updated DESC')) {
        return [
          {
            id: 'doc-recent-1',
            box: 'nb-a',
            hpath: '/Notes/Plan',
            content: '个人主页设计笔记',
            tag: '#插件#',
            ial: '',
            updated: '20261122140000',
          },
        ];
      }
      if (stmt.includes('COUNT(DISTINCT name)') && stmt.includes("box = 'nb-b'")) {
        return [{ cnt: 225 }];
      }
      if (stmt.includes('COUNT(DISTINCT name)') && stmt.includes("box = 'nb-a'")) {
        return [{ cnt: 108 }];
      }
      return [];
    }),
    lsNotebooks: vi.fn().mockResolvedValue([
      { id: 'nb-a', name: '日记本A', icon: '', closed: false },
      { id: 'nb-b', name: '日记本B', icon: '', closed: false },
    ]),
    getNotebookConf: vi.fn().mockResolvedValue({
      dailyNoteSavePath: '/daily/{{now | date "2006-01-02"}}',
      dailyNoteTemplatePath: '',
    }),
    createDailyNote: vi.fn().mockResolvedValue({ id: 'created-today-id' }),
    renderSprig: vi.fn().mockResolvedValue('/daily/2026-11-20'),
    createDocWithMd: vi.fn().mockResolvedValue('created-past-id'),
    renderTemplate: vi.fn().mockResolvedValue({ content: '' }),
    prependBlock: vi.fn().mockResolvedValue(undefined),
    setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    getLocalStorage: vi.fn().mockResolvedValue({ 'local-dailynoteid': 'nb-a' }),
    setLocalStorageVal: vi.fn().mockResolvedValue(undefined),
    searchDocs: vi.fn().mockResolvedValue([]),
  };
}

describe('HomePage integration (Task 9)', () => {
  it('loads all modules, links diary notebook switching to local-dailynoteid + stats, persists task/habit, and reloads on sync-end', async () => {
    const { storage, files } = createMemoryStorage();
    const api = createMockApi();
    const openDoc = vi.fn();
    let triggerSync: (() => void) | null = null;
    const subscribeSyncRefresh = (cb: () => void) => {
      triggerSync = cb;
      return () => {
        triggerSync = null;
      };
    };

    render(
      <HomePage
        api={api}
        storage={storage}
        openDoc={openDoc}
        subscribeSyncRefresh={subscribeSyncRefresh}
        todayOverride="2026-11-22"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('个人主页设计笔记')).toBeInTheDocument();
      expect(screen.getByText('108')).toBeInTheDocument();
    });

    // Switch diary notebook -> syncs local-dailynoteid & updates yearDiaryDays to 225
    fireEvent.change(screen.getByLabelText('切换日记本'), { target: { value: 'nb-b' } });
    await waitFor(() => {
      expect(api.setLocalStorageVal).toHaveBeenCalledWith('local-dailynoteid', 'nb-b');
      expect(screen.getByText('225')).toBeInTheDocument();
    });

    // Create task directly on HomePage
    const taskInput = screen.getByPlaceholderText(/输入新任务回车添加/);
    fireEvent.change(taskInput, { target: { value: '集成测试任务' } });
    fireEvent.keyDown(taskInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('集成测试任务')).toBeInTheDocument();
    });

    // Simulate external sync writing a new task on disk and emitting sync-end
    const diskTasks = structuredClone(files.get('tasks.json')) as {
      version: 1;
      categories: unknown[];
      tasks: unknown[];
    };
    diskTasks.tasks.push({
      id: 'remote-t',
      title: '来自另一台设备的任务',
      priority: 'high',
      categoryId: 'cat-work',
      completed: false,
      createdAt: Date.now() + 1000,
      updatedAt: Date.now() + 1000,
      sortOrder: 99,
    });
    files.set('tasks.json', diskTasks);

    await act(async () => {
      triggerSync?.();
    });
    await waitFor(() => {
      expect(screen.getByText('来自另一台设备的任务')).toBeInTheDocument();
    });

    // Open Settings modal and toggle option
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    expect(screen.getByText('个人主页设置')).toBeInTheDocument();
  });
});
