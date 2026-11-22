import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Plugin, openTab } from 'siyuan';
import { DEFAULT_SETTINGS, type PluginSettings } from './domain/types';
import { HomePage } from './pages/HomePage';
import { RecentReadTracker } from './services/recentDocsService';
import { createSiYuanClient } from './services/siyuanApi';
import { StorageService } from './services/storageService';
import './styles/index.css';

const HOME_TAB_TYPE = 'sph-home-tab';
const ICON_ID = 'iconSphHome';
const HOME_ICON_SVG = `<symbol id="${ICON_ID}" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6.5h-5V21H4a1 1 0 0 1-1-1z"/></symbol>`;

interface CustomTabContext {
  element: HTMLElement;
  tab?: {
    headElement?: HTMLElement;
    parent?: {
      switchTab?: (head: HTMLElement) => void;
    };
  };
}

export default class PersonalHomePlugin extends Plugin {
  private storage!: StorageService;
  private readTracker: RecentReadTracker | null = null;
  private cachedSettings: PluginSettings = { ...DEFAULT_SETTINGS };
  private activeTabCtx: CustomTabContext | null = null;
  private activeRoot: Root | null = null;
  private syncListeners = new Set<() => void>();

  private readonly handleSwitchProtyle = (event: unknown): void => {
    const detail = (event as { detail?: { protyle?: { block?: { rootID?: string } } } })?.detail;
    const rootId = detail?.protyle?.block?.rootID;
    this.readTracker?.onSwitchDoc(rootId);
  };

  private readonly handleSyncEnd = (): void => {
    for (const cb of this.syncListeners) {
      cb();
    }
  };

  async onload(): Promise<void> {
    this.storage = new StorageService({
      loadData: async (name) => {
        const cache = (this as unknown as { data?: Record<string, unknown> }).data;
        if (cache && Object.prototype.hasOwnProperty.call(cache, name)) {
          delete cache[name];
        }
        return this.loadData(name);
      },
      saveData: async (name, data) => {
        const res = (await this.saveData(name, data)) as
          | { code?: number; msg?: string }
          | undefined
          | void;
        if (res && typeof res === 'object' && typeof res.code === 'number' && res.code !== 0) {
          throw new Error(res.msg || `保存失败（${name}, code=${res.code}）`);
        }
      },
    });

    try {
      this.cachedSettings = await this.storage.loadSettings();
    } catch {
      this.cachedSettings = { ...DEFAULT_SETTINGS };
    }

    if (typeof this.addIcons === 'function') {
      this.addIcons(HOME_ICON_SVG);
    }

    const plugin = this;
    const api = createSiYuanClient();

    this.addTab({
      type: HOME_TAB_TYPE,
      init() {
        const ctx = this as unknown as CustomTabContext;
        plugin.activeTabCtx = ctx;
        const container = document.createElement('div');
        container.style.height = '100%';
        container.style.width = '100%';
        ctx.element.innerHTML = '';
        ctx.element.appendChild(container);

        const root = createRoot(container);
        plugin.activeRoot = root;
        root.render(
          React.createElement(HomePage, {
            api,
            storage: plugin.storage,
            openDoc: (docId: string) => {
              openTab({
                app: plugin.app,
                doc: { id: docId },
              });
            },
            subscribeSyncRefresh: (cb: () => void) => {
              plugin.syncListeners.add(cb);
              return () => {
                plugin.syncListeners.delete(cb);
              };
            },
          }),
        );
      },
      destroy() {
        if (plugin.activeRoot) {
          plugin.activeRoot.unmount();
          plugin.activeRoot = null;
        }
        plugin.activeTabCtx = null;
      },
    });

    this.addTopBar({
      icon: ICON_ID,
      title: this.i18n?.pluginTitle || '个人主页',
      position: this.cachedSettings.topBarPosition,
      callback: () => {
        this.openHomeTab();
      },
    });

    this.addCommand({
      langKey: 'openHome',
      hotkey: '⌥⇧H',
      callback: () => {
        this.openHomeTab();
      },
    });

    this.readTracker = new RecentReadTracker(async (docId) => {
      try {
        await this.storage.saveRecentRead(docId);
      } catch {
        // Ignore transient write errors during background read tracking
      }
    }, 1500);

    this.eventBus.on('switch-protyle', this.handleSwitchProtyle as never);
    this.eventBus.on('sync-end', this.handleSyncEnd as never);
  }

  onLayoutReady(): void {
    if (this.cachedSettings.autoOpenOnStart && !this.activeTabCtx) {
      this.openHomeTab();
    }
  }

  onDataChanged(): void {
    this.handleSyncEnd();
  }

  openHomeTab(): void {
    const head = this.activeTabCtx?.tab?.headElement;
    const switchTab = this.activeTabCtx?.tab?.parent?.switchTab;
    if (head && typeof switchTab === 'function') {
      switchTab.call(this.activeTabCtx?.tab?.parent, head);
      return;
    }

    const pluginName = this.name || 'siyuan-personal-home';
    openTab({
      app: this.app,
      custom: {
        icon: ICON_ID,
        title: this.i18n?.pluginTitle || '个人主页',
        id: `${pluginName}${HOME_TAB_TYPE}`,
      },
    });
  }

  onunload(): void {
    this.eventBus.off('switch-protyle', this.handleSwitchProtyle as never);
    this.eventBus.off('sync-end', this.handleSyncEnd as never);
    this.readTracker?.dispose();
    this.readTracker = null;
    this.syncListeners.clear();
    if (this.activeRoot) {
      this.activeRoot.unmount();
      this.activeRoot = null;
    }
    this.activeTabCtx = null;
  }
}
