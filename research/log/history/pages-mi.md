# 历史：pages-mi

> 原样移自 research/progress.md（2026-10-31 精简）。

## 已完成：页面架构与 MI 洞察（2026-10-12 用户提出，10-13 夜间完成）

用户选定的顺序：先改页面架构，让菜单与页面以后能随时挪动、单独测试；再做数据架构 B-1–B-3（用户选定：数据暂不分包，仍是一个 `atlas.json`；规则外置、监听构建、洞察数字校验暂不做）；最后做 MI 洞察（内容见 `milestones.md` MI 节），洞察既嵌在人物、思想、派系等各页，也在顶栏单设“洞察”一组汇总。旧链接不保留。

| 阶段 | 内容 | 状态 |
|---|---|---|
| A-1 | 页面注册表、菜单配置、路由纯函数 | ✔ 见下“页面架构” |
| A-2 | 各视图改用页面 id；思想组 5 个分页拆成独立页面；页面按需加载 | ✔ 每页一个代码块，首屏不再加载其他页 |
| A-3 | 测试：Vitest 单元测试，Playwright 全页面冒烟（桌面 1440×900、手机 390×844） | ✔ 单元 10 项；冒烟 50 项（25 个地址 × 2 种尺寸）。冒烟顺带查出两处手机端裁切：研究页统计格的长数字被截（改为两列），派系档案掌控机构名被截，已修 |
| A-4 | CI 跑两种测试后再部署 | ✔ `.github/workflows/pages.yml` |
| B-1 | 共享派生层 `src/derive/`：构建脚本与前端共用的纯函数（引文核对、语料计数、地名与机构匹配），Vitest 可测；atlas 索引与下载分开，测试可直接索引真实数据；洞察的计算也放这里（需要全文的在构建时算，只用结构化数据的在浏览器算） | ✔ `src/derive/quotes.ts`、`corpus.ts`、`match.ts`；`src/data/atlas.ts` 的 `indexAtlas`；部分日期比较 `after` 进 `src/lib/dates.ts`（该文件不得有 import，构建在纯 Node 下直接读它）。`src/derive/` 内部 import 带 `.ts` 后缀，原因同上。单元测试 12 项（`tests/unit/derive.test.ts`），含对真实 atlas 的索引 |
| B-2 | 构建脚本按阶段拆成几个文件（读取、关联、校验、引文、语料与输出），不做插件式注册表 | ✔ `tools/build/{io,load,link,check,quotes,emit}.ts`，`tools/build-data.ts` 只按顺序调用。拆分前后 `atlas.json` 除构建时间外逐字段相同。构建脚本纳入 `tsc -b`（`tsconfig.node.json`）。加一种数据：schema → `load.ts` 一行 → `check.ts` 校验 → `emit.ts` 输出 |
| B-3 | `Drawer.tsx` 按实体种类拆文件，加一张“种类 → 卡片”对照表 | ✔ `src/components/drawer/`：每种卡片一个文件，`lists.tsx` 放人物页、机构页共用的列表，`cards.ts` 是对照表（`Record<EntityType, …>`，新种类没配卡片就编译不过）。冒烟测试加 8 种卡片各一个样例（64 项全过）；顺带发现旧探测脚本里的概念 id `capitalist-roader` 少了 s |

