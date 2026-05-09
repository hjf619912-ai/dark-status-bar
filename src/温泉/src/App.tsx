import React, {useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {motion} from 'motion/react';
import {Activity, Eye, Image as ImageIcon, MapPin, RefreshCw, ShieldAlert, Sparkles, User, Users, Wand2, X} from 'lucide-react';
import {Schema as StatSchema, type Schema} from './schema';

type UpdateMessage = {type: 'TavernHotSpringUpdate'; payload: unknown};
type ActionMessage = {type: 'TavernHotSpringAction'; text: string};

const FIGURE_IMAGE_BASE = 'http://38.246.237.16:32774/image';
const FIGURE_IMAGE_BUCKET = '温泉';
const FIGURE_SLOT_COUNT = 5;

/** 「丰乳肥臀/安产型」等带斜杠的文案会多出一层路径；统一映射到服务端文件夹「丰乳肥臀」 */
function normalizeFigureGalleryFolder(body: string): string {
  const t = body.trim();
  if (t.startsWith('丰乳肥臀/')) return '丰乳肥臀';
  return t;
}

function buildFigureGalleryUrl(bodyRaw: string | undefined, slot: number): string | null {
  const body = String(bodyRaw ?? '').trim();
  if (!body || slot < 1 || slot > FIGURE_SLOT_COUNT) return null;
  const folder = normalizeFigureGalleryFolder(body);
  const a = encodeURIComponent(FIGURE_IMAGE_BUCKET);
  const b = encodeURIComponent(folder);
  return `${FIGURE_IMAGE_BASE}/${a}/${b}/${slot}.png`;
}

/** 当前身材对应的 1.png～5.png 完整 URL（与请求一致，含编码） */
function listFigureGalleryUrls(bodyRaw: string | undefined): string[] {
  const urls: string[] = [];
  for (let s = 1; s <= FIGURE_SLOT_COUNT; s++) {
    const u = buildFigureGalleryUrl(bodyRaw, s);
    if (u) urls.push(u);
  }
  return urls;
}

const ProgressBar = ({
  value,
  label,
  icon: Icon,
  color,
}: {
  value: number;
  label: string;
  icon?: React.ComponentType<{size?: number; className?: string}>;
  color: string;
}) => {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 justify-between items-center gap-2 text-[10px] uppercase tracking-widest text-white/55">
        <div className="flex items-center gap-1.5">
          {Icon ? <Icon size={12} className="opacity-70" /> : null}
          <span>{label}</span>
        </div>
        <span className="font-mono">{Math.round(safe)}%</span>
      </div>
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
        <motion.div
          initial={{width: 0}}
          animate={{width: `${safe}%`}}
          transition={{duration: 0.6, ease: 'easeOut'}}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

/** 小屏改为「标签一行 + 内容满宽」，避免双列挤扁导致每行只能显示两三个汉字 */
const Field = ({k, v}: {k: string; v?: React.ReactNode}) => (
  <div className="grid min-w-0 grid-cols-1 gap-1.5 py-2 border-b border-white/5 last:border-b-0 sm:grid-cols-[minmax(4.5rem,5.75rem)_minmax(0,1fr)] sm:items-start sm:gap-3">
    <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold shrink-0 sm:pt-0.5">{k}</div>
    <div className="min-w-0 text-[12px] text-white/80 leading-relaxed wrap-break-word">{v ?? <span className="text-white/30">—</span>}</div>
  </div>
);

const Card = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{size?: number; className?: string}>;
  children: React.ReactNode;
}) => (
  <section className="bg-black/40 rounded-xl border border-white/10 overflow-hidden">
    <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10 bg-white/5">
      {Icon ? <Icon size={14} className="text-orange-400" /> : null}
      <div className="text-[12px] font-extrabold tracking-[0.25em] text-white/90">{title}</div>
    </div>
    <div className="min-w-0 p-4">{children}</div>
  </section>
);

