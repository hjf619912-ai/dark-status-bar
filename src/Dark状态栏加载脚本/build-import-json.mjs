import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const jsPath = path.join(root, 'dist/Dark状态栏加载脚本/index.js');

/** 固定 id，重复导入时助手通常视为同一条脚本（具体行为以你使用的助手版本为准） */
const SCRIPT_IMPORT_ID = 'd4a5f600-8b2c-4e1f-9a0d-1234567890ab';

let code = fs.readFileSync(jsPath, 'utf8');
code = code.replace(/\r?\n\/\/# sourceMappingURL=.*$/, '');

const info =
  '云端 iframe + 本地 $.get；正则「替换为」只放 <div class="dark-status-hook"></div>（或 custom-dark-status-hook）。可选：局部正则脚本名「云端」「本地」自动开关。';

/**
 * 与仓库「初始模板/脚本/导入到酒馆中/脚本-实时修改.json」相同字段，
 * 酒馆助手「导入脚本」应使用此格式（content = 代码本体，不是 script/code）。
 */
const tavernHelperImport = {
  id: SCRIPT_IMPORT_ID,
  name: 'Dark状态栏加载脚本',
  content: code,
  info,
  buttons: [],
};

const outMain = path.join(__dirname, 'TavernHelper导入.json');
fs.writeFileSync(outMain, JSON.stringify(tavernHelperImport, null, 2), 'utf8');
console.log('written:', outMain);

/** 与 @types 中 Script 结构接近，部分版本若只认完整结构可试此文件 */
const fullScriptShape = {
  type: 'script',
  enabled: true,
  id: SCRIPT_IMPORT_ID,
  name: 'Dark状态栏加载脚本',
  content: code,
  info,
  button: { enabled: false, buttons: [] },
  data: {},
};
const outFull = path.join(__dirname, 'TavernHelper导入-完整script字段.json');
fs.writeFileSync(outFull, JSON.stringify(fullScriptShape, null, 2), 'utf8');
console.log('written:', outFull);

/** 旧版误用字段，保留一份以免老文档外链失效；请勿优先使用 */
const legacyWrong = {
  name: 'Dark状态栏加载脚本',
  display_name: 'Dark状态栏加载脚本',
  description: info,
  script: code,
};
const outLegacy = path.join(__dirname, 'TavernHelper导入-旧字段勿用.json');
fs.writeFileSync(outLegacy, JSON.stringify(legacyWrong, null, 2), 'utf8');
console.log('written (legacy, 勿优先):', outLegacy);
