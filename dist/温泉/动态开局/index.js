/******/ // The require scope
/******/ var __webpack_require__ = {};
/******/ 
/************************************************************************/
/******/ /* webpack/runtime/define property getters */
/******/ (() => {
/******/ 	// define getter functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ })();
/******/ 
/******/ /* webpack/runtime/hasOwnProperty shorthand */
/******/ (() => {
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ })();
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

;// ./src/温泉/动态开局/presets/开局一.ts
/** 开局一：极乐庄 · 温泉入口 — 写入聊天变量的根级字段 */
/* harmony default export */ const _ = ({
    主角: {
        位置: '极乐庄·温泉入口',
        体力: 100,
        风险: 4,
        肉棒: '',
        心境: '平静，带着些许好奇',
        近况: '刚进入温泉区，正在观察周围环境。',
    },
    焦点旅客: {
        姓名: '',
        年龄: null,
        职业: '',
        关系: '',
        生理: '',
        身材: '',
        三围: '',
        性格: '',
        倾向: '',
        面具: null,
        渴求: null,
        下体: '',
        OS片段: '',
        近况: '',
        位置: '',
    },
    旅客B: {
        姓名: '',
        性格: '',
        身材: '',
        年龄: null,
        近况: '',
        位置: '',
        内心OS: '',
    },
    旅客C: {
        姓名: '',
        性格: '',
        身材: '',
        年龄: null,
        近况: '',
        位置: '',
        内心OS: '',
    },
    环境: {
        冴子轨迹: '',
        环境预告: '',
        Risk: '3%',
        周边视线: [],
        冴子处理: [],
        状态: '',
    },
    建议行动: [
        { 图标: '🔧', 文本: '进去更衣区更换好衣服，不动声色，貌似无害', 强调: false },
        { 图标: '🔞', 文本: '在更衣区角落视奸，暗中观察可能的目标', 强调: true },
        { 图标: '🥛', 文本: '先去拿瓶牛奶', 强调: false },
        { 图标: '🚶', 文本: '移动到冲洗区，借助冲洗，仔细观察女性的肉体', 强调: false },
    ],
});

;// ./src/温泉/动态开局/presets/开局二.ts
/** 开局二：去往温泉的大巴 — 写入聊天变量的根级字段 */
/* harmony default export */ const presets_ = ({
    主角: {
        位置: '去往温泉的大巴上',
        体力: 100,
        风险: 4,
        肉棒: '',
        心境: '平静，带着些许好奇',
        近况: '坐在车上，维持对外的温和形象',
    },
    焦点旅客: {
        姓名: '',
        年龄: null,
        职业: '',
        关系: '',
        生理: '',
        身材: '',
        三围: '',
        性格: '',
        倾向: '',
        面具: null,
        渴求: null,
        下体: '',
        OS片段: '',
        近况: '',
        位置: '',
    },
    旅客B: {
        姓名: '',
        性格: '',
        身材: '',
        年龄: null,
        近况: '',
        位置: '',
        内心OS: '',
    },
    旅客C: {
        姓名: '',
        性格: '',
        身材: '',
        年龄: null,
        近况: '',
        位置: '',
        内心OS: '',
    },
    环境: {
        冴子轨迹: '',
        环境预告: '',
        Risk: '3%',
        周边视线: [],
        冴子处理: [],
        状态: '',
    },
    建议行动: [
        { 图标: '🔧', 文本: '和四周的女性攀谈，保持着朴实的对外形象', 强调: false },
        { 图标: '🔞', 文本: '暗中观察周围女性，确认谁最容易成为猎物', 强调: true },
        { 图标: '🥛', 文本: '喝水假寐，维持住状态', 强调: false },
        { 图标: '🚶', 文本: '询问周围女性一会儿是否需要帮忙拿行李，创造下车时侯攀谈的契机', 强调: false },
    ],
});

;// ./src/温泉/动态开局/index.ts
/**
 * 温泉 · 开局变量（云维护版 · MVU stat_data）
 *
 * 远程拉取开局 JSON 后，合并到 **`stat_data`**（键名可由 manifest `stat_data键名` 改）。
 * 若已安装 **MVU**，使用 `Mvu.replaceMvuData` 写入，并同时更新：
 * - `type: 'chat'`（聊天级 MVU 表）
 * - `type: 'message', message_id: 'latest'`（**界面/状态栏通常读这一层**）
 * 无 MVU 时回退为 `replaceVariables` 仅写聊天变量表。
 *
 * ## 按「第一条消息 / 额外问候语」自动开局（无需按按钮）
 * - 默认 **`问候语自动开局`: true**（manifest 可改 false 恢复「仅空聊天 + 默认选用开局」）
 * - 监听 `CHARACTER_FIRST_MESSAGE_SELECTED`、以及 `MESSAGE_RECEIVED` 且 `type === 'first_message'`
 * - **文内标记**（可写在问候语任意处，建议置顶一行）：`[温泉开局:开局一]`、`[温泉开局:开局二]` 或 HTML 注释 `<!--温泉开局:开局一-->`
 * - **索引匹配**：将当前选中的问候语文本与角色卡 `first_messages[i]` 比对；默认 `0 → 开局一`、`1 → 开局二`（对应「第一条消息」与「额外问候语#1」），可用 manifest `问候语索引映射` 改
 * - **顶三行 + 稳定防抖**：`#chat` MutationObserver 与渲染事件会反复调度；**约 450ms 内顶三行不变**才读第 0 楼并写入。**顶三行签名变了**（换问候语/开局二）会再次写入，不再按 chatId 只写一次锁死。
 * - **层数上限**：当前聊天 **`getLastMessageId()` 大于 1**（即已有 **超过 2 层** 消息）时，**不再**做首楼正文/顶三行检测，也 **不再**自动写入开局（避免每次打开长对话仍跑逻辑）。**脚本按钮「开局·写入一/二」** 仍可直接调用 `applyWarmSpringOpeningVars`，不受此限。
 */


const CONFIG_KEY = '温泉开局变量';
/** 与仓库 `assets/warm-spring-openings/manifest.json` 同步 */
const BUILTIN_MANIFEST_URL = 'https://cdn.jsdelivr.net/gh/hjf619912-ai/dark-status-bar@feature/warm-spring-ui/assets/warm-spring-openings/manifest.json';
const PRESETS = {
    开局一: structuredClone(_),
    开局二: structuredClone(presets_),
};
function parseKeywordMap(raw) {
    const out = {};
    if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) {
            if (typeof v === 'string' && v.trim()) {
                out[String(k).trim()] = v.trim();
            }
        }
    }
    return out;
}
/** 解析 `{ "0": "开局一", "1": "开局二" }` */
function parseIndexOpeningMap(raw) {
    const o = {};
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw))
        return o;
    for (const [k, v] of Object.entries(raw)) {
        const idx = Number(String(k).trim());
        if (!Number.isFinite(idx) || idx < 0)
            continue;
        if (typeof v === 'string' && v.trim())
            o[idx] = v.trim();
    }
    return o;
}
function mergeIndexOpeningMap(char, script, manifest) {
    const def = { 0: '开局一', 1: '开局二' };
    return {
        ...def,
        ...parseIndexOpeningMap(manifest.问候语索引映射),
        ...script.问候语索引映射,
        ...parseIndexOpeningMap(char.问候语索引映射),
    };
}
function resolveGreetingAuto(char, script, manifest) {
    if (typeof char.问候语自动开局 === 'boolean')
        return char.问候语自动开局;
    if (typeof script.问候语自动开局 === 'boolean')
        return script.问候语自动开局;
    if (typeof manifest.问候语自动开局 === 'boolean')
        return manifest.问候语自动开局;
    return true;
}
function readScriptCfg() {
    const raw = getVariables({ type: 'script' });
    const u1 = raw['开局一链接'];
    const u2 = raw['开局二链接'];
    const base = raw['远程预设基础URL'];
    const manifestUrl = raw['远程配置链接'];
    const pickOpening = raw['选用开局'];
    let 自动初始化;
    const a = raw['自动初始化'];
    if (a === false || a === true)
        自动初始化 = a;
    const sdk = raw['stat_data键名'];
    let 问候语自动开局;
    const ga = raw['问候语自动开局'];
    if (ga === false || ga === true)
        问候语自动开局 = ga;
    return {
        开局一链接: typeof u1 === 'string' ? u1 : '',
        开局二链接: typeof u2 === 'string' ? u2 : '',
        开局关键字映射: parseKeywordMap(raw['开局关键字映射']),
        远程预设基础URL: typeof base === 'string' ? base : '',
        远程配置链接: typeof manifestUrl === 'string' ? manifestUrl : '',
        选用开局: typeof pickOpening === 'string' ? pickOpening : '',
        自动初始化,
        stat_data键名: typeof sdk === 'string' ? sdk : '',
        问候语自动开局,
        问候语索引映射: parseIndexOpeningMap(raw['问候语索引映射']),
    };
}
function readOpeningConfig() {
    try {
        const v = getVariables({ type: 'character' });
        const raw = v[CONFIG_KEY];
        if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
            return raw;
        }
    }
    catch {
        /* 未选角色卡等 */
    }
    return {};
}
async function fetchManifest() {
    const scriptUrl = readScriptCfg().远程配置链接.trim();
    const url = scriptUrl || BUILTIN_MANIFEST_URL;
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('manifest 须为 JSON 对象');
        }
        return data;
    }
    catch (e) {
        console.warn('[温泉开局变量] manifest 拉取失败，将仅用脚本/角色卡覆盖项（若有）', e);
        return {};
    }
}
function resolveStatDataKey(char, script, manifest) {
    const k = (char.stat_data键名 ?? '').trim() ||
        script.stat_data键名.trim() ||
        (manifest.stat_data键名 ?? '').trim() ||
        'stat_data';
    return k || 'stat_data';
}
async function buildMerged() {
    const manifest = await fetchManifest();
    const script = readScriptCfg();
    const char = readOpeningConfig();
    const keywordMap = {
        ...parseKeywordMap(manifest.开局关键字映射),
        ...script.开局关键字映射,
        ...parseKeywordMap(char.开局关键字映射),
    };
    const chosen = (char.选用开局 ?? '').trim() ||
        script.选用开局.trim() ||
        (manifest.默认选用开局 ?? '').trim() ||
        (manifest.选用开局 ?? '').trim() ||
        '';
    const chosenOpeningRaw = chosen.length > 0 ? chosen : null;
    let autoInit = true;
    if (typeof char.自动初始化 === 'boolean')
        autoInit = char.自动初始化;
    else if (typeof script.自动初始化 === 'boolean')
        autoInit = script.自动初始化;
    else if (typeof manifest.自动初始化 === 'boolean')
        autoInit = manifest.自动初始化;
    return {
        chosenOpeningRaw,
        autoInit,
        greetingAuto: resolveGreetingAuto(char, script, manifest),
        indexOpeningMap: mergeIndexOpeningMap(char, script, manifest),
        statDataKey: resolveStatDataKey(char, script, manifest),
        keywordMap,
        char,
        script,
        manifest,
    };
}
function normalizeBaseUrl(base) {
    return base.trim().replace(/\/+$/, '');
}
function resolveRemoteUrl(merged, resolvedOpeningId) {
    const pick = (charUrl, scriptUrl, manUrl) => (charUrl ?? '').trim() || scriptUrl.trim() || (manUrl ?? '').trim();
    if (resolvedOpeningId === '开局一') {
        const u = pick(merged.char.开局一链接, merged.script.开局一链接, merged.manifest.开局一链接);
        if (u)
            return u;
    }
    if (resolvedOpeningId === '开局二') {
        const u = pick(merged.char.开局二链接, merged.script.开局二链接, merged.manifest.开局二链接);
        if (u)
            return u;
    }
    const baseRaw = (merged.char.远程预设基础URL ?? '').trim() ||
        merged.script.远程预设基础URL.trim() ||
        (merged.manifest.远程预设基础URL ?? '').trim();
    if (baseRaw) {
        return `${normalizeBaseUrl(baseRaw)}/${resolvedOpeningId}.json`;
    }
    return '';
}
async function fetchPresetFromUrl(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('JSON 根节点必须是对象');
        }
        return structuredClone(data);
    }
    finally {
        clearTimeout(timer);
    }
}
async function resolvePreset(merged, resolvedOpeningId) {
    const url = resolveRemoteUrl(merged, resolvedOpeningId);
    if (url) {
        try {
            const remote = await fetchPresetFromUrl(url);
            console.info('[温泉开局变量] 已拉取远程预设', resolvedOpeningId, url);
            return remote;
        }
        catch (e) {
            console.error('[温泉开局变量] 远程预设失败，将尝试内置预设', resolvedOpeningId, e);
        }
    }
    const local = PRESETS[resolvedOpeningId];
    return local ? structuredClone(local) : null;
}
function hasPresetSource(merged, resolvedOpeningId) {
    return Boolean(PRESETS[resolvedOpeningId] || resolveRemoteUrl(merged, resolvedOpeningId));
}
function normalizeGreetingText(s) {
    return s.trim().replace(/\s+/g, ' ');
}
function greetingTextsMatch(utterance, template) {
    const a = normalizeGreetingText(utterance);
    const b = normalizeGreetingText(template);
    if (!b)
        return false;
    if (a === b)
        return true;
    const n = 220;
    if (a.length >= 40 && b.length >= 40 && a.slice(0, n) === b.slice(0, n))
        return true;
    if (b.length >= 24 && a.includes(b.slice(0, Math.min(120, b.length))))
        return true;
    return false;
}
/** 将标记里捕获的片段规范成 `开局一` / `开局二` 等 */
function canonOpeningTag(raw, merged) {
    const t = raw.replace(/\s/g, '');
    const alias = {
        开局1: '开局一',
        开局2: '开局二',
        开局两: '开局二',
        '1': '开局一',
        '2': '开局二',
        一: '开局一',
        二: '开局二',
        两: '开局二',
    };
    const compact = t.startsWith('开局') ? t : `开局${t}`;
    const base = alias[compact] ?? alias[t] ?? (t.startsWith('开局') ? t : compact);
    return merged.keywordMap[base] ?? base;
}
/**
 * 与酒馆编辑界面一致：默认第一条消息 + `alternate_greetings`（额外问候语#1 常为 alternate_greetings[0]），
 * 再补上 `first_messages` 里除首条外的条目（去重）。
 */
