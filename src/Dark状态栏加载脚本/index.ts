/**
 * Dark 状态栏：云端用 iframe（同源 /dark），本地用 $.get 注入（远程 dist/Dark）。
 * 正则「替换为」只保留占位，例如：<div class="dark-status-hook"></div>
 * 也兼容：<div class="custom-dark-status-hook"></div>
 */
/** 挂载点：任选其一即可 */
const HOOK_SELECTOR = '.dark-status-hook, .custom-dark-status-hook';

const CLOUD_HOST_RE = /^38\.246\.237\.16(:\d+)?$/;
const REMOTE_BASE = 'http://38.246.237.16/dist/Dark';

/**
 * 可选：在同一张角色卡里做两条**局部正则**，「脚本名称」填下面两个值（须与酒馆 UI 里完全一致）。
 * 脚本会根据当前是云端还是本地，自动只启用其中一条（另一条 disabled）。
 * 若任一项留空，则不会改角色正则（与旧行为一致）。
 *
 * **不要**把下面两个常量都改成 `''` 后直接 `pnpm build`：生产压缩会认为「永远不同步」而删掉整段逻辑。
 * 不需要同步时：保持默认名称即可（只会尝试开关同名正则；找不到则仅打警告），或改源码后改用 `pnpm watch` 调试包。
 *
 * 注意：依赖酒馆「角色卡局部正则」总开关为开启；写入可能触发界面/消息重算，请勿把名称设得太泛以免误伤其它正则。
 */
const CLOUD_REGEX_SCRIPT_NAME = '云端';
const LOCAL_REGEX_SCRIPT_NAME = '本地';

/** 设为 true 时输出 [部署选择][regex] 详细步骤（仅当前 frame 一条，不镜像） */
const REGEX_SYNC_DEBUG = false;

/** 调用 updateCharacter 后酒馆会再抛 CHAT_CHANGED 等事件，在此冷却内不再跑同步，避免死循环 */
const REGEX_WRITE_COOLDOWN_MS = 2500;
/** 合并短时间内多次事件，减少重复日志与 refresh */
const REGEX_SYNC_DEBOUNCE_MS = 800;

let regexWriteCooldownUntil = 0;
let regexSyncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 助手脚本在 iframe 内执行：若 **iframe + 父页面各打一次**，控制台里同一条会出现两遍。
 * 优先只写到 **父页面 console**（你在 top 里搜「部署选择」仍能看到一条）；不可用时再退回当前 frame。
 */
function deployMirrorLog(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
  const a = args as never[];
  try {
    const p = window.parent;
    if (p !== window && p.console) {
      if (level === 'info') p.console.info(...a);
      else if (level === 'warn') p.console.warn(...a);
      else p.console.error(...a);
      return;
    }
  } catch {
    /* 跨域父页面 */
  }
  if (level === 'info') console.info(...a);
  else if (level === 'warn') console.warn(...a);
  else console.error(...a);
}

type DarkDeployRegexConfig = { cloud?: string; local?: string };

/**
 * 父页面可覆盖：`window.__DARK_DEPLOY_REGEX = { cloud: '…', local: '…' }`（与顶层 window 同源即可）。
 */
function resolveRegexScriptNames(): { cloud: string; local: string } {
  let fromParent: DarkDeployRegexConfig | undefined;
  try {
    const p = window.parent as unknown as { __DARK_DEPLOY_REGEX?: DarkDeployRegexConfig };
    fromParent = p.__DARK_DEPLOY_REGEX;
  } catch {
    fromParent = undefined;
  }
  const cloud = String(fromParent?.cloud ?? CLOUD_REGEX_SCRIPT_NAME).trim();
  const local = String(fromParent?.local ?? LOCAL_REGEX_SCRIPT_NAME).trim();
  return { cloud, local };
}

/** SillyTavern 原生用 scriptName + disabled；助手规范化可能用 script_name + enabled；个别导出用 name */
function regexScriptName(r: Record<string, unknown>): string {
  const a = r.script_name;
  const b = r.scriptName;
  const nm = r.name;
  const raw =
    typeof a === 'string' && a
      ? a
      : typeof b === 'string' && b
        ? b
        : typeof nm === 'string' && nm
          ? nm
          : '';
  return raw.trim();
}

