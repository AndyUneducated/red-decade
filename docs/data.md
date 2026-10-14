# 开放数据

站内的全部数据都可以下载，不需要运行任何代码。站内入口是“史料 › 开放数据”（[`#/data`](https://andyuneducated.github.io/red-decade/#/data)），那里也能为任意一条数据生成引用。

## 下载

所有文件都在 `https://andyuneducated.github.io/red-decade/data/` 下：

| 文件 | 内容 |
|---|---|
| `open/index.json` | 目录：构建时间、版本（git commit）、许可，以及每张表的条数、文件名、字段说明 |
| `open/<表>.json` | 一张表的全部记录，嵌套字段完整保留，UTF-8 |
| `open/<表>.csv` | 同一张表，每条一行，只含平面字段；UTF-8 带 BOM，CRLF 换行，RFC 4180 引号规则，Excel 可直接打开 |
| `open/ids.txt` | 发布过的全部稳定 id，每行一个 `<表>/<id>` |
| `open/moved.json` | 改名、合并或撤下的 id 及其去向 |
| `atlas.json` | 站点使用的完整构建产物，另含词频、引用网络等派生数据 |
| `texts/<来源 id>.txt` | 原始文献全文（纯文本） |

共 23 张表，每张表的每一列见 [`fields.md`](fields.md)。其中 17 张是主表，有稳定 id；6 张（`fates`、`positions`、`leaders`、`evidence`、`counts`、`points`）是把主表里的嵌套列表展开成的 CSV，通过主表的 id 关联。

## 格式约定

- **日期**写成 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD`，只写到原文能确定的精度。`1966-08` 表示 1966 年 8 月某日，不是 8 月 1 日。按字符串排序就是时间顺序。
- **出处**（`cite`、`cites`）是 `sources` 表的 id，可以带 `@` 加页码、条目或段落，如 `ws-1980-indictment@第二部分`。来源有全文的，全文在 `texts/<id>.txt`；维基文库来源的 `url` 指向抓取时的那一版（`oldid=<revid>`）。
- **`verify: true`** 表示这条事实还没有与库内原文逐字核对（“待核”）。不带这个标记的事实都有可核对的出处。
- **引文**（`quote` 字段，以及 `quote: true` 的声部）在构建时与出处全文逐字比对，比对不上构建就会失败。没有标 `quote` 的声部是转述。
- **声部**（`voice`）区分说法的来源：原始文件、当时官方、1980 年代审判、1981 年决议、亲历者、学术研究等。同一件事的不同说法并列，不合并成一个答案。
- **数字**只在原文给出数字时填 `value`；原文的约数用语（余、多、近）保留在 `approx`。不同出处的数字并列，不取平均。
- CSV 中的列表（如 `factions`、`cites`）用英文分号 `;` 连接；构建会检查列表项里没有分号。

## 稳定 id

- 主表的每条记录有一个 id：小写字母、数字和单个连字符，例如人物 `liu-shaoqi`、事件 `1966-08-18-first-rally`；研究结论是 `C` 加三位数字，如 `C013`。省级革委会表以机构 id 作 id。
- 关系没有手写的 id，构建时生成 `a~type~b`，例如 `mao-zedong~spouse~jiang-qing`；同一对人同一种关系出现多次时加 `~2`、`~3`。
- **id 发布后不会消失。** `research/ids.txt` 登记每一次构建发布过的全部 id。某个 id 从数据里消失时构建会失败，除非在 `content/ids-moved.yaml` 写明它改成了什么、并入了哪条，或者为何撤下。去向公布在 `open/moved.json`；站内旧网址（详情页和抽屉里选中的条目）打开时自动改到新 id。
- 同一个 id 在不同表里可以重复（`shanghai` 同时是派系“上海市委”、地点上海和数字争议里的上海“立案审查”），所以引用时总是写成 `<表>/<id>`。

## 引用

引用一条数据，写明表、id、数据版本和网址：

> 红色年代 · Red Decade，人物 people/liu-shaoqi，数据版本 70582d9，https://andyuneducated.github.io/red-decade/#/people/liu-shaoqi，访问于 2026-10-13。

- **数据版本**是构建所用的 git commit，见 `open/index.json` 的 `commit` 或开放数据页。按这个 commit 检出仓库并构建，得到的就是当时的数据（见 [`build.md`](build.md)）。
- **网址**：有站内页面的表，用 `index.json` 里的 `link` 模板（把 `{id}` 换成 id），如人物 `#/people/<id>`、事件 `#/timeline?sel=event:<id>`、结论 `#/research?sel=claim:<id>`；没有页面的表，写下载文件的网址加 id。
- 引用原始文献时，应引原文本身（标题、日期、作者，维基文库加 `oldid`），本站只是转录与整理。

## 许可

- 本站整理的数据与研究（`content/`、`research/` 以及由其生成的 `open/`、`atlas.json`）：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans)，使用时注明出处。
- 原始文献全文（`texts/`）不在 CC BY 4.0 之内，版权状态以来源页面为准，规则见 [`research/methods.md`](../research/methods.md) 第 6 节。
- 视觉档案的缩略图各有许可，见 `archive` 表的 `license`、`author`、`url`。
