# 字段说明

> 由 `npm run data:build` 从 `src/data/open.ts` 生成，请勿手改。格式、id 与引用方式见 [`data.md`](data.md)。

| 表 | 内容 | 稳定 id | 站内网址 |
|---|---|---|---|
| [`people`](#people) 人物 | 每人一条：生平、派系、传记分节、命运节点 | 是 | `#/people/{id}` |
| [`fates`](#fates) 命运节点 | 人物的政治处境随时间的变化，按日期排列 | 否，经 people 引用 | — |
| [`positions`](#positions) 职务 | 人物担任的职务 | 否，经 people 引用 | — |
| [`events`](#events) 事件 | 1949–1989 年的事件，每条并列多个声部的说法 | 是 | `#/timeline?sel=event:{id}` |
| [`relations`](#relations) 关系 | 人物之间有时段的关系，方向从 a 到 b | 是 | — |
| [`factions`](#factions) 派系 | 政治派系与群体 | 是 | `#/factions/{id}` |
| [`orgs`](#orgs) 机构 | 党、政、军、群团与群众组织 | 是 | `#/orgs/{id}` |
| [`leaders`](#leaders) 机构负责人 | 各机构的历任负责人，包括未收入人物表的人 | 否，经 orgs 引用 | — |
| [`places`](#places) 地点 | 出生、去世、关押与事件地点的近似坐标（约 0.1°） | 是 | — |
| [`concepts`](#concepts) 概念 | 口号、罪名与关键词，及其在语料中的检索词 | 是 | `#/concepts?sel=concept:{id}` |
| [`isms`](#isms) 主义 | 主义、路线、异端与罪名，及其源流和在两轴光谱上的位置 | 是 | `#/lineage?sel=ism:{id}` |
| [`sources`](#sources) 来源 | 全部来源的登记：一手文献（多数有全文）与书目 | 是 | `#/docs/{id}` |
| [`documents`](#documents) 文献注释 | 重点文献的提要、意义与逐条对照 | 是 | `#/docs/{id}` |
| [`claims`](#claims) 研究结论 | 本站由原文推出的结论，附证据、方法与保留意见 | 是 | `#/research?sel=claim:{id}` |
| [`essays`](#essays) 专题长文 | 研究栏目的长文，由研究结论与原文写成 | 是 | `#/essays/{id}` |
| [`evidence`](#evidence) 结论证据 | 每条研究结论的证据 | 否，经 claims 引用 | — |
| [`topics`](#topics) 专题 | 跨时期的专题；事件与结论通过各自的 topics 字段归入 | 是 | `#/topics/{id}` |
| [`archive`](#archive) 视觉档案 | 宣传画、像章、邮票、样板戏、书刊与歌曲，每条有日期、出处与版权状态 | 是 | — |
| [`figures`](#figures) 数字争议 | 死亡与迫害数字：一个案例一条，各出处的数字并列 | 是 | — |
| [`counties`](#counties) 县级登记 | 县、市、地区一条，登记各来源给出的数字和县革委会成立日期 | 是 | — |
| [`counts`](#counts) 数字 | 数字争议与县级登记里的每一个数字 | 否，经 figures, counties 引用 | — |
| [`revcoms`](#revcoms) 省级革委会 | 每省一条，按当时报道的日期 | 是 | — |
| [`series`](#series) 经济与人口序列 | 粮食、钢、人口等逐年数字 | 是 | — |
| [`points`](#points) 序列数字 | 序列的每一个数字；同一年可以有当时公布、后来修正、另一口径几个数 | 否，经 series 引用 | — |

## people

**人物**：每人一条：生平、派系、传记分节、命运节点。文件 `open/people.json`、`open/people.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id（拼音） |
| `name` | 姓名 |
| `pinyin` | 拼音 |
| `gender` | m 男、f 女 |
| `ethnicity` | 民族 |
| `born` | 出生，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `died` | 去世，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `birthplace` | 出生地，按原文 |
| `origin` | 籍贯 |
| `birthAt` | 出生地在 places 表的 id |
| `death` | 死因的原文说法 |
| `deathKind` | 死因分类：natural 病故、suicide 自杀、persecuted 被迫害致死、executed 处决、killed 被杀、accident 事故、war 战死、unknown 不明 |
| `deathContested` | true 表示死因本身有争议 |
| `deathPlace` | 去世地点 |
| `deathAt` | 去世地点在 places 表的 id |
| `classOrigin` | 家庭出身，按档案记载 |
| `classNote` | 出身的争议或后来改划 |
| `party` | 党派，空为中国共产党 |
| `joinedParty` | 入党，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `joinedRevolution` | 参加革命或工作，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `tier` | 重要程度：1 核心人物（派系页列为核心，图上加粗），2、3 依次次之 |
| `role1966` | 1966 年前后的身份 |
| `factions` | 曾属派系（factions 的 id），第一项为默认归属 |
| `bio` | 概述 |
| `wikidata` | Wikidata 编号（只在 CSV，由 JSON 字段算出） |
| `cites` | 出处列表（sources 的 id） |
| `verify` | true 表示尚未找到原文出处（待核） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `aka` | 别名：kind（original 原名、courtesy 字、art 号、pen 笔名、cover 化名、other 又名）与 name |
| `education` | 学历：school、from、to、note、cite |
| `positions` | 职务，CSV 见 positions 表 |
| `rank` | 军衔：rank、date、cite |
| `rehab` | 平反：date、text、cite |
| `afterlife` | 身后：date、text、cite |
| `ids` | 外部编号：wikidata、cbdb |
| `life` | 完整传记分节：h 标题、from、to、text、cites |
| `assess` | 评价：voice（doc 原始文件、official1966 当时官方、foreign 外国档案、official1981 1981 决议、officialLater 后来官方、judicial1980 1980 年代审判、witness 亲历者、scholar 学术研究、editor 本站研究）、text、cite、quote（true 为逐字引文） |
| `quotes` | 本人或关于本人的原话：text、cite、by、date、note、voice |
| `works` | 著作：title、date、cite |
| `memberships` | 分时段的主要派系：f、from、to、note、cite |
| `fate` | 命运节点，CSV 见 fates 表 |
| `photo` | 照片：src、url、author、license、date |

## fates

**命运节点**：人物的政治处境随时间的变化，按日期排列。文件 `open/fates.json`、`open/fates.csv`。

| 列 | 说明 |
|---|---|
| `person` | people 的 id |
| `date` | 日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `s` | 处境：normal 常态、rise 崛起、power 掌权、attacked 受批判、sidelined 靠边、purged 被打倒、detained 关押、dead 死亡、restored 复出/平反 |
| `note` | 说明 |
| `place` | 关押、下放等地点在 places 的 id |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `verify` | true 表示尚未找到原文出处（待核） |

## positions

**职务**：人物担任的职务。文件 `open/positions.json`、`open/positions.csv`。

| 列 | 说明 |
|---|---|
| `person` | people 的 id |
| `title` | 职务名称 |
| `org` | orgs 的 id；机构未建模时为空 |
| `orgName` | 机构名称，按原文 |
| `sys` | 系统：party 党、gov 政、army 军、other 其他 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `note` | 说明 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `verify` | true 表示尚未找到原文出处（待核） |

## events

**事件**：1949–1989 年的事件，每条并列多个声部的说法。文件 `open/events.json`、`open/events.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `date` | 日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `end` | 结束，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `title` | 标题 |
| `lane` | 泳道：center 中央高层、ideology 思想舆论、mass 群众运动、army 军队、culture 文教、local 地方、intl 国际、econ 经济社会 |
| `weight` | 重要程度 1–3 |
| `place` | 地点，按原文 |
| `at` | 地点在 places 的 id |
| `summary` | 概述 |
| `people` | 涉及人物（people 的 id） |
| `concepts` | 涉及概念（concepts 的 id） |
| `docs` | 相关文献（sources 的 id） |
| `topics` | 所属专题（topics 的 id） |
| `cites` | 出处列表（sources 的 id） |
| `verify` | true 表示尚未找到原文出处（待核） |
| `why` | 待核的原因：缺哪类原文，或摘要中哪处超出所引原文 |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `voices` | 各声部的说法：voice（doc 原始文件、official1966 当时官方、foreign 外国档案、official1981 1981 决议、officialLater 后来官方、judicial1980 1980 年代审判、witness 亲历者、scholar 学术研究、editor 本站研究）、text、cite、quote（true 为逐字引文） |

## relations

**关系**：人物之间有时段的关系，方向从 a 到 b。文件 `open/relations.json`、`open/relations.csv`。

| 列 | 说明 |
|---|---|
| `id` | 构建时生成：a~type~b，同一对人同一种关系出现多次时加 ~2、~3 |
| `a` | people 的 id |
| `b` | people 的 id |
| `type` | 关系：spouse 配偶、patron 提携/支持、ally 同盟/同僚、subordinate 下属/秘书、attack 批判/攻击、persecute 诬陷/迫害、protect 保护/庇护、link 被关联 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `note` | 说明 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `verify` | true 表示尚未找到原文出处（待核） |

## factions

**派系**：政治派系与群体。文件 `open/factions.json`、`open/factions.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称 |
| `kind` | 类型：core 核心（毛泽东）、group 政治集团、institution 体制内机构与领导层、mass 群众与群体、target 被点名打击的群体、dissent 异见 |
| `color` | 图上颜色 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `summary` | 概述 |
| `cites` | 出处列表（sources 的 id） |

## orgs

**机构**：党、政、军、群团与群众组织。文件 `open/orgs.json`、`open/orgs.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 全称 |
| `short` | 简称 |
| `aliases` | 别名 |
| `kind` | 类别：party 党、state 政、army 军、mass 群团、popular 群众组织、unit 单位 |
| `level` | 层级：central 中央、regional 大区、provincial 省市、local 地县、basic 基层 |
| `from` | 成立，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 撤销，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `parent` | 最早的上级机构（orgs 的 id），全部见 JSON 的 under（只在 CSV，由 JSON 字段算出） |
| `factions` | 掌控派系（factions 的 id） |
| `summary` | 概述 |
| `cites` | 出处列表（sources 的 id） |
| `verify` | true 表示尚未找到原文出处（待核） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `suspended` | 名存实亡的时段：from、to、note |
| `places` | 驻地：at、from、to |
| `under` | 上级机构：org、from、to |
| `links` | 与其他机构的关系：org、kind（领导、设立、对立、并入、夺权、取代）、date、to、note、cite |
| `leaders` | 历任负责人，CSV 见 leaders 表 |

## leaders

**机构负责人**：各机构的历任负责人，包括未收入人物表的人。文件 `open/leaders.json`、`open/leaders.csv`。

| 列 | 说明 |
|---|---|
| `org` | orgs 的 id |
| `name` | 姓名 |
| `person` | people 的 id；不在人物表时为空 |
| `title` | 职务 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `faction` | 任内派系（factions 的 id） |
| `note` | 说明 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落；为空表示出自一般工具书，待核 |

## places

**地点**：出生、去世、关押与事件地点的近似坐标（约 0.1°）。文件 `open/places.json`、`open/places.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称 |
| `names` | 用来匹配原文的其他写法 |
| `lat` | 纬度 |
| `lon` | 经度 |
| `far` | true 表示在地图范围以外 |

## concepts

**概念**：口号、罪名与关键词，及其在语料中的检索词。文件 `open/concepts.json`、`open/concepts.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称 |
| `terms` | 检索词 |
| `summary` | 概述 |
| `related` | 相关概念（concepts 的 id） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `notes` | 各声部的说法：voice、text、cite、quote |

## isms

**主义**：主义、路线、异端与罪名，及其源流和在两轴光谱上的位置。文件 `open/isms.json`、`open/isms.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称 |
| `short` | 简称 |
| `kind` | 类别：core 正统、line 党内路线、heterodox 民间异端、foreign 外来 · 对立面、label 罪名 · 标签 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `parents` | 源自（isms 的 id） |
| `against` | 针对（isms 的 id） |
| `terms` | 检索词 |
| `concepts` | 相关概念（concepts 的 id） |
| `summary` | 概述 |
| `cites` | 出处列表（sources 的 id） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `carriers` | 代表人物：name，在人物表时另有 person（people 的 id） |
| `pos` | 光谱位置：at、x（经济轴 −1 到 1）、y（政治轴 −1 到 1）、note；是编者对相对立场的判断，不是测量 |
| `notes` | 各声部的说法：voice、text、cite、quote |

## sources

**来源**：全部来源的登记：一手文献（多数有全文）与书目。文件 `open/sources.json`、`open/sources.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id，也是全文文件名 |
| `title` | 标题 |
| `date` | 日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `author` | 作者或发布机关 |
| `kind` | 类别：party-doc 中央文件、editorial 社论 · 评论、speech 讲话 · 检讨、news 新闻报道、redguard 红卫兵 · 群众组织文献、essay 民间思想、chronology 资料汇编、judicial 司法文书、index 目录 · 索引、collected 文集 · 文稿、annals 年谱 · 组织史、memoir 回忆录 · 口述、article 文章 · 研究、monograph 学术专著、database 资料库、archive 外国档案、gazetteer 地方志、local-record 地方处遗材料 |
| `alias` | 通称 |
| `tier` | 层级：1 原文、2 官方、3 亲历、4 研究 |
| `url` | 取自何处 |
| `revid` | 维基文库的修订号，可据此取回同一版本 |
| `via` | 网页转录的来源 |
| `excerpt` | true 表示只保留了摘录 |
| `hasText` | true 表示有全文 |
| `text` | 全文文件，相对 public/data/（只在 CSV，由 JSON 字段算出） |
| `publisher` | 出版者 |
| `locator` | 书目位置 |
| `access` | 阅读状态：unread 未读、partial 部分、read 已读 |
| `want` | 要从这本书里找的东西 |
| `note` | 说明 |

## documents

**文献注释**：重点文献的提要、意义与逐条对照。文件 `open/documents.json`、`open/documents.csv`。

| 列 | 说明 |
|---|---|
| `id` | sources 的 id |
| `summary` | 提要 |
| `significance` | 意义 |
| `people` | 涉及人物（people 的 id） |
| `concepts` | 涉及概念（concepts 的 id） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `pairs` | 逐条对照：against（被批驳的文献）、point、original、rebuttal |

## claims

**研究结论**：本站由原文推出的结论，附证据、方法与保留意见。文件 `open/claims.json`、`open/claims.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id，C 加三位数字 |
| `statement` | 结论 |
| `status` | 状态：supported 成立、partial 部分成立、contested 有争议、open 未定 |
| `method` | 方法 |
| `caveats` | 保留意见 |
| `people` | 涉及人物 |
| `concepts` | 涉及概念 |
| `events` | 涉及事件 |
| `isms` | 涉及主义 |
| `factions` | 涉及派系 |
| `topics` | 所属专题 |
| `logged` | 登记日期，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `evidence` | 证据，CSV 见 evidence 表 |
| `history` | 修订记录：date、note |

## essays

**专题长文**：研究栏目的长文，由研究结论与原文写成。文件 `open/essays.json`、`open/essays.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `title` | 标题 |
| `period` | 所论时期 |
| `summary` | 提要 |
| `written` | 写作日期，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `claims` | 依据的研究结论（claims 的 id）（只在 CSV，由 JSON 字段算出） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `sections` | 分节：h 标题、text 正文（段落以空行分隔，“”内四字以上的引文构建时逐字核对）、claims 依据的结论、cites 出处 |

## evidence

**结论证据**：每条研究结论的证据。文件 `open/evidence.json`、`open/evidence.csv`。

| 列 | 说明 |
|---|---|
| `claim` | claims 的 id |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `quote` | 原文引文，构建时与出处全文逐字核对 |
| `note` | 说明 |

## topics

**专题**：跨时期的专题；事件与结论通过各自的 topics 字段归入。文件 `open/topics.json`、`open/topics.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称 |
| `from` | 起，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `to` | 止，日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `summary` | 概述 |
| `events` | 由专题一侧列入的事件 id（已并入事件的 topics） |
| `claims` | 由专题一侧列入的结论 id（已并入结论的 topics） |
| `gaps` | 现有材料还回答不了的问题 |
| `cites` | 出处列表（sources 的 id） |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `sections` | 分节：h、text、cites |

## archive

**视觉档案**：宣传画、像章、邮票、样板戏、书刊与歌曲，每条有日期、出处与版权状态。文件 `open/archive.json`、`open/archive.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `kind` | 类别：poster 宣传画、badge 像章与徽章、stamp 邮票、opera 样板戏与舞台、publication 书刊与报头、song 歌曲、film 电影、photo 照片 |
| `title` | 标题 |
| `date` | 日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `dateFrom` | 日期依据：metadata 文件元数据、title 文件名、source 引用的原文 |
| `file` | Wikimedia Commons 文件名 |
| `url` | 文件页 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `quote` | 原文引文，构建时与出处全文逐字核对 |
| `author` | 作者 |
| `license` | 许可或版权状态 |
| `licenseUrl` | 许可证网址 |
| `description` | 说明 |
| `via` | 转录来源 |
| `image` | 缩略图，相对站点根目录 |

## figures

**数字争议**：死亡与迫害数字：一个案例一条，各出处的数字并列。文件 `open/figures.json`、`open/figures.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `title` | 案例 |
| `period` | 时期 |
| `region` | 地区 |
| `summary` | 概述 |
| `events` | 相关事件 |
| `people` | 相关人物 |
| `caveats` | 保留意见 |
| `need` | 还缺什么原文 |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `counts` | 各出处的数字，CSV 见 counts 表 |

## counties

**县级登记**：县、市、地区一条，登记各来源给出的数字和县革委会成立日期。文件 `open/counties.json`、`open/counties.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `name` | 名称（当时） |
| `province` | 省 |
| `prefecture` | 地区 |
| `kind` | 类别：county 县、city 市、district 区、prefecture 地区 |
| `revcomDate` | 县革委会成立日期（只在 CSV，由 JSON 字段算出） |
| `lon` | 经度（今治所）（只在 CSV，由 JSON 字段算出） |
| `lat` | 纬度（今治所）（只在 CSV，由 JSON 字段算出） |
| `note` | 说明 |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `counts` | 各出处的数字，CSV 见 counts 表 |
| `revcom` | 县革委会成立：date、cite、quote |
| `geo` | 位置：lon、lat、wd（Wikidata 编号）、as（按哪个今地名定位） |

## counts

**数字**：数字争议与县级登记里的每一个数字。文件 `open/counts.json`、`open/counts.csv`。

| 列 | 说明 |
|---|---|
| `table` | 所属表：figures 或 counties |
| `owner` | 所属记录的 id |
| `measure` | 计的是什么：deaths 致死、persecuted 受迫害 / 立案、injured 伤残、detained 关押、cases 案件、reported 上报数、none 不给数字 |
| `what` | 原文所计对象 |
| `scope` | 口径、范围 |
| `value` | 数值；原文不给数字时为空 |
| `approx` | 原文的约数用语（余、多、近、数十） |
| `unit` | 单位 |
| `voice` | 声部：doc 原始文件、official1966 当时官方、foreign 外国档案、official1981 1981 决议、officialLater 后来官方、judicial1980 1980 年代审判、witness 亲历者、scholar 学术研究、editor 本站研究 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `quote` | 原文引文，构建时与出处全文逐字核对 |
| `note` | 说明 |

## revcoms

**省级革委会**：每省一条，按当时报道的日期。文件 `open/revcoms.json`、`open/revcoms.csv`。

| 列 | 说明 |
|---|---|
| `org` | orgs 的 id，也是这张表的 id |
| `province` | 省 |
| `date` | 日期，YYYY、YYYY-MM 或 YYYY-MM-DD，只写到原文能确定的精度 |
| `kind` | 日期的性质：founded 成立、rally 庆祝大会、seized 夺权 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `quote` | 原文引文，构建时与出处全文逐字核对 |
| `note` | 说明 |

## series

**经济与人口序列**：粮食、钢、人口等逐年数字。文件 `open/series.json`、`open/series.csv`。

| 列 | 说明 |
|---|---|
| `id` | 稳定 id |
| `title` | 名称 |
| `group` | 分组：agri 农业、industry 工业、people 人口与就业、money 投资、商业与外贸 |
| `unit` | 单位 |
| `summary` | 概述 |
| `caveats` | 保留意见 |
| `events` | 相关事件 |

只在 JSON 中的嵌套字段：

| 字段 | 说明 |
|---|---|
| `points` | 逐年数字，CSV 见 points 表 |

## points

**序列数字**：序列的每一个数字；同一年可以有当时公布、后来修正、另一口径几个数。文件 `open/points.json`、`open/points.csv`。

| 列 | 说明 |
|---|---|
| `series` | series 的 id |
| `year` | 年份 |
| `value` | 数值，已换算为序列单位 |
| `approx` | true 表示原文是约数 |
| `kind` | 口径：reported 当时公布、revised 后来修正、variant 另一口径、retro 后来官方·回溯 |
| `cite` | 出处：sources 表的 id，可带 @ 后的页码或段落 |
| `quote` | 原文引文，构建时与出处全文逐字核对；保留原单位 |
| `note` | 说明 |