/** 局部正则可能挂在 extensions.regex_scripts，也可能在 SillyTavern v2 的 data.extensions.regex_scripts */
function collectRegexScriptLists(character: unknown): Record<string, unknown>[][] {
  const c = character as Record<string, unknown>;
  const lists: Record<string, unknown>[][] = [];
  const ext = c.extensions as Record<string, unknown> | undefined;
  if (ext && Array.isArray(ext.regex_scripts)) {
    lists.push(ext.regex_scripts as Record<string, unknown>[]);
  }
  const data = c.data as Record<string, unknown> | undefined;
  const dext = data?.extensions as Record<string, unknown> | undefined;
  if (dext && Array.isArray(dext.regex_scripts)) {
    lists.push(dext.regex_scripts as Record<string, unknown>[]);
  }
  return lists;
}

function regexDebug(msg: string, extra?: unknown): void {
  if (!REGEX_SYNC_DEBUG) return;
  /** 诊断日志不镜像父页面，避免与主日志叠成多条 */
  if (extra !== undefined) console.info('[部署选择][regex]', msg, extra);
  else console.info('[部署选择][regex]', msg);
}

function regexScriptIsEnabled(r: Record<string, unknown>): boolean {
  /** 助手侧常用 enabled；酒馆原生常用 disabled。二者并存时以 enabled 为准（与 TH 写入一致） */
  if (typeof r.enabled === 'boolean') return r.enabled;
  if (typeof r.disabled === 'boolean') return !r.disabled;
  return true;
}

/**
 * 必须**同时**写入 enabled + disabled：原生卡可能只有 disabled，若只改一边，
 * `replaceTavernRegexes` 等只认 `enabled` 的路径会把条目当成未启用。
 */
function regexScriptSetEnabled(r: Record<string, unknown>, enabled: boolean): void {
  r.disabled = !enabled;
  r.enabled = enabled;
}

const DEFAULT_REGEX_SOURCE: TavernRegex['source'] = {
  user_input: true,
  ai_output: true,
  slash_command: true,
  world_info: true,
};

const DEFAULT_REGEX_DESTINATION: TavernRegex['destination'] = {
  display: true,
  prompt: true,
};

/** 无 id 的条目用脚本名+查找正则生成稳定 id，避免 merge/replace 每次随机出新脚本 */
function stableRegexScriptId(r: Record<string, unknown>): string {
  const id = typeof r.id === 'string' && r.id ? r.id : '';
  if (id) return id;
  const sn = regexScriptName(r);
  const fr = String(r.find_regex ?? r.findRegex ?? '');
  let h = 0;
  const key = `${sn}\0${fr}`;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return `th-dark-${(h >>> 0).toString(16)}`;
}

/**
 * 将角色卡里的单条正则（可能是 TavernRegex 或 SillyTavern RegexScriptData 驼峰）整理成 replace API 能吃的形状。
 * 缺 `source` / `destination` 等字段时，部分环境下 `replaceTavernRegexes` 会静默失败或 UI 不更新。
 */
