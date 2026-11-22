import { fetchSyncPost } from 'siyuan';

export interface SiYuanNotebook {
  id: string;
  name: string;
  icon: string;
  closed: boolean;
}

export interface SiYuanNotebookConf {
  dailyNoteSavePath: string;
  dailyNoteTemplatePath: string;
}

export interface SearchDocHit {
  id: string;
  box: string;
  hpath: string;
  content: string;
}

export interface SiYuanClient {
  sql<T = Record<string, unknown>>(stmt: string): Promise<T[]>;
  lsNotebooks(): Promise<SiYuanNotebook[]>;
  getNotebookConf(notebookId: string): Promise<SiYuanNotebookConf>;
  createDailyNote(notebookId: string): Promise<{ id: string }>;
  renderSprig(template: string): Promise<string>;
  createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string>;
  renderTemplate(id: string, path: string): Promise<{ content: string }>;
  prependBlock(parentId: string, dom: string): Promise<void>;
  setBlockAttrs(id: string, attrs: Record<string, string>): Promise<void>;
  getLocalStorage(): Promise<Record<string, unknown>>;
  setLocalStorageVal(key: string, val: unknown): Promise<void>;
  getEditorFontFamily?(): Promise<string>;
  renderAttributeView?(params: {
    id: string;
    blockID?: string;
    viewID?: string;
    page?: number;
    pageSize?: number;
  }): Promise<unknown>;
  searchDocs(keyword: string): Promise<SearchDocHit[]>;
}

interface SiYuanFontConf {
  editor?: { fontFamily?: string };
  appearance?: {
    globalFontFamilies?: Array<{ family?: string }>;
  };
}

function extractConfiguredFontFamily(conf?: SiYuanFontConf): string {
  const candidates: string[] = [];
  const editorFont = conf?.editor?.fontFamily?.trim();
  if (editorFont) candidates.push(editorFont);
  const globalFonts = conf?.appearance?.globalFontFamilies;
  if (Array.isArray(globalFonts)) {
    for (const item of globalFonts) {
      const fam = item?.family?.trim();
      if (fam && !candidates.includes(fam)) {
        candidates.push(fam);
      }
    }
  }
  return candidates.join(', ');
}

export function getRuntimeEditorFontFamily(): string {
  try {
    const win = window as unknown as {
      siyuan?: { config?: SiYuanFontConf };
    };
    return extractConfiguredFontFamily(win?.siyuan?.config);
  } catch {
    // ignore non-browser env
  }
  return '';
}

export function escapeSqlString(val: string): string {
  return val.replace(/'/g, "''");
}

export function escapeSqlLike(val: string): string {
  return escapeSqlString(val.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_'));
}

async function postApi<T>(url: string, data?: Record<string, unknown>): Promise<T> {
  const res = await fetchSyncPost(url, data ?? {});
  if (res.code !== 0) {
    throw new Error(res.msg || `SiYuan API error (${res.code}) at ${url}`);
  }
  return res.data as T;
}

export function createSiYuanClient(): SiYuanClient {
  return {
    async sql<T = Record<string, unknown>>(stmt: string): Promise<T[]> {
      const data = await postApi<T[] | null>('/api/query/sql', { stmt });
      return Array.isArray(data) ? data : [];
    },

    async lsNotebooks(): Promise<SiYuanNotebook[]> {
      const data = await postApi<{ notebooks?: SiYuanNotebook[] }>('/api/notebook/lsNotebooks');
      return Array.isArray(data?.notebooks) ? data.notebooks : [];
    },

    async getNotebookConf(notebookId: string): Promise<SiYuanNotebookConf> {
      const data = await postApi<{ conf?: Partial<SiYuanNotebookConf> }>(
        '/api/notebook/getNotebookConf',
        { notebook: notebookId },
      );
      return {
        dailyNoteSavePath:
          data?.conf?.dailyNoteSavePath || '/daily note/{{now | date "2006/01"}}/{{now | date "2006-01-02"}}',
        dailyNoteTemplatePath: data?.conf?.dailyNoteTemplatePath || '',
      };
    },

    async createDailyNote(notebookId: string): Promise<{ id: string }> {
      return postApi<{ id: string }>('/api/filetree/createDailyNote', {
        notebook: notebookId,
      });
    },

    async renderSprig(template: string): Promise<string> {
      return postApi<string>('/api/template/renderSprig', { template });
    },

    async createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string> {
      return postApi<string>('/api/filetree/createDocWithMd', {
        notebook: notebookId,
        path,
        markdown,
      });
    },

    async renderTemplate(id: string, path: string): Promise<{ content: string }> {
      return postApi<{ content: string }>('/api/template/render', { id, path });
    },

    async prependBlock(parentId: string, dom: string): Promise<void> {
      await postApi('/api/block/prependBlock', {
        dataType: 'dom',
        data: dom,
        parentID: parentId,
      });
    },

    async setBlockAttrs(id: string, attrs: Record<string, string>): Promise<void> {
      await postApi('/api/attr/setBlockAttrs', { id, attrs });
    },

    async getLocalStorage(): Promise<Record<string, unknown>> {
      const data = await postApi<Record<string, unknown> | null>('/api/storage/getLocalStorage');
      return data ?? {};
    },

    async setLocalStorageVal(key: string, val: unknown): Promise<void> {
      await postApi('/api/storage/setLocalStorageVal', { key, val });
    },

    async getEditorFontFamily(): Promise<string> {
      const runtime = getRuntimeEditorFontFamily();
      if (runtime) return runtime;
      try {
        const data = await postApi<{ conf?: SiYuanFontConf }>('/api/system/getConf');
        return extractConfiguredFontFamily(data?.conf);
      } catch {
        return '';
      }
    },

    async renderAttributeView(params): Promise<unknown> {
      return postApi('/api/av/renderAttributeView', {
        id: params.id,
        blockID: params.blockID ?? '',
        viewID: params.viewID ?? '',
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 200,
        query: '',
        createIfNotExist: false,
        persistView: false,
      });
    },

    async searchDocs(keyword: string): Promise<SearchDocHit[]> {
      const safe = escapeSqlLike(keyword.trim());
      const where = safe
        ? `type = 'd' AND (content LIKE '%${safe}%' ESCAPE '\\' OR hpath LIKE '%${safe}%' ESCAPE '\\')`
        : `type = 'd'`;
      return this.sql<SearchDocHit>(
        `SELECT id, box, hpath, content FROM blocks WHERE ${where} ORDER BY updated DESC LIMIT 30`,
      );
    },
  };
}
