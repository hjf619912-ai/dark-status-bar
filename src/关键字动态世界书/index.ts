/**
 * 关键字动态世界书：在近期聊天里出现指定词时，把「名称匹配的」世界书条目改为蓝灯 (constant)，
 * 否则恢复绿灯 (selective)。逻辑与「踏月寻仙」范例一致，但配置极简。
 *
 * 使用步骤见同目录 README.md
 */

/* ============================================================================
 * 【小白只改这里】以后加关键字 / 新角色：只改下面的 RULES，保存后执行 pnpm build，
 * 再把 dist/关键字动态世界书/index.js 复制进酒馆助手脚本。
 *
 * - keywords：聊天里出现其中任意一个词（子串匹配）就算命中
 * - entryNameIncludes：世界书「条目名称」里必须包含这段字，该条目才会被蓝/绿灯切换
 * ============================================================================ */

/** 扫描最近多少条消息（含用户与 AI） */
const SCAN_LAST_MESSAGES = 24;

/** 防抖，避免连续事件狂刷世界书 */
const DEBOUNCE_MS = 450;

/** 控制台详细日志 */
const DEBUG = false;

/**
 * 规则：任一 keyword 在近期消息中出现 → 所有「条目名包含 entryNameIncludes」的已启用条目改为 constant；
 * 否则改为 selective（不改变 enabled、不改变 keys）。
 */
type KeywordWorldbookRule = {
  keywords: string[];
  entryNameIncludes: string;
};

const RULES: KeywordWorldbookRule[] = [
  { keywords: ['蒂薇儿'], entryNameIncludes: '蒂薇儿' },
  // 复制上一行改字即可，例如再来一个角色：
  // { keywords: ['艾莉', 'Ellie'], entryNameIncludes: '艾莉' },
];

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastWorldbookWarn: string | null = null;

function kwLog(...args: unknown[]): void {
  if (!DEBUG) return;
  console.info('[关键字世界书]', ...args);
}

/** 当前角色绑定的主世界书；未绑定则返回 null */
function resolvePrimaryWorldbookName(): string | null {
  try {
    const { primary } = getCharWorldbookNames('current');
    const n = primary?.trim();
    return n ? n : null;
  } catch (e) {
    console.warn('[关键字世界书] getCharWorldbookNames 失败', e);
    return null;
  }
}

/** 取近期纯文本（去掉代码块，减轻误匹配） */
function getRecentMessageTexts(maxMessages: number): string[] {
  try {
    const last = getLastMessageId();
    if (last < 0) return [];
    const all = getChatMessages(`0-${last}`);
    const slice = all.slice(Math.max(0, all.length - maxMessages));
    return slice
      .map(m => {
        let t = m.message ?? '';
        t = t.replace(/```[\s\S]*?```/g, ' ');
        t = t.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, ' ');
        return t;
      })
      .map(t => t.trim())
      .filter(Boolean);
  } catch (e) {
    console.warn('[关键字世界书] 获取消息失败', e);
    return [];
  }
}

function keywordHitInTexts(texts: string[], keywords: string[]): boolean {
  for (const kw of keywords) {
    const k = kw.trim();
    if (!k) continue;
    for (const t of texts) {
      if (t.includes(k)) return true;
    }
  }
  return false;
}

/** 该条目是否应强制 constant（任一匹配规则的关键词命中） */
function shouldForceConstant(entryName: string, texts: string[]): boolean {
  for (const rule of RULES) {
    if (!rule.entryNameIncludes) continue;
    if (!entryName.includes(rule.entryNameIncludes)) continue;
    if (keywordHitInTexts(texts, rule.keywords)) return true;
  }
  return false;
}

/** 该条目是否受本脚本管理（名称命中任一规则的 entryNameIncludes） */
function isManagedEntry(entryName: string): boolean {
  return RULES.some(r => r.entryNameIncludes && entryName.includes(r.entryNameIncludes));
}

async function syncWorldbookByKeywords(): Promise<void> {
  const wbName = resolvePrimaryWorldbookName();
  if (!wbName) {
    if (lastWorldbookWarn !== 'no_primary') {
      lastWorldbookWarn = 'no_primary';
      console.warn('[关键字世界书] 当前角色未绑定主世界书，已跳过。请在角色卡中绑定世界书。');
    }
    return;
  }
  lastWorldbookWarn = null;

  const texts = getRecentMessageTexts(SCAN_LAST_MESSAGES);
  kwLog('主世界书:', wbName, '近期消息数:', texts.length);

  await updateWorldbookWith(wbName, entries => {
    let changed = 0;
    for (const e of entries) {
      if (!e.enabled) continue;
      const name = e.name ?? '';
      if (!isManagedEntry(name)) continue;

      const wantConstant = shouldForceConstant(name, texts);
      const nextType: WorldbookEntry['strategy']['type'] = wantConstant ? 'constant' : 'selective';
      if (e.strategy.type === nextType) continue;

      /** 向量化条目勿动 */
      if (e.strategy.type === 'vectorized') continue;

      e.strategy = { ...e.strategy, type: nextType };
      changed++;
      kwLog(`条目「${name}」→ ${nextType} (${wantConstant ? '命中关键字' : '未命中'})`);
    }
    if (DEBUG && changed === 0) kwLog('无需变更');
    return entries;
  });
}

function scheduleSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void errorCatched(syncWorldbookByKeywords)();
  }, DEBOUNCE_MS);
}

$(() => {
  errorCatched(() => {
    console.info('[关键字世界书] 已加载；规则数:', RULES.length);
    void syncWorldbookByKeywords();

    eventOn(tavern_events.MESSAGE_SENT, () => {
      kwLog('MESSAGE_SENT → 调度同步');
      scheduleSync();
    });
    eventOn(tavern_events.MESSAGE_RECEIVED, () => {
      kwLog('MESSAGE_RECEIVED → 调度同步');
      scheduleSync();
    });
    eventOn(tavern_events.CHARACTER_PAGE_LOADED, () => {
      kwLog('CHARACTER_PAGE_LOADED → 调度同步');
      scheduleSync();
    });
    eventOn(tavern_events.CHAT_CHANGED, () => {
      kwLog('CHAT_CHANGED → 调度同步');
      scheduleSync();
    });

    $(window).on('pagehide', () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    });
  })();
});