**2026-10-13 用户安排（夜间长时间执行）：** 架构做轻量版，避免为设计而设计 → B 完成后做 MI（“洞察”组放在“思想”与“史料”之间）→ MI 完成后进入 M6。期间只在本地分阶段提交，**不推送**；用户醒来后一次推送并发布。
| MI-0 | “洞察”菜单组与页内嵌入块框架；P 洞见卡 | ✔ P：研究结论加 `isms`、`factions` 两个标注字段（31 条按结论原文标注，`check.ts` 校验 id）；机构不手标，结论原文提到机构名即关联（与事件同一个 `orgMentioner`）。`ix.claimsBy[种类]` 一处索引，`<ClaimLinks on=种类 id=…>` 没有结论时不显示，已挂到人物、事件、概念、主义、派系、机构的卡片和人物、派系、机构详情页。框架只做一个共用外壳 `src/views/insights/Insight.tsx`（问题、方法与局限、正文），每个洞察是 `pages.ts` 里普通的一页、在“洞察”组；没有另设洞察注册表 |
| MI-1 | 思想：A–F | ✔ 需要全文的在构建时算（`tools/build/emit.ts`，纯函数在 `src/derive/corpus.ts`），词表在 `content/insight-terms.yaml`。A `#/drift` 词义漂移（每个概念四个时期里匹配词前后 60 字内最常出现的人，`concepts[].near`；毛泽东默认隐去）；B `#/authority` 权威来源（官方文本逐年每万字称引次数，不足 2 万字的年份留空；已建档的人用人物 id）；C `#/attribution` 归因追踪（至少 3 种叙述者的事件，逐条列出点名的人，只在一种叙述里出现的加框）；D `#/spread` 口号传播（各类文本中的首现）；E `#/selfcrit` 检讨文体（5 篇检讨 × 13 个用语）；F `#/citations` 文献互引（书名号点名，被引文献不晚于引用者；加上 `documents.pairs` 的反驳，红色） |
| MI-2 | 人物：G–J | ✔ G `#/survival` 生存曲线（Kaplan–Meier，按 1965-11 时的派系，严格/宽两种口径，小多图）；H `#/overlap` 加害与受害（批判/诬陷关系的发起者后来是否被打倒）；J `#/parallel` 平行人生（逐年五类状态，差异＝不同年数/可比年数；跟随当前选中的人）；I `#/moments` 表态时刻（本人带日期引语，按九个时期排列，可只看一人）。纯函数在 `src/derive/fates.ts`，单元测试 4 项 |
| MI-3 | 派系、机构与数据：K、L、N、O | ✔ K `#/flows` 派系流向（档案里有日期的派系转换只有 2 条，改为批判/诬陷关系按双方当时派系的矩阵，加跨派系的人）；L `#/rhetoric` 说辞重合（文本按署名归派，用词取本站追踪的概念与主义，余弦相似度；老红卫兵与造反派用词重合 0.88，但两派各只有 5、4 份署名文本）；N `#/paralysis` 机构瘫痪与军管化（逐月停止活动的机构数，省委最多 32 个中 25 个同时停止，1968-10；省级革委会主任同期军职）；O `#/outcomes` 人均产量（人口在两次公布数之间线性插值，不外推；插值点空心，修订数红色） |
| MI-4 | 嵌入块与验收 | ✔ 每项洞察在相关卡片和详情页有一段摘要（`src/components/drawer/InsightNotes.tsx`），点“看全图”带着当前实体进入洞察页（`go(page, param, sel)` 同一条历史记录）。人物：B、I、H、J；派系：G、K、L；概念：A、D；主义：D；事件：C、O；机构：N；文献：E、F；P 在各处。洞察页与摘要共用的定义（口径、时间范围、词表归类、派系用词计算）在 `src/views/insights/shared.ts`，不含 React，卡片不因此加载洞察页。单元测试 34 项，冒烟 92 项 |

**洞察的约定：** 每个洞察是 `pages.ts` 里普通的一页，外壳 `Insight.tsx`（问题、方法与局限、正文）。需要全文的计数在构建时算进 `atlas.json`，只用结构化数据的在浏览器算；两边共用 `src/derive/` 的纯函数。加一个洞察：`pages.ts` + `pageComponents.tsx` + `nav.ts` 的“洞察”组 → 视图放 `src/views/insights/` → 与卡片共用的常量放 `shared.ts` → 卡片摘要放 `InsightNotes.tsx`。

**页面架构：**
- `src/pages.ts`：全站页面各一条。id 就是地址（`#/<id>[/<参数>]`），与它在菜单里的位置无关；`title`、`desc`；有详情页的写 `detail`（实体种类与取名函数）和 `sample`（冒烟测试打开的样例）；`hidden: true` 的页面只能由地址进入，不进菜单。
- `src/nav.ts`：顶栏分组，只列页面 id，可选 `label` 改写组内显示名。挪动页面就是挪这里的一行；`navProblems()` 检查每个可见页面恰好出现一次、没有空组和重名组。
- `src/routes.ts`：`parseHash` / `toHash`，不依赖 React。未知页面回到时间线；不收参数的页面丢掉参数。
- `src/pageComponents.tsx`：页面 id → 视图组件（`React.lazy`），类型是 `Record<PageId, …>`，新页面没配组件就编译不过。
- `src/components/PageTitle.tsx`：页面标题，同组有多页时前面加组名。
- `state.tsx` 的 `useApp()` 给出 `page`、`param`；`open(kind, id)` 按实体种类找详情页，所以详情页改名、换组都不用改调用处。
- 新增页面：`pages.ts` 加一条 → `pageComponents.tsx` 配组件 → `nav.ts` 放进某组（或标 `hidden`）→ `npm test`。
- 地址变化：`#/ideas`、`#/ideas/<分页>` 改为 `#/lineage`、`#/spectrum`、`#/ism-stream`、`#/press`、`#/concepts`；其余不变。
- 测试：`npm test`（Vitest，`tests/unit`）；`npm run build && npm run test:smoke`（Playwright，`tests/smoke`，本机用系统 Edge，CI 用 Chromium）。冒烟测试逐页检查：无脚本错误、标题可见且与菜单名一致、没有不能滚动的裁切、页面不超出窗口宽度。
