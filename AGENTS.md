# 给接手的智能体 / 协作者

## 先读这三个文件

1. [`research/progress.md`](research/progress.md)：当前状态、长期口径、本轮阶段表、恢复步骤。**每次开始工作先读它。**
2. [`research/milestones.md`](research/milestones.md)：全部要求的覆盖表、M0–M11 的内容与验收标准、每个切片的深度标准。
3. [`research/queue.md`](research/queue.md)：待查、待核清单（P0–P3）。

方法与版权规则见 `research/methods.md`，数据字段见 `docs/fields.md`，构建与复现见 `docs/build.md`。

## 工作规则

- **分阶段提交。** 每完成一个阶段（progress.md 表里的一行）就更新该行（做了什么、查过没结果的、提交号）并提交，保证中断后能从下一阶段继续。不另写当日日志。推送按用户当轮的口径；发布到 main 要用户确认。
- **提交身份只能用：**
  `git -c user.name=andyuneducated -c user.email=andyuneducated@users.noreply.github.com commit ...`
  不要用本机全局 git 身份，不要写入任何公司邮箱。
- **提交前必须通过：** `npm run data:build`（校验 schema、id 引用、引文逐字核对）和 `npx tsc -b`（含 `tools/`）。改了 `src/` 再跑 `npx vitest run`；改了界面再跑 `npx vite build && npm run test:smoke`（各页在电脑和手机尺寸下不报错、不被裁切）。
- **界面只用简体中文。** 站点结论必须能追溯到入库原文；做不到的标“待核”并写明原因。
- **版权：** 机关、报刊署名作品发表满 50 年的全文收录；个人作者去世未满 50 年的只存摘录（`excerpt: true` + `keep:`），见 methods.md §6。

## 常用工具（`tools/`）

- 抓取：`fetch-wikisource.ts`（维基文库，`npm run data:fetch`）、`fetch-web.ts`（网页与 PDF；`--peek <id>` 只把全文写到 `.probe/peek-<id>.txt` 用来挑 `keep` 段落，`--list <url>` 列《人民日报》当日标题）、`ws-search.ts`（维基文库检索）。
- 检查：`audit.ts`（各时期深度标准；`--gaps` 列不达标事件，`--voices <起> <止>` 列单声部事件）、`verify-sources.ts`（离线核对原文哈希）、`people-links.ts`。
- 截图：`npx vite build && node tools/screenshots.ts "<hash>|<文件名>[|phone]"`，写到 `docs/screenshots/`。

## Windows / PowerShell 注意

- 控制台和 `>`、`*>` 重定向会把中文弄成乱码（`*>` 还会让 Playwright 崩溃）。需要中文输出时让 node 脚本直接写 UTF-8 文件（如 `WS_OUT=<file>`、`fetch-web.ts --list` 写 `.probe/rmrb-list.txt`）。
- `.probe/` 是本地草稿目录（已 gitignore），一次性脚本和报告放这里，不提交。