function coerceRegexEntryForReplace(r: Record<string, unknown>): TavernRegex {
  const out = { ...r } as Record<string, unknown>;
  const enabled = regexScriptIsEnabled(r);
  out.enabled = enabled;
  out.disabled = !enabled;
  const sn = regexScriptName(r);
  if (sn) out.script_name = sn;
  else if (typeof out.script_name !== 'string') out.script_name = '';

  if (typeof out.find_regex !== 'string' && typeof out.findRegex === 'string') {
    out.find_regex = out.findRegex;
  }
  if (typeof out.replace_string !== 'string' && typeof out.replaceString === 'string') {
    out.replace_string = out.replaceString;
  }
  if (typeof out.trim_strings !== 'string') {
    if (Array.isArray(out.trimStrings)) {
      out.trim_strings = (out.trimStrings as string[]).join('\n');
    } else if (typeof out.trim_strings !== 'string') {
      out.trim_strings = '';
    }
  }
  if (typeof out.run_on_edit !== 'boolean' && typeof out.runOnEdit === 'boolean') {
    out.run_on_edit = out.runOnEdit;
  }
  if (typeof out.run_on_edit !== 'boolean') out.run_on_edit = false;

  if (out.min_depth === undefined && 'minDepth' in out) {
    out.min_depth = out.minDepth as number | null;
  }
  if (out.max_depth === undefined && 'maxDepth' in out) {
    out.max_depth = out.maxDepth as number | null;
  }
  if (out.min_depth === undefined) out.min_depth = null;
  if (out.max_depth === undefined) out.max_depth = null;

  const src = out.source;
  const hasSource =
    src &&
    typeof src === 'object' &&
    'user_input' in (src as object) &&
    'ai_output' in (src as object);
  if (!hasSource) {
    const po = out.promptOnly === true;
    const mo = out.markdownOnly === true;
    if (po && !mo) {
      out.source = { ...DEFAULT_REGEX_SOURCE };
      out.destination = { display: false, prompt: true };
    } else if (mo && !po) {
      out.source = { ...DEFAULT_REGEX_SOURCE };
      out.destination = { display: true, prompt: false };
    } else {
      out.source = { ...DEFAULT_REGEX_SOURCE };
      out.destination = { ...DEFAULT_REGEX_DESTINATION };
    }
  }
  const dest = out.destination;
  const hasDest = dest && typeof dest === 'object' && 'display' in (dest as object);
  if (!hasDest) {
    out.destination = { ...DEFAULT_REGEX_DESTINATION };
  }

  if (typeof out.id !== 'string' || !out.id) {
    out.id = stableRegexScriptId(r);
  }

  return out as TavernRegex;
}

/**
 * 合并 extensions.regex_scripts 与 data.extensions.regex_scripts（按 id 去重，后者字段覆盖前者）。
 * 只 replace「其中一份」时，酒馆 UI/引擎仍可能读另一份，表现为开关无效。
 */
function mergeRegexScriptsForReplace(ch: Character): TavernRegex[] | null {
  const lists = collectRegexScriptLists(ch);
  if (!lists.some(l => l.length > 0)) return null;
  const byId = new Map<string, Record<string, unknown>>();
  for (const list of lists) {
    for (const raw of list) {
      const r = raw as Record<string, unknown>;
      const id = stableRegexScriptId(r);
      const prev = byId.get(id);
      byId.set(id, prev ? { ...prev, ...r } : { ...r });
    }
  }
  const merged = [...byId.values()];
  return merged.map(x => coerceRegexEntryForReplace(x));
}

/**
 * 助手脚本常在 srcdoc / 嵌套 iframe 中运行，`window.location.host` 可能为空。
 * 优先读 top，再读同源的 parent（即酒馆页面），最后才用当前 frame。
 */
function pageHost(): string {
  try {
    const h = window.top?.location?.host;
    if (h) return h;
  } catch {
    /* 跨域 top */
  }
  try {
    if (window.parent !== window) {
      const h = window.parent.location?.host;
      if (h) return h;
    }
  } catch {
    /* 跨域 parent */
  }
  return window.location.host ?? '';
}

function isCloudHost(): boolean {
  return CLOUD_HOST_RE.test(pageHost());
}

/**
 * 按访问环境切换角色卡上两条局部正则的启用状态（由脚本名称识别）。
 * 已在目标状态时不会调用写入 API。
 *
 * 注意：不能用 `getTavernRegexes` 做「是否需要写入」的判断——在部分环境下它**只返回已启用的正则**，
 * 若你把「云端」「本地」都关掉，列表里可能没有这两条，`needWrite` 会恒为 false，永远不会恢复。
 * 因此这里用 `getCharacter('current')` 读完整的 `extensions.regex_scripts`（含禁用项）再写回。
 */
/** @returns 是否执行了 updateCharacterWith（用于决定是否 refresh DOM，避免无写入也反复拆挂 Dark） */
function characterRegexOption(): { type: 'character'; name: string | 'current' } {
  const n = getCurrentCharacterName();
  return n != null && String(n).trim() !== ''
    ? { type: 'character', name: n }
    : { type: 'character', name: 'current' };
}

