import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as siyuan from 'siyuan';
import PersonalHomePlugin from '../../src/index';

describe('PersonalHomePlugin lifecycle (Task 10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('registers single topBar, Alt+Shift+H command, custom tab, never calls addDock, and cleans up on unload', async () => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const plugin = new PersonalHomePlugin({} as never);
    const saved = new Map<string, unknown>();

    const addTopBarSpy = vi.spyOn(plugin, 'addTopBar');
    const addCommandSpy = vi.spyOn(plugin, 'addCommand');
    const addTabSpy = vi.spyOn(plugin, 'addTab');
    const addDockSpy = vi.spyOn(plugin, 'addDock');
    const openTabSpy = vi.spyOn(siyuan, 'openTab').mockReturnValue({} as never);

    vi.spyOn(plugin, 'loadData').mockImplementation(async (name: string) => saved.get(name) ?? null);
    vi.spyOn(plugin, 'saveData').mockImplementation(async (name: string, data: unknown) => {
      saved.set(name, structuredClone(data));
    });

    const onSpy = vi.spyOn(plugin.eventBus, 'on').mockImplementation(((
      event: string,
      cb: (...args: unknown[]) => void,
    ) => {
      const set = listeners.get(event) ?? new Set();
      set.add(cb);
      listeners.set(event, set);
    }) as never);
    const offSpy = vi.spyOn(plugin.eventBus, 'off').mockImplementation(((
      event: string,
      cb: (...args: unknown[]) => void,
    ) => {
      listeners.get(event)?.delete(cb);
    }) as never);

    await plugin.onload();

    expect(addTopBarSpy).toHaveBeenCalledTimes(1);
    expect(addCommandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        langKey: 'openHome',
        hotkey: '⌥⇧H',
      }),
    );
    expect(addTabSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sph-home-tab',
      }),
    );
    expect(addDockSpy).not.toHaveBeenCalled();
    expect(onSpy).toHaveBeenCalledWith('switch-protyle', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('sync-end', expect.any(Function));

    // onLayoutReady opens Home tab once when autoOpenOnStart=true
    plugin.onLayoutReady();
    expect(openTabSpy).toHaveBeenCalledTimes(1);

    // Calling openHomeTab again while active tab instance exists activates it instead of calling openTab again
    const tabSpec = addTabSpy.mock.calls[0][0] as unknown as {
      init?: (this: {
        element: HTMLElement;
        tab?: { parent?: { switchTab: (el: HTMLElement) => void }; headElement?: HTMLElement };
      }) => void;
      destroy?: () => void;
    };
    const switchTabSpy = vi.fn();
    const fakeTabInstance = {
      element: document.createElement('div'),
      tab: {
        headElement: document.createElement('li'),
        parent: { switchTab: switchTabSpy },
      },
    };
    tabSpec.init?.call(fakeTabInstance);

    openTabSpy.mockClear();
    plugin.openHomeTab();
    expect(openTabSpy).not.toHaveBeenCalled();
    expect(switchTabSpy).toHaveBeenCalledWith(fakeTabInstance.tab.headElement);

    // switch-protyle records recent read after 1500ms dwell
    const switchHandler = Array.from(listeners.get('switch-protyle') ?? [])[0];
    switchHandler?.({ detail: { protyle: { block: { rootID: 'doc-read-99' } } } });
    await vi.advanceTimersByTimeAsync(1500);
    const recentReads = saved.get('recent-reads.json') as { records: Array<{ docId: string }> } | undefined;
    expect(recentReads?.records[0]?.docId).toBe('doc-read-99');

    // onunload removes both event listeners and disposes timers cleanly
    plugin.onunload();
    expect(offSpy).toHaveBeenCalledWith('switch-protyle', expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith('sync-end', expect.any(Function));
    expect(listeners.get('switch-protyle')?.size ?? 0).toBe(0);
    expect(listeners.get('sync-end')?.size ?? 0).toBe(0);
  });
});