/** 桌面端双栏等高；移动端高度随内容，避免焦点旅客简略区下方被拉出一截空白 */
const guestPanelClass =
  'w-full self-start h-auto rounded-lg border border-[#5b3822]/58 bg-[linear-gradient(180deg,rgba(40,23,15,0.96),rgba(22,12,9,0.98)_44%,rgba(8,5,6,0.99))] p-4 max-sm:p-5 flex flex-col shadow-[inset_0_1px_0_rgba(255,220,180,0.06),0_14px_36px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:h-full sm:self-stretch sm:min-h-0';

/** 与 guestPanelClass 同壳，但去内边距；顶栏另做「标题行」色块（对齐主角区信息结构） */
const focusGuestPanelClass =
  'w-full self-start h-auto overflow-hidden rounded-lg border border-[#5b3822]/58 bg-[linear-gradient(180deg,rgba(40,23,15,0.96),rgba(22,12,9,0.98)_44%,rgba(8,5,6,0.99))] p-0 flex flex-col shadow-[inset_0_1px_0_rgba(255,220,180,0.06),0_14px_36px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:h-full sm:self-stretch sm:min-h-0';

function emptyStatData(): Schema {
  const parsed = StatSchema.safeParse({
    主角: {},
    焦点旅客: {},
    旅客B: {},
    旅客C: {},
    环境: {},
    建议行动: [],
  });
  if (parsed.success) return parsed.data;
  return {
    主角: {},
    焦点旅客: {},
    旅客B: {},
    旅客C: {},
    环境: {},
    建议行动: [],
  } as Schema;
}

const EMPTY_DATA: Schema = emptyStatData();

function safeJsonPreview(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    try {
      return String(v);
    } catch {
      return '[无法序列化的数据]';
    }
  }
}

function clonePayload(payload: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload;
  }
}

function sendActionToParent(text: string) {
  const content = String(text ?? '').trim();
  if (!content) return;

  try {
    // SillyTavern 父窗口暴露全局 jQuery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = (window.parent as any).$ as ((sel: string) => any) | undefined;
    if (typeof $ === 'function') {
      const $ta = $(
        '#send_textarea, textarea[name="send_textarea"], textarea#send_textarea, #send_text, textarea[data-testid="send_textarea"], textarea.mes_textarea',
      ).filter((_i: number, el: HTMLElement) => $(el).is(':visible'));
      const first = $ta.first();
      if (first && first.length && first[0]) {
        const ta = first[0] as HTMLTextAreaElement;
        const prev = String(ta.value ?? '');
        ta.value = prev.trim().length > 0 ? `${prev}\n${content}` : content;
        ta.dispatchEvent(new Event('input', {bubbles: true}));
        ta.dispatchEvent(new Event('change', {bubbles: true}));
        ta.focus();
        try {
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
        return;
      }
    }
  } catch {
    /* fall through to postMessage */
  }

  const msg: ActionMessage = {type: 'TavernHotSpringAction', text: content};
  try {
    const targets: (Window | null | undefined)[] = [window.parent, window.top];
    const seen = new Set<Window>();
    for (const t of targets) {
      if (!t || seen.has(t)) continue;
      seen.add(t);
      t.postMessage(msg, '*');
    }
  } catch (e) {
    console.warn('[温泉] 无法向父页面发送动作', e);
  }
}

function TagList({items, empty}: {items: string[]; empty: string}) {
  if (!items.length) {
    return <span className="text-[11px] text-white/30">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
          {t}
        </span>
      ))}
    </div>
  );
}