async function syncCharacterDarkRegexByHost(): Promise<boolean> {
  const { cloud: nameCloud, local: nameLocal } = resolveRegexScriptNames();
  const cloud = isCloudHost();
  regexDebug('开始同步', { nameCloud, nameLocal, isCloud: cloud, pageHost: pageHost() });
  if (!nameCloud || !nameLocal) {
    regexDebug('未配置名称，跳过');
    return false;
  }

  let globalRegexOn = true;
  try {
    globalRegexOn = isCharacterTavernRegexesEnabled();
  } catch {
    globalRegexOn = true;
  }
  if (!globalRegexOn) {
    deployMirrorLog(
      'warn',
      '[部署选择] isCharacterTavernRegexesEnabled() 为 false：若云端/本地开关仍无效，请到酒馆设置开启「角色卡局部正则」。脚本仍会尝试写入角色卡并 replace。',
    );
  }

  /** 助手脚本沙箱里 getCurrentCharacterName 可能恒为 null，不能据此放弃；getCharacter("current") 仍可用 */
  const charLabel = getCurrentCharacterName();
  regexDebug('getCurrentCharacterName()', charLabel);

  let character: Character;
  try {
    character = await getCharacter('current');
  } catch (e) {
    deployMirrorLog('error', '[部署选择] 读取角色卡失败，无法同步正则', e);
    return false;
  }

  const lists = collectRegexScriptLists(character);
  regexDebug('regex_scripts 挂载点数量', lists.length);
  if (lists.length === 0) {
    deployMirrorLog(
      'warn',
      '[部署选择][regex] getCharacter 结果里既没有 extensions.regex_scripts，也没有 data.extensions.regex_scripts，无法同步。请确认酒馆助手版本与角色卡已完整加载。',
    );
    return false;
  }

  const flat = lists.flat();
  regexDebug('正则条目总数', flat.length);

  let needWrite = false;
  let foundCloud = false;
  let foundLocal = false;
  const seen = new Set<string>();
  for (const r of flat) {
    const rid = stableRegexScriptId(r as Record<string, unknown>);
    if (seen.has(rid)) continue;
    seen.add(rid);
    const name = regexScriptName(r);
    if (name === nameCloud) {
      foundCloud = true;
      if (regexScriptIsEnabled(r) !== cloud) needWrite = true;
    }
    if (name === nameLocal) {
      foundLocal = true;
      if (regexScriptIsEnabled(r) !== !cloud) needWrite = true;
    }
  }

  if (!foundCloud || !foundLocal) {
    const names = flat.map(regexScriptName).filter(Boolean);
    deployMirrorLog(
      'warn',
      '[部署选择] 角色卡里未找到脚本名称为「' +
        nameCloud +
        '」/「' +
        nameLocal +
        '」的局部正则，跳过同步。当前读到的名称列表：' +
        (names.length ? JSON.stringify(names) : '（数组为空）'),
    );
    return false;
  }
  if (!needWrite) {
    regexDebug('已符合当前环境，跳过写入');
    return false;
  }

  await updateCharacterWith('current', ch => {
    for (const list of collectRegexScriptLists(ch)) {
      for (const r of list) {
        const name = regexScriptName(r);
        if (name === nameCloud) regexScriptSetEnabled(r, cloud);
        if (name === nameLocal) regexScriptSetEnabled(r, !cloud);
      }
    }
    return ch;
  });

  /**
   * 仅写角色卡文件时，酒馆界面与楼层格式化用的「内存正则」往往不会立刻跟着变。
   * replaceTavernRegexes 会按新列表刷新引擎并**重载聊天**（助手文档说明较慢，但可让开关立刻生效）。
   */
  const regexOpt = characterRegexOption();
  try {
    const refreshed = await getCharacter('current');
    const toApply = mergeRegexScriptsForReplace(refreshed);
    if (toApply?.length) {
      regexDebug('replaceTavernRegexes 条数 / option', { count: toApply.length, regexOpt });
      await replaceTavernRegexes(toApply, regexOpt);
      /** 再推一次内存状态，避免部分版本 UI 仍读旧 enabled */
      try {
        await updateTavernRegexesWith(
          regexes => {
            for (const re of regexes) {
              const n = String(re.script_name ?? '').trim();
              if (n === nameCloud) re.enabled = cloud;
              if (n === nameLocal) re.enabled = !cloud;
            }
            return regexes;
          },
          regexOpt,
        );
      } catch {
        /* 可选增强，失败不阻断 */
      }
    } else {
      deployMirrorLog('warn', '[部署选择] 刷新后未得到可提交的 regex_scripts 数组，replaceTavernRegexes 已跳过。');
    }
  } catch (e) {
    deployMirrorLog(
      'warn',
      '[部署选择] 角色卡已保存，但 replaceTavernRegexes 未成功，正则界面/替换可能仍滞后，可尝试刷新页面。',
      e,
    );
  }

  deployMirrorLog(
    'info',
    `[部署选择] 已同步角色局部正则：${cloud ? '启用「' + nameCloud + '」' : '启用「' + nameLocal + '」'}（host=${pageHost()}，replace 选项 ${regexOpt.name === 'current' ? 'current' : '角色名'}）`,
  );
  return true;
}

