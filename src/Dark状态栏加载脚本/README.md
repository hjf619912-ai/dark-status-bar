# Dark 状态栏加载脚本（酒馆助手）

## 作用

- **云酒馆**（`38.246.237.16` 任意端口）：在挂载点内用 **iframe** 加载 `当前域名/dark/index.html`（与你验证可用的方式一致）。
- **本地酒馆**（其它 host）：用 **`fetch`** 从 `http://38.246.237.16/dist/Dark` 拉取并注入（避免 jQuery 自动带 `x-csrf-token` 导致跨域预检失败）。

## 使用步骤

### 方式 A：导入 JSON（界面只让选 JSON 时）

1. 在项目根目录执行 `pnpm build` 后，再执行：
   ```bash
   node src/Dark状态栏加载脚本/build-import-json.mjs
   ```
2. 在酒馆助手中 **导入脚本**，请选择（与仓库 `初始模板/脚本/导入到酒馆中/脚本-实时修改.json` **同结构**）：
   - **优先：`TavernHelper导入.json`** — 字段为 `id`、`name`、`**content**`、`info`、`buttons`（代码在 **`content`** 里，不是 `script` / `code`）
   - 若仍报错，再试 **`TavernHelper导入-完整script字段.json`**（含 `type`、`button` 等，贴近 `@types` 里的 `Script`）

> 以前生成的 `script` / `code` 字段不符合酒馆助手导入格式，导入会失败；已修正生成逻辑。`TavernHelper导入-旧字段勿用.json` 仅作对照，请勿使用。

### 方式 B：新建脚本粘贴代码

1. 打开 `dist/Dark状态栏加载脚本/index.js`，**全选复制**。
2. 酒馆助手 → 脚本 → **新建脚本**，把代码粘贴进去保存。

### 方式 C：网络加载（需能访问你的静态地址）

新建脚本内容为：

```text
import 'https://你的域名/路径/Dark状态栏加载脚本/index.js'
```

---

1. 在酒馆助手中启用本脚本（以上任一方式）。
2. 角色卡 / 世界书 **正则「替换为」** 只保留一行占位（须包在 Markdown 代码块里，按你酒馆习惯）。以下**任选其一**，脚本都会识别：

   ```
   <div class="dark-status-hook"></div>
   ```

   若你习惯用自定义类名，也可用：

   ```
   <div class="custom-dark-status-hook"></div>
   ```

3. **查找** 仍用你的占位符（如 `<StatusPlaceHolderImpl/>`）。

### 可选：两条「云端 / 本地」局部正则，由脚本自动开关

可以。在同一张角色卡的 **局部正则** 里建两条规则，**脚本名称**分别起名为（示例）`云端` 与 `本地`（须与下面常量**一字不差**）。两条可以共用同一个「查找」正则，但「替换为」内容不同。

模板里默认已写 `'云端'` / `'本地'`。若你的脚本名称不同，请改 `index.ts` 里这两行后 **`pnpm build`**，再复制新的 `dist/.../index.js`。

**切勿**把两常量都改成 `''` 再生产打包：压缩器会把「自动同步正则」整段当成死代码删掉，酒馆里的脚本里就**再也没有**这段逻辑。

重新打包/粘贴脚本后，会用 **`getCharacter('current')` 读取完整的 `extensions.regex_scripts`**（含已禁用的条目），再 **`updateCharacterWith('current', …)`** 写回：按当前是否云主机只启用对应一条、关闭另一条。已在目标状态则不会写入。

**为何日志显示「已同步」但界面/楼层像没变化？** 仅写角色卡文件时，酒馆里正在用的「内存正则」和已渲染楼层往往不会立刻跟着变。脚本在**真正写入**后会 **`getCharacter('current')` 再 `replaceTavernRegexes(...)`**，按助手文档这会刷新正则引擎并可能**重载当前聊天**，使开关与替换立刻生效；若仍滞后可 **F5 刷新页面**。

（旧版曾用 `getTavernRegexes` 判断要不要写；在部分环境下它**只返回已启用的正则**，若你把两条都关掉则列表里没有它们，会误以为「无需写入」而永远不恢复——已改为读角色卡 JSON。）