function FigureGalleryPathList({urls}: {urls: string[]}) {
  if (!urls.length) return null;
  return (
    <div className="rounded-lg border border-white/12 bg-black/45">
      <div className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        请按以下完整路径放置图片（每行一条，共 {urls.length} 张）
      </div>
      <div className="max-h-[min(38vh,280px)] overflow-y-auto overscroll-y-contain px-2 py-2 [-webkit-overflow-scrolling:touch] sm:max-h-[320px]">
        <ul className="space-y-2">
          {urls.map(u => (
            <li key={u} className="break-all font-mono text-[10px] leading-snug text-amber-100/88 sm:text-[11px]">
              {u}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FigureGalleryBlock({
  url,
  bodyLabel,
  slot,
  failed,
  onImgError,
  onReroll,
}: {
  url: string | null;
  bodyLabel?: string;
  slot: number;
  failed: boolean;
  onImgError: () => void;
  onReroll: () => void;
}) {
  const body = String(bodyLabel ?? '').trim();
  const pathUrls = listFigureGalleryUrls(bodyLabel);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (failed) setLightboxOpen(false);
  }, [failed]);

  if (!url) {
    const demoUrls = listFigureGalleryUrls('下作的魅魔型');
    return (
      <Card title="云端图库" icon={ImageIcon}>
        <div className="space-y-3 text-[12px] leading-relaxed text-white/55">
          <p>暂无「身材」字段或为空，无法解析图库目录。</p>
          <p className="text-[11px] text-white/42">示例目录（请将对应身材文件夹放在服务器同名路径下，内含 1.png～5.png）：</p>
          {demoUrls.length ? <FigureGalleryPathList urls={demoUrls} /> : null}
        </div>
      </Card>
    );
  }

  const lightbox =
    lightboxOpen &&
    url &&
    createPortal(
      <div
        className="fixed inset-0 z-[9999] flex touch-manipulation flex-col bg-black"
        role="dialog"
        aria-modal="true"
        aria-label="图片全屏查看"
      >
        <div className="flex shrink-0 items-center justify-end px-3 pb-2 pr-[max(12px,env(safe-area-inset-right))] pt-[max(10px,env(safe-area-inset-top))] sm:px-5">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="inline-flex h-12 min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-xl border-2 border-orange-200/90 bg-gradient-to-br from-orange-500 to-rose-600 px-5 text-sm font-black tracking-wide text-white shadow-[0_8px_28px_rgba(0,0,0,0.55)] active:scale-[0.96]"
            aria-label="关闭全屏"
          >
            <X size={22} strokeWidth={2.75} className="shrink-0" aria-hidden />
            关闭
          </button>
        </div>
        <div className="flex min-h-0 flex-1 w-full items-center justify-center overflow-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] px-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">
          <img
            src={url}
            alt=""
            className="mx-auto block h-auto w-auto max-h-[min(100%,calc(100dvh-5.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] max-w-full object-contain select-none"
            draggable={false}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>,
      document.body,
    );

  return (
    <Card title="云端图库" icon={ImageIcon}>
      <div className="space-y-3">
        {!failed ? (
          <>
            <button
              type="button"
              className="relative w-full cursor-zoom-in overflow-hidden rounded-xl border border-[#7a4828]/45 bg-black/55 text-left outline-none ring-offset-2 ring-offset-[#1a0f0a] focus-visible:ring-2 focus-visible:ring-orange-400/70 max-sm:active:opacity-95"
              onClick={() => setLightboxOpen(true)}
              aria-label="全屏查看图片，自适应缩放至可视区域"
            >
              <img
                src={url}
                alt=""
                className="pointer-events-none mx-auto block h-auto w-full max-h-[min(44vh,360px)] object-contain object-center sm:max-h-[400px]"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={onImgError}
              />
            </button>
            <p className="hidden text-center text-[10px] text-white/38 max-sm:block">点击图片全屏 · 整图自适应一屏 · 仍可双指放大</p>
            {lightbox}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-[12px] text-white/50">当前图片未加载，请确认下列路径上文件是否存在（HTTPS 页面也可能拦截 HTTP 图片）。</p>
            {pathUrls.length ? <FigureGalleryPathList urls={pathUrls} /> : null}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <span className="text-[11px] font-mono text-white/40">
            随机 #{slot} / {FIGURE_SLOT_COUNT}
          </span>
          <button
            type="button"
            onClick={onReroll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/18 bg-white/8 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-white/12 active:scale-[0.99]"
          >
            <RefreshCw size={14} className="opacity-90" aria-hidden />
            换一张
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function App() {
  const [raw, setRaw] = useState<unknown>(undefined);
  const [data, setData] = useState<Schema>(() => EMPTY_DATA);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [figureGallerySlot, setFigureGallerySlot] = useState(1);
  const [figureGalleryFailed, setFigureGalleryFailed] = useState(false);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = ev.data as UpdateMessage | undefined;
        if (!msg || msg.type !== 'TavernHotSpringUpdate') return;

        setRaw(clonePayload(msg.payload));
        const parsed = StatSchema.safeParse(msg.payload);
        if (!parsed.success) {
          setParseError(parsed.error.message);
          console.warn('[温泉] 变量解析失败（已隐藏详情面板）', parsed.error);
          return;
        }
        setParseError(null);
        setData(parsed.data);
        setLastUpdated(Date.now());
      } catch (e) {
        console.error('[温泉] 处理 TavernHotSpringUpdate 异常', e);
        setParseError('内部处理异常（已忽略本次更新）');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!detailOpen) return;
    setFigureGallerySlot(Math.floor(Math.random() * FIGURE_SLOT_COUNT) + 1);
    setFigureGalleryFailed(false);
  }, [detailOpen, data.焦点旅客?.身材]);

  const figureGalleryUrl = useMemo(
    () => buildFigureGalleryUrl(data.焦点旅客?.身材, figureGallerySlot),
    [data.焦点旅客?.身材, figureGallerySlot],
  );

  const rerollFigureGallery = () => {
    setFigureGallerySlot(prev => {
      let n = Math.floor(Math.random() * FIGURE_SLOT_COUNT) + 1;
      let guard = 0;
      while (n === prev && guard++ < 14) {
        n = Math.floor(Math.random() * FIGURE_SLOT_COUNT) + 1;
      }
      return n;
    });
    setFigureGalleryFailed(false);
  };

  const connected = useMemo(() => {
    if (lastUpdated == null) return false;
    return Date.now() - lastUpdated <= 3000;
  }, [lastUpdated]);

  const actionList = data.建议行动 ?? [];
  const actionSlots = useMemo(() => {
    const four = actionList.slice(0, 4);
    while (four.length < 4) four.push(undefined);
    return four;
  }, [actionList]);
  const isCompactAction = useMemo(() => window.innerWidth <= 520, []);

  const actionTheme = (icon?: string) => {
    switch (icon) {
      case '🔧':
        return {border: 'border-sky-500/35', bg: 'bg-sky-500/10', hover: 'hover:bg-sky-500/15', text: 'text-sky-100', badge: 'text-sky-300/80'};
      case '🔞':
        return {border: 'border-rose-500/35', bg: 'bg-rose-500/10', hover: 'hover:bg-rose-500/15', text: 'text-rose-50', badge: 'text-rose-300/80'};
      case '🥛':
        return {border: 'border-emerald-500/35', bg: 'bg-emerald-500/10', hover: 'hover:bg-emerald-500/15', text: 'text-emerald-50', badge: 'text-emerald-300/80'};
      case '🚶':
        return {border: 'border-amber-500/35', bg: 'bg-amber-500/10', hover: 'hover:bg-amber-500/15', text: 'text-amber-50', badge: 'text-amber-300/80'};
      default:
        return {border: 'border-white/10', bg: 'bg-white/5', hover: 'hover:bg-white/8', text: 'text-white/80', badge: 'text-white/40'};
    }
  };

  const env = data.环境;
  const sight = env?.周边视线 ?? [];
  const saeko = env?.冴子处理 ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,rgba(71,33,13,0.98),rgba(25,15,10,0.99)_42%,rgba(4,3,4,1)_100%)] text-white font-sans selection:bg-orange-300/25 selection:text-white">
      <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-1 flex-col overflow-hidden">
        <header className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">♨️</div>
            <div>
              <div className="text-sm sm:text-base font-extrabold tracking-[0.35em] text-[#ffd29a] drop-shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                温泉·实况监测
              </div>
              <div className="text-[11px] text-[#d9b48a]/72 font-mono">
                postMessage: <span className="text-[#f4f7ff]">{'TavernHotSpringUpdate'}</span>
                {lastUpdated ? (
                  <>
                    {' · '}
                    <span className={connected ? 'text-emerald-300' : 'text-orange-200'}>{connected ? '已连接' : '已断开/等待'}</span>
                  </>
                ) : (
                  <>
                    {' · '}
                    <span className="text-slate-300">等待变量推送</span>
                  </>
                )}
                {parseError ? (
                  <>
                    {' · '}
                    <span className="text-rose-200">数据不合法（已忽略本次更新）</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowRaw(v => !v)}
            className="text-xs px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-[#fff6fb] hover:bg-white/15 transition"
          >
            {showRaw ? '隐藏原始数据' : '显示原始数据'}
          </button>
        </header>

        <main className="warm-spring-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-4 pt-0 sm:px-6 sm:pb-6 [-webkit-overflow-scrolling:touch] space-y-4">
          {showRaw ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-[11px] uppercase tracking-widest text-white/55 mb-2">raw payload</div>
              <pre className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap wrap-break-word font-mono">
                {safeJsonPreview(raw ?? data)}
              </pre>
            </div>
          ) : null}

          <section className="rounded-xl border border-[#5a3720]/62 overflow-hidden bg-[linear-gradient(180deg,rgba(53,31,18,0.95),rgba(24,14,10,0.98)_44%,rgba(8,6,7,0.99))]">
            <div className="px-4 py-3 border-b border-[#c06d2e]/32">
              <div className="text-[12px] font-extrabold tracking-[0.25em] text-white">主角 · 焦点旅客</div>
            </div>
            <div className="p-4 max-sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start auto-rows-auto sm:items-stretch sm:auto-rows-fr">
                <div className={guestPanelClass}>
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <User size={14} className="text-white" />
                    <div className="text-xs font-black tracking-widest text-white">主角</div>
                  </div>
                  <div className="min-w-0 w-full space-y-3 max-sm:flex-none sm:min-h-0 sm:flex-1">
                    <Field k="位置" v={data.主角?.位置} />
                    <div className="grid min-w-0 grid-cols-1 gap-3">
                      <ProgressBar value={data.主角?.体力 ?? 0} label="体力" icon={Activity} color="bg-gradient-to-r from-emerald-500 to-teal-400" />
                      <ProgressBar value={data.主角?.风险 ?? 0} label="风险" icon={ShieldAlert} color="bg-gradient-to-r from-orange-500 to-rose-500" />
                    </div>
                    <Field k="肉棒" v={data.主角?.肉棒} />
                    <Field k="心境" v={data.主角?.心境} />
                    <Field k="近况" v={data.主角?.近况} />
                  </div>
                </div>

                <div className={focusGuestPanelClass}>
                  {/* 标题行：与面板主体拉开色差，风格贴近外层「主角·焦点旅客」栏 */}
                  <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-between gap-2 border-b border-[#c06d2e]/38 bg-[linear-gradient(90deg,rgba(132,76,38,0.52),rgba(62,36,22,0.72),rgba(26,15,10,0.92))] px-4 py-2.5 max-sm:gap-1.5 max-sm:px-3 max-sm:py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Users size={14} className="shrink-0 text-white" />
                      <div className="whitespace-nowrap text-xs font-black tracking-widest text-white max-sm:text-[11px] max-sm:tracking-wide">
                        焦点旅客
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailOpen(true)}
                      className="shrink-0 whitespace-nowrap rounded-md border border-white/22 bg-black/70 px-2 py-1.5 text-[11px] font-bold leading-none text-white backdrop-blur-sm transition hover:bg-black/82 active:scale-[0.99] sm:rounded-lg sm:px-3 sm:py-2 sm:text-[12px]"
                    >
                      查看详情
                    </button>
                  </div>
                  {/* 与主角列一致：统一 space-y-3 / gap-3，无内层套框 */}
                  <div className="min-w-0 w-full space-y-3 p-4 max-sm:flex-none max-sm:p-3 sm:min-h-0 sm:flex-1">
                    <Field
                      k="姓名"
                      v={
                        <>
                          <span className="font-semibold text-white/95">
                            {data.焦点旅客?.姓名 ?? '—'}
                            {data.焦点旅客?.年龄 != null ? (
                              <span className="ml-2 font-mono text-xs font-normal text-white/50">({data.焦点旅客.年龄}Y)</span>
                            ) : null}
                          </span>
                        </>
                      }
                    />
                    <Field k="位置" v={data.焦点旅客?.位置} />
                    <Field k="职业" v={data.焦点旅客?.职业 ?? '未知职业'} />
                    <Field k="身材" v={data.焦点旅客?.身材 ?? '身材未明'} />
                    <Field k="性格" v={data.焦点旅客?.性格 ?? '性格未明'} />
                    <div className="grid min-w-0 grid-cols-1 gap-3">
                      <ProgressBar value={data.焦点旅客?.面具 ?? 0} label="面具" icon={Eye} color="bg-gradient-to-r from-[#ffb36f] to-[#ff7a3a]" />
                      <ProgressBar value={data.焦点旅客?.渴求 ?? 0} label="渴求" icon={Sparkles} color="bg-gradient-to-r from-[#ff8f5a] to-[#ff4d6d]" />
                    </div>
                    <Field k="OS片段" v={<span className="italic text-slate-200/95">{data.焦点旅客?.OS片段 ?? '内心独白尚未公开'}</span>} />
                    <Field k="近况" v={data.焦点旅客?.近况 ?? '近况未明'} />
                    <Field k="下体" v={data.焦点旅客?.下体 ?? '下体未明'} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card title="旅客B / 旅客C" icon={Users}>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3 max-sm:p-4">
                <div className="mb-2.5 text-xs font-black tracking-widest text-white/80 max-sm:text-[11px] max-sm:tracking-wide">旅客B</div>
                <div className="min-w-0 space-y-0">
                  <Field k="姓名" v={data.旅客B?.姓名} />
                  <Field k="年龄" v={data.旅客B?.年龄 != null ? String(data.旅客B.年龄) : undefined} />
                  <Field k="性格" v={data.旅客B?.性格} />
                  <Field k="身材" v={data.旅客B?.身材} />
                  <Field k="近况" v={data.旅客B?.近况} />
                  <Field k="位置" v={data.旅客B?.位置} />
                  <Field
                    k="内心OS"
                    v={
                      data.旅客B?.内心OS?.trim() ? (
                        <span className="italic text-slate-200/95">{data.旅客B.内心OS}</span>
                      ) : undefined
                    }
                  />
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 p-3 max-sm:p-4">
                <div className="mb-2.5 text-xs font-black tracking-widest text-white/80 max-sm:text-[11px] max-sm:tracking-wide">旅客C</div>
                <div className="min-w-0 space-y-0">
                  <Field k="姓名" v={data.旅客C?.姓名} />
                  <Field k="年龄" v={data.旅客C?.年龄 != null ? String(data.旅客C.年龄) : undefined} />
                  <Field k="性格" v={data.旅客C?.性格} />
                  <Field k="身材" v={data.旅客C?.身材} />
                  <Field k="近况" v={data.旅客C?.近况} />
                  <Field k="位置" v={data.旅客C?.位置} />
                  <Field
                    k="内心OS"
                    v={
                      data.旅客C?.内心OS?.trim() ? (
                        <span className="italic text-slate-200/95">{data.旅客C.内心OS}</span>
                      ) : undefined
                    }
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card title="环境" icon={MapPin}>
            <div className="space-y-3">
              <Field k="冴子轨迹" v={data.环境?.冴子轨迹} />
              <Field k="环境预告" v={data.环境?.环境预告} />
              <ProgressBar value={data.环境?.Risk ?? 0} label="Risk" icon={ShieldAlert} color="bg-gradient-to-r from-red-500 to-rose-600" />
              <Field k="状态" v={data.环境?.状态} />
              <div>
                <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold mb-2">周边视线</div>
                <TagList items={sight} empty="—" />
              </div>
              <div>
                <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold mb-2">冴子处理</div>
                <TagList items={saeko} empty="—" />
              </div>
            </div>
          </Card>

          <Card title="建议行动" icon={Wand2}>
            <div className={`grid ${isCompactAction ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-3`}>
              {actionSlots.map((a, i) => {
                const labelText = a?.文本 != null ? String(a.文本) : '';
                const isEmpty = !a || (!labelText.trim() && !a.图标);
                const theme = actionTheme(a?.图标);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isEmpty}
                    onClick={() => labelText.trim() && sendActionToParent(labelText)}
                    className={`rounded-lg border p-3 transition min-h-[52px] flex items-center justify-between gap-3 text-left ${
                      isEmpty
                        ? 'border-white/10 bg-white/3 text-white/25 cursor-not-allowed'
                        : a.强调
                          ? 'border-orange-400/70 bg-orange-500/12 hover:bg-orange-500/16 ring-2 ring-orange-400/35 ring-offset-2 ring-offset-black/40'
                          : `${theme.border} ${theme.bg} ${theme.hover} cursor-pointer`
                    }`}
                  >
                    <div className={`text-sm font-bold ${isEmpty ? 'text-white/25' : theme.text}`}>{isEmpty ? '—' : labelText || '—'}</div>
                    {!isEmpty && a?.图标 && !isCompactAction ? <div className={`text-[12px] font-mono ${theme.badge}`}>{a.图标}</div> : null}
                  </button>
                );
              })}
            </div>
            {actionList.length > 4 ? (
              <div className="mt-3 text-[11px] text-white/35 font-mono">还有 {actionList.length - 4} 条未显示</div>
            ) : null}
          </Card>
        </main>
      </div>

      {detailOpen ? (
        <div className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.78)] backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-[#5a3822]/42 bg-[linear-gradient(180deg,rgba(26,16,12,0.98),rgba(12,8,7,0.99)_44%,rgba(4,3,4,1))] shadow-[0_30px_90px_rgba(0,0,0,0.76)] sm:rounded-3xl">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#8a552f]/28 bg-[linear-gradient(90deg,rgba(116,68,32,0.42),rgba(61,36,22,0.22),rgba(255,255,255,0.03))] shrink-0">
              <div>
                <div className="text-sm font-extrabold tracking-[0.25em] text-white">焦点旅客详情</div>
                <div className="text-[11px] text-slate-300 mt-1">完整字段在这里查看，主界面只保留简略摘要</div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="min-w-12 h-12 px-4 rounded-full bg-black/88 border border-white/16 text-white text-lg font-black hover:bg-black/94 active:scale-[0.98] transition shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-sm flex items-center justify-center"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch] sm:p-6">
              <div className="flex flex-col gap-4">
                <FigureGalleryBlock
                  url={figureGalleryUrl}
                  bodyLabel={data.焦点旅客?.身材}
                  slot={figureGallerySlot}
                  failed={figureGalleryFailed}
                  onImgError={() => setFigureGalleryFailed(true)}
                  onReroll={rerollFigureGallery}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card title="身份标签" icon={Users}>
                  <Field k="姓名" v={data.焦点旅客?.姓名} />
                  <Field k="年龄" v={data.焦点旅客?.年龄 != null ? String(data.焦点旅客.年龄) : undefined} />
                  <Field k="位置" v={data.焦点旅客?.位置} />
                  <Field k="职业" v={data.焦点旅客?.职业} />
                  <Field k="倾向" v={data.焦点旅客?.倾向} />
                  <Field k="关系" v={data.焦点旅客?.关系} />
                  <Field k="性格" v={data.焦点旅客?.性格} />
                </Card>
                <Card title="生理指标" icon={Activity}>
                  <Field k="身材" v={data.焦点旅客?.身材} />
                  <Field k="三围" v={data.焦点旅客?.三围} />
                  <Field k="生理" v={data.焦点旅客?.生理} />
                  <Field k="下体" v={data.焦点旅客?.下体} />
                  <ProgressBar value={data.焦点旅客?.面具 ?? 0} label="面具" icon={Eye} color="bg-gradient-to-r from-[#ffb36f] to-[#ff7a3a]" />
                  <ProgressBar value={data.焦点旅客?.渴求 ?? 0} label="渴求" icon={Sparkles} color="bg-gradient-to-r from-[#ff8f5a] to-[#ff4d6d]" />
                </Card>
                <div className="sm:col-span-2">
                  <Card title="状态记录" icon={MapPin}>
                    <Field k="OS片段" v={data.焦点旅客?.OS片段} />
                    <Field k="近况" v={data.焦点旅客?.近况} />
                  </Card>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