function mountIframe($hook: JQuery<HTMLElement>) {
  let origin = '';
  try {
    origin = window.top?.location.origin ?? window.location.origin;
  } catch {
    origin = window.location.origin;
  }
  // 云端统一走 /dist/Dark，避免误命中旧的 /dark 目录
  const baseUrl = `${origin}/dist/Dark`;
  const v = Date.now();
  const src = `${baseUrl}/index.html?v=${v}`;
  const wrap = `<div class="dark-embed-wrap" style="width:100%;min-width:100%;max-width:100vw;overflow-x:hidden;box-sizing:border-box;"><iframe src="${src}" style="width:100%;height:80vh;min-height:400px;border:none;display:block;"></iframe></div>`;
  $hook.empty().html(wrap);
}

function mountInject($hook: JQuery<HTMLElement>) {
  const ownerDoc = $hook[0].ownerDocument;
  const baseUrl = REMOTE_BASE;
  const v = Date.now();
  const pageUrl = `${baseUrl}/index.html?v=${v}`;
  /**
   * 勿用 `$.get`：酒馆全局 `$.ajaxSetup` 会给跨域请求带上 `x-csrf-token`，触发 CORS 预检，
   * 远端若未在 `Access-Control-Allow-Headers` 里放行该头，会得到
   * 「x-csrf-token is not allowed by Access-Control-Allow-Headers」。
   * `fetch` 默认不带该头，一般为简单 GET，可正常拉 HTML。
   */
  void fetch(pageUrl, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })
    .then(htmlText => {
      const parsed = new DOMParser().parseFromString(htmlText, 'text/html');
      const root = parsed.querySelector('#root');
      const rootHtml = root ? root.outerHTML : '<div id="root"></div>';
      const wrap = `<div class="dark-embed-wrap" style="width:100%;min-width:100%;max-width:100vw;overflow-x:hidden;box-sizing:border-box;">${rootHtml}</div>`;
      $hook.empty().html(wrap);
      $(ownerDoc).find('head link[data-dark-css="1"]').remove();
      const link = ownerDoc.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-dark-css', '1');
      link.href = `${baseUrl}/assets/index.css?v=${v}`;
      ownerDoc.head.appendChild(link);
      ownerDoc.getElementById('dark-remote-module')?.remove();
      const s = ownerDoc.createElement('script');
      s.id = 'dark-remote-module';
      s.type = 'module';
      s.src = `${baseUrl}/assets/index.js?v=${v}`;
      s.crossOrigin = 'anonymous';
      ownerDoc.body.appendChild(s);
    })
    .catch(err => {
      deployMirrorLog(
        'error',
        '[部署选择] 拉取远程 Dark 失败（已用 fetch 避免 CSRF 头触发 CORS）。若仍报错，请检查 38.246.237.16 是否允许来自本地的跨域 GET，或把 Dark 放到本地同源目录。',
        err,
      );
    });
}

function tryMountHook(el: HTMLElement) {
  if (el.getAttribute('data-dark-mounted') === '1') return;
  el.setAttribute('data-dark-mounted', '1');
  const $hook = $(el);
  if (isCloudHost()) {
    mountIframe($hook);
  } else {
    mountInject($hook);
  }
}

