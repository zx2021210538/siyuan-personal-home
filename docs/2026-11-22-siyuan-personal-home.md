# 思源笔记「个人主页」插件（siyuan-personal-home）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零构建可独立安装至 `E:\Siyuan_Vault` 的思源笔记「个人主页」插件（`siyuan-personal-home`），在单一自定义标签页中整合笔记统计与年度热力图、日记月历与今日日记预览卡、Notebook Navigator 风格最近改过/读过卡片、双维度习惯打卡与无时间节点轻量任务，彻底替代 `任务笔记管理` 与 `日历面板`。

**Architecture:** 采用方案一（单页 Bento 卡片工作台 + 插件私有结构化 JSON 存储）。代码严格分为纯函数领域层（`src/domain/`）、思源 API 与存储服务层（`src/services/`）、独立业务卡片组件层（`src/components/`）与单页布局容器（`src/pages/HomePage.tsx`），确保未来可零数据迁移平滑演进至多子页应用（方案三）。

**Tech Stack:** React 19, TypeScript 5 (strict), Vite (CJS library bundle, external `siyuan`), Tailwind CSS 4 (scoped to `.sph-root` with SiYuan CSS variables), `lucide-react`, Vitest + `@testing-library/react` + `happy-dom`.

**Spec:** [2026-11-22-siyuan-personal-home-design.md](file:///d:/WorkSpace/vscode_workspace/docs/superpowers/specs/2026-11-22-siyuan-personal-home-design.md)

## Global Constraints

- 插件 ID 固定为 `siyuan-personal-home`，中文名 `个人主页`，英文名 `Personal Home`，最低思源版本 `minAppVersion: "3.8.11"`。
- 源码工程位于 `d:\WorkSpace\vscode_workspace\siyuan-personal-home`，构建产物同时产出 `dist/` 与 `package.zip`，并支持本地安装到 `E:\Siyuan_Vault\data\plugins\siyuan-personal-home`。
- 严禁调用 `addDock`，零侧边栏 Dock 图标；仅注册顶栏单一入口图标、命令快捷键 `Alt+Shift+H` 与单实例自定义标签页 `sph-home-tab`。
- 严禁向思源笔记本写入任务/打卡 Markdown 块；所有插件数据通过 `Plugin.saveData`/`loadData` 分文件持久化于 `settings.json`、`tasks.json`、`habits.json`、`recent-reads.json`（均含 `version: 1`）。
- 全部样式限定在 `.sph-root` 作用域下，色彩与圆角映射思源原生 `--b3-theme-*` / `--b3-border-color` / `--b3-list-hover` 变量，严禁硬编码不可适配的亮/暗底色。
- `TaskItem` 刻意不包含截止时间、开始时间或提醒字段；v1 不引入任何拖拽排序（DnD）库。
- 提交 Git 时仅 `git add siyuan-personal-home/...`，不得暂存工作区其他无关修改。

## Review Focus

以下 5 类隐含失败模式已分别钉入对应任务的单元测试中：

1. **跨年/跨周打卡连击边界**：`daily` 习惯跨 `12-31 → 01-01` 与闰年 `02-28 → 02-29 → 03-01`、`weekly` 习惯跨年同一自然周时，连击天数/周数不得断裂或重复计数。（覆盖于 Task 2）
2. **死链文档与非图片题头图容错**：`recent-reads.json` 含已删除文档 ID、或文档 `ial` 中 `title-img` 为纯色/CSS `linear-gradient` 渐变、或文档正文为空时，必须静默过滤死链、隐藏缩略图占位且不抛错。（覆盖于 Task 3、Task 6）
3. **跨端同步记录级合并与损坏 JSON 保护**：磁盘快照含远端更新时，写入必须按 `updatedAt` + `deleted` 软删除合并而不覆写无关记录；磁盘或导入 JSON 格式损坏时拒绝覆盖原文件。（覆盖于 Task 4）
4. **SQL 特殊字符转义与空/关闭笔记本兜底**：ID 或关键词含单引号、`local-dailynoteid` 指向已关闭笔记本、或工作区暂无打开笔记本时，查询与日记本解析必须安全降级为空态而不报错。（覆盖于 Task 5）
5. **快速切页去噪与插件卸载清理**：1.5 秒内连续切换多篇文档不得写入 `recent-reads.json`；插件 `onunload` 必须注销 `switch-protyle`/`sync-end` 监听器、清除定时器并卸载 React Root。（覆盖于 Task 6、Task 10）

---

## File Structure Overview

```text
siyuan-personal-home/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── public/
│   ├── plugin.json
│   ├── icon.png
│   └── i18n/{zh_CN.json, en_US.json}
├── scripts/
│   ├── build-zip.mjs
│   └── install-local.mjs
├── src/
│   ├── index.ts
│   ├── styles/index.css
│   ├── domain/
│   │   ├── types.ts
│   │   ├── habitStats.ts
│   │   ├── taskLogic.ts
│   │   ├── docPreview.ts
│   │   └── storeMerge.ts
│   ├── services/
│   │   ├── siyuanApi.ts
│   │   ├── storageService.ts
│   │   ├── statsService.ts
│   │   ├── dailyNoteService.ts
│   │   └── recentDocsService.ts
│   ├── components/
│   │   ├── StatsHeatmapCard.tsx
│   │   ├── TodayDailyNoteCard.tsx
│   │   ├── RecentDocsCard.tsx
│   │   ├── MiniCalendarCard.tsx
│   │   ├── HabitCard.tsx
│   │   ├── HabitDetailModal.tsx
│   │   ├── TaskCard.tsx
│   │   ├── DocPickerModal.tsx
│   │   └── SettingsModal.tsx
│   └── pages/HomePage.tsx
└── tests/
    ├── domain/
    │   ├── habitStats.test.ts
    │   ├── taskLogic.test.ts
    │   ├── docPreview.test.ts
    │   └── storeMerge.test.ts
    ├── services/
    │   ├── storageService.test.ts
    │   ├── statsAndDailyNote.test.ts
    │   └── recentDocsService.test.ts
    └── components/
        ├── contentCards.test.tsx
        ├── actionCards.test.tsx
        ├── homePage.test.tsx
        └── pluginLifecycle.test.ts
```

---

### Task 1: 项目脚手架、类型契约、主题样式与构建脚本

**Files:**
- Create: `siyuan-personal-home/package.json`
- Create: `siyuan-personal-home/tsconfig.json`
- Create: `siyuan-personal-home/vite.config.ts`
- Create: `siyuan-personal-home/vitest.config.ts`
- Create: `siyuan-personal-home/public/plugin.json`
- Create: `siyuan-personal-home/public/icon.png`
- Create: `siyuan-personal-home/public/i18n/zh_CN.json`
- Create: `siyuan-personal-home/public/i18n/en_US.json`
- Create: `siyuan-personal-home/src/domain/types.ts`
- Create: `siyuan-personal-home/src/styles/index.css`
- Create: `siyuan-personal-home/src/index.ts` (最小可编译占位入口)
- Create: `siyuan-personal-home/scripts/build-zip.mjs`
- Create: `siyuan-personal-home/scripts/install-local.mjs`
- Test: `siyuan-personal-home/tests/domain/types.smoke.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `src/domain/types.ts` 导出：`WeekStartDay`, `TopBarPosition`, `PluginSettings`, `DEFAULT_SETTINGS`, `TaskPriority`, `TaskCategory`, `TaskItem`, `TasksStore`, `DEFAULT_TASK_CATEGORIES`, `HabitFrequencyType`, `HabitItem`, `HabitCheckin`, `HabitsStore`, `RecentReadRecord`, `RecentReadsStore`, `DocPreviewItem`, `OverviewStats`, `HeatmapDay`, `MonthCalendarDay`, `BackupBundle`
  - 构建与测试命令：`pnpm type-check`, `pnpm test`, `pnpm build`, `pnpm install:local`

- [ ] **Step 1: 创建项目配置文件与清单**
  在 `siyuan-personal-home/` 下创建：
  - `package.json`：声明 React 19、ReactDOM 19、`lucide-react`、`tailwindcss`、`@tailwindcss/vite`、TypeScript 5、Vite、Vitest、`@testing-library/react`、`@testing-library/user-event`、`happy-dom`、`siyuan`（devDependency 提供类型）、`jszip`（devDependency 供 `build-zip.mjs` 跨平台打包）；配置 scripts：`dev`, `type-check`, `test`, `build`（依次跑 `tsc --noEmit`、`vite build`、`node scripts/build-zip.mjs`）、`install:local`。
  - `vite.config.ts`：Library 模式，入口 `src/index.ts`，`formats: ['cjs']`，`fileName: () => 'index.js'`，`cssFileName: 'index'`，Rollup `external: ['siyuan']`，`define: { 'process.env.NODE_ENV': JSON.stringify('production') }`，输出到 `dist/` 并自动复制 `public/` 静态资源。
  - `vitest.config.ts`：配置 `environment: 'happy-dom'` 与 `globals: true`。
  - `public/plugin.json`：`name: "siyuan-personal-home"`, `version: "0.1.0"`, `minAppVersion: "3.8.11"`, `backends: ["all"]`, `frontends: ["all"]`, `disabledInPublish: true`, `displayName: { default: "Personal Home", "zh-CN": "个人主页" }`, `icon: "icon.png"`。
  - `public/icon.png`（生成简洁 160x160 PNG 图标）与 `public/i18n/{zh_CN,en_US}.json`。

- [ ] **Step 2: 编写核心领域类型契约 `src/domain/types.ts`**
  完整定义 Spec 第 6.4、6.5、7 节中的所有数据接口与默认值：
  - `DEFAULT_SETTINGS`：`{ version: 1, topBarPosition: 'left', autoOpenOnStart: true, weekStartDay: 1, showHeatmap: true, showDiaryTodoBadge: true, useThemeAccent: true, hideDailyNotesInRecent: false, recentTab: 'modified', diaryNotebookId: '' }`
  - `DEFAULT_TASK_CATEGORIES`：预置 4 个维度（`工作`、`学习`、`生活`、`随手记`，固定稳定 ID 如 `cat-work` / `cat-study` / `cat-life` / `cat-misc`）。
  - `TaskItem` / `TaskCategory` / `HabitItem` / `HabitCheckin` 均包含 `updatedAt: number`，前三个包含 `deleted?: boolean`；`TaskItem` 不含任何时间节点或提醒字段。

- [ ] **Step 3: 编写主题作用域样式 `src/styles/index.css` 与打包安装脚本**
  - `src/styles/index.css`：引入 Tailwind CSS 4，在 `.sph-root` 下定义 `--sph-bg`、`--sph-surface`、`--sph-card`、`--sph-text`、`--sph-muted`、`--sph-border`、`--sph-hover`、`--sph-accent`、`--sph-accent-fg`、`--sph-radius`，全部映射到思源原生 `--b3-theme-*` / `--b3-border-color` / `--b3-list-hover`；提供 `.sph-use-accent` 切换主题强调色与中性色，提供 `.sph-grid` 响应式断点（`>=960px` 左 `1.62fr` 右 `1fr`，`<960px` 单列）。
  - `scripts/build-zip.mjs`：验证 `dist/plugin.json`、`dist/index.js`、`dist/index.css` 存在后将 `dist/` 打包为 `package.zip`。
  - `scripts/install-local.mjs`：将 `dist/` 复制到 `process.env.SIYUAN_PLUGIN_DIR || 'E:\\Siyuan_Vault\\data\\plugins'` 下的 `siyuan-personal-home` 目录。

- [ ] **Step 4: 编写最小占位入口与冒烟测试**
  创建 `src/index.ts`（导出空壳 `PersonalHomePlugin extends Plugin`）与 `tests/domain/types.smoke.test.ts`：
  ```ts
  it('provides clean default settings and 4 initial task categories without due dates', () => {
    expect(DEFAULT_SETTINGS.autoOpenOnStart).toBe(true);
    expect(DEFAULT_SETTINGS.weekStartDay).toBe(1);
    expect(DEFAULT_TASK_CATEGORIES.map((c) => c.name)).toEqual(['工作', '学习', '生活', '随手记']);
  });
  ```

- [ ] **Step 5: 安装依赖并验证全链路**
  Run: `pnpm --dir siyuan-personal-home install && pnpm --dir siyuan-personal-home test && pnpm --dir siyuan-personal-home build`
  Expected: 所有测试 PASS，`dist/index.js`、`dist/index.css`、`dist/plugin.json`、`package.zip` 均成功生成且零类型错误。

- [ ] **Step 6: Commit**
  ```bash
  git add siyuan-personal-home
  git commit -m "chore: scaffold siyuan-personal-home plugin with types and build scripts"
  ```

---

### Task 2: 习惯双维度统计领域逻辑

**Files:**
- Create: `siyuan-personal-home/src/domain/habitStats.ts`
- Test: `siyuan-personal-home/tests/domain/habitStats.test.ts`

**Interfaces:**
- Consumes: `HabitItem`, `HabitCheckin`, `WeekStartDay` from `src/domain/types.ts`
- Produces:
  - `export interface WeekDot { date: string; state: 'done' | 'missed' | 'future'; isToday: boolean; durationMinutes?: number }`
  - `export interface HabitStats { currentStreak: number; bestStreak: number; streakUnit: 'day' | 'week'; thisWeekCount: number; weeklyTarget: number; totalDays: number; spanDays: number; todayDone: boolean; todayDurationMinutes: number; thisWeekDurationMinutes: number; totalDurationMinutes: number; weekDots: WeekDot[] }`
  - `export function getWeekStartDate(dateStr: string, weekStartDay: WeekStartDay): string`
  - `export function getCurrentWeekDots(checkins: Record<string, HabitCheckin>, todayStr: string, weekStartDay: WeekStartDay): WeekDot[]`
  - `export function computeHabitStats(habit: HabitItem, checkins: Record<string, HabitCheckin>, todayStr: string, weekStartDay: WeekStartDay): HabitStats`
  - `export function formatDurationMinutes(minutes: number): string`

- [ ] **Step 1: 编写覆盖全部规则与跨年/闰年边界的失败测试 `tests/domain/habitStats.test.ts`**
  ```ts
  describe('habitStats', () => {
    it('keeps daily streak alive before today is checked in and crosses year/leap-year boundaries', () => {
      // 2025-12-30, 2025-12-31, 2026-01-01 checked; today = 2026-01-02 (unchecked) => currentStreak=3, bestStreak=3
      // 2024-02-28, 2024-02-29, 2024-03-01 checked; today = 2024-03-01 => currentStreak=3
    });

    it('computes weekly habit streak in consecutive goal-met calendar weeks including cross-year week', () => {
      // weeklyTarget=3, weekStartDay=1; 连续 3 个自然周（跨 2025-12-29..2026-01-04）均打卡>=3次，本周仅2次 => currentStreak=3, streakUnit='week', thisWeekCount=2
    });

    it('aligns 7-dot strip to current calendar week with done/missed/future/isToday states', () => {
      // today = 2026-11-19 (Thu), weekStartDay = 1 => dots span 2026-11-16..2026-11-22; Fri-Sun state='future'; Thu isToday=true
    });

    it('computes spanDays from earliest checkin or createdAt and aggregates duration minutes', () => {
      // totalDays, spanDays, todayDurationMinutes, thisWeekDurationMinutes, totalDurationMinutes
      // formatDurationMinutes(0) === '0m', (45) === '45m', (90) === '1h 30m', (120) === '2h'
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/habitStats.test.ts`
  Expected: FAIL (`Cannot find module '../../src/domain/habitStats'`).

- [ ] **Step 3: 实现 `src/domain/habitStats.ts`**
  所有日期运算严格基于纯 `YYYY-MM-DD` UTC 整数日历算术（禁止混用本地时区夏令时偏移导致差一天）：
  - `daily`：`currentStreak` 在 `todayDone` 时从今天往回计，否则从昨天往回计；`bestStreak` 扫全量有序已打卡日期取最大连续段。
  - `weekly`：将全部 `done === true` 日期按 `getWeekStartDate(d, weekStartDay)` 分桶计数；判断桶计数 `>= weeklyTarget` 的达标周；`currentStreak` 若本周达标从本周起算，否则从上周起算；`bestStreak` 取历史最长连续达标周数。
  - `spanDays`：取 `min(首个 done 日期, habit.createdAt)` 到 `todayStr` 的含首尾自然日数（最小为 1）。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/habitStats.test.ts`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/domain/habitStats.ts siyuan-personal-home/tests/domain/habitStats.test.ts
  git commit -m "feat(domain): implement dual-dimension habit statistics and weekly streak logic"
  ```

---

### Task 3: 轻量任务逻辑与文档预览清洗

**Files:**
- Create: `siyuan-personal-home/src/domain/taskLogic.ts`
- Create: `siyuan-personal-home/src/domain/docPreview.ts`
- Test: `siyuan-personal-home/tests/domain/taskLogic.test.ts`
- Test: `siyuan-personal-home/tests/domain/docPreview.test.ts`

**Interfaces:**
- Consumes: `TaskItem`, `TaskCategory`, `TaskPriority` from `src/domain/types.ts`
- Produces:
  - `taskLogic.ts`:
    - `export function getActiveTasks(tasks: TaskItem[], categoryId?: string | 'all'): TaskItem[]`
    - `export function getCompletedTasks(tasks: TaskItem[], categoryId?: string | 'all'): TaskItem[]`
    - `export function sortTasksByPriority(tasks: TaskItem[]): TaskItem[]`（`high > medium > low`，同级 `createdAt` 降序）
    - `export function groupTasksByCategory(tasks: TaskItem[], categories: TaskCategory[]): Array<{ category: TaskCategory; tasks: TaskItem[] }>`
    - `export function cyclePriority(current: TaskPriority): TaskPriority`（`high → medium → low → high`）
    - `export function moveItemOrder<T extends { id: string; sortOrder: number; updatedAt: number }>(items: T[], id: string, direction: 'up' | 'down', now: number): T[]`
  - `docPreview.ts`:
    - `export function parseIalAttrs(ial: string | null | undefined): Record<string, string>`
    - `export function extractTitleImageUrl(ial: string | null | undefined): string | null`
    - `export function extractDocIcon(ial: string | null | undefined): { type: 'emoji' | 'image'; value: string } | null`
    - `export function cleanSnippetMarkdown(rawBlocks: string[], maxChars?: number): string`
    - `export function parseTags(tagField: string | null | undefined, maxCount?: number): string[]`
    - `export function formatRelativeTime(timestampMs: number, nowMs: number): string`

- [ ] **Step 1: 编写失败测试 `tests/domain/taskLogic.test.ts` 与 `tests/domain/docPreview.test.ts`**
  - `taskLogic.test.ts` 断言：过滤软删除任务、按高→中→低排序且同级新任务靠前、按维度分组忽略已删除维度（孤儿任务兜底归入首个有效维度）、`cyclePriority` 循环、`moveItemOrder` 上下移边界不动且更新 `updatedAt`。
  - `docPreview.test.ts` 断言（含 Review Focus #2）：
    - `extractTitleImageUrl` 从 `title-img="background-image:url(assets/cover-123.png)"` 提取 `assets/cover-123.png`，同时对 `linear-gradient(...)`、`background-color:#fff`、空/损坏 IAL 返回 `null`。
    - `extractDocIcon` 正确转换十六进制 Emoji（如 `1f4d6` → `📖`）及图片图标路径。
    - `cleanSnippetMarkdown` 剥离标题 `#`、加粗/链接/块引 `((id "文本"))`、代码块围栏与多余空白，对全空数组返回空字符串。
    - `parseTags` 解析 `#tag1# #tag2/sub#` 并最多返回 3 个。
    - `formatRelativeTime` 正确输出「刚刚」「N 分钟前」「N 小时前」「昨天 HH:mm」「MM-DD」。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/taskLogic.test.ts tests/domain/docPreview.test.ts`
  Expected: FAIL.

- [ ] **Step 3: 实现 `src/domain/taskLogic.ts` 与 `src/domain/docPreview.ts`**
  按上述签名实现纯函数逻辑；`parseIalAttrs` 支持 SiYuan `{: key="val" key2="val2"}` 与 HTML 实体还原（`&quot;` / `&amp;`）。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/taskLogic.test.ts tests/domain/docPreview.test.ts`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/domain/taskLogic.ts siyuan-personal-home/src/domain/docPreview.ts siyuan-personal-home/tests/domain/taskLogic.test.ts siyuan-personal-home/tests/domain/docPreview.test.ts
  git commit -m "feat(domain): add lightweight task logic and Notebook Navigator preview parsers"
  ```

---

### Task 4: 记录级同步合并与结构化存储服务

**Files:**
- Create: `siyuan-personal-home/src/domain/storeMerge.ts`
- Create: `siyuan-personal-home/src/services/storageService.ts`
- Test: `siyuan-personal-home/tests/domain/storeMerge.test.ts`
- Test: `siyuan-personal-home/tests/services/storageService.test.ts`

**Interfaces:**
- Consumes: `PluginSettings`, `TasksStore`, `HabitsStore`, `RecentReadsStore`, `BackupBundle`, `DEFAULT_SETTINGS`, `DEFAULT_TASK_CATEGORIES` from `src/domain/types.ts`
- Produces:
  - `storeMerge.ts`:
    - `export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000`
    - `export function mergeTasksStore(local: TasksStore, disk: TasksStore, nowMs: number): TasksStore`
    - `export function mergeHabitsStore(local: HabitsStore, disk: HabitsStore, nowMs: number): HabitsStore`
    - `export function mergeRecentReadsStore(local: RecentReadsStore, disk: RecentReadsStore, maxItems?: number): RecentReadsStore`
    - `export function validateBackupBundle(raw: unknown): BackupBundle`（格式非法时抛明确中文错误）
  - `storageService.ts`:
    - `export interface PluginDataAdapter { loadData(name: string): Promise<unknown>; saveData(name: string, data: unknown): Promise<void> }`
    - `export class StorageService`:
      - `loadSettings(): Promise<PluginSettings>` / `saveSettings(next: PluginSettings): Promise<PluginSettings>`
      - `loadTasks(): Promise<TasksStore>` / `updateTasks(updater: (curr: TasksStore) => TasksStore): Promise<TasksStore>`
      - `loadHabits(): Promise<HabitsStore>` / `updateHabits(updater: (curr: HabitsStore) => HabitsStore): Promise<HabitsStore>`
      - `loadRecentReads(): Promise<RecentReadsStore>` / `saveRecentRead(docId: string, nowMs?: number): Promise<RecentReadsStore>` / `pruneRecentReads(validIds: Set<string>): Promise<RecentReadsStore>`
      - `exportAllData(): Promise<BackupBundle>` / `importAllData(raw: unknown): Promise<void>`

- [ ] **Step 1: 编写失败测试（覆盖 Review Focus #3）**
  - `tests/domain/storeMerge.test.ts`：
    - 两端分别修改不同任务与不同日期的打卡记录，合并后全部保留、互不覆盖；
    - 同一任务/习惯/打卡按更大 `updatedAt` 胜出，较新的 `deleted: true` 不会被较旧快照复活；
    - 超过 30 天的 `deleted: true` 记录在合并时被 GC 清理；
    - `validateBackupBundle` 对缺字段、错误 `version`、非数组结构抛出校验错误。
  - `tests/services/storageService.test.ts`：
    - 使用内存 mock `PluginDataAdapter` 验证串行写队列（连续触发 5 次并发 `updateTasks` 不丢任何一条）；
    - 验证 read-before-write：模拟外部同步先更新了磁盘上的 `habits.json` 新增一条远端打卡，本端再打卡另一天时，落盘结果同时保留两天打卡；
    - 验证磁盘读到损坏字符串/非对象 JSON 时，`loadTasks`/`loadHabits` 不静默覆盖磁盘原文件（抛受控恢复错误或跳过覆盖）。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/storeMerge.test.ts tests/services/storageService.test.ts`
  Expected: FAIL.

- [ ] **Step 3: 实现 `src/domain/storeMerge.ts` 与 `src/services/storageService.ts`**
  - 四个物理文件：`settings.json`、`tasks.json`、`habits.json`、`recent-reads.json`。
  - 每个文件维护独立的 Promise 串行链 `writeQueues`，`updateTasks`/`updateHabits` 在队列内执行：`读取磁盘当前快照 → 与内存基线按记录级 LWW 合并 → 应用 updater → 落盘 → 更新基线`。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/domain/storeMerge.test.ts tests/services/storageService.test.ts`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/domain/storeMerge.ts siyuan-personal-home/src/services/storageService.ts siyuan-personal-home/tests/domain/storeMerge.test.ts siyuan-personal-home/tests/services/storageService.test.ts
  git commit -m "feat(storage): implement per-record LWW merge, serial write queue, and JSON backup"
  ```

---

### Task 5: 思源 API 适配层、笔记统计热力图与日记服务

**Files:**
- Create: `siyuan-personal-home/src/services/siyuanApi.ts`
- Create: `siyuan-personal-home/src/services/statsService.ts`
- Create: `siyuan-personal-home/src/services/dailyNoteService.ts`
- Test: `siyuan-personal-home/tests/services/statsAndDailyNote.test.ts`

**Interfaces:**
- Consumes: `OverviewStats`, `HeatmapDay`, `MonthCalendarDay`, `DocPreviewItem`, `WeekStartDay` from `src/domain/types.ts`; `extractTitleImageUrl`, `extractDocIcon`, `cleanSnippetMarkdown` from `src/domain/docPreview.ts`
- Produces:
  - `siyuanApi.ts`:
    - `export interface SiYuanNotebook { id: string; name: string; icon: string; closed: boolean }`
    - `export interface SiYuanClient`:
      - `sql<T = Record<string, unknown>>(stmt: string): Promise<T[]>`
      - `lsNotebooks(): Promise<SiYuanNotebook[]>`
      - `getNotebookConf(notebookId: string): Promise<{ dailyNoteSavePath: string; dailyNoteTemplatePath: string }>`
      - `createDailyNote(notebookId: string): Promise<{ id: string }>`
      - `renderSprig(template: string): Promise<string>`
      - `createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string>`
      - `renderTemplate(id: string, path: string): Promise<{ content: string }>`
      - `prependBlock(parentId: string, dom: string): Promise<void>`
      - `setBlockAttrs(id: string, attrs: Record<string, string>): Promise<void>`
      - `getLocalStorage(): Promise<Record<string, unknown>>`
      - `setLocalStorageVal(key: string, val: unknown): Promise<void>`
      - `searchDocs(keyword: string): Promise<Array<{ id: string; box: string; hpath: string; content: string }>>`
    - `export function escapeSqlString(val: string): string`
    - `export function createSiYuanClient(): SiYuanClient`（底层走 `fetchSyncPost`）
  - `statsService.ts`:
    - `export function fetchOverviewStats(api: SiYuanClient, activeDiaryNotebookId: string, todayStr: string): Promise<OverviewStats>`
    - `export function fetchYearHeatmap(api: SiYuanClient, year: number, activeDiaryNotebookId: string): Promise<{ days: HeatmapDay[]; totalBlocks: number; activeDays: number }>`
  - `dailyNoteService.ts`:
    - `export function resolveActiveDiaryNotebook(notebooks: SiYuanNotebook[], localDailyNoteId: string | undefined, savedNotebookId: string | undefined): string`
    - `export function fetchMonthCalendarDays(api: SiYuanClient, notebookId: string, year: number, month: number, includeTodoBadge: boolean): Promise<Record<string, MonthCalendarDay>>`
    - `export function fetchTodayDailyNote(api: SiYuanClient, notebookId: string, todayStr: string, notebookName: string): Promise<DocPreviewItem | null>`
    - `export function openOrCreateDailyNote(api: SiYuanClient, notebookId: string, dateStr: string, todayStr: string): Promise<string>`（返回文档 ID）

- [ ] **Step 1: 编写失败测试 `tests/services/statsAndDailyNote.test.ts`（覆盖 Review Focus #4）**
  - 测试 `escapeSqlString("a'b") === "a''b"`，并在 SQL 参数中正确转义单引号。
  - 测试 `resolveActiveDiaryNotebook` 优先级：`local-dailynoteid`（仅当未关闭）> `savedNotebookId`（仅当未关闭）> 首个未关闭笔记本 > 无打开笔记本时返回 `''`。
  - 测试 `fetchOverviewStats`：前 3 项（文档数、叶子块总字数/总块数、近 7 天活跃）聚合全工作区；「今年日记天数」仅过滤 `activeDiaryNotebookId`（为空时返回 0 而不发非法 SQL）。
  - 测试 `fetchYearHeatmap`：日记块按 `custom-dailynote-YYYYMMDD` 归入日记日期、普通块按 `created` 前 8 位归入、计算 0~4 五级强度等级。
  - 测试 `openOrCreateDailyNote`：
    - 当日已存在日记时直接返回已有 ID，不重复创建；
    - 当日为今天且无日记时调用 `createDailyNote`；
    - 当日为历史日期且无日记时调用 `getNotebookConf` → `renderSprig`（把 `now` 替换为指定日期 `toDate "2006-01-02" "YYYY-MM-DD"`）→ `createDocWithMd` → 写入 `custom-dailynote-YYYYMMDD` 属性，若配置了模板路径再调用 `renderTemplate` 注入正文。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/services/statsAndDailyNote.test.ts`
  Expected: FAIL.

- [ ] **Step 3: 实现 `siyuanApi.ts`、`statsService.ts` 与 `dailyNoteService.ts`**
  遵循 Spec 第 6.1、6.2 节的精确 SQL 口径与接口调用序列；注意 `dailyNoteSavePath` 中常见的 `now` 模板变量替换为指定日期的 Sprig 表达式（参考 `arco-calendar` 社区标准做法：`now` → `(toDate "2006-01-02" "YYYY-MM-DD")`）。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/services/statsAndDailyNote.test.ts`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/services/siyuanApi.ts siyuan-personal-home/src/services/statsService.ts siyuan-personal-home/src/services/dailyNoteService.ts siyuan-personal-home/tests/services/statsAndDailyNote.test.ts
  git commit -m "feat(services): implement SiYuan API adapter, stats/heatmap aggregation, and daily note service"
  ```

---

### Task 6: 最近改过 & 最近读过服务与预览批量拉取

**Files:**
- Create: `siyuan-personal-home/src/services/recentDocsService.ts`
- Test: `siyuan-personal-home/tests/services/recentDocsService.test.ts`

**Interfaces:**
- Consumes: `SiYuanClient`, `SiYuanNotebook` from `src/services/siyuanApi.ts`; `DocPreviewItem`, `RecentReadRecord` from `src/domain/types.ts`; `extractTitleImageUrl`, `extractDocIcon`, `cleanSnippetMarkdown`, `parseTags` from `src/domain/docPreview.ts`
- Produces:
  - `export interface RecentDocsQuery { notebookId?: string | 'all'; hideDailyNotes: boolean; keyword?: string; limit: number; offset: number }`
  - `export function fetchRecentModifiedDocs(api: SiYuanClient, notebooks: SiYuanNotebook[], query: RecentDocsQuery): Promise<{ items: DocPreviewItem[]; hasMore: boolean }>`
  - `export function fetchRecentReadDocs(api: SiYuanClient, notebooks: SiYuanNotebook[], records: RecentReadRecord[], query: RecentDocsQuery, onDeadIds?: (validIds: Set<string>) => void): Promise<{ items: DocPreviewItem[]; hasMore: boolean }>`
  - `export class RecentReadTracker`：
    - `constructor(onRecord: (docId: string) => void | Promise<void>, dwellMs = 1500)`
    - `onSwitchDoc(docId: string | null | undefined): void`
    - `dispose(): void`

- [ ] **Step 1: 编写失败测试 `tests/services/recentDocsService.test.ts`（覆盖 Review Focus #2 & #5）**
  - 测试 `RecentReadTracker`（使用 Vitest fake timers）：
    - 在 1500ms 内连续切 `doc-1 → doc-2 → doc-3`，只有最后停留满 1500ms 的 `doc-3` 触发 `onRecord`；
    - 切到空 ID 或调用 `dispose()` 后定时器被清除，绝不再触发回调。
  - 测试 `fetchRecentModifiedDocs`：按 `updated DESC` 返回文档，正确批量补全正文摘要与缩略图（优先 `title-img`，无题头图时回退到 `assets` 表中该文档首张 `.png/.jpg/.jpeg/.webp/.gif/.avif`）；开启 `hideDailyNotes: true` 时排除带 `custom-dailynote-%` 属性的文档。
  - 测试 `fetchRecentReadDocs`：保持 `records` 按 `lastReadAt DESC` 顺序；若其中 1 篇已在思源中删除，结果自动剔除死链并触发 `onDeadIds` 回调通知清理；正文为空的文档返回空摘要且不崩溃。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/services/recentDocsService.test.ts`
  Expected: FAIL.

- [ ] **Step 3: 实现 `src/services/recentDocsService.ts`**
  用单次 `IN (...)` 批量 SQL 拉取目标文档列表的前置非空文本块（用于摘要）和 `assets` 图片记录（用于无题头图回退缩略图），避免 N+1 查询拖慢主页。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/services/recentDocsService.test.ts`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/services/recentDocsService.ts siyuan-personal-home/tests/services/recentDocsService.test.ts
  git commit -m "feat(services): implement recent modified/read document service with dwell debouncing"
  ```

---

### Task 7: 左侧内容区组件（统计热力图、今日日记预览卡、最近读写卡片流）

**Files:**
- Create: `siyuan-personal-home/src/components/StatsHeatmapCard.tsx`
- Create: `siyuan-personal-home/src/components/TodayDailyNoteCard.tsx`
- Create: `siyuan-personal-home/src/components/RecentDocsCard.tsx`
- Test: `siyuan-personal-home/tests/components/contentCards.test.tsx`

**Interfaces:**
- Consumes: `OverviewStats`, `HeatmapDay`, `DocPreviewItem`, `WeekStartDay` from `src/domain/types.ts`; `SiYuanNotebook` from `src/services/siyuanApi.ts`
- Produces:
  - `StatsHeatmapCard({ stats, heatmap, year, showHeatmap, weekStartDay, onChangeYear, onToggleHeatmap, onClickDate })`
  - `TodayDailyNoteCard({ todayStr, dailyNote, loading, onOpenDoc, onCreateToday })`
  - `RecentDocsCard({ activeTab, onChangeTab, items, hasMore, loading, hideDailyNotes, onToggleHideDailyNotes, notebookId, notebooks, onChangeNotebook, keyword, onChangeKeyword, onLoadMore, onOpenDoc })`

- [ ] **Step 1: 编写失败组件测试 `tests/components/contentCards.test.tsx`**
  - `StatsHeatmapCard`：渲染 4 张统计数字（文档总数、总字数、近 7 天更新、今年日记天数），点击折叠按钮触发 `onToggleHeatmap`，点击年份切换触发 `onChangeYear`，点击热力图日期格触发 `onClickDate(dateStr)`。
  - `TodayDailyNoteCard`：有今日日记时展示标题、摘要、缩略图并点击触发 `onOpenDoc(id)`；无今日日记时展示空态并点击「写今天的日记」触发 `onCreateToday()`。
  - `RecentDocsCard`：点击「最近读过」切换 Tab、当最近读过为空时展示冷启动引导文案、渲染缩略图与最多 3 个标签 chip（无图文档不渲染 `<img>`）、点击卡片触发 `onOpenDoc(id)`、点击「加载更多」触发 `onLoadMore()`。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/components/contentCards.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: 实现三个内容区组件**
  严格按 Spec 第 5.2、6.1、6.2、6.3 节实现：
  - `RecentDocsCard` 遵循 `Notebook Navigator` 现代卡片视觉：标题 + 图标、2~3 行截断摘要、右侧圆角缩略图（无图自动铺满文字）、底部笔记本名 + 标签 chips + 相对时间，全部采用 `--sph-*` 思源主题变量。
  - 热力图用 5 级主题色阶格子，悬停 `title`/tooltip 显示日期与内容块数。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/components/contentCards.test.tsx`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/components/StatsHeatmapCard.tsx siyuan-personal-home/src/components/TodayDailyNoteCard.tsx siyuan-personal-home/src/components/RecentDocsCard.tsx siyuan-personal-home/tests/components/contentCards.test.tsx
  git commit -m "feat(ui): build stats heatmap, today daily note card, and Notebook Navigator recent cards"
  ```

---

### Task 8: 右侧行动区组件（日记月历、习惯打卡与详览弹窗、轻量任务与关联笔记弹窗）

**Files:**
- Create: `siyuan-personal-home/src/components/MiniCalendarCard.tsx`
- Create: `siyuan-personal-home/src/components/HabitCard.tsx`
- Create: `siyuan-personal-home/src/components/HabitDetailModal.tsx`
- Create: `siyuan-personal-home/src/components/TaskCard.tsx`
- Create: `siyuan-personal-home/src/components/DocPickerModal.tsx`
- Test: `siyuan-personal-home/tests/components/actionCards.test.tsx`

**Interfaces:**
- Consumes: `MonthCalendarDay`, `HabitItem`, `HabitCheckin`, `TaskItem`, `TaskCategory`, `TaskPriority`, `WeekStartDay` from `src/domain/types.ts`; `computeHabitStats`, `formatDurationMinutes` from `src/domain/habitStats.ts`; `getActiveTasks`, `getCompletedTasks`, `sortTasksByPriority`, `groupTasksByCategory`, `cyclePriority` from `src/domain/taskLogic.ts`; `SiYuanNotebook` from `src/services/siyuanApi.ts`
- Produces:
  - `MiniCalendarCard({ year, month, todayStr, weekStartDay, showTodoBadge, daysMap, notebooks, activeNotebookId, onChangeMonth, onSelectNotebook, onClickDate, onJumpToday })`
  - `HabitCard({ habits, checkins, todayStr, weekStartDay, onToggleToday, onUpdateTodayDuration, onOpenDetail, onCreateHabit })`
  - `HabitDetailModal({ habit, checkins, todayStr, weekStartDay, isFirst, isLast, onClose, onToggleDate, onUpdateHabit, onMoveOrder, onArchive, onDelete, onPickDoc, onOpenDoc })`
  - `TaskCard({ tasks, categories, onCreateTask, onToggleComplete, onUpdateTask, onDeleteTask, onClearCompleted, onSaveCategories, onPickDoc, onOpenDoc })`
  - `DocPickerModal({ open, onClose, onSearch, onSelect })`

- [ ] **Step 1: 编写失败组件测试 `tests/components/actionCards.test.tsx`**
  - `MiniCalendarCard`：标记已有日记圆底、今日圆点、含未完成任务琥珀角标；切换日记本触发 `onSelectNotebook`；点击日期触发 `onClickDate('YYYY-MM-DD')`。
  - `HabitCard` & `HabitDetailModal`：
    - 点击一键勾选框触发 `onToggleToday`；
    - 对开启 `trackDuration` 的已打卡习惯，点击时长胶囊可原地修改分钟数并触发 `onUpdateTodayDuration`；
    - 验证 `daily` 显示「连续 X 天」、`weekly` 显示「连续 X 周」及 7 个自然周圆点状态；
    - 打开详情弹窗点击历史日期可补卡/取消打卡，点击上移/下移触发 `onMoveOrder`。
  - `TaskCard`：
    - 顶部输入框输入标题按 Enter 触发 `onCreateTask`（不出现任何日期选择控件）；
    - 切换「按轻重缓急 / 按维度分组」双视图；
    - 点击复选框完成任务，已完成的收入折叠区「已完成 (N)」；
    - 点击优先级圆点循环切换 高/中/低；点击关联文档图标可跳转 `onOpenDoc`。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/components/actionCards.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: 实现 5 个右侧行动区组件与弹窗**
  严格遵循 Spec 第 6.2、6.4、6.5 节交互细节：
  - `HabitCard` 支持一键新建习惯弹窗/表单（名称、Emoji、频率 daily/weekly 与每周目标、是否记录耗时与默认分钟数、可选关联笔记）。
  - `TaskCard` 内置轻量「管理维度」弹窗（新增、重命名、选色、上移/下移 `sortOrder`、删除）。
  - `DocPickerModal` 复用 `api.searchDocs(keyword)` 提供即时搜索选择思源文档。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/components/actionCards.test.tsx`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/components/MiniCalendarCard.tsx siyuan-personal-home/src/components/HabitCard.tsx siyuan-personal-home/src/components/HabitDetailModal.tsx siyuan-personal-home/src/components/TaskCard.tsx siyuan-personal-home/src/components/DocPickerModal.tsx siyuan-personal-home/tests/components/actionCards.test.tsx
  git commit -m "feat(ui): build mini calendar, dual-dimension habit tracker, and lightweight task manager"
  ```

---

### Task 9: 设置弹窗与单页 Bento 主页容器

**Files:**
- Create: `siyuan-personal-home/src/components/SettingsModal.tsx`
- Create: `siyuan-personal-home/src/pages/HomePage.tsx`
- Test: `siyuan-personal-home/tests/components/homePage.test.tsx`

**Interfaces:**
- Consumes: `StorageService`, `SiYuanClient`, `statsService`, `dailyNoteService`, `recentDocsService`, 所有 Task 7/8 组件
- Produces:
  - `SettingsModal({ open, settings, onClose, onChangeSettings, onExportJson, onImportJson })`
  - `HomePage({ api, storage, openDoc, subscribeSyncRefresh })`（支持外部触发 `sync-end` 热重载）

- [ ] **Step 1: 编写失败集成测试 `tests/components/homePage.test.tsx`**
  - 渲染完整 `HomePage`（注入 mock `SiYuanClient` 与内存 `StorageService`）：
    - 验证初始加载展示统计数字、热力图、今日日记、最近改过、月历、习惯与任务；
    - 验证在 `MiniCalendarCard` 切换日记本后，同步调用 `api.setLocalStorageVal('local-dailynoteid', ...)` 并重新拉取 `TodayDailyNoteCard` 和「今年日记天数」；
    - 验证在主页新建任务并打卡习惯后数据落盘，且收到 `subscribeSyncRefresh` 回调时重新从 `StorageService` 加载最新数据；
    - 验证打开 `SettingsModal` 可切换设置并导出/导入 JSON 备份。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/components/homePage.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: 实现 `SettingsModal.tsx` 与 `HomePage.tsx`**
  - `HomePage.tsx` 仅作布局编排与共享状态（`activeDiaryNotebookId`、`settings`、`tasksStore`、`habitsStore`）协调器，严格按 Spec 第 5.2 节 Bento Grid 排布，保持每个子卡片零耦合。
  - 顶部栏显示当前日期与星期、手动「刷新」按钮与「设置」按钮。

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm --dir siyuan-personal-home test tests/components/homePage.test.tsx`
  Expected: ALL PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/components/SettingsModal.tsx siyuan-personal-home/src/pages/HomePage.tsx siyuan-personal-home/tests/components/homePage.test.tsx
  git commit -m "feat(app): assemble single-page Bento HomePage container and settings modal"
  ```

---

### Task 10: 思源插件主入口、生命周期与本地打包安装验证

**Files:**
- Modify: `siyuan-personal-home/src/index.ts`
- Test: `siyuan-personal-home/tests/components/pluginLifecycle.test.ts`

**Interfaces:**
- Consumes: `HomePage`, `StorageService`, `createSiYuanClient`, `RecentReadTracker`
- Produces: `export default class PersonalHomePlugin extends Plugin`

- [ ] **Step 1: 编写失败生命周期测试 `tests/components/pluginLifecycle.test.ts`（覆盖 Review Focus #5）**
  - Mock `siyuan` 的 `Plugin`、`openTab`、`getAllEditor` 等最小接口，验证：
    - `onload()` 注册 1 个顶栏按钮、1 个快捷键命令 `Alt+Shift+H`、1 个 Custom Tab `sph-home-tab`，且**不调用** `addDock`；
    - 连续调用两次打开个人主页时，若已存在 `sph-home-tab` 实例则直接激活已有标签而不重复 `openTab`；
    - `onLayoutReady()` 当 `settings.autoOpenOnStart === true` 且尚无主页标签时自动打开主页；为 `false` 时不打开；
    - 触发 `switch-protyle` 事件经 1500ms 后调用 `storage.saveRecentRead(rootID)`；
    - 触发 `sync-end` 事件通知主页热重载；
    - `onunload()` 注销 `switch-protyle` 与 `sync-end` 监听器、销毁 `RecentReadTracker` 定时器并卸载已挂载的 React Root。

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm --dir siyuan-personal-home test tests/components/pluginLifecycle.test.ts`
  Expected: FAIL.

- [ ] **Step 3: 完善 `src/index.ts`**
  实现完整的 `PersonalHomePlugin`：
  - 使用 SVG 图标注册顶栏按钮（支持按 `settings.topBarPosition` 放置左侧/右侧）；
  - `openHomeTab()` 实现单实例查找与激活逻辑；
  - `addTab({ type: 'sph-home-tab', init() { ... }, destroy() { ... } })` 挂载与卸载 React 19 `createRoot`；
  - 完整接入 `RecentReadTracker`、`sync-end` 订阅总线及 `onunload` 清理。

- [ ] **Step 4: 全量测试、类型检查、生产构建与产物验收**
  Run:
  ```powershell
  pnpm --dir siyuan-personal-home type-check
  pnpm --dir siyuan-personal-home test
  pnpm --dir siyuan-personal-home build
  ```
  Expected:
  - `tsc --noEmit` 0 errors；
  - Vitest 全部测试文件 PASS；
  - `dist/index.js`、`dist/index.css`、`dist/plugin.json`、`dist/icon.png`、`dist/i18n/zh_CN.json` 与 `package.zip` 全部产出；
  - 确认 `dist/index.js` 中包含 `require("siyuan")` 外部引用且未误将 `siyuan` 打包进去。

- [ ] **Step 5: Commit**
  ```bash
  git add siyuan-personal-home/src/index.ts siyuan-personal-home/tests/components/pluginLifecycle.test.ts
  git commit -m "feat(plugin): wire SiYuan plugin entry, lifecycle cleanup, and production build"
  ```

---

## Self-Review Notes

- **Spec 覆盖**：统计 4 卡 + 年度热力图（Task 5/7）、日记月历 + 今日日记预览卡 + `activeDiaryNotebookId` 联动（Task 5/7/8/9）、Notebook Navigator 风格最近改过/读过 + 1.5s 防抖（Task 3/6/7）、双维度习惯打卡 + 7 自然周圆点 + 补卡详览弹窗（Task 2/8）、无时间节点轻量任务 + 维度管理 + 笔记关联（Task 3/8）、记录级 LWW 同步合并 + JSON 导入导出（Task 4/9）、零侧边栏单实例插件入口 + 打包安装脚本（Task 1/10）全部一一对应。
- **Review Focus 覆盖**：5 类隐含失败模式全部映射到具体任务与测试用例，无悬空项。
- **类型一致性**：所有 Task 间共享类型统一声明于 `src/domain/types.ts`，函数名与返回契约前后完全对齐。
