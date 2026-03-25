import { Globe, Sparkles, User, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type GalleryCountMap = Record<string, Record<string, number>>;
type AvatarPathMap = Record<string, string>;
type DataReadMode = 'current_message' | 'latest_message' | 'chat';
type ActionOption = {
  label: string;
  output?: string;
  icon?: string;
  color?: string;
  success_rate?: number;
};

function getActionIconGlyph(action: ActionOption): string {
  const icon = (action.icon || '').toLowerCase();
  const label = (action.label || '').toLowerCase();
  const output = (action.output || '').toLowerCase();
  const text = `${icon} ${label} ${output}`;
  if (text.includes('lightning') || text.includes('雷') || text.includes('突袭')) {
    return '⚡';
  }
  if (text.includes('shield') || text.includes('guard') || text.includes('防') || text.includes('护')) {
    return '🛡';
  }
  if (text.includes('sword') || text.includes('剑') || text.includes('斩') || text.includes('attack')) {
    return '⚔';
  }
  if (text.includes('gun') || text.includes('枪') || text.includes('射')) {
    return '✦';
  }
  if (text.includes('heal') || text.includes('回复') || text.includes('治疗')) {
    return '✚';
  }
  return '◆';
}

type ActionTone = 'attack' | 'guard' | 'mobility' | 'support' | 'neutral';

function getActionTone(action: ActionOption): ActionTone {
  const icon = (action.icon || '').toLowerCase();
  const label = (action.label || '').toLowerCase();
  const output = (action.output || '').toLowerCase();
  const text = `${icon} ${label} ${output}`;
  if (text.includes('shield') || text.includes('guard') || text.includes('防') || text.includes('护')) {
    return 'guard';
  }
  if (text.includes('heal') || text.includes('回复') || text.includes('治疗') || text.includes('恢复')) {
    return 'support';
  }
  if (
    text.includes('lightning') ||
    text.includes('雷') ||
    text.includes('突袭') ||
    text.includes('闪避') ||
    text.includes('位移')
  ) {
    return 'mobility';
  }
  if (
    text.includes('sword') ||
    text.includes('剑') ||
    text.includes('斩') ||
    text.includes('attack') ||
    text.includes('枪')
  ) {
    return 'attack';
  }
  return 'neutral';
}

/** DMC5 战斗风格：中文名、英文斜体、图标字母 */
const DMC_STYLES = [
  { cn: '剑圣', en: 'Swordmaster', icon: 'S' },
  { cn: '枪神', en: 'Gunslinger', icon: 'G' },
  { cn: '骗术师', en: 'Trickster', icon: 'T' },
  { cn: '皇家护卫', en: 'Royal Guard', icon: 'R' },
] as const;
// 每次发布改这里即可：齿轮 → 设置弹窗内可见
const UI_VERSION = 'V0.60';

function getStyleIcon(style: string): string {
  const s = String(style || '').trim();
  const found = DMC_STYLES.find(x => x.cn === s || (x.cn === '皇家护卫' && (s === '皇家护卫' || s === '皇家守卫')));
  return found?.icon ?? '';
}

function parseActionOptionsFromText(raw: string): ActionOption[] {
  const text = raw || '';
  const blocks = text
    .split(/\n(?=\s*(?:[-*]\s*)?(?:label|label:|label：|•\s*label))/i)
    .map(item => item.trim())
    .filter(Boolean);
  const result: ActionOption[] = [];
  for (const block of blocks) {
    const label = block.match(/label\s*[:：]\s*["“]?([^"\n”]+)["”]?/i)?.[1]?.trim() || '';
    const output = block.match(/output\s*[:：]\s*["“]?([^"\n”]+)["”]?/i)?.[1]?.trim() || '';
    const icon = block.match(/icon\s*[:：]\s*["“]?([^"\n”]+)["”]?/i)?.[1]?.trim();
    const color = block.match(/color\s*[:：]\s*["“]?([^"\n”]+)["”]?/i)?.[1]?.trim();
    const rateRaw = block.match(/success_rate\s*[:：]\s*([0-9]{1,3})/i)?.[1];
    const success_rate = rateRaw ? Number(rateRaw) : undefined;
    if (label) {
      result.push({
        label,
        output: output || label,
        icon: icon || 'ph-lightning',
        color: color || 'var(--gold)',
        success_rate,
      });
    }
  }
  return result;
}

function parseJsonObjectFromLooseText(raw: string): any | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  const direct = parseJson<any>(text, null as any);
  if (direct && typeof direct === 'object') {
    return direct;
  }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (!objMatch) {
    return null;
  }
  const parsed = parseJson<any>(objMatch[0], null as any);
  return parsed && typeof parsed === 'object' ? parsed : null;
}

function parseJsonArrayFromLooseText(raw: string): any[] {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const text = raw.trim();
  const direct = parseJson<any[]>(text, []);
  if (Array.isArray(direct) && direct.length > 0) {
    return direct;
  }
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (!arrMatch) {
    return [];
  }
  const parsed = parseJson<any[]>(arrMatch[0], []);
  return Array.isArray(parsed) ? parsed : [];
}

type DashboardSettings = {
  avatarBaseUrl: string;
  heroAvatarPath: string;
  companionAvatarPaths: AvatarPathMap;
  npcAvatarPaths: AvatarPathMap;
  randomNpcRules: Record<
    string,
    {
      avatar?: { path: string; count: number; ext?: string };
      veil?: { path?: string; statusCounts?: Record<string, number>; defaultCount?: number; ext?: string };
    }
  >;
  veilBaseUrl: string;
  galleryCounts: GalleryCountMap;
};

const SETTINGS_KEY = 'dark_dashboard_settings_v1';
/** 备份到聊天变量，换域名/端口后仍可从同一聊天恢复 */
const CHAT_UI_BACKUP_KEY = 'dark_dashboard_ui_backup_v1';
const SETTINGS_PASSWORD_KEY = 'dark_dashboard_settings_password_v1';
const DEFAULT_SETTINGS_PASSWORD = '000000';
const DATA_READ_MODE_KEY = 'dark_dashboard_data_read_mode_v1';

const defaultSettings: DashboardSettings = {
  avatarBaseUrl: '',
  heroAvatarPath: '',
  companionAvatarPaths: {},
  npcAvatarPaths: {},
  randomNpcRules: {},
  veilBaseUrl: '',
  galleryCounts: {},
};

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function loadDashboardBackupFromChat(): DashboardSettings | null {
  const g = globalThis as any;
  if (typeof g.getVariables !== 'function') {
    return null;
  }
  try {
    const chat = g.getVariables({ type: 'chat' }) || {};
    const raw = chat[CHAT_UI_BACKUP_KEY];
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    const parsed = parseJson<DashboardSettings>(raw, defaultSettings);
    return { ...defaultSettings, ...parsed };
  } catch {
    return null;
  }
}

function persistDashboardBackupToChat(data: DashboardSettings) {
  const g = globalThis as any;
  if (typeof g.getVariables !== 'function' || typeof g.replaceVariables !== 'function') {
    return;
  }
  try {
    const chat = g.getVariables({ type: 'chat' }) || {};
    chat[CHAT_UI_BACKUP_KEY] = JSON.stringify(data);
    g.replaceVariables(chat, { type: 'chat' });
  } catch (e) {
    console.warn('[Dark] 聊天变量备份界面配置失败', e);
  }
}

function getRuntimeMvuData<T>(
  fallback: T,
  mode: DataReadMode,
): { data: T; source: string; messageIdUsed: string | number } {
  const g = globalThis as any;
  const currentMessageId = typeof g.getCurrentMessageId === 'function' ? g.getCurrentMessageId() : 'latest';

  const hasDtGauge = (maybeData: any): boolean => {
    const hero = maybeData?.主角;
    if (!hero || typeof hero !== 'object') {
      return false;
    }
    // Prefer DT Gauge (string key contains space) and a few aliases for compatibility.
    return (
      Object.prototype.hasOwnProperty.call(hero, 'DT Gauge') ||
      Object.prototype.hasOwnProperty.call(hero, 'DTGauge') ||
      Object.prototype.hasOwnProperty.call(hero, 'DT_Gauge')
    );
  };

  const messageCandidates: Array<string | number> =
    mode === 'latest_message' ? ['latest', currentMessageId] : [currentMessageId, 'latest'];
  const preferChat = mode === 'chat';
  const tryChatFirst = () => {
    try {
      if (typeof g.getVariables === 'function') {
        const chatVars = g.getVariables({ type: 'chat' });
        if (chatVars && typeof chatVars === 'object') {
          if (chatVars.stat_data && typeof chatVars.stat_data === 'object') {
            return { data: chatVars.stat_data as T, source: 'getVariables(chat).stat_data', messageIdUsed: 'chat' };
          }
          if (chatVars.mvu && typeof chatVars.mvu === 'object') {
            return { data: chatVars.mvu as T, source: 'getVariables(chat).mvu', messageIdUsed: 'chat' };
          }
          return { data: chatVars as T, source: 'getVariables(chat)', messageIdUsed: 'chat' };
        }
      }
    } catch (error) {
      console.warn('[Dark] getVariables({type: "chat"}) failed.', error);
    }
    return null;
  };
  if (preferChat) {
    const chatResult = tryChatFirst();
    if (chatResult) {
      return chatResult;
    }
  }
  try {
    if (g.Mvu && typeof g.Mvu.getMvuData === 'function') {
      let firstNonEmpty: null | { data: T; source: string; messageIdUsed: string | number } = null;
      for (const messageId of messageCandidates) {
        const mvuData = g.Mvu.getMvuData({ type: 'message', message_id: messageId });
        if (mvuData && typeof mvuData === 'object' && Object.keys(mvuData).length > 0) {
          const statData = (mvuData as any).stat_data;
          const candidateData = statData && typeof statData === 'object' ? (statData as T) : (mvuData as T);
          const candidateSource =
            statData && typeof statData === 'object'
              ? `Mvu.getMvuData(message.${String(messageId)}).stat_data`
              : `Mvu.getMvuData(message.${String(messageId)})`;

          if (hasDtGauge(candidateData)) {
            return {
              data: candidateData,
              source: candidateSource,
              messageIdUsed: messageId,
            };
          }

          if (!firstNonEmpty) {
            firstNonEmpty = {
              data: candidateData,
              source: candidateSource,
              messageIdUsed: messageId,
            };
          }
        }
      }
      if (firstNonEmpty) {
        return firstNonEmpty;
      }
    }
  } catch (error) {
    console.warn('[Dark] Mvu.getMvuData failed, trying fallback sources.', error);
  }
  try {
    if (typeof g.getVariables === 'function') {
      let firstNonEmpty: null | { data: T; source: string; messageIdUsed: string | number } = null;
      for (const messageId of messageCandidates) {
        const messageVars = g.getVariables({ type: 'message', message_id: messageId });
        if (messageVars && typeof messageVars === 'object') {
          if (messageVars.stat_data && typeof messageVars.stat_data === 'object') {
            const candidateData = messageVars.stat_data as T;
            if (hasDtGauge(candidateData)) {
              return {
                data: candidateData,
                source: `getVariables(message.${String(messageId)}).stat_data`,
                messageIdUsed: messageId,
              };
            }
            if (!firstNonEmpty) {
              firstNonEmpty = {
                data: candidateData,
                source: `getVariables(message.${String(messageId)}).stat_data`,
                messageIdUsed: messageId,
              };
            }
          }
          if (messageVars.mvu && typeof messageVars.mvu === 'object') {
            const candidateData = messageVars.mvu as T;
            if (hasDtGauge(candidateData)) {
              return {
                data: candidateData,
                source: `getVariables(message.${String(messageId)}).mvu`,
                messageIdUsed: messageId,
              };
            }
            if (!firstNonEmpty) {
              firstNonEmpty = {
                data: candidateData,
                source: `getVariables(message.${String(messageId)}).mvu`,
                messageIdUsed: messageId,
              };
            }
          }
        }
      }
      if (firstNonEmpty) {
        return firstNonEmpty;
      }
    }
  } catch (error) {
    console.warn('[Dark] getVariables({type: "message"}) failed, trying chat.', error);
  }
  try {
    if (typeof g.getVariables === 'function') {
      const chatVars = g.getVariables({ type: 'chat' });
      if (chatVars && typeof chatVars === 'object') {
        if (chatVars.stat_data && typeof chatVars.stat_data === 'object') {
          return { data: chatVars.stat_data as T, source: 'getVariables(chat).stat_data', messageIdUsed: 'chat' };
        }
        if (chatVars.mvu && typeof chatVars.mvu === 'object') {
          return { data: chatVars.mvu as T, source: 'getVariables(chat).mvu', messageIdUsed: 'chat' };
        }
        return { data: chatVars as T, source: 'getVariables(chat)', messageIdUsed: 'chat' };
      }
    }
  } catch (error) {
    console.warn('[Dark] getVariables({type: "chat"}) failed, using fallback.', error);
  }
  return { data: fallback, source: 'fallback(defaultMvuData)', messageIdUsed: 'fallback' };
}

function mergeMvuData(defaultData: any, runtimeData: any) {
  const merged = {
    ...defaultData,
    ...(runtimeData || {}),
  };
  merged.世界 = { ...defaultData.世界, ...(runtimeData?.世界 || {}) };
  merged.主角 = { ...defaultData.主角, ...(runtimeData?.主角 || {}) };
  merged.主角.生命值 = { ...defaultData.主角.生命值, ...(runtimeData?.主角?.生命值 || {}) };
  merged.主角.魔力值 = { ...defaultData.主角.魔力值, ...(runtimeData?.主角?.魔力值 || {}) };
  merged.主角.核心属性 = { ...defaultData.主角.核心属性, ...(runtimeData?.主角?.核心属性 || {}) };
  merged.主角.装备栏 = { ...defaultData.主角.装备栏, ...(runtimeData?.主角?.装备栏 || {}) };
  merged.追随者与猎物 = runtimeData?.追随者与猎物 || defaultData.追随者与猎物;
  merged.当前互动角色 = runtimeData?.当前互动角色 || defaultData.当前互动角色;
  merged.暗夜面纱 = { ...defaultData.暗夜面纱, ...(runtimeData?.暗夜面纱 || {}) };
  merged.暗夜面纱.图库计数 = runtimeData?.暗夜面纱?.图库计数 || defaultData.暗夜面纱.图库计数;
  return merged;
}

function sanitizeRuntimeData(input: any) {
  const data = input && typeof input === 'object' ? { ...input } : {};
  // Tolerate malformed keys occasionally produced by manual edits.
  // Always keep canonical keys and drop malformed duplicates.
  if (data['世界"']) {
    if (!data.世界) {
      data.世界 = data['世界"'];
    }
    delete data['世界"'];
  }
  if (Object.prototype.hasOwnProperty.call(data, '')) {
    if (!data.主角) {
      data.主角 = data[''];
    }
    delete data[''];
  }
  if (!data.专属角色资源映射 && data.npcAvatarPaths) {
    data.专属角色资源映射 = data.npcAvatarPaths;
  }
  if (!data.随机NPC资源规则 && data.randomNpcRules) {
    data.随机NPC资源规则 = data.randomNpcRules;
  }
  return data;
}

function getChatFallbackData() {
  const g = globalThis as any;
  try {
    if (typeof g.getVariables === 'function') {
      const chatVars = g.getVariables({ type: 'chat' });
      if (chatVars?.stat_data && typeof chatVars.stat_data === 'object') {
        return chatVars.stat_data;
      }
      if (chatVars && typeof chatVars === 'object') {
        return chatVars;
      }
    }
  } catch (error) {
    console.warn('[Dark] getChatFallbackData failed', error);
  }
  return {};
}

function getDualSourceSnapshot() {
  const g = globalThis as any;
  const currentMessageId = typeof g.getCurrentMessageId === 'function' ? g.getCurrentMessageId() : 'latest';
  const readMessage = (messageId: string | number) => {
    try {
      if (g.Mvu && typeof g.Mvu.getMvuData === 'function') {
        const m = g.Mvu.getMvuData({ type: 'message', message_id: messageId }) || {};
        return sanitizeRuntimeData((m as any).stat_data || m);
      }
      if (typeof g.getVariables === 'function') {
        const v = g.getVariables({ type: 'message', message_id: messageId }) || {};
        return sanitizeRuntimeData(v.stat_data || v.mvu || v);
      }
    } catch (error) {
      console.warn('[Dark] readMessage snapshot failed', messageId, error);
    }
    return {};
  };
  const readChat = () => {
    try {
      if (typeof g.getVariables === 'function') {
        const v = g.getVariables({ type: 'chat' }) || {};
        return sanitizeRuntimeData(v.stat_data || v.mvu || v);
      }
    } catch (error) {
      console.warn('[Dark] readChat snapshot failed', error);
    }
    return {};
  };
  const currentData = readMessage(currentMessageId);
  const latestData = readMessage('latest');
  const chatData = readChat();
  return {
    currentMessageId,
    messageCurrent: {
      当前互动角色键: Object.keys((currentData as any)?.当前互动角色 || {}),
      追随者与猎物键: Object.keys((currentData as any)?.追随者与猎物 || {}),
      行动预判选项数: Array.isArray((currentData as any)?.行动预判?.选项)
        ? (currentData as any).行动预判.选项.length
        : 0,
    },
    messageLatest: {
      当前互动角色键: Object.keys((latestData as any)?.当前互动角色 || {}),
      追随者与猎物键: Object.keys((latestData as any)?.追随者与猎物 || {}),
      行动预判选项数: Array.isArray((latestData as any)?.行动预判?.选项) ? (latestData as any).行动预判.选项.length : 0,
    },
    chat: {
      当前互动角色键: Object.keys((chatData as any)?.当前互动角色 || {}),
      追随者与猎物键: Object.keys((chatData as any)?.追随者与猎物 || {}),
      行动预判选项数: Array.isArray((chatData as any)?.行动预判?.选项) ? (chatData as any).行动预判.选项.length : 0,
    },
  };
}

function hasRuntimeBridge() {
  const g = globalThis as any;
  const hasMvu = !!(g.Mvu && typeof g.Mvu.getMvuData === 'function');
  const hasVars = typeof g.getVariables === 'function';
  const hasReplace =
    typeof g.replaceVariables === 'function' || !!(g.Mvu && typeof g.Mvu.replaceMvuData === 'function');
  return { hasMvu, hasVars, hasReplace };
}

async function waitRuntimeBridge(timeoutMs = 10000, stepMs = 200) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = hasRuntimeBridge();
    if ((status.hasMvu || status.hasVars) && status.hasReplace) {
      return { ready: true, status };
    }
    await new Promise(resolve => setTimeout(resolve, stepMs));
  }
  return { ready: false, status: hasRuntimeBridge() };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('hero');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState('');
  const [veilModalError, setVeilModalError] = useState('');
  const [selectedCompanionIndex, setSelectedCompanionIndex] = useState(0);
  const [selectedEncounterIndex, setSelectedEncounterIndex] = useState(0);
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [normalizationStatus, setNormalizationStatus] = useState('未执行');
  const [bridgeStatusText, setBridgeStatusText] = useState('检测中');
  const [bridgeReady, setBridgeReady] = useState(false);
  const [dataReadMode, setDataReadMode] = useState<DataReadMode>(() => {
    const raw = localStorage.getItem(DATA_READ_MODE_KEY);
    if (raw === 'latest_message' || raw === 'chat' || raw === 'current_message') {
      return raw;
    }
    return 'current_message';
  });
  const [actionInitStatus, setActionInitStatus] = useState('未执行');
  const [dualSourceSnapshot, setDualSourceSnapshot] = useState<any>({});
  const [hasManjinTransformed, setHasManjinTransformed] = useState(false);
  const [styleSelectorOpen, setStyleSelectorOpen] = useState(false);

  // Fallback action when runtime data does not provide action prediction.
  const fallbackActions: ActionOption[] = [
    { label: '现在可自由行动', output: '现在可自由行动', icon: 'ph-lightning', color: 'var(--gold)' },
  ];

  const defaultMvuData = {
    世界: {
      当前日期: '大陆历元年1月1日',
      当前位置: '柳叶镇·住宅区',
      环境状态: '安全区',
      魔物活跃度: '平静',
      当前状态总结: '你目前位于柳叶镇·住宅区，环境安全，DT Gauge 充足。',
    },
    主角: {
      姓名: 'Emiya',
      生命值: { 当前: 100, 上限: 100 },
      魔力值: { 当前: 100, 上限: 100 },
      'DT Gauge': 0,
      核心属性: { 力量: 10, 敏捷: 10, 体质: 10, 魔力: 10, 魅力: 10 },
      战斗风格: '剑圣',
      装备栏: { 近战武器: '叛逆之刃', 远程武器: '黑檀木与白象牙', 特殊装备: '无' } as Record<string, string>,
      行动预判: '现在可自由行动',
    },
    追随者与猎物: {
      莉莉丝: {
        种族: '魅魔',
        年龄: 160,
        身份: '签订了主仆契约的下级恶魔',
        生命值: { 当前: 80, 上限: 80 },
        状态: '口交',
        好感度: 85,
        服从度: 70,
        私密数据: {
          三围: 'B98 W58 H92 (G杯)',
          敏感度: 90,
          情欲值: 95,
          开发阶段: '初步调教',
        },
        战斗定位: '辅助',
        专属特质: '魔力饥渴',
      },
    } as Record<string, any>,
    当前互动角色: {} as Record<string, any>,
    背包: {
      金币: 0,
      物品列表: {} as Record<string, any>,
    },
    暗夜面纱: {
      基础URL: '',
      图库计数: {} as GalleryCountMap,
    },
  };
  const runtime = getRuntimeMvuData(defaultMvuData, dataReadMode);
  const sanitizedRuntimeData = sanitizeRuntimeData(runtime.data);
  const chatFallbackData = sanitizeRuntimeData(getChatFallbackData());
  const mergedRuntimeForDisplay = {
    ...sanitizedRuntimeData,
    当前互动角色:
      Object.keys(sanitizedRuntimeData?.当前互动角色 || {}).length > 0
        ? sanitizedRuntimeData.当前互动角色
        : chatFallbackData?.当前互动角色 || {},
    追随者与猎物:
      Object.keys(sanitizedRuntimeData?.追随者与猎物 || {}).length > 0
        ? sanitizedRuntimeData.追随者与猎物
        : chatFallbackData?.追随者与猎物 || {},
  };
  const mvuData: any = mergeMvuData(defaultMvuData, mergedRuntimeForDisplay);
  const needsNormalization =
    !!runtime.data &&
    typeof runtime.data === 'object' &&
    (Object.prototype.hasOwnProperty.call(runtime.data, '世界"') ||
      Object.prototype.hasOwnProperty.call(runtime.data, ''));

  useEffect(() => {
    const s = hasRuntimeBridge();
    const ready = (s.hasMvu || s.hasVars) && s.hasReplace;
    setBridgeReady(ready);
    setBridgeStatusText(
      `Mvu:${s.hasMvu ? 'Y' : 'N'} getVariables:${s.hasVars ? 'Y' : 'N'} writer:${s.hasReplace ? 'Y' : 'N'}`,
    );
    setDualSourceSnapshot(getDualSourceSnapshot());
  }, []);

  // 换域名/端口后 localStorage 为空时，从聊天变量恢复完整界面配置（需曾点过「保存设置」写入备份）
  useEffect(() => {
    if (localStorage.getItem(SETTINGS_KEY)) {
      return;
    }
    const run = async () => {
      const bridge = await waitRuntimeBridge(12000, 250);
      if (!bridge.ready) {
        return;
      }
      const fromChat = loadDashboardBackupFromChat();
      if (!fromChat) {
        return;
      }
      setSettings(fromChat);
      setCompanionAvatarText(JSON.stringify(fromChat.companionAvatarPaths, null, 2));
      setNpcAvatarText(JSON.stringify(fromChat.npcAvatarPaths, null, 2));
      setRandomNpcRuleText(JSON.stringify(fromChat.randomNpcRules, null, 2));
      setGalleryCountText(JSON.stringify(fromChat.galleryCounts, null, 2));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(fromChat));
      console.info('[Dark] 已从聊天变量恢复界面配置');
    };
    void run();
  }, []);

  useEffect(() => {
    if (!needsNormalization) {
      setNormalizationStatus('无需清洗');
      return;
    }
    const run = async () => {
      try {
        const bridge = await waitRuntimeBridge(12000, 250);
        setBridgeReady(bridge.ready);
        setBridgeStatusText(
          `Mvu:${bridge.status.hasMvu ? 'Y' : 'N'} getVariables:${bridge.status.hasVars ? 'Y' : 'N'} writer:${bridge.status.hasReplace ? 'Y' : 'N'}`,
        );
        if (!bridge.ready) {
          setNormalizationStatus('检测到脏键，但桥接接口未就绪');
          return;
        }
        const g = globalThis as any;
        // Prefer MVU API when available.
        if (g.Mvu && typeof g.Mvu.replaceMvuData === 'function') {
          await g.Mvu.replaceMvuData(sanitizedRuntimeData, { type: 'message', message_id: 'latest' });
          setNormalizationStatus('已通过 Mvu.replaceMvuData 清洗并回写');
          return;
        }
        if (typeof g.getVariables === 'function' && typeof g.replaceVariables === 'function') {
          const messageVars = g.getVariables({ type: 'message', message_id: 'latest' }) || {};
          messageVars.stat_data = sanitizedRuntimeData;
          g.replaceVariables(messageVars, { type: 'message', message_id: 'latest' });
          setNormalizationStatus('已通过 replaceVariables 清洗并回写');
          return;
        }
        setNormalizationStatus('检测到脏键，但无可用回写接口');
      } catch (error) {
        console.error('[Dark] failed to normalize stat_data', error);
        setNormalizationStatus('清洗失败，请看控制台');
      }
    };
    void run();
  }, [needsNormalization, sanitizedRuntimeData]);

  const retryRuntimeBridge = async () => {
    setBridgeStatusText('重试检测中...');
    const bridge = await waitRuntimeBridge(12000, 250);
    setBridgeReady(bridge.ready);
    setBridgeStatusText(
      `Mvu:${bridge.status.hasMvu ? 'Y' : 'N'} getVariables:${bridge.status.hasVars ? 'Y' : 'N'} writer:${bridge.status.hasReplace ? 'Y' : 'N'}`,
    );
    setDualSourceSnapshot(getDualSourceSnapshot());
  };

  const [settings, setSettings] = useState<DashboardSettings>(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        ...defaultSettings,
        veilBaseUrl: mvuData.暗夜面纱.基础URL || '',
        galleryCounts: mvuData.暗夜面纱.图库计数 || {},
      };
    }
    return { ...defaultSettings, ...parseJson<DashboardSettings>(raw, defaultSettings) };
  });
  const [companionAvatarText, setCompanionAvatarText] = useState(
    JSON.stringify(settings.companionAvatarPaths, null, 2),
  );
  const [npcAvatarText, setNpcAvatarText] = useState(JSON.stringify(settings.npcAvatarPaths, null, 2));
  const [randomNpcRuleText, setRandomNpcRuleText] = useState(JSON.stringify(settings.randomNpcRules, null, 2));
  const [galleryCountText, setGalleryCountText] = useState(JSON.stringify(settings.galleryCounts, null, 2));
  const [quickNpcName, setQuickNpcName] = useState('');
  const [quickNpcStatus, setQuickNpcStatus] = useState('');
  const [quickNpcCount, setQuickNpcCount] = useState('1');
  const [quickRandomGender, setQuickRandomGender] = useState('*');
  const [quickRandomJob, setQuickRandomJob] = useState('*');
  const [quickRandomRace, setQuickRandomRace] = useState('*');
  const [quickRandomAvatarCount, setQuickRandomAvatarCount] = useState('1');
  const [quickRandomStatusName, setQuickRandomStatusName] = useState('');
  const [quickRandomStatusCount, setQuickRandomStatusCount] = useState('1');

  const hero = {
    name: mvuData.主角.姓名,
    style: mvuData.主角.战斗风格,
    hpCurrent: mvuData.主角.生命值.当前,
    hpMax: mvuData.主角.生命值.上限,
    mpCurrent: mvuData.主角.魔力值.当前,
    mpMax: mvuData.主角.魔力值.上限,
    // 优先读取新字段：DT Gauge；兼容旧字段：行动力
    dtGauge:
      mvuData?.主角?.['DT Gauge'] ??
      (mvuData?.主角 as any)?.DTGauge ??
      (mvuData?.主角 as any)?.DT_Gauge ??
      mvuData?.主角?.行动力,
    stats: Object.entries(mvuData.主角.核心属性),
    equipments: Object.entries(mvuData.主角.装备栏),
  };

  const hpPercent = hero.hpMax > 0 ? Math.round((hero.hpCurrent / hero.hpMax) * 100) : 0;
  const mpPercent = hero.mpMax > 0 ? Math.round((hero.mpCurrent / hero.mpMax) * 100) : 0;
  const dtRaw = Number(hero.dtGauge);
  const dtCurrent = Number.isFinite(dtRaw) ? Math.max(0, Math.min(100, Math.round(dtRaw))) : 0;
  const dtPercent = Math.round((dtCurrent / 100) * 100);

  useEffect(() => {
    // 当 DT 未满时，允许再次显示“魔人化”按钮
    if (dtCurrent < 100 && hasManjinTransformed) {
      setHasManjinTransformed(false);
    }
  }, [dtCurrent, hasManjinTransformed]);

  const followersNode =
    typeof mvuData.追随者与猎物 === 'string'
      ? parseJsonObjectFromLooseText(mvuData.追随者与猎物) || {}
      : mvuData.追随者与猎物 || {};
  const encountersNode =
    typeof mvuData.当前互动角色 === 'string'
      ? parseJsonObjectFromLooseText(mvuData.当前互动角色) || {}
      : mvuData.当前互动角色 || {};

  const companions = useMemo(
    () =>
      Object.entries(followersNode).map(([name, value]: [string, any]) => ({
        name,
        race: value.种族,
        gender: value.性别 || '',
        job: value.职业 || '',
        identity: value.身份 || '',
        role: value.战斗定位,
        status: value.状态,
        love: value.好感度,
        obedience: value.服从度,
        trait: value.专属特质,
        private: value.私密数据,
      })),
    [followersNode],
  );

  const encounters = useMemo(
    () =>
      Object.entries(encountersNode).map(([name, value]: [string, any]) => ({
        name,
        race: value.种族,
        gender: value.性别 || '',
        job: value.职业 || '',
        identity: value.身份 || '',
        status: value.状态,
        obedience: value.服从度,
        private: value.私密数据,
      })),
    [encountersNode],
  );

  const companion = companions[selectedCompanionIndex];
  const selectedEncounter = encounters[selectedEncounterIndex];
  const exclusiveAvatarMap: AvatarPathMap =
    Object.keys(settings.npcAvatarPaths || {}).length > 0
      ? settings.npcAvatarPaths
      : (((mvuData as any).专属角色资源映射 || {}) as AvatarPathMap);
  const runtimeRandomRules: DashboardSettings['randomNpcRules'] =
    Object.keys(settings.randomNpcRules || {}).length > 0
      ? settings.randomNpcRules
      : (((mvuData as any).随机NPC资源规则 || {}) as DashboardSettings['randomNpcRules']);

  const getEffectiveVeilBaseUrl = () => (settings.veilBaseUrl || (mvuData as any)?.暗夜面纱?.基础URL || '').trim();

  const closeVeilModal = () => {
    setIsModalOpen(false);
    setModalImage('');
    setVeilModalError('');
  };

  const toReadableUrl = (raw: string) => {
    if (!raw) return '';
    try {
      return decodeURI(raw);
    } catch {
      return raw;
    }
  };

  const openVeilErrorModal = (message: string, url?: string) => {
    const detail = url ? `\n图片地址：${toReadableUrl(url)}` : '';
    setModalImage('');
    setVeilModalError(`${message}${detail}`);
    setIsModalOpen(true);
  };

  const openModal = (imgUrl: string) => {
    setVeilModalError('');
    setModalImage(imgUrl);
    setIsModalOpen(true);
  };

  const notifyVeil = (msg: string) => {
    console.warn('[Dark][暗夜面纱]', msg);
    openVeilErrorModal(msg);
  };

  const buildRemoteUrl = (baseUrl: string, ...segments: string[]) => {
    if (!baseUrl) {
      return '';
    }
    const trimmed = baseUrl.replace(/\/+$/, '');
    const path = segments
      .filter(Boolean)
      .map(s => encodeURIComponent(s))
      .join('/');
    return `${trimmed}/${path}`;
  };
  const randomAvatarCacheRef = useRef<Record<string, string>>({});

  const matchRandomRule = (profile: { gender?: string; job?: string; race?: string }) => {
    const rules = runtimeRandomRules || {};
    for (const [ruleKey, ruleValue] of Object.entries(rules)) {
      const [g, j, r] = ruleKey.split('|').map(item => (item || '*').trim());
      const gMatch = g === '*' || g === '' || g === (profile.gender || '');
      const jMatch = j === '*' || j === '' || j === (profile.job || '');
      const rMatch = r === '*' || r === '' || r === (profile.race || '');
      if (gMatch && jMatch && rMatch) {
        return ruleValue;
      }
    }
    return undefined;
  };
  const matchRandomRuleWithKey = (profile: { gender?: string; job?: string; race?: string }) => {
    const rules = runtimeRandomRules || {};
    for (const [ruleKey, ruleValue] of Object.entries(rules)) {
      const [g, j, r] = ruleKey.split('|').map(item => (item || '*').trim());
      const gMatch = g === '*' || g === '' || g === (profile.gender || '');
      const jMatch = j === '*' || j === '' || j === (profile.job || '');
      const rMatch = r === '*' || r === '' || r === (profile.race || '');
      if (gMatch && jMatch && rMatch) {
        return { key: ruleKey, rule: ruleValue };
      }
    }
    return undefined;
  };

  const pickRuleAvatar = (name: string, profile: { gender?: string; job?: string; race?: string }) => {
    const cacheKey = `${name}|${profile.gender || ''}|${profile.job || ''}|${profile.race || ''}`;
    if (randomAvatarCacheRef.current[cacheKey]) {
      return randomAvatarCacheRef.current[cacheKey];
    }
    const rule = matchRandomRule(profile);
    const avatarRule = rule?.avatar;
    if (!avatarRule?.path || !avatarRule?.count) {
      return '';
    }
    const total = Math.max(1, Number(avatarRule.count));
    const picked = Math.floor(Math.random() * total) + 1;
    const ext = avatarRule.ext || 'png';
    const url = buildRemoteUrl(settings.avatarBaseUrl, avatarRule.path, `${picked}.${ext}`);
    randomAvatarCacheRef.current[cacheKey] = url;
    return url;
  };

  const getAvatarMatchChain = (
    name: string,
    profile?: { gender?: string; job?: string; race?: string },
    allowCompanionMap = false,
  ) => {
    if (exclusiveAvatarMap[name]) {
      return `固定NPC映射命中(${name})`;
    }
    if (allowCompanionMap && settings.companionAvatarPaths[name]) {
      return `队友映射命中(${name})`;
    }
    const matched = matchRandomRuleWithKey(profile || {});
    if (matched?.key) {
      return `随机规则命中(${matched.key})`;
    }
    return '默认回退(按姓名文件)';
  };

  const getVeilMatchChain = (
    name: string,
    status: string,
    profile?: { gender?: string; job?: string; race?: string },
  ) => {
    if (Number(settings.galleryCounts[name]?.[status] ?? 0) > 0) {
      return `固定图库命中(${name}/${status})`;
    }
    const matched = matchRandomRuleWithKey(profile || {});
    if (matched?.rule?.veil) {
      return `随机规则命中(${matched.key})`;
    }
    return '默认回退(按姓名/状态路径)';
  };

  const heroAvatar = settings.heroAvatarPath
    ? buildRemoteUrl(settings.avatarBaseUrl, settings.heroAvatarPath)
    : buildRemoteUrl(settings.avatarBaseUrl, `${hero.name}.png`);

  const getCompanionAvatar = (name: string, profile?: { gender?: string; job?: string; race?: string }) => {
    const npcPath = exclusiveAvatarMap[name];
    if (npcPath) {
      return buildRemoteUrl(settings.avatarBaseUrl, npcPath);
    }
    const customPath = settings.companionAvatarPaths[name];
    if (customPath) {
      return buildRemoteUrl(settings.avatarBaseUrl, customPath);
    }
    const randomByRule = pickRuleAvatar(name, profile || {});
    if (randomByRule) {
      return randomByRule;
    }
    return buildRemoteUrl(settings.avatarBaseUrl, `${name}.png`);
  };

  const getNpcAvatar = (name: string, profile?: { gender?: string; job?: string; race?: string }) => {
    const npcPath = exclusiveAvatarMap[name];
    if (npcPath) {
      return buildRemoteUrl(settings.avatarBaseUrl, npcPath);
    }
    const randomByRule = pickRuleAvatar(name, profile || {});
    if (randomByRule) {
      return randomByRule;
    }
    return buildRemoteUrl(settings.avatarBaseUrl, `${name}.png`);
  };

  const getRandomVeilImage = (
    name: string,
    status: string,
    profile?: { gender?: string; job?: string; race?: string },
  ) => {
    const veilBase = getEffectiveVeilBaseUrl();
    const directTotal = Number(settings.galleryCounts[name]?.[status] ?? 0);
    if (directTotal > 0) {
      const picked = Math.floor(Math.random() * directTotal) + 1;
      return buildRemoteUrl(veilBase, name, status, `${picked}.png`);
    }
    const rule = matchRandomRule(profile || {});
    const veilRule = rule?.veil;
    if (veilRule) {
      const total = Math.max(1, Number(veilRule.statusCounts?.[status] ?? veilRule.defaultCount ?? 1));
      const picked = Math.floor(Math.random() * total) + 1;
      const ext = veilRule.ext || 'png';
      const basePath = veilRule.path || '';
      return buildRemoteUrl(veilBase, basePath, status, `${picked}.${ext}`);
    }
    const fallback = 1;
    const picked = Math.floor(Math.random() * fallback) + 1;
    return buildRemoteUrl(veilBase, name, status, `${picked}.png`);
  };

  const saveSettings = () => {
    const nextCompanionMap = parseJson<AvatarPathMap>(companionAvatarText, {});
    const nextNpcMap = parseJson<AvatarPathMap>(npcAvatarText, {});
    const nextRandomRules = parseJson<DashboardSettings['randomNpcRules']>(randomNpcRuleText, {});
    const nextGalleryCounts = parseJson<GalleryCountMap>(galleryCountText, {});
    const nextSettings: DashboardSettings = {
      ...settings,
      companionAvatarPaths: nextCompanionMap,
      npcAvatarPaths: nextNpcMap,
      randomNpcRules: nextRandomRules,
      galleryCounts: nextGalleryCounts,
    };
    setSettings(nextSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    persistDashboardBackupToChat(nextSettings);
    setIsSettingsOpen(false);
  };

  const addQuickGalleryRule = () => {
    const npcName = quickNpcName.trim();
    const npcStatus = quickNpcStatus.trim();
    const count = Math.max(1, Number(quickNpcCount) || 1);
    if (!npcName || !npcStatus) {
      return;
    }
    const parsed = parseJson<GalleryCountMap>(galleryCountText, {});
    parsed[npcName] = parsed[npcName] || {};
    parsed[npcName][npcStatus] = count;
    setGalleryCountText(JSON.stringify(parsed, null, 2));
    setQuickNpcCount('1');
  };

  const addQuickRandomRule = () => {
    const gender = quickRandomGender.trim() || '*';
    const job = quickRandomJob.trim() || '*';
    const race = quickRandomRace.trim() || '*';
    const avatarCount = Math.max(1, Number(quickRandomAvatarCount) || 1);
    const key = `${gender}|${job}|${race}`;
    const parsed = parseJson<DashboardSettings['randomNpcRules']>(randomNpcRuleText, {});
    const safePathPart = (value: string) => (value.trim() || '*').replace(/[\\/:*?"<>|]/g, '_');
    const autoPath = `${safePathPart(gender)}/${safePathPart(job)}/${safePathPart(race)}`;
    const oldRule = parsed[key] || {};
    const nextRule: NonNullable<DashboardSettings['randomNpcRules'][string]> = {
      ...oldRule,
      avatar: {
        path: oldRule.avatar?.path || autoPath,
        count: avatarCount,
        ext: oldRule.avatar?.ext || 'png',
      },
      veil: {
        path: oldRule.veil?.path || autoPath,
        statusCounts: { ...(oldRule.veil?.statusCounts || {}) },
        defaultCount: avatarCount,
        ext: oldRule.veil?.ext || 'png',
      },
    };
    const statusName = quickRandomStatusName.trim();
    if (statusName) {
      nextRule.veil = {
        ...(nextRule.veil || {}),
        statusCounts: {
          ...(nextRule.veil?.statusCounts || {}),
          [statusName]: Math.max(1, Number(quickRandomStatusCount) || 1),
        },
      };
    }
    parsed[key] = nextRule;
    setRandomNpcRuleText(JSON.stringify(parsed, null, 2));
  };
  const quickRandomPreview = (() => {
    const safePathPart = (value: string) => (value.trim() || '*').replace(/[\\/:*?"<>|]/g, '_');
    const gender = safePathPart(quickRandomGender);
    const job = safePathPart(quickRandomJob);
    const race = safePathPart(quickRandomRace);
    const status = safePathPart(quickRandomStatusName || '日常');
    const buildReadableUrl = (baseUrl: string, ...segments: string[]) => {
      if (!baseUrl) {
        return '';
      }
      const trimmed = baseUrl.replace(/\/+$/, '');
      const path = segments.filter(Boolean).join('/');
      return `${trimmed}/${path}`;
    };
    const avatar = buildReadableUrl(settings.avatarBaseUrl, gender, job, race, '1.png');
    const veil = buildReadableUrl(getEffectiveVeilBaseUrl(), gender, job, race, status, '1.png');
    return { avatar, veil };
  })();

  const getCurrentPassword = () => localStorage.getItem(SETTINGS_PASSWORD_KEY) || DEFAULT_SETTINGS_PASSWORD;

  const unlockSettings = () => {
    const currentPassword = getCurrentPassword();
    if (passwordInput === currentPassword) {
      setIsSettingsUnlocked(true);
      setPasswordMessage('');
      setPasswordInput('');
      return;
    }
    setPasswordMessage('密码错误，请重试。');
  };

  const changePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMessage('新密码至少 6 位。');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('两次输入的新密码不一致。');
      return;
    }
    localStorage.setItem(SETTINGS_PASSWORD_KEY, newPassword);
    setPasswordMessage('密码已更新。');
    setNewPassword('');
    setConfirmPassword('');
  };

  const world = [
    { label: '当前日期', value: mvuData.世界.当前日期, icon: 'ph-calendar' },
    { label: '当前位置', value: mvuData.世界.当前位置, icon: 'ph-map-pin' },
    { label: '环境状态', value: mvuData.世界.环境状态, icon: 'ph-cloud-fog' },
    { label: '魔物活跃度', value: mvuData.世界.魔物活跃度, icon: 'ph-warning' },
  ];
  const heroActionNode = (mvuData as any)?.主角?.行动预判;
  const rawActionNode = Array.isArray(heroActionNode)
    ? heroActionNode
    : heroActionNode && typeof heroActionNode === 'object'
      ? (heroActionNode as any).选项 || heroActionNode
      : heroActionNode;
  const rawActionOptions = Array.isArray(rawActionNode)
    ? rawActionNode
    : rawActionNode && typeof rawActionNode === 'object'
      ? Object.values(rawActionNode)
      : [];
  const objectActions: ActionOption[] = rawActionOptions
    .map((item: any) => ({
      label: String(item?.label || item?.名称 || '').trim(),
      output: String(item?.output || item?.输出 || item?.label || item?.名称 || '').trim(),
      icon: String(item?.icon || 'ph-lightning'),
      color: String(item?.color || 'var(--gold)'),
      success_rate:
        typeof item?.success_rate === 'number'
          ? item.success_rate
          : typeof item?.成功率 === 'number'
            ? item.成功率
            : undefined,
    }))
    .filter(item => item.label.length > 0);
  const textActionSource =
    typeof rawActionNode === 'string' ? rawActionNode : typeof heroActionNode === 'string' ? heroActionNode : '';
  const arrayActionsFromText = textActionSource
    ? parseJsonArrayFromLooseText(textActionSource)
        .map((item: any) => ({
          label: String(item?.label || item?.名称 || '').trim(),
          output: String(item?.output || item?.输出 || item?.label || item?.名称 || '').trim(),
          icon: String(item?.icon || 'ph-lightning'),
          color: String(item?.color || 'var(--gold)'),
          success_rate:
            typeof item?.success_rate === 'number'
              ? item.success_rate
              : typeof item?.成功率 === 'number'
                ? item.成功率
                : undefined,
        }))
        .filter(item => item.label.length > 0)
    : [];
  const textActions = textActionSource ? parseActionOptionsFromText(textActionSource) : [];
  const singleActionFromObject: ActionOption[] =
    !Array.isArray(heroActionNode) && heroActionNode && typeof heroActionNode === 'object'
      ? (() => {
          const label = String(
            (heroActionNode as any).下一行动 ||
              (heroActionNode as any).行动目标 ||
              (heroActionNode as any).预判依据 ||
              '',
          ).trim();
          if (!label) {
            return [];
          }
          const rate = Number((heroActionNode as any).预计成功率);
          return [
            {
              label,
              output: label,
              icon: 'ph-lightning',
              color: 'var(--gold)',
              success_rate: Number.isFinite(rate) ? Math.max(0, Math.min(100, rate)) : undefined,
            },
          ];
        })()
      : [];
  const actions: ActionOption[] =
    objectActions.length > 0
      ? objectActions
      : arrayActionsFromText.length > 0
        ? arrayActionsFromText
        : textActions.length > 0
          ? textActions
          : singleActionFromObject;
  const actionsToRender = actions.length > 0 ? actions : fallbackActions;
  const actionFormatStatus =
    objectActions.length > 0
      ? '标准数组/对象格式'
      : arrayActionsFromText.length > 0
        ? '字符串中的JSON数组格式'
        : textActions.length > 0
          ? '文本兜底解析格式(建议改为标准数组)'
          : '未提供行动预判选项';

  useEffect(() => {
    const ensureActionData = async () => {
      if (actions.length > 0) {
        setActionInitStatus('已存在');
        return;
      }
      const bridge = await waitRuntimeBridge(8000, 200);
      if (!bridge.ready) {
        setActionInitStatus('桥接未就绪');
        return;
      }
      const g = globalThis as any;
      const defaultActionData = {
        主角: {
          行动预判: '现在可自由行动',
        },
      };
      try {
        if (g.Mvu && typeof g.Mvu.getMvuData === 'function' && typeof g.Mvu.replaceMvuData === 'function') {
          const currentMessageId = typeof g.getCurrentMessageId === 'function' ? g.getCurrentMessageId() : 'latest';
          const mvuData = g.Mvu.getMvuData({ type: 'message', message_id: currentMessageId }) || {};
          const statData = sanitizeRuntimeData((mvuData as any).stat_data || mvuData);
          if (!statData?.主角?.行动预判) {
            statData.主角 = { ...(statData.主角 || {}), ...defaultActionData.主角 };
            await g.Mvu.replaceMvuData(statData, { type: 'message', message_id: currentMessageId });
            setActionInitStatus('已自动写入默认行动预判');
            return;
          }
        }
        if (typeof g.getVariables === 'function' && typeof g.replaceVariables === 'function') {
          const messageVars = g.getVariables({ type: 'message', message_id: 'latest' }) || {};
          const statData = sanitizeRuntimeData(messageVars.stat_data || {});
          if (!statData?.主角?.行动预判) {
            statData.主角 = { ...(statData.主角 || {}), ...defaultActionData.主角 };
            messageVars.stat_data = statData;
            g.replaceVariables(messageVars, { type: 'message', message_id: 'latest' });
            setActionInitStatus('已通过变量接口写入默认行动预判');
            return;
          }
        }
        setActionInitStatus('无需写入');
      } catch (error) {
        console.error('[Dark] ensure action data failed', error);
        setActionInitStatus('写入失败');
      }
    };
    void ensureActionData();
  }, [actions.length]);

  const pushActionToTavern = (action: ActionOption) => {
    const content = (action.output || action.label || '').trim();
    if (!content) {
      return;
    }
    const g = globalThis as any;
    try {
      if (typeof g.triggerSlash === 'function') {
        g.triggerSlash(`/send ${content}`);
        setIsActionPanelOpen(false);
        return;
      }
    } catch (error) {
      console.warn('[Dark] triggerSlash send failed, fallback to textarea insert.', error);
    }
    const jq = g.$;
    if (typeof jq === 'function') {
      const input = jq('#send_textarea, textarea[name="send_textarea"], #send_text').first();
      if (input.length) {
        input.val(content).trigger('input').trigger('change');
        const sendBtn = jq('#send_but, #send-button, .mes_send').first();
        if (sendBtn.length) {
          sendBtn.trigger('click');
        }
        setIsActionPanelOpen(false);
        return;
      }
    }
    setIsActionPanelOpen(false);
  };
  const currentCompanionPreview = companion
    ? (() => {
        const matched = matchRandomRuleWithKey({
          gender: companion.gender,
          job: companion.job,
          race: companion.race,
        });
        return {
          名称: companion.name,
          属性: { 性别: companion.gender || '', 职业: companion.job || '', 种族: companion.race || '' },
          命中规则: matched?.key || '未命中',
          头像命中链路: getAvatarMatchChain(
            companion.name,
            {
              gender: companion.gender,
              job: companion.job,
              race: companion.race,
            },
            true,
          ),
          面纱命中链路: getVeilMatchChain(companion.name, companion.status, {
            gender: companion.gender,
            job: companion.job,
            race: companion.race,
          }),
          头像预览: getCompanionAvatar(companion.name, {
            gender: companion.gender,
            job: companion.job,
            race: companion.race,
          }),
          面纱示例: getRandomVeilImage(companion.name, companion.status, {
            gender: companion.gender,
            job: companion.job,
            race: companion.race,
          }),
        };
      })()
    : null;
  const currentEncounterPreview = selectedEncounter
    ? (() => {
        const target = selectedEncounter;
        const matched = matchRandomRuleWithKey({
          gender: target.gender,
          job: target.job,
          race: target.race,
        });
        return {
          名称: target.name,
          属性: { 性别: target.gender || '', 职业: target.job || '', 种族: target.race || '' },
          命中规则: matched?.key || '未命中',
          头像命中链路: getAvatarMatchChain(
            target.name,
            {
              gender: target.gender,
              job: target.job,
              race: target.race,
            },
            false,
          ),
          面纱命中链路: getVeilMatchChain(target.name, target.status, {
            gender: target.gender,
            job: target.job,
            race: target.race,
          }),
          头像预览: getNpcAvatar(target.name, {
            gender: target.gender,
            job: target.job,
            race: target.race,
          }),
          面纱示例: getRandomVeilImage(target.name, target.status, {
            gender: target.gender,
            job: target.job,
            race: target.race,
          }),
        };
      })()
    : null;

  return (
    <div className="dashboard" id="main-dashboard">
      {/* Header */}
      <header className="header">
        <div className="header-title">DARK FANTASY RPG</div>
        <div className="header-icons">
          {/* 纯 Unicode，不依赖字体/SVG，本地 iframe 与云酒馆均可见 */}
          <span className="header-icon-emoji-only" title="通知" role="img" aria-label="通知">
            🔔
          </span>
          <button
            type="button"
            className="header-icon-emoji-only header-settings-btn setting-gear"
            title="设置"
            aria-label="打开设置"
            onClick={() => {
              setIsSettingsOpen(true);
              setIsSettingsUnlocked(false);
              setPasswordMessage('');
              setPasswordInput('');
            }}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav">
        <div className={`nav-item ${activeTab === 'hero' ? 'active' : ''}`} onClick={() => setActiveTab('hero')}>
          <User size={20} strokeWidth={2} color="currentColor" aria-hidden />
          <span>主角</span>
        </div>
        <div
          className={`nav-item ${activeTab === 'companions' ? 'active pink' : ''}`}
          onClick={() => setActiveTab('companions')}
        >
          <Users size={20} strokeWidth={2} color="currentColor" aria-hidden />
          <span>队友</span>
        </div>
        <div
          className={`nav-item ${activeTab === 'encounters' ? 'active pink' : ''}`}
          onClick={() => setActiveTab('encounters')}
        >
          <Sparkles size={20} strokeWidth={2} color="currentColor" aria-hidden />
          <span>邂逅</span>
        </div>
        <div className={`nav-item ${activeTab === 'world' ? 'active' : ''}`} onClick={() => setActiveTab('world')}>
          <Globe size={20} strokeWidth={2} color="currentColor" aria-hidden />
          <span>世界</span>
        </div>
      </nav>

      {/* Content Area */}
      <main className="content">
        {/* Hero Tab */}
        <div className={`tab-content ${activeTab === 'hero' ? 'active' : ''}`} style={{ width: '100%' }}>
          <div style={{ width: '100%' }}>
            <div className="hero-profile">
              <button
                type="button"
                className="btn-style-switcher"
                onClick={() => setStyleSelectorOpen(true)}
                title="切换战斗风格"
                aria-label="切换战斗风格"
              >
                <span className="style-switcher-icon">{getStyleIcon(hero.style) || '?'}</span>
              </button>
              <div className="hero-avatar">
                {heroAvatar ? (
                  <img src={heroAvatar} alt="Hero" referrerPolicy="no-referrer" />
                ) : (
                  <img
                    src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200"
                    alt="Hero"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <div className="hero-info">
                <h2>{hero.name}</h2>
                <div className="hero-style-row">
                  <span className="hero-tag">{hero.style}</span>
                  {getStyleIcon(hero.style) && (
                    <span className="style-icon dmc-icon" aria-hidden>
                      {getStyleIcon(hero.style)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {styleSelectorOpen && (
              <div className="style-selector-overlay" onClick={() => setStyleSelectorOpen(false)}>
                <div className="style-selector-panel" onClick={e => e.stopPropagation()}>
                  <div className="style-selector-title">切换战斗风格</div>
                  <div className="style-selector-grid">
                    {DMC_STYLES.map(s => (
                      <button
                        key={s.cn}
                        type="button"
                        className={`style-option ${hero.style === s.cn || (s.cn === '皇家护卫' && hero.style === '皇家守卫') ? 'active' : ''}`}
                        onClick={() => {
                          const displayCn = s.cn;
                          pushActionToTavern({
                            label: displayCn,
                            output: `切换风格：${displayCn}`,
                            icon: 'ph-swap',
                            color: 'var(--gold)',
                          });
                          const g = globalThis as any;
                          if (g.Mvu?.getMvuData && g.Mvu?.replaceMvuData) {
                            const mvu = g.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
                            if (mvu?.主角) {
                              const merged = { ...mvu, 主角: { ...mvu.主角, 战斗风格: s.cn } };
                              g.Mvu.replaceMvuData(merged, { type: 'message', message_id: 'latest' }).catch(() => {});
                            }
                          }
                          setStyleSelectorOpen(false);
                        }}
                      >
                        <span className="style-option-icon">{s.icon}</span>
                        <span className="style-option-cn">{s.cn}</span>
                        <span className="style-option-en">{s.en}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="style-selector-close" onClick={() => setStyleSelectorOpen(false)}>
                    关闭
                  </button>
                </div>
              </div>
            )}

            <div className="status-bars">
              <div className="bar-container">
                <div className="bar-label">
                  <span>HP 生命值</span>
                  <span>
                    {hero.hpCurrent}/{hero.hpMax}
                  </span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill hp-fill" style={{ width: `${hpPercent}%` }}></div>
                </div>
              </div>
              <div className="bar-container">
                <div className="bar-label">
                  <span>MP 魔力值</span>
                  <span>
                    {hero.mpCurrent}/{hero.mpMax}
                  </span>
                </div>
                <div className="bar-bg">
                  <div className="bar-fill mp-fill" style={{ width: `${mpPercent}%` }}></div>
                </div>
              </div>
              <div className="bar-container">
                <div className="bar-label">
                  <span>DT Gauge</span>
                  <span>{dtCurrent}/100</span>
                </div>
                <div className="bar-bg">
                  <div
                    className={`bar-fill dt-fill ${dtCurrent >= 100 ? 'dt-full' : ''}`}
                    style={{ width: `${dtPercent}%` }}
                  ></div>
                </div>
                {dtCurrent >= 100 && !hasManjinTransformed && (
                  <button
                    className="btn-dt-manjin"
                    onClick={() => {
                      setHasManjinTransformed(true);
                      pushActionToTavern({
                        label: '魔人化',
                        output: '魔人化启动',
                        icon: 'ph-lightning',
                        color: 'var(--gold)',
                      });
                    }}
                  >
                    <i className="ph-fill ph-lightning"></i> 魔人化
                  </button>
                )}
              </div>
            </div>

            <div className="stats-grid">
              {hero.stats.map(([name, value]: [string, any], idx: number) => (
                <div key={idx} className="stat-card">
                  <div className="stat-icon">
                    <i className="ph-bold ph-star-four"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-name">{name}</span>
                    <span className="stat-value">{String(value)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="private-data weapon-data">
              <div className="private-header weapon-header">装备栏</div>
              <div className="private-grid">
                {hero.equipments.map(([slot, item]: [string, any]) => (
                  <div key={slot} className="private-item">
                    <span className="private-label">{slot}</span>
                    <span className="private-val">{String(item || '无')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Companions Tab */}
        <div className={`tab-content ${activeTab === 'companions' ? 'active' : ''}`} style={{ width: '100%' }}>
          <div style={{ width: '100%' }}>
            {companions.length > 0 && (
              <div className="companion-selector">
                {companions.map((comp, index) => (
                  <div
                    key={`${comp.name}-${index}`}
                    className={`selector-item ${selectedCompanionIndex === index ? 'active' : ''}`}
                    onClick={() => setSelectedCompanionIndex(index)}
                    title={comp.name}
                  >
                    <img
                      src={
                        getCompanionAvatar(comp.name, { gender: comp.gender, job: comp.job, race: comp.race }) ||
                        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=600'
                      }
                      alt={comp.name}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
            {companions.length === 0 && (
              <div className="companion-detail">
                <h3 className="companion-name">暂无队友</h3>
                <div className="companion-status">`追随者与猎物` 当前为空</div>
              </div>
            )}
            {companions.length > 0 && companion && (
              <div className="companion-detail">
                <div className="companion-avatar-large">
                  <div className="avatar-glow"></div>
                  <img
                    src={
                      getCompanionAvatar(companion.name, {
                        gender: companion.gender,
                        job: companion.job,
                        race: companion.race,
                      }) ||
                      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=600'
                    }
                    alt={companion.name}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="companion-name">{companion.name}</h3>
                <div className="companion-status">
                  {companion.race} · {companion.role} · {companion.status}
                </div>

                <div className="bar-container" style={{ width: '100%' }}>
                  <div className="bar-label">
                    <span style={{ color: 'var(--pink)' }}>好感度</span>
                    <span style={{ color: 'var(--pink)' }}>{companion.love}%</span>
                  </div>
                  <div className="bar-bg">
                    <div
                      className="bar-fill"
                      style={{ width: `${companion.love}%`, background: 'linear-gradient(90deg, #be185d, #ec4899)' }}
                    ></div>
                  </div>
                </div>

                <div className="bar-container" style={{ width: '100%' }}>
                  <div className="bar-label">
                    <span style={{ color: 'var(--pink)' }}>服从度</span>
                    <span style={{ color: 'var(--pink)' }}>{companion.obedience}%</span>
                  </div>
                  <div className="bar-bg">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${companion.obedience}%`,
                        background: 'linear-gradient(90deg, #9d174d, #f472b6)',
                      }}
                    ></div>
                  </div>
                </div>

                <div className="private-data">
                  <div className="private-header">私密数据</div>
                  <div className="private-grid">
                    <div className="private-item">
                      <span className="private-label">三围</span>
                      <span className="private-val">{companion.private.三围}</span>
                    </div>
                    <div className="private-item">
                      <span className="private-label">敏感度</span>
                      <span className="private-val">{companion.private.敏感度}</span>
                    </div>
                    <div className="private-item">
                      <span className="private-label">情欲值</span>
                      <span className="private-val">{companion.private.情欲值}%</span>
                    </div>
                    <div className="private-item">
                      <span className="private-label">开发阶段</span>
                      <span className="private-val">{companion.private.开发阶段}</span>
                    </div>
                    <div className="private-item">
                      <span className="private-label">专属特质</span>
                      <span className="private-val">{companion.trait}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', width: '100%' }}>
                  <button
                    className="btn-pink"
                    onClick={() => {
                      if (!getEffectiveVeilBaseUrl()) {
                        notifyVeil('请先填写「暗夜面纱基础 URL」并保存设置，或在 MVU 中设置 暗夜面纱.基础URL');
                        return;
                      }
                      const img = getRandomVeilImage(companion.name, companion.status, {
                        gender: companion.gender,
                        job: companion.job,
                        race: companion.race,
                      });
                      if (!img) {
                        notifyVeil('无法生成面纱图片地址，请检查基础 URL 与图库路径');
                        return;
                      }
                      openModal(img);
                    }}
                  >
                    <i className="ph-fill ph-eye"></i> 暗夜面纱 (随机查看)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Encounters Tab */}
        <div className={`tab-content ${activeTab === 'encounters' ? 'active' : ''}`} style={{ width: '100%' }}>
          {encounters.length > 0 && selectedEncounter && (
            <div
              className="companion-detail"
              style={{ color: 'var(--pink)', flex: 1, justifyContent: 'center', width: '100%' }}
            >
              <div className="companion-selector">
                {encounters.map((enc, index) => (
                  <div
                    key={`${enc.name}-${index}`}
                    className={`selector-item ${selectedEncounterIndex === index ? 'active' : ''}`}
                    onClick={() => setSelectedEncounterIndex(index)}
                    title={enc.name}
                  >
                    <img
                      src={
                        getNpcAvatar(enc.name, { gender: enc.gender, job: enc.job, race: enc.race }) ||
                        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600'
                      }
                      alt={enc.name}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
              <div className="companion-avatar-large">
                <div className="avatar-glow"></div>
                <img
                  src={
                    getNpcAvatar(selectedEncounter.name, {
                      gender: selectedEncounter.gender,
                      job: selectedEncounter.job,
                      race: selectedEncounter.race,
                    }) || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600'
                  }
                  alt={selectedEncounter.name}
                  referrerPolicy="no-referrer"
                />
              </div>
              <h3 className="companion-name" style={{ color: 'var(--text-main)' }}>
                {selectedEncounter.name}
              </h3>
              <div className="companion-status" style={{ opacity: 0.8 }}>
                {selectedEncounter.race} · {selectedEncounter.status}
              </div>

              <div className="private-data" style={{ marginBottom: '16px' }}>
                <div className="private-header">私密数据</div>
                <div className="private-grid">
                  <div className="private-item">
                    <span className="private-label">三围</span>
                    <span className="private-val">{selectedEncounter.private.三围}</span>
                  </div>
                  <div className="private-item">
                    <span className="private-label">敏感度</span>
                    <span className="private-val">{selectedEncounter.private.敏感度}</span>
                  </div>
                  <div className="private-item">
                    <span className="private-label">情欲值</span>
                    <span className="private-val">{selectedEncounter.private.情欲值}%</span>
                  </div>
                  <div className="private-item">
                    <span className="private-label">开发阶段</span>
                    <span className="private-val">{selectedEncounter.private.开发阶段}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', width: '100%' }}>
                <button
                  className="btn-pink"
                  onClick={() => {
                    if (!getEffectiveVeilBaseUrl()) {
                      notifyVeil('请先填写「暗夜面纱基础 URL」并保存设置，或在 MVU 中设置 暗夜面纱.基础URL');
                      return;
                    }
                    const img = getRandomVeilImage(selectedEncounter.name, selectedEncounter.status, {
                      gender: selectedEncounter.gender,
                      job: selectedEncounter.job,
                      race: selectedEncounter.race,
                    });
                    if (!img) {
                      notifyVeil('无法生成面纱图片地址，请检查基础 URL 与图库路径');
                      return;
                    }
                    openModal(img);
                  }}
                >
                  <i className="ph-fill ph-eye"></i> 暗夜面纱 (随机查看)
                </button>
              </div>
            </div>
          )}
          {encounters.length === 0 && (
            <div
              className="companion-detail"
              style={{ color: 'var(--pink)', flex: 1, justifyContent: 'center', width: '100%' }}
            >
              <h3 className="companion-name" style={{ color: 'var(--text-main)' }}>
                暂无邂逅角色
              </h3>
              <div className="companion-status" style={{ opacity: 0.8 }}>
                `当前互动角色` 当前为空
              </div>
            </div>
          )}
        </div>

        {/* World Tab */}
        <div className={`tab-content ${activeTab === 'world' ? 'active' : ''}`} style={{ width: '100%' }}>
          <div className="world-grid" style={{ width: '100%' }}>
            {world.map((item, idx) => (
              <div key={idx} className="world-card">
                <i className={`world-icon ${item.icon}`}></i>
                <div className="world-label">{item.label}</div>
                <div className="world-value">{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '20px', width: '100%' }}>
            <div
              style={{
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)',
                width: '100%',
              }}
            >
              <h4 style={{ fontSize: '0.8rem', color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase' }}>
                当前状况总结
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                {mvuData.世界?.当前状态总结 || '暂无总结。'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Action Prediction Button */}
      <div className="action-trigger-container">
        <button className="btn-action-trigger" onClick={() => setIsActionPanelOpen(true)}>
          <i className="ph-fill ph-lightning"></i> 行动预判
        </button>
      </div>

      {/* Action Panel (Bottom Sheet) */}
      <div className={`action-panel ${isActionPanelOpen ? 'active' : ''}`} onClick={() => setIsActionPanelOpen(false)}>
        <div className="action-panel-content" onClick={e => e.stopPropagation()}>
          <div className="action-panel-handle"></div>
          <div className="action-panel-header">
            <h3>选择你的下一步行动</h3>
            <p>预测成功率将基于你的属性和当前好感度</p>
          </div>
          <div className="action-list">
            {actionsToRender.map((action, idx) => {
              const tone = getActionTone(action);
              return (
                <div
                  key={`${action.label}-${idx}`}
                  className={`action-item action-tone-${tone}`}
                  style={
                    {
                      '--accent': action.color || 'var(--gold)',
                      display: 'grid',
                      gridTemplateColumns: '32px minmax(0, 1fr)',
                      gridTemplateAreas: '"icon label" "icon chance"',
                      alignItems: 'start',
                      columnGap: '8px',
                      rowGap: '3px',
                      overflow: 'visible',
                      minHeight: 'auto',
                    } as any
                  }
                  onClick={() => pushActionToTavern(action)}
                >
                  <div className="action-icon" style={{ gridArea: 'icon', width: '32px', height: '32px' }}>
                    <span className="action-icon-glyph" aria-hidden>
                      {getActionIconGlyph(action)}
                    </span>
                  </div>
                  <div
                    className="action-label"
                    style={{
                      gridArea: 'label',
                      whiteSpace: 'pre-wrap',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      lineHeight: 1.28,
                      fontSize: '0.82rem',
                    }}
                  >
                    {action.label}
                  </div>
                  <div
                    className="action-chance"
                    style={{
                      gridArea: 'chance',
                      justifySelf: 'start',
                      alignSelf: 'start',
                      textAlign: 'left',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '6px',
                      alignItems: 'baseline',
                    }}
                  >
                    <span className="chance-val">
                      {typeof action.success_rate === 'number'
                        ? `${Math.max(0, Math.min(100, action.success_rate))}%`
                        : `${Math.floor(Math.random() * 40 + 50)}%`}
                    </span>
                    <span className="chance-label">成功率</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn-close-panel" onClick={() => setIsActionPanelOpen(false)}>
            取消
          </button>
        </div>
      </div>

      {/* 暗夜面纱：0 层全屏遮罩，点击图片外任意区域关闭 */}
      {createPortal(
        <div
          className={`modal modal--veil-full ${isModalOpen ? 'active' : ''}`}
          onClick={closeVeilModal}
          role="dialog"
          aria-modal="true"
          aria-label="暗夜面纱"
        >
          <div className="modal-veil-img-only" onClick={e => e.stopPropagation()}>
            {!veilModalError && modalImage && (
              <img
                src={modalImage}
                alt="暗夜面纱"
                referrerPolicy="no-referrer"
                onError={() => {
                  openVeilErrorModal('图片加载失败：请检查图库路径、跨域或文件是否存在。', modalImage);
                }}
              />
            )}
            {veilModalError && (
              <div className="veil-error-panel" role="alert">
                <div className="veil-error-title">暗夜面纱加载失败</div>
                <pre className="veil-error-message">{veilModalError}</pre>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {createPortal(
        <div className={`modal ${isSettingsOpen ? 'active' : ''}`} onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
            <span className="modal-close" onClick={() => setIsSettingsOpen(false)}>
              &times;
            </span>
            <div className="settings-title-row">
              <h3 className="settings-title">云端资源设置</h3>
              <span className="settings-version-badge" title="当前面板构建版本">
                {UI_VERSION}
              </span>
            </div>
            <p className="settings-version-hint">版本号用于确认手机/CDN 是否加载到最新脚本</p>
            {!isSettingsUnlocked && (
              <div className="settings-row">
                <label>请输入设置密码（默认 000000）</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="输入密码后解锁设置"
                />
                <button className="btn-pink" onClick={unlockSettings}>
                  解锁设置
                </button>
              </div>
            )}

            {isSettingsUnlocked && (
              <>
                <div className="settings-row">
                  <label>调试信息（只读）</label>
                  <textarea
                    readOnly
                    value={JSON.stringify(
                      {
                        数据来源: runtime.source,
                        楼层来源: runtime.messageIdUsed,
                        读取模式: dataReadMode,
                        聊天级回退可用键: Object.keys(chatFallbackData || {}),
                        桥接就绪: bridgeReady,
                        桥接状态: bridgeStatusText,
                        原始顶层键: Object.keys(runtime.data || {}),
                        清洗后顶层键: Object.keys(sanitizedRuntimeData || {}),
                        数据清洗状态: normalizationStatus,
                        当前互动角色键: Object.keys((sanitizedRuntimeData as any)?.当前互动角色 || {}),
                        追随者与猎物键: Object.keys((sanitizedRuntimeData as any)?.追随者与猎物 || {}),
                        当前队友规则预览: currentCompanionPreview,
                        当前互动角色规则预览: currentEncounterPreview,
                        行动预判选项数: actions.length,
                        行动预判格式状态: actionFormatStatus,
                        行动预判初始化状态: actionInitStatus,
                        专属角色资源映射键数: Object.keys(exclusiveAvatarMap || {}).length,
                        随机NPC资源规则键数: Object.keys(runtimeRandomRules || {}).length,
                        双源对照: dualSourceSnapshot,
                      },
                      null,
                      2,
                    )}
                  />
                </div>

                <div className="settings-row">
                  <label>数据读取模式</label>
                  <select
                    value={dataReadMode}
                    onChange={e => {
                      const nextMode = e.target.value as DataReadMode;
                      setDataReadMode(nextMode);
                      localStorage.setItem(DATA_READ_MODE_KEY, nextMode);
                    }}
                  >
                    <option value="current_message">当前楼层优先</option>
                    <option value="latest_message">latest 优先</option>
                    <option value="chat">chat 优先</option>
                  </select>
                </div>

                <div className="settings-row">
                  <label>桥接接口状态（远程调试）</label>
                  <div className="settings-inline">
                    <input readOnly value={bridgeStatusText} />
                    <button className="btn-pink btn-inline" onClick={retryRuntimeBridge}>
                      重试桥接
                    </button>
                  </div>
                </div>

                <div className="settings-row">
                  <label>头像基础 URL</label>
                  <input
                    value={settings.avatarBaseUrl}
                    onChange={e => setSettings({ ...settings, avatarBaseUrl: e.target.value })}
                    placeholder="例如 https://cdn.jsdelivr.net/gh/you/repo@main/avatar"
                  />
                </div>

                <div className="settings-row">
                  <label>主角头像路径（相对路径）</label>
                  <input
                    value={settings.heroAvatarPath}
                    onChange={e => setSettings({ ...settings, heroAvatarPath: e.target.value })}
                    placeholder="例如 Emiya.png"
                  />
                </div>

                <div className="settings-guide-box">
                  <strong>小白指路 · 头像与面纱</strong>
                  <br />① <strong>队友</strong>：追随者与猎物里的固定队友，按姓名映射
                  <br />② <strong>通用 NPC</strong>：已知姓名的 NPC（当前互动角色等），按姓名映射，优先于随机规则
                  <br />③ <strong>随机 NPC 规则</strong>：未在①②里配置的 NPC，按「性别|职业|种族」匹配，键支持 *
                  通配；avatar 控制头像，veil 控制面纱图
                  <br />④ <strong>图库计数</strong>：暗夜面纱随机抽图用，记录「角色名→状态→该状态图片数量」
                </div>

                <div className="settings-row">
                  <label>队友头像路径映射（JSON）</label>
                  <span className="settings-hint">追随者与猎物中的队友，按姓名映射头像路径</span>
                  <textarea
                    value={companionAvatarText}
                    onChange={e => setCompanionAvatarText(e.target.value)}
                    placeholder='{"莉莉丝":"followers/lilith.png"}'
                  />
                </div>

                <div className="settings-row">
                  <label>通用 NPC 头像路径映射（JSON，优先级最高）</label>
                  <span className="settings-hint">
                    已知姓名的 NPC（当前互动角色等），按姓名映射；命中则不再走随机规则
                  </span>
                  <textarea
                    value={npcAvatarText}
                    onChange={e => setNpcAvatarText(e.target.value)}
                    placeholder='{"蒂薇儿":"npc/diweier.png","莉莉丝":"npc/lilith.png"}  // 或写入变量键: 专属角色资源映射'
                  />
                </div>

                <div className="settings-row">
                  <label>随机 NPC 规则（JSON，键格式：性别|职业|种族，支持 * 通配）</label>
                  <span className="settings-hint">
                    键示例：女|老板娘|半魅魔 —— 未在「通用 NPC」里的 NPC 按此匹配；avatar 配头像，veil 配面纱
                  </span>
                  <textarea
                    value={randomNpcRuleText}
                    onChange={e => setRandomNpcRuleText(e.target.value)}
                    placeholder={
                      '{"女|老板娘|半魅魔/半人类混血":{"avatar":{"path":"npc/random/tavern_owner","count":8},"veil":{"path":"veil/random/tavern_owner","statusCounts":{"微醺":6,"日常":3},"defaultCount":2}},"*|战士|兽人":{"avatar":{"path":"npc/random/orc_warrior","count":10}}}  // 或写入变量键: 随机NPC资源规则'
                    }
                  />
                </div>
                <div className="settings-row">
                  <label>快速新增随机 NPC 规则</label>
                  <span className="settings-hint">
                    填写下方 性别|职业|种族、头像数量、状态名及数量后，点击按钮自动写入上方的 JSON
                  </span>
                  <div className="settings-quick-grid">
                    <input
                      value={quickRandomGender}
                      onChange={e => setQuickRandomGender(e.target.value)}
                      placeholder="性别，例如 女（可用 *）"
                    />
                    <input
                      value={quickRandomJob}
                      onChange={e => setQuickRandomJob(e.target.value)}
                      placeholder="职业，例如 老板娘（可用 *）"
                    />
                    <input
                      value={quickRandomRace}
                      onChange={e => setQuickRandomRace(e.target.value)}
                      placeholder="种族，例如 半魅魔/半人类混血（可用 *）"
                    />
                  </div>
                  <div className="settings-quick-grid" style={{ marginTop: '8px' }}>
                    <input
                      value={quickRandomAvatarCount}
                      onChange={e => setQuickRandomAvatarCount(e.target.value)}
                      placeholder="随机头像数量，例如 8"
                    />
                    <input
                      value={quickRandomStatusName}
                      onChange={e => setQuickRandomStatusName(e.target.value)}
                      placeholder="状态名（可空），例如 微醺"
                    />
                    <input
                      value={quickRandomStatusCount}
                      onChange={e => setQuickRandomStatusCount(e.target.value)}
                      placeholder="该状态数量，例如 6"
                    />
                  </div>
                  <button className="btn-pink" onClick={addQuickRandomRule}>
                    添加到随机 NPC 规则 JSON
                  </button>
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--glass-border)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      fontSize: '0.75rem',
                      color: 'var(--text-main)',
                      lineHeight: 1.6,
                    }}
                  >
                    <div style={{ color: 'var(--gold)', marginBottom: '4px' }}>URL 预览</div>
                    <div>头像：{quickRandomPreview.avatar || '请先填写头像基础 URL'}</div>
                    <div>面纱：{quickRandomPreview.veil || '请先填写暗夜面纱基础 URL'}</div>
                  </div>
                </div>

                <div className="settings-row">
                  <label>暗夜面纱基础 URL</label>
                  <span className="settings-hint">面纱图片的 CDN 根地址，与随机规则里的 path 拼接成完整 URL</span>
                  <input
                    value={settings.veilBaseUrl}
                    onChange={e => setSettings({ ...settings, veilBaseUrl: e.target.value })}
                    placeholder="例如 https://cdn.jsdelivr.net/gh/you/repo@main/veil"
                  />
                </div>

                <div className="settings-row">
                  <label>图库计数（JSON）</label>
                  <span className="settings-hint">
                    记录每个角色、每种状态下的图片数量，用于随机抽图；可与 MVU 暗夜面纱.图库计数 同步
                  </span>
                  <textarea
                    value={galleryCountText}
                    onChange={e => setGalleryCountText(e.target.value)}
                    placeholder='{"莉莉丝":{"口交":12},"Martha":{"微醺":3}}'
                  />
                </div>

                <div className="settings-row">
                  <label>快速新增 NPC 状态规则</label>
                  <span className="settings-hint">填写角色名、状态名、数量后，点击按钮自动写入上方的图库计数 JSON</span>
                  <div className="settings-quick-grid">
                    <input
                      value={quickNpcName}
                      onChange={e => setQuickNpcName(e.target.value)}
                      placeholder="NPC 名称，例如 莉莉丝"
                    />
                    <input
                      value={quickNpcStatus}
                      onChange={e => setQuickNpcStatus(e.target.value)}
                      placeholder="状态，例如 口交"
                    />
                    <input
                      value={quickNpcCount}
                      onChange={e => setQuickNpcCount(e.target.value)}
                      placeholder="数量，例如 12"
                    />
                  </div>
                  <button className="btn-pink" onClick={addQuickGalleryRule}>
                    添加到图库计数 JSON
                  </button>
                </div>

                <div className="settings-row">
                  <label>修改设置密码</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="新密码（至少 6 位）"
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                  />
                  <button className="btn-pink" onClick={changePassword}>
                    更新密码
                  </button>
                </div>

                <button className="btn-pink" onClick={saveSettings}>
                  保存设置
                </button>
              </>
            )}
            {passwordMessage && <div className="settings-message">{passwordMessage}</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