**字段兼容：** 角色卡文件里局部正则可能是 SillyTavern 原生格式（`scriptName` + `disabled`），脚本会同时识别助手侧的 `script_name` + `enabled`，以及部分导出的 `name`。正则数组可能位于 **`extensions.regex_scripts`** 或 **`data.extensions.regex_scripts`**（v2），脚本会两处都读、都写。

**启用状态：** 写入与 `replaceTavernRegexes` 前会**同时**设置 `enabled` 与 `disabled`。若只改 `disabled` 而运行时 API 只认 `enabled`，会出现「日志已同步但 UI 仍显示关闭」的现象（已修复）。

**双份存储：** 部分角色卡同时在 `extensions.regex_scripts` 与 `data.extensions.regex_scripts` 存局部正则；脚本会**按 id 合并**后再 `replaceTavernRegexes`，并补全 `source`/`destination` 等字段，避免只刷新其中一份导致开关无效。

**诊断：** 同步成功时父页会打一条带 `host=…` 与 `replace 选项` 的日志；若你本地访问却启用了「云端」，请核对浏览器地址栏 host 是否被 `CLOUD_HOST_RE` 判为云服。

**排查：** 将 `index.ts` 里 **`REGEX_SYNC_DEBUG` 改为 `true`** 后重新打包，可看到 `[部署选择][regex]` 详细步骤（仅在当前 frame 打一条，不重复）。默认 `false` 减少控制台噪音。

**控制台搜不到「部署选择」？** 助手脚本在 **iframe 沙箱**里跑，Chrome 左上角上下文选 **top** 时，有时只能看到主页面日志。请：**先清空控制台筛选框**（不要只留「部署选择」过滤），或把上下文改成带 **iframe / tavern / helper** 字样的那一项再看。新版脚本会把日志 **镜像到父页面 `console`**，在 **top** 下过滤「部署选择」一般也能看到；若仍没有，说明脚本未加载或未执行到 `init`（检查助手是否启用、是否热重载成功）。

**日志刷屏 / 界面不停刷新？** 已对「正则同步」做 **防抖** 与 **写入后冷却**，并去掉 **`CHARACTER_EDITED` 监听**；只有真的写入角色卡后才会 `refresh`。重要日志 **优先只写到父页面 console**，在 **top** 下每条一般只出现 **一次**（不再 iframe+top 各一条）。

**刷新后开关又被关回去？** 已**不再**在 **`CHAT_CHANGED`**（聊天重载）时同步正则：`replaceTavernRegexes` 本身会触发聊天重载，若在此时再次同步，可能读到短暂过期的角色卡数据并把刚启用的规则写回关闭。换角色（`CHARACTER_PAGE_LOADED`）与应用就绪（`APP_READY`）仍会同步；脚本首次加载也会同步一次。

**注意：**

- 酒馆总设置里 **角色卡局部正则** 必须处于开启状态（`isCharacterTavernRegexesEnabled()`）。
- 修改正则列表可能触发消息重算或界面刷新，属酒馆侧行为；脚本已尽量在 `enabled` 已正确时跳过写入。

## 服务器

- 云端：`public/dark/` → 能打开 `http://你的IP:端口/dark/index.html`
- 本地跨域：`http://38.246.237.16/dist/Dark/`（Nginx 需 CORS，你已配置）

### 本地酒馆拉 Dark 报 CORS / `x-csrf-token`

酒馆会给 **jQuery `$.ajax` / `$.get`** 自动加 **`x-csrf-token`**，跨域访问远程 `index.html` 时会触发预检，远端若未在 `Access-Control-Allow-Headers` 里允许该头就会失败。本脚本已改为用 **`fetch` 拉 HTML**（不带该头）。若 **`index.js` / `index.css` 模块**仍被浏览器拦 CORS，仍需在 Nginx 上对 `/dist/Dark/` 等资源配置 CORS（与此前说明一致）。

## 修改 IP / 路径

编辑 `index.ts` 中的 `CLOUD_HOST_RE`、`REMOTE_BASE`、以及 `mountIframe` 里的 `/dark` 路径。
