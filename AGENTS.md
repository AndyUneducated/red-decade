# 给接手的智能体 / 协作者

## 先读这三个文件

1. [`research/progress.md`](research/progress.md)：当前里程碑、阶段表、下一步、恢复步骤。**每次开始工作先读它。**
2. [`research/milestones.md`](research/milestones.md)：全部要求的覆盖表、M0–M11 的内容与验收标准、每个切片的深度标准。
3. [`research/queue.md`](research/queue.md)：待查、待核清单（P0–P3）。

当天的检索过程和遇到的问题写在 `research/log/<日期>-<里程碑>.md`，方法与版权规则见 `research/methods.md`。

## 工作规则

- **分阶段提交并推送。** 每完成一个阶段（progress.md 表里的一行）就更新 progress.md、写日志、提交、推送，保证中断后能从下一阶段继续。
- **提交身份只能用：**
  `git -c user.name=andyuneducated -c user.email=andyuneducated@users.noreply.github.com commit ...`
  不要用本机全局 git 身份，不要写入任何公司邮箱。
- **提交前必须通过：** `npm run data:build`（校验 schema、id 引用、引文逐字核对）和 `npx tsc -b`。
- **界面只用简体中文。** 站点结论必须能追溯到入库原文；做不到的标“待核”并写明原因。
- **版权：** 机关、报刊署名作品发表满 50 年的全文收录；个人作者去世未满 50 年的只存摘录（`excerpt: true` + `keep:`），见 methods.md §6。

## Windows / PowerShell 注意

- 控制台和 `>` 重定向会把中文弄成乱码。需要中文输出时让 node 脚本直接写 UTF-8 文件（如 `WS_OUT=<file>`、`fetch-web.ts --list` 写 `.probe/rmrb-list.txt`）。
- `.probe/` 是本地探针目录（已 gitignore）：`shot.mjs` 截图、`layout.mjs` 查各视图的裁切与滚动、`peek.mjs` 抓网页纯文本。截图前先 `npx vite build`。
