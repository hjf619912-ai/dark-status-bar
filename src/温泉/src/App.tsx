/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {
  Activity,
  Eye,
  MapPin,
  ShieldAlert,
  Sparkles,
  User,
  Users,
  Wand2,
} from 'lucide-react';
import {Schema as StatSchema, type Schema} from './schema';

type UpdateMessage = {type: 'TavernHotSpringUpdate'; payload: unknown};
type ActionMessage = {type: 'TavernHotSpringAction'; text: string};

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
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/55">
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

const Field = ({k, v}: {k: string; v?: React.ReactNode}) => (
  <div className="grid grid-cols-[92px_1fr] gap-3 py-2 border-b border-white/5 last:border-b-0">
    <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold">{k}</div>
    <div className="text-[12px] text-white/80 leading-relaxed wrap-break-word">{v ?? <span className="text-white/30">—</span>}</div>
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
    <div className="p-4">{children}</div>
  </section>
);

const demo: Schema = {
  主角: {位置: '露天汤池·回廊', 体力: 68, 风险: 15, 肉棒: '半硬', 心境: '跃跃欲试', 近况: '热气蒸腾，心跳加速'},
  焦点旅客: {
    姓名: '雪乃',
    年龄: 24,
    职业: '温泉旅馆接待',
    关系: '同行旅客',
    生理: '呼吸微乱',
    身材: '匀称偏纤细，线条柔和',
    三围: '88/56/86',
    性格: '外冷内热，谨慎克制',
    倾向: '偏向试探与观察',
    面具: 42,
    渴求: 85,
    下体: '湿润',
    OS片段: '……别靠太近。',
    近况: '目光游移，似在等待',
    位置: '你身侧',
  },
  旅客B: {姓名: '冴子', 年龄: 27, 状态: '正靠近', 位置: '回廊尽头'},
  旅客C: {姓名: '旅客C', 年龄: 19, 状态: '未知', 位置: '更衣间'},
  环境: {
    冴子轨迹: '回廊 → 汤池',
    环境预告: '脚步声渐近',
    Risk: 35,
    周边视线: ['木屐声', '薰香', '水波轻响'],
    冴子处理: ['等待接近', '观察动向'],
    状态: '温泉区正常开放',
  },
  建议行动: [{图标: 'Sparkles', 文本: '感官试探', 强调: true}, {图标: 'Wand2', 文本: '查看详情'}],
};

