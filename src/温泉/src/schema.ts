import _ from 'lodash';
import {z} from 'zod';

const safeObj = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(val => (val == null ? {} : val), schema);

const normalizeNumber = (min: number, max: number) =>
  z.preprocess(
    val => {
      if (val == null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val.trim() === '' ? undefined : Number(val);
      return val;
    },
    // 允许预处理后得到 undefined（用于兼容 null/空字符串输入）
    z
      .number()
      .transform(v => _.clamp(Math.round(v), min, max))
      .optional(),
  );

const normalizePercent = () => normalizeNumber(0, 100);
const normalizeAge = () =>
  z.preprocess(
    val => {
      if (val == null || val === '') return undefined;
      if (typeof val === 'number') return val;
      if (typeof val === 'string') return val.trim() === '' ? undefined : Number(val);
      return val;
    },
    z
      .number()
      .transform(v => _.clamp(Math.round(v), 0, 999))
      .optional(),
  );

const actionItemSchema = safeObj(
  z.object({
    图标: z.string().optional(),
    文本: z.string().optional(),
    强调: z.coerce.boolean().optional(),
  }),
);

const focusGuestSchema = safeObj(
  z.object({
    姓名: z.string().optional(),
    年龄: normalizeAge().optional(),
    职业: z.string().optional(),
    关系: z.string().optional(),
    生理: z.string().optional(),
    身材: z.string().optional(),
    三围: z.string().optional(),
    性格: z.string().optional(),
    倾向: z.string().optional(),
    面具: normalizePercent().optional(),
    渴求: normalizePercent().optional(),
    下体: z.string().optional(),
    OS片段: z.string().optional(),
    近况: z.string().optional(),
    位置: z.string().optional(),
  }),
);

const simpleGuestSchema = safeObj(
  z.object({
    姓名: z.string().optional(),
    年龄: normalizeAge().optional(),
    状态: z.string().optional(),
    位置: z.string().optional(),
  }),
);

export const Schema = safeObj(
  z.object({
    主角: safeObj(
      z.object({
        位置: z.string().optional(),
        体力: normalizePercent().optional(),
        风险: normalizePercent().optional(),
        肉棒: z.string().optional(),
        心境: z.string().optional(),
        近况: z.string().optional(),
      }),
    ),

    焦点旅客: focusGuestSchema,
    旅客B: simpleGuestSchema,
    旅客C: simpleGuestSchema,

    环境: safeObj(
      z.object({
        冴子轨迹: z.string().optional(),
        环境预告: z.string().optional(),
        Risk: normalizePercent().optional(),
        周边视线: z.array(z.string()).optional(),
        冴子处理: z.array(z.string()).optional(),
        状态: z.string().optional(),
      }),
    ),

    建议行动: z.array(actionItemSchema).optional(),
  }),
);

export type Schema = z.output<typeof Schema>;

