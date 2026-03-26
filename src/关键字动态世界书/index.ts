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
  // 命中 keyword 时，把对应条目切到哪种灯
  hitType?: 'constant' | 'selective';
  // 未命中（或已连续 misses>=3）时，把对应条目切到哪种灯
  missType?: 'constant' | 'selective';
};

const RULES: KeywordWorldbookRule[] = [
  // 关键词命中：聊天里出现“蒂薇儿”
  // 灯的切换对象：世界书「条目名称包含」“蒂薇儿设定”
  { keywords: ['蒂薇儿'], entryNameIncludes: '蒂薇儿设定', hitType: 'constant', missType: 'selective' },
  // 关键词命中：聊天里出现“午夜玫瑰”
  // 灯的切换对象：世界书「条目名称包含」“午夜玫瑰委托”
  // 你要求：检测到“午夜玫瑰”后，此条目变为绿色（selective）
  { keywords: ['午夜玫瑰'], entryNameIncludes: '午夜玫瑰委托', hitType: 'selective', missType: 'constant' },
  // 复制上一行改字即可，例如再来一个角色：
  // { keywords: ['艾莉', 'Ellie'], entryNameIncludes: '艾莉' },
];

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastWorldbookWarn: string | null = null;

// 连续三次 AI 回复都没有再提到关键词：强制把灯切回 selective（绿灯）
// 按每个 RULE 分开统计，便于你后续扩展多角色/多条目。
let missingCountByRule: number[] = RULES.map(() => 0);
let lastHandledReceivedMessageId: string | number | null = null;

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

/** 取“最近一次收到的 AI 回复”的纯文本（尽量去掉代码块，减轻误判） */
function getLastReceivedText(): string {
  try {
    const lastId = getLastMessageId();
    if (lastId < 0) return '';
    const all = getChatMessages(`0-${lastId}`);
    const lastMsg = all[all.length - 1];
    let t = lastMsg?.message ?? '';
    t = t.replace(/```[\s\S]*?```/g, ' ');
    t = t.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi, ' ');
    return String(t || '').trim();
  } catch (e) {
    console.warn('[关键字世界书] getLastReceivedText failed', e);
    return '';
  }
}

/** 更新每条 RULE 的“连续未命中计数”（只统计 AI 回复：MESSAGE_RECEIVED） */
function updateMissingCountsByLastReceived(): void {
  try {
    const lastId = getLastMessageId();
    if (lastId === lastHandledReceivedMessageId) return; // 防止重复触发同一条回复
    lastHandledReceivedMessageId = lastId;

    const lastText = getLastReceivedText();
    RULES.forEach((rule, idx) => {
      const hit = keywordHitInTexts([lastText], rule.keywords);
      if (hit) missingCountByRule[idx] = 0;
      else missingCountByRule[idx] += 1;
    });
  } catch (e) {
    console.warn('[关键字世界书] updateMissingCountsByLastReceived failed', e);
  }
}

function getNextStrategyTypeForEntry(entryName: string, texts: string[]): WorldbookEntry['strategy']['type'] | null {
  // 一个 entryName 只会匹配一个 entryNameIncludes（按你的命名习惯）
  const matchedRuleIdx = RULES.findIndex(r => r.entryNameIncludes && entryName.includes(r.entryNameIncludes));
  if (matchedRuleIdx < 0) return null;
  const rule = RULES[matchedRuleIdx];

  const hit = keywordHitInTexts(texts, rule.keywords);
  const tooManyMisses = (missingCountByRule[matchedRuleIdx] ?? 0) >= 3;

  // 命中：切到 hitType（例如 selective=绿色）
  if (hit && !tooManyMisses) {
    return (rule.hitType ?? 'constant') as WorldbookEntry['strategy']['type'];
  }
  // 未命中 / misses>=3：切到 missType
  return (rule.missType ?? 'selective') as WorldbookEntry['strategy']['type'];
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
      const nextType = getNextStrategyTypeForEntry(name, texts);
      if (!nextType) continue;
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
      updateMissingCountsByLastReceived();
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