function buildOrderedGreetingTemplates(character) {
    const out = [];
    const seen = new Set();
    const push = (s) => {
        if (typeof s !== 'string')
            return;
        const v = s.trim();
        if (!v || seen.has(v))
            return;
        seen.add(v);
        out.push(s);
    };
    const fm = character.first_messages ?? [];
    push(fm[0]);
    const alt = character.alternate_greetings;
    if (Array.isArray(alt)) {
        for (const g of alt)
            push(g);
    }
    for (let i = 1; i < fm.length; i++)
        push(fm[i]);
    return out;
}
function extractTop3NonEmptyLines(text) {
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .slice(0, 3)
        .join('\n');
}
/** 文内标记（优先只看顶三行）、或与问候语模板列表按索引匹配 */
async function detectOpeningFromGreetingText(text, merged) {
    const cap = '(开局\\s*[一二两二三\\d]+|开局[12]|[12])';
    const markerRes = [
        new RegExp(`\\[\\s*温泉开局\\s*[:：]\\s*${cap}\\s*\\]`),
        new RegExp(`【\\s*温泉开局\\s*[:：]\\s*${cap}\\s*】`),
        new RegExp(`<!--\\s*温泉开局\\s*[:：]\\s*${cap}\\s*-->`),
    ];
    const head3 = extractTop3NonEmptyLines(text);
    for (const re of markerRes) {
        const m = head3.match(re) ?? text.match(re);
        if (m?.[1]) {
            const id = canonOpeningTag(m[1].trim(), merged);
            if (id && (PRESETS[id] || resolveRemoteUrl(merged, id)))
                return id;
        }
    }
    try {
        const character = await getCharacter('current');
        const list = buildOrderedGreetingTemplates(character);
        for (let i = 0; i < list.length; i++) {
            const tpl = list[i];
            const tplHead = extractTop3NonEmptyLines(tpl);
            if (greetingTextsMatch(text, tpl) || (head3.length > 0 && greetingTextsMatch(head3, tplHead))) {
                const oid = merged.indexOpeningMap[i];
                if (oid)
                    return oid;
            }
        }
    }
    catch {
        /* 忽略 */
    }
    return null;
}
async function resolveOpeningId(openingKeywordOrId) {
    const merged = await buildMerged();
    const t = openingKeywordOrId.trim();
    if (!t)
        return t;
    return merged.keywordMap[t] ?? t;
}
function patchMvuRootStatBucket(root, preset, statDataKey) {
    const rawBucket = root[statDataKey];
    const bucket = rawBucket != null && typeof rawBucket === 'object' && !Array.isArray(rawBucket)
        ? { ...rawBucket }
        : {};
    const clone = structuredClone(preset);
    for (const key of Object.keys(clone)) {
        bucket[key] = clone[key];
    }
    return { ...root, [statDataKey]: bucket };
}
/** 无 MVU 时：直接写酒馆聊天变量表 */
function mergePresetIntoChatStatDataFallback(preset, statDataKey) {
    const chat = getVariables({ type: 'chat' });
    const nextChat = patchMvuRootStatBucket(chat, preset, statDataKey);
    replaceVariables(nextChat, { type: 'chat' });
}
async function tryMvuReady() {
    try {
        await Promise.race([
            waitGlobalInitialized('Mvu'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Mvu wait timeout')), 5000)),
        ]);
        return typeof Mvu !== 'undefined' && typeof Mvu.replaceMvuData === 'function';
    }
    catch {
        return false;
    }
}
/**
 * 合并预设到 MVU 的 stat_data（或同名键），并同步 chat + latest message。
 * 状态栏/iframe 多数使用 `getMvuData({ type: 'message', message_id: 'latest' })`，只写 chat 会读不到。
 */
async function applyPresetToMvuStatData(preset, statDataKey) {
    const useMvu = await tryMvuReady();
    if (!useMvu) {
        mergePresetIntoChatStatDataFallback(preset, statDataKey);
        return;
    }
    const chatRoot = Mvu.getMvuData({ type: 'chat' });
    const nextChat = patchMvuRootStatBucket(chatRoot, preset, statDataKey);
    await Mvu.replaceMvuData(nextChat, { type: 'chat' });
    if (getLastMessageIdSafe() >= 0) {
        const msgRoot = Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        const nextMsg = patchMvuRootStatBucket(msgRoot, preset, statDataKey);
        await Mvu.replaceMvuData(nextMsg, { type: 'message', message_id: 'latest' });
    }
}
function getLastMessageIdSafe() {
    try {
        return getLastMessageId();
    }
    catch {
        return 0;
    }
}
function isEmptyChat() {
    return getLastMessageIdSafe() < 0;
}
/**
 * 用于「是否仍算开局阶段」的楼层判断：不用 `getLastMessageIdSafe` 的 catch 回退 0，避免异常时误判。
 * 允许：`lastMessageId` 为 -1（空）或 0、1（至多 **2 层** 消息）。
 */
function getLastMessageIdForFloorCap() {
    try {
        return getLastMessageId();
    }
    catch {
        return -1;
    }
}
/** 已超过 2 层消息：不做问候语/顶三行检测与 `applyOpeningFromGreetingContent` 自动写入 */
function isChatBeyondGreetingAutoFloorLimit() {
    const last = getLastMessageIdForFloorCap();
    return last > 1;
}
function getCurrentChatIdSafe() {
    try {
        return SillyTavern.getCurrentChatId();
    }
    catch {
        return '';
    }
}
/** 切换聊天后递增，作废上一轮延迟「补水」任务 */
let hydrateGeneration = 0;
/** 问候语自动开局：同一聊天在途只跑一条链路，避免 hydrate + 稳定防抖 + 渲染事件叠成多次写入 */
const greetingApplyInFlightByChatId = new Set();
function resetOpeningTrackingState() {
    appliedChatIds.clear();
    syncedStatDataAfterFirstUserMessage.clear();
    lastAppliedOpeningByChatId.clear();
    lastAppliedTop3SigByChatId.clear();
    greetingApplyInFlightByChatId.clear();
    for (const t of top3StableTimerByChatId.values()) {
        clearTimeout(t);
    }
    top3StableTimerByChatId.clear();
}
function scheduleHydrateOpeningFromFloor0() {
    hydrateGeneration += 1;
    const gen = hydrateGeneration;
    /** 与 MutationObserver + 顶三行稳定防抖重叠时易重复触发；保留两次较晚兜底即可 */
    const delays = [500, 2200];
    for (const ms of delays) {
        setTimeout(() => void runHydrateOpeningAttempt(gen), ms);
    }
}
async function runHydrateOpeningAttempt(gen) {
    if (gen !== hydrateGeneration)
        return;
    const merged = await buildMerged();
    if (!merged.autoInit || !merged.greetingAuto)
        return;
    const chatId = getCurrentChatIdSafe();
    if (!chatId)
        return;
    if (isChatBeyondGreetingAutoFloorLimit())
        return;
    if (getLastMessageIdSafe() < 0)
        return;
    let text = '';
    try {
        const asAssistant = getChatMessages(0, { role: 'assistant' });
        if (asAssistant.length > 0)
            text = asAssistant[0]?.message ?? '';
        if (!text.trim()) {
            const anyRole = getChatMessages(0);
            text = anyRole[0]?.message ?? '';
        }
    }
    catch {
        return;
    }
    if (!text.trim())
        return;
    await applyOpeningFromGreetingContent(text, 'hydrate:floor0');
}
/** 取第 0 楼 AI 正文（优先 assistant） */
function peekFirstAssistantMessageText() {
    try {
        const a = getChatMessages(0, { role: 'assistant' });
        let t = (a[0]?.message ?? '').trim();
        if (!t) {
            const any0 = getChatMessages(0);
            t = (any0[0]?.message ?? '').trim();
        }
        return t;
    }
    catch {
        return '';
    }
}
/** 用首条 AI 回复「非空前缀三行」做签名：换问候语 / 换开局后内容会变，可再次写入 */
function makeTop3LineSignature(text) {
    return extractTop3NonEmptyLines(text);
}
/** 顶三行稳定后再写（流式时每敲一字会重置计时，停笔 ~450ms 才触发） */
const TOP3_STABLE_MS = 450;
const lastAppliedTop3SigByChatId = new Map();
const top3StableTimerByChatId = new Map();
function scheduleStableTop3Apply(chatId, source) {
    if (!chatId)
        return;
    if (isChatBeyondGreetingAutoFloorLimit())
        return;
    const prev = top3StableTimerByChatId.get(chatId);
    if (prev)
        clearTimeout(prev);
    const timer = setTimeout(() => {
        top3StableTimerByChatId.delete(chatId);
        void flushStableTop3Apply(chatId, source);
    }, TOP3_STABLE_MS);
    top3StableTimerByChatId.set(chatId, timer);
}
async function flushStableTop3Apply(chatId, source) {
    if (getCurrentChatIdSafe() !== chatId)
        return;
    if (isChatBeyondGreetingAutoFloorLimit())
        return;
    const merged = await buildMerged();
    if (!merged.autoInit || !merged.greetingAuto)
        return;
    if (getLastMessageIdSafe() < 0)
        return;
    const text = peekFirstAssistantMessageText();
    if (!text.trim())
        return;
    const sig = makeTop3LineSignature(text);
    if (sig.length < 2)
        return;
    if (lastAppliedTop3SigByChatId.get(chatId) === sig)
        return;
    await applyOpeningFromGreetingContent(text, source, sig);
}
function mountChatDomFirstMessageWatcher() {
    const $chat = $('#chat');
    const root = ($chat.length ? $chat : $('body'))[0];
    if (!root)
        return;
    const mo = new MutationObserver(() => {
        const cid = getCurrentChatIdSafe();
        if (cid)
            scheduleStableTop3Apply(cid, 'mutation:#chat');
    });
    mo.observe(root, { childList: true, subtree: true });
    $(window).on('pagehide', () => {
        mo.disconnect();
        for (const t of top3StableTimerByChatId.values())
            clearTimeout(t);
        top3StableTimerByChatId.clear();
    });
}
const appliedChatIds = new Set();
/** 供首条用户消息后同步 latest 楼层时复用已确定的开局 ID */
const lastAppliedOpeningByChatId = new Map();
/** 空聊天只写了 chat 层时，首条用户消息后再补写 latest 楼层，界面才能读到 */
const syncedStatDataAfterFirstUserMessage = new Set();
/**
 * @param top3Sig 若已算好「顶三行签名」，传入可避免与全文微差；未传则用全文现算
 */
async function applyOpeningFromGreetingContent(text, source, top3Sig) {
    const chatId = getCurrentChatIdSafe();
    if (!chatId)
        return;
    if (isChatBeyondGreetingAutoFloorLimit())
        return;
    const sig = (top3Sig ?? makeTop3LineSignature(text)).trim();
    if (sig.length >= 2 && lastAppliedTop3SigByChatId.get(chatId) === sig)
        return;
    if (greetingApplyInFlightByChatId.has(chatId))
        return;
    greetingApplyInFlightByChatId.add(chatId);
    try {
        const merged = await buildMerged();
        if (!merged.autoInit || !merged.greetingAuto)
            return;
        const freshText = peekFirstAssistantMessageText();
        const sigFresh = makeTop3LineSignature(freshText);
        if (sigFresh.length >= 2 && lastAppliedTop3SigByChatId.get(chatId) === sigFresh)
            return;
        const textForDetect = freshText.trim() && sigFresh.length >= 2 ? freshText : text;
        let openingRaw = await detectOpeningFromGreetingText(textForDetect, merged);
        if (!openingRaw && merged.chosenOpeningRaw) {
            openingRaw = merged.chosenOpeningRaw;
        }
        if (!openingRaw) {
            console.info('[温泉开局变量]', source, '未识别开局，可在问候语首行加 [温泉开局:开局一]');
            return;
        }
        const resolved = merged.keywordMap[openingRaw] ?? openingRaw;
        if (!hasPresetSource(merged, resolved))
            return;
        const claimSig = sigFresh.length >= 2 ? sigFresh : sig;
        lastAppliedTop3SigByChatId.set(chatId, claimSig);
        if (!(await applyWarmSpringOpeningVars(openingRaw))) {
            lastAppliedTop3SigByChatId.delete(chatId);
            return;
        }
        console.info('[温泉开局变量] 已按问候语自动开局', source, openingRaw);
    }
    finally {
        greetingApplyInFlightByChatId.delete(chatId);
    }
}
async function applyWarmSpringOpeningVars(openingKeywordOrId) {
    const merged = await buildMerged();
    const trimmed = openingKeywordOrId.trim();
    const pickRaw = trimmed.length > 0 ? trimmed : (merged.chosenOpeningRaw ?? '');
    const id = (merged.keywordMap[pickRaw] ?? pickRaw).trim();
    if (!id) {
        toastr.warning('未配置开局（请检查远程 manifest 的 默认选用开局）', '温泉开局变量');
        return false;
    }
    const preset = await resolvePreset(merged, id);
    if (!preset) {
        console.warn('[温泉开局变量] 无法解析开局:', id);
        toastr.warning(`开局「${id}」无可用数据`, '温泉开局变量');
        return false;
    }
    try {
        await applyPresetToMvuStatData(preset, merged.statDataKey);
        const rawLabel = trimmed.length > 0 ? trimmed : pickRaw || id;
        const via = rawLabel && rawLabel !== id ? `${rawLabel} → ${id}` : id;
        const layer = getLastMessageIdSafe() >= 0 ? `MVU chat + 最新楼层.${merged.statDataKey}` : `MVU chat.${merged.statDataKey}`;
        console.info('[温泉开局变量] 已合并', layer, via);
        toastr.success(`已写入「${via}」→ ${layer}`, '温泉开局变量');
        const cid = getCurrentChatIdSafe();
        if (cid) {
            lastAppliedOpeningByChatId.set(cid, id);
            appliedChatIds.add(cid);
            const fresh = peekFirstAssistantMessageText();
            if (fresh) {
                lastAppliedTop3SigByChatId.set(cid, makeTop3LineSignature(fresh));
            }
        }
        return true;
    }
    catch (e) {
        console.error('[温泉开局变量] 写入失败', e);
        toastr.error('写入失败（需安装 MVU 或检查控制台）', '温泉开局变量');
        return false;
    }
}
async function tryAutoApply() {
    const merged = await buildMerged();
    if (!merged.autoInit)
        return;
    /** 交给「选问候语」事件决定开局，避免空聊天阶段用默认开局写错档 */
    if (merged.greetingAuto)
        return;
    const raw = merged.chosenOpeningRaw;
    if (!raw)
        return;
    const resolved = merged.keywordMap[raw] ?? raw;
    if (!hasPresetSource(merged, resolved))
        return;
    const chatId = getCurrentChatIdSafe();
    if (!chatId || appliedChatIds.has(chatId))
        return;
    if (!isEmptyChat())
        return;
    if (await applyWarmSpringOpeningVars(raw)) {
        appliedChatIds.add(chatId);
    }
}
$(() => {
    errorCatched(() => {
        try {
            window.__温泉开局变量应用 =
                applyWarmSpringOpeningVars;
            window.__温泉开局解析 = resolveOpeningId;
        }
        catch {
            /* ignore */
        }
        appendInexistentScriptButtons([
            { name: '开局·写入开局一', visible: true },
            { name: '开局·写入开局二', visible: true },
        ]);
        eventOn(getButtonEvent('开局·写入开局一'), () => {
            void applyWarmSpringOpeningVars('开局一');
        });
        eventOn(getButtonEvent('开局·写入开局二'), () => {
            void applyWarmSpringOpeningVars('开局二');
        });
        void tryAutoApply();
        scheduleHydrateOpeningFromFloor0();
        mountChatDomFirstMessageWatcher();
        eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, message_id => {
            if (message_id !== 0)
                return;
            const cid = getCurrentChatIdSafe();
            if (cid)
                scheduleStableTop3Apply(cid, 'CHARACTER_MESSAGE_RENDERED:0');
        });
        eventOn(tavern_events.CHAT_CHANGED, () => {
            resetOpeningTrackingState();
            void tryAutoApply();
            scheduleHydrateOpeningFromFloor0();
        });
        eventOn(tavern_events.CHAT_CREATED, () => {
            resetOpeningTrackingState();
            scheduleHydrateOpeningFromFloor0();
        });
        eventOn(tavern_events.CHARACTER_FIRST_MESSAGE_SELECTED, () => {
            const cid = getCurrentChatIdSafe();
            if (cid)
                scheduleStableTop3Apply(cid, 'CHARACTER_FIRST_MESSAGE_SELECTED');
        });
        eventOn(tavern_events.MESSAGE_RECEIVED, (message_id, type) => {
            if (message_id !== 0)
                return;
            if (type !== 'first_message' && type !== 'normal')
                return;
            try {
                const msgs = getChatMessages(message_id);
                const row = msgs[0];
                if (row && row.role !== 'assistant')
                    return;
                const text = (row?.message ?? '').trim();
                if (!text)
                    return;
                const cid = getCurrentChatIdSafe();
                if (cid)
                    scheduleStableTop3Apply(cid, `MESSAGE_RECEIVED:${String(type)}`);
            }
            catch {
                /* ignore */
            }
        });
        eventOn(tavern_events.MESSAGE_SENT, message_id => {
            if (message_id !== 0)
                return;
            const chatId = getCurrentChatIdSafe();
            if (!chatId || syncedStatDataAfterFirstUserMessage.has(chatId))
                return;
            setTimeout(() => {
                void (async () => {
                    try {
                        const merged = await buildMerged();
                        if (!merged.autoInit)
                            return;
                        const raw = lastAppliedOpeningByChatId.get(chatId) ?? merged.chosenOpeningRaw ?? '';
                        if (!raw)
                            return;
                        const resolved = merged.keywordMap[raw] ?? raw;
                        if (!hasPresetSource(merged, resolved))
                            return;
                        if (!(await tryMvuReady()) || getLastMessageIdSafe() < 0)
                            return;
                        const preset = await resolvePreset(merged, resolved);
                        if (!preset)
                            return;
                        await applyPresetToMvuStatData(preset, merged.statDataKey);
                        syncedStatDataAfterFirstUserMessage.add(chatId);
                        console.info('[温泉开局变量] 首条用户消息后已同步 MVU 最新楼层 stat_data');
                    }
                    catch {
                        /* ignore */
                    }
                })();
            }, 400);
        });
    })();
});

export { applyWarmSpringOpeningVars, resolveOpeningId };

//# sourceMappingURL=index.js.map