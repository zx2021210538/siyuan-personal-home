export class Plugin {
  name = 'siyuan-personal-home';
  app: unknown = {};
  eventBus = {
    on: () => undefined,
    off: () => undefined,
  };
  i18n: Record<string, string> = {};
  addIcons(_svg: string): void {}
  addTopBar(_options: unknown): HTMLElement {
    return document.createElement('div');
  }
  addCommand(_options: unknown): void {}
  addTab(_options: unknown): () => unknown {
    return () => ({});
  }
  addDock(_options: unknown): unknown {
    return {};
  }
  async loadData(_name: string): Promise<unknown> {
    return null;
  }
  async saveData(_name: string, _data: unknown): Promise<void> {}
}

export async function fetchSyncPost(
  _url: string,
  _data?: unknown,
): Promise<{ code: number; msg: string; data: unknown }> {
  return { code: 0, msg: '', data: null };
}

export function openTab(_options: unknown): unknown {
  return {};
}

export function showMessage(_text: string, _timeout?: number, _type?: string): void {}
