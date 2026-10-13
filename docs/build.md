# 复现构建

仓库里有构建所需的一切：原文、缩略图、照片、底图都已入库，构建不联网。按下面的步骤，任何人都能从一个 commit 得到与线上相同的站点和数据。

## 需要

- [Node.js](https://nodejs.org/) 24 或更高（工具脚本直接运行 TypeScript，不经编译）。
- git。冒烟测试另需 Playwright 的 Chromium，第一次运行时安装。

## 步骤

```bash
git clone https://github.com/AndyUneducated/red-decade.git
cd red-decade
git checkout <commit>          # 要复现某个数据版本时；版本号见 data/open/index.json
npm ci                         # 按 package-lock.json 安装，版本完全一致
npm run build                  # 校验数据 → 生成 public/data → 类型检查 → 打包到 dist/
npm test                       # 单元测试
npx playwright install chromium
npm run test:smoke             # 每个页面在电脑与手机尺寸下打开：无脚本错误、有标题、内容不被裁切
node tools/verify-sources.ts   # 离线核对原文文件与抓取日志的 SHA-256
```

`npm run build` 的第一步 `npm run data:build` 会打印各类数据的条数，任何错误都会让它失败并列出原因，不写出任何文件。GitHub Actions（`.github/workflows/pages.yml`）在每次推送到 `main` 时执行同样的步骤，全部通过后才部署。

## 构建做了什么

`tools/build-data.ts` 依次运行 `tools/build/` 下的六个阶段：

| 阶段 | 文件 | 内容 |
|---|---|---|
| 1 读入 | `load.ts` | 读 `content/`、`research/claims.yaml`、`research/manifests/` 与 `sources/text/`，逐条按 `src/data/schema.ts` 校验 |
| 2 关联 | `link.ts` | 把出生地、职务里的机构名、机构负责人等按名字关联到 id |
| 3 检查 | `check.ts` | 未知或重复的 id、未知出处、日期倒序或超出生卒、既无出处又未标“待核”的记录 |
| 4 引文 | `quotes.ts` | 每一句引文都必须逐字出现在它的出处全文里 |
| 5 汇编 | `emit.ts` | 词频、引用网络等派生数据，写出 `public/data/atlas.json` 与 `public/data/texts/` |
| 6 开放数据 | `open.ts` | 按 `src/data/open.ts` 写出 `public/data/open/` 的 JSON 与 CSV；登记稳定 id（`research/ids.txt`），已发布的 id 消失即失败；生成 `docs/fields.md` |

同一 commit 两次构建，`open/` 下的表逐字节相同，`atlas.json` 与 `open/index.json` 只差构建时间（`builtAt`）；`index.json` 另记 commit。`research/ids.txt` 与 `docs/fields.md` 由构建改写，改了数据之后连同数据一起提交。

## 原文从哪里来

原文不是构建时下载的，而是事先抓取并入库：

- `research/manifests/*.yaml` 列出每份文献（`wikisource:` 下是维基文库页面，`web:` 下是其他网页）。
- `npm run data:fetch -- <id>`（`tools/fetch-wikisource.ts`）和 `node tools/fetch-web.ts <id>` 抓取原文，写入 `sources/raw/`（原始页面）与 `sources/text/`（纯文本），并在 `research/fetch-log.jsonl` 追加一行：维基文库修订号 `revid`、抓取时间、原始页面的 SHA-256、许可模板。
- 维基文库页面会被编辑，再次抓取得到的可能是新版本。核对时应看 `fetch-log.jsonl` 记录的 `oldid` 版本；`tools/verify-sources.ts` 检查仓库里的原文文件仍是当时抓到的那一份。
- 只存摘录的来源（`excerpt: true`）不保存原始页面，理由见 [`research/methods.md`](../research/methods.md) 第 6 节。

视觉档案与人物照片同理：`tools/fetch-archive.ts`、`tools/fetch-photos.ts` 把 Wikimedia Commons 的元数据写入 `content/archive/commons.yaml`、`content/photos.yaml`，缩略图存入 `public/archive/`、`public/photos/`。

## 目录

| 目录 | 内容 |
|---|---|
| `content/` | 人物、事件、派系、机构、关系、概念、专题、档案等（YAML，人工编写） |
| `research/` | 来源清单、抓取日志、研究结论、id 登记、研究日志、方法与进度 |
| `sources/` | 抓取的原文：`raw/` 原始页面，`text/` 纯文本 |
| `tools/` | 检索、抓取、核对与数据构建 |
| `src/` | 前端（React + TypeScript + D3）与共用的数据模型 |
| `docs/` | 本文档、开放数据说明与字段表 |
| `tests/` | 单元测试（`unit/`）与冒烟测试（`smoke/`） |