function scanDocument(doc: Document) {
  $(doc).find(HOOK_SELECTOR).each((_, el) => {
    tryMountHook(el as HTMLElement);
  });
}

/**
 * $ 来自父页面，但勿用脚本 iframe 的 document —— 聊天区在父 document 里。
 */
function scanAll() {
  let rootDoc: Document;
  try {
    rootDoc = window.parent.document;
  } catch {
    rootDoc = document;
  }

  scanDocument(rootDoc);
  $(rootDoc).find('iframe').each((_, frame) => {
    try {
      const idoc = (frame as HTMLIFrameElement).contentDocument;
      if (idoc) scanDocument(idoc);
    } catch {
      /* 跨域 iframe 无法访问 */
    }
  });
}

function init() {
  let rootDoc: Document;
  try {
    rootDoc = window.parent.document;
  } catch {
    rootDoc = document;
  }

  deployMirrorLog('info', '[部署选择] 已加载，扫描父页面挂载点（.dark-status-hook / .custom-dark-status-hook）');

  scanAll();
  const mo = new MutationObserver(() => {
    scanAll();
  });
  const chat = rootDoc.querySelector('#chat');
  if (chat) {
    mo.observe(chat, { childList: true, subtree: true });
  } else {
    mo.observe(rootDoc.body, { childList: true, subtree: true });
  }

  const refresh = () => {
    $(rootDoc).find(HOOK_SELECTOR).removeAttr('data-dark-mounted');
    $(rootDoc).find('#dark-remote-module').remove();
    $(rootDoc).find('head link[data-dark-css="1"]').remove();
    scanAll();
  };

  /**
   * 不在 CHAT_CHANGED 上同步：`replaceTavernRegexes` 会重载聊天并触发 CHAT_CHANGED，防抖后再跑
   * `syncCharacterDarkRegexByHost` 时，部分环境下 `getCharacter` 仍短暂带回旧开关，会把刚启用的「本地」又关掉。
   * 云端/本地只依赖当前浏览器 host，与「哪条聊天」无关，故仅在换角色 / 应用就绪时再同步即可。
   *
   * updateCharacterWith 仍会触发其它事件；已去掉 CHARACTER_EDITED；此处保留防抖 + 写入后冷却，且仅在实际写入后才 refresh。
   */
  const scheduleDebouncedRegexSync = () => {
    if (regexSyncDebounceTimer) clearTimeout(regexSyncDebounceTimer);
    regexSyncDebounceTimer = setTimeout(() => {
      regexSyncDebounceTimer = null;
      if (Date.now() < regexWriteCooldownUntil) {
        return;
      }
      void syncCharacterDarkRegexByHost()
        .then(wrote => {
          if (wrote) {
            regexWriteCooldownUntil = Date.now() + REGEX_WRITE_COOLDOWN_MS;
            refresh();
          }
        })
        .catch(err => deployMirrorLog('error', '[部署选择] 同步角色正则失败', err));
    }, REGEX_SYNC_DEBOUNCE_MS);
  };

  eventOn(tavern_events.CHARACTER_PAGE_LOADED, scheduleDebouncedRegexSync);
  eventOn(tavern_events.APP_READY, scheduleDebouncedRegexSync);
  eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, () => setTimeout(scanAll, 0));
  eventOn(tavern_events.USER_MESSAGE_RENDERED, () => setTimeout(scanAll, 0));
  eventOn(tavern_events.MORE_MESSAGES_LOADED, () => setTimeout(scanAll, 0));

  $(window).on('pagehide', () => {
    mo.disconnect();
    if (regexSyncDebounceTimer) {
      clearTimeout(regexSyncDebounceTimer);
      regexSyncDebounceTimer = null;
    }
  });
}

$(() => {
  void syncCharacterDarkRegexByHost()
    .then(wrote => {
      if (wrote) regexWriteCooldownUntil = Date.now() + REGEX_WRITE_COOLDOWN_MS;
    })
    .catch(err => deployMirrorLog('error', '[部署选择] 同步角色正则失败', err))
    .finally(() => {
      errorCatched(init)();
    });
});