export default function App() {
  const [raw, setRaw] = useState<unknown>(undefined);
  const [data, setData] = useState<Schema>(() => demo);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const msg = ev.data as UpdateMessage | undefined;
      if (!msg || msg.type !== 'TavernHotSpringUpdate') return;

      setRaw(msg.payload);
      const parsed = StatSchema.safeParse(msg.payload);
      if (!parsed.success) {
        setParseError(parsed.error.message);
        console.warn('[温泉] 变量解析失败（已隐藏详情面板）', parsed.error);
        return;
      }
      setParseError(null);
      setData(parsed.data);
      setLastUpdated(Date.now());
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

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

  const actionTheme = (icon?: string) => {
    switch (icon) {
      case '🔧':
        return {
          border: 'border-rose-300/45',
          bg: 'bg-rose-200/14',
          hover: 'hover:bg-rose-200/22',
          text: 'text-rose-50',
          badge: 'text-rose-100/80',
        };
      case '🔞':
        return {
          border: 'border-pink-300/45',
          bg: 'bg-pink-200/14',
          hover: 'hover:bg-pink-200/22',
          text: 'text-pink-50',
          badge: 'text-pink-100/80',
        };
      case '🥛':
        return {
          border: 'border-fuchsia-300/45',
          bg: 'bg-fuchsia-200/14',
          hover: 'hover:bg-fuchsia-200/22',
          text: 'text-fuchsia-50',
          badge: 'text-fuchsia-100/80',
        };
      case '🚶':
        return {
          border: 'border-orange-200/45',
          bg: 'bg-orange-100/14',
          hover: 'hover:bg-orange-100/22',
          text: 'text-orange-50',
          badge: 'text-orange-100/80',
        };
      default:
        return {
          border: 'border-white/18',
          bg: 'bg-white/10',
          hover: 'hover:bg-white/14',
          text: 'text-[#fff5fa]',
          badge: 'text-[#ffe5f0]/70',
        };
    }
  };

  const sendActionToParent = (text: string) => {
    const content = String(text ?? '').trim();
    if (!content) return;

    // 优先：如果同源，直接写父页面输入框（无需正则桥接；参考 Dark 的做法）
    try {
      const jqParent = (window.parent as any)?.$;
      if (typeof jqParent === 'function') {
        const input = jqParent(
          '#send_textarea, textarea[name="send_textarea"], textarea#send_textarea, #send_text, textarea[data-testid="send_textarea"], textarea.mes_textarea',
        )
          .filter((_: any, el: any) => jqParent(el).is(':visible'))
          .first();
        if (input && input.length) {
          const textarea = input[0] as HTMLTextAreaElement;
          const prev = String(textarea?.value ?? '');
          textarea.value = prev.trim().length > 0 ? `${prev}\n${content}` : content;
          textarea.dispatchEvent(new Event('input', {bubbles: true}));
          textarea.dispatchEvent(new Event('change', {bubbles: true}));
          textarea.focus();
          try {
            const end = textarea.value.length;
            textarea.setSelectionRange(end, end);
          } catch {
            // ignore
          }
          return;
        }
      }
    } catch {
      // 跨域会直接抛 SecurityError，忽略后走 postMessage
    }

    // 退路：跨域/拿不到父页面 DOM → 用 postMessage 让父页面脚本代写
    const msg: ActionMessage = {type: 'TavernHotSpringAction', text: content};
    try {
      // 你的场景可能是“酒馆页面(顶层) → 楼层/正则作用域 → 该 iframe”，因此要同时发给 parent 和 top
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
  };

  return (
    <div className="h-full bg-[radial-gradient(circle_at_top,_rgba(71,33,13,0.98),_rgba(25,15,10,0.99)_42%,_rgba(4,3,4,1)_100%)] text-[#f5f7fb] font-sans selection:bg-orange-300/25 selection:text-white overflow-hidden">
      <div className="h-full max-w-5xl mx-auto flex flex-col overflow-hidden">
        <header className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">♨️</div>
            <div>
              <div className="text-sm sm:text-base font-extrabold tracking-[0.35em] text-[#ffd29a] drop-shadow-[0_1px_0_rgba(255,255,255,0.06)]">温泉 · 变量面板</div>
              <div className="text-[11px] text-[#d9b48a]/72 font-mono">
                postMessage: <span className="text-[#f4f7ff]">{'TavernHotSpringUpdate'}</span>
                {lastUpdated ? (
                  <>
                    {' · '}
                    <span className={connected ? 'text-emerald-300' : 'text-orange-200'}>
                      {connected ? '已连接' : '已断开/等待'}
                    </span>
                    {' · '}
                    <span className="text-[#d6b79a]/65">更新于 {new Date(lastUpdated).toLocaleTimeString()}</span>
                  </>
                ) : (
                  <> · <span className="text-slate-300">等待数据（当前显示 Demo）</span></>
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRaw(v => !v)}
              className="text-xs px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-[#fff6fb] hover:bg-white/15 transition shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
            >
              {showRaw ? '隐藏原始数据' : '显示原始数据'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
          {showRaw ? (
            <div className="rounded-xl border border-white/10 bg-black/40 p-4">
              <div className="text-[11px] uppercase tracking-widest text-white/55 mb-2">raw payload</div>
              <pre className="text-[11px] leading-relaxed text-white/70 whitespace-pre-wrap wrap-break-word font-mono">
                {JSON.stringify(raw ?? data, null, 2)}
              </pre>
            </div>
          ) : null}

          {/* 主角（左列） + 焦点旅客（右列） */}
          <section className="rounded-xl border border-[#5a3720]/62 overflow-hidden bg-[linear-gradient(180deg,rgba(53,31,18,0.95),rgba(24,14,10,0.98)_44%,rgba(8,6,7,0.99))] shadow-[0_26px_78px_rgba(0,0,0,0.78)] backdrop-blur-2xl">
            <div className="px-4 py-3 border-b border-[#c06d2e]/32 bg-[linear-gradient(90deg,rgba(86,48,22,0.96),rgba(56,31,16,0.94),rgba(255,255,255,0.04))]">
              <div className="text-[12px] font-extrabold tracking-[0.25em] text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.20)]">主角 · 焦点旅客</div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch auto-rows-fr">
                {/* 左侧：主角 */}
                <div className="h-full rounded-lg border border-[#5b3822]/58 bg-[linear-gradient(180deg,rgba(40,23,15,0.96),rgba(22,12,9,0.98)_44%,rgba(8,5,6,0.99))] p-4 flex flex-col min-h-0 shadow-[inset_0_1px_0_rgba(255,220,180,0.06),0_14px_36px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
                  <div className="flex items-center gap-2 mb-3 shrink-0">
                    <User size={14} className="text-white" />
                    <div className="text-xs font-black tracking-widest text-white">主角</div>
                  </div>
                  <div className="space-y-3 min-h-0 flex-1">
                    <Field k="位置" v={data.主角?.位置} />
                    <div className="grid grid-cols-1 gap-3">
                      <ProgressBar
                        value={data.主角?.体力 ?? 0}
                        label="体力"
                        icon={Activity}
                        color="bg-gradient-to-r from-emerald-500 to-teal-400"
                      />
                      <ProgressBar
                        value={data.主角?.风险 ?? 0}
                        label="风险"
                        icon={ShieldAlert}
                        color="bg-gradient-to-r from-orange-500 to-rose-500"
                      />
                    </div>
                    <Field k="肉棒" v={data.主角?.肉棒} />
                    <Field k="心境" v={data.主角?.心境} />
                    <Field k="近况" v={data.主角?.近况} />
                  </div>
                </div>

                {/* 右侧：焦点旅客（抽屉触发） */}
                <div className="h-full rounded-lg border border-[#5b3822]/58 bg-[linear-gradient(180deg,rgba(40,23,15,0.96),rgba(22,12,9,0.98)_44%,rgba(8,5,6,0.99))] p-4 flex flex-col min-h-0 shadow-[inset_0_1px_0_rgba(255,220,180,0.06),0_14px_36px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
                  <div className="flex items-center gap-2 mb-3 shrink-0 justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-white" />
                      <div className="text-xs font-black tracking-widest text-white">焦点旅客</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(true)}
                      className="text-[12px] px-3 py-2 rounded-lg bg-black/88 border border-white/18 text-white hover:bg-black/94 active:scale-[0.99] transition shadow-[0_8px_24px_rgba(0,0,0,0.50)] backdrop-blur-sm font-bold"
                    >
                      查看详情
                    </button>
                  </div>

                  <div className="space-y-3 min-h-0 flex-1">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-base font-black text-white drop-shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                          {data.焦点旅客?.姓名 ?? '—'}
                          {data.焦点旅客?.年龄 != null ? (
                            <span className="ml-2 text-xs font-mono text-white/45">({data.焦点旅客?.年龄}Y)</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-300/72 font-mono shrink-0">{data.焦点旅客?.位置 ?? ''}</div>
                      </div>
                      <div className="text-[12px] text-slate-100 leading-relaxed">
                        {data.焦点旅客?.职业 ?? '未知职业'} / {data.焦点旅客?.倾向 ?? '倾向未明'} / {data.焦点旅客?.三围 ?? '三围未明'}
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <ProgressBar
                          value={data.焦点旅客?.面具 ?? 0}
                          label="面具"
                          icon={Eye}
                          color="bg-gradient-to-r from-[#ffb36f] to-[#ff7a3a]"
                        />
                        <ProgressBar
                          value={data.焦点旅客?.渴求 ?? 0}
                          label="渴求"
                          icon={Sparkles}
                          color="bg-gradient-to-r from-[#ff8f5a] to-[#ff4d6d]"
                        />
                      </div>
                      <div className="text-[11px] text-slate-200 leading-relaxed italic">
                        {data.焦点旅客?.OS片段 ?? '内心独白尚未公开'}
                      </div>
                      <div className="text-[11px] text-slate-300 leading-relaxed">
                        {data.焦点旅客?.近况 ?? '近况未明'}
                      </div>
                      <div className="text-[11px] text-slate-300 leading-relaxed">
                        {data.焦点旅客?.身材 ?? '身材未明'}
                      </div>
                    </div>


                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card title="旅客B / 旅客C" icon={Users}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-black tracking-widest text-white/80 mb-2">旅客B</div>
                <Field k="姓名" v={data.旅客B?.姓名} />
                <Field k="年龄" v={data.旅客B?.年龄} />
                <Field k="状态" v={data.旅客B?.状态} />
                <Field k="位置" v={data.旅客B?.位置} />
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-black tracking-widest text-white/80 mb-2">旅客C</div>
                <Field k="姓名" v={data.旅客C?.姓名} />
                <Field k="年龄" v={data.旅客C?.年龄} />
                <Field k="状态" v={data.旅客C?.状态} />
                <Field k="位置" v={data.旅客C?.位置} />
              </div>
            </div>
          </Card>

          <Card title="环境" icon={MapPin}>
            <div className="space-y-3">
              <Field k="冴子轨迹" v={data.环境?.冴子轨迹} />
              <Field k="环境预告" v={data.环境?.环境预告} />
              <Field k="Risk" v={data.环境?.Risk} />
              <Field k="状态" v={data.环境?.状态} />
              <div>
                <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold mb-2">周边视线</div>
                <div className="flex flex-wrap gap-2">
                  {(data.环境?.周边视线 ?? []).length ? (
                    (data.环境?.周边视线 ?? []).map((t, i) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-white/30">—</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold mb-2">冴子处理</div>
                <div className="flex flex-wrap gap-2">
                  {(data.环境?.冴子处理 ?? []).length ? (
                    (data.环境?.冴子处理 ?? []).map((t, i) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-white/30">—</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title="建议行动" icon={Wand2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {actionSlots.map((a, i) => {
                const isEmpty = !a || (!a.文本 && !a.图标);
                const theme = actionTheme(a?.图标);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isEmpty}
                    onClick={() => {
                      if (!a?.文本) return;
                      sendActionToParent(a.文本);
                    }}
                    className={`rounded-lg border p-3 transition min-h-[52px] flex items-center justify-between gap-3 text-left ${
                      isEmpty
                        ? 'border-white/10 bg-white/3 text-white/25 cursor-not-allowed'
                        : a.强调
                          ? 'border-orange-400/70 bg-orange-500/12 hover:bg-orange-500/16 ring-2 ring-orange-400/35 ring-offset-2 ring-offset-black/40'
                          : `${theme.border} ${theme.bg} ${theme.hover} cursor-pointer`
                    }`}
                  >
                    <div className={`text-sm font-bold ${isEmpty ? 'text-white/25' : theme.text}`}>
                      {isEmpty ? '—' : a.文本}
                    </div>
                    {!isEmpty && a?.图标 ? (
                      <div className={`text-[12px] font-mono ${theme.badge}`}>{a.图标}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {actionList.length > 4 ? (
              <div className="mt-3 text-[11px] text-white/35 font-mono">还有 {actionList.length - 4} 条未显示</div>
            ) : null}
          </Card>

          <footer className="text-[11px] text-white/35 font-mono pb-2">
            期望你正则里发的是 <span className="text-white/55">stat_data</span> 本体（即本 Schema 对应对象），并用{' '}
            <span className="text-white/55">postMessage</span> 推到 iframe。
          </footer>
        </main>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.78)] backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
            <div className="w-full max-w-4xl max-h-[92vh] bg-[linear-gradient(180deg,rgba(26,16,12,0.98),rgba(12,8,7,0.99)_44%,rgba(4,3,4,1))] border border-[#5a3822]/42 rounded-t-3xl sm:rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.76)] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[#8a552f]/28 bg-[linear-gradient(90deg,rgba(116,68,32,0.42),rgba(61,36,22,0.22),rgba(255,255,255,0.03))] shrink-0">
                <div>
                  <div className="text-sm font-extrabold tracking-[0.25em] text-white">焦点旅客详情</div>
                  <div className="text-[11px] text-slate-300 mt-1">完整字段在这里查看，主界面只保留简略摘要</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="min-w-12 h-12 px-4 rounded-full bg-black/88 border border-white/16 text-white text-lg font-black hover:bg-black/94 active:scale-[0.98] transition shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-sm"
                  aria-label="关闭抽屉"
                >
                  ×
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto min-h-0 flex-1 space-y-4">
                <section className="rounded-xl border border-[#6a4228]/42 bg-[linear-gradient(180deg,rgba(20,12,10,0.96),rgba(11,7,6,0.98))] p-4 space-y-3 shadow-[inset_0_1px_0_rgba(255,220,180,0.05),0_12px_30px_rgba(0,0,0,0.50)] backdrop-blur-2xl">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-xl font-black text-white">
                      {data.焦点旅客?.姓名 ?? '—'}
                      {data.焦点旅客?.年龄 != null ? (
                        <span className="ml-2 text-xs font-mono text-slate-400">({data.焦点旅客?.年龄}Y)</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{data.焦点旅客?.位置 ?? ''}</div>
                  </div>
                  <div className="text-[13px] text-slate-200 leading-relaxed">
                    {data.焦点旅客?.职业 ?? '未知职业'} · {data.焦点旅客?.性格 ?? '性格未明'} · {data.焦点旅客?.倾向 ?? '倾向未明'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ProgressBar
                      value={data.焦点旅客?.面具 ?? 0}
                      label="面具"
                      icon={Eye}
                      color="bg-gradient-to-r from-[#ff9a54] to-[#ff6a2a]"
                    />
                    <ProgressBar
                      value={data.焦点旅客?.渴求 ?? 0}
                      label="渴求"
                      icon={Sparkles}
                      color="bg-gradient-to-r from-[#ff8b5d] to-[#ff4770]"
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-[#6a4228]/42 bg-[linear-gradient(180deg,rgba(20,12,10,0.96),rgba(11,7,6,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,220,180,0.05),0_12px_30px_rgba(0,0,0,0.50)] backdrop-blur-2xl">
                  <div className="text-xs font-black tracking-widest text-slate-300 mb-3">完整信息</div>
                  <div className="space-y-3">
                    <Field k="职业" v={data.焦点旅客?.职业} />
                    <Field k="关系" v={data.焦点旅客?.关系} />
                    <Field k="生理" v={data.焦点旅客?.生理} />
                    <Field k="身材" v={data.焦点旅客?.身材} />
                    <Field k="三围" v={data.焦点旅客?.三围} />
                    <Field k="性格" v={data.焦点旅客?.性格} />
                    <Field k="倾向" v={data.焦点旅客?.倾向} />
                    <Field k="下体" v={data.焦点旅客?.下体} />
                    <Field k="OS片段" v={data.焦点旅客?.OS片段} />
                    <Field k="近况" v={data.焦点旅客?.近况} />
                  </div>
                </section>

                <div className="sm:hidden h-2" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
