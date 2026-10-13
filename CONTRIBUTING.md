# 贡献指南

本站的每一条事实都要能追溯到一份原文，所以新增内容的顺序总是：先有原文入库，再写事实，最后写结论。构建会替你检查大部分规则；本文说明怎样加内容，以及合并前人工审核看什么。

先准备好本地环境，见 [`docs/build.md`](docs/build.md)。方法与规则的完整说明在 [`research/methods.md`](research/methods.md)。

## 1. 新增来源

1. 在维基文库找到准确的页面标题：`npm run data:search -- "intitle:红卫兵 1966"`。期刊目录页可用 `node tools/ws-links.ts <页面标题>` 列出全部链接。
2. 在 `research/manifests/` 下按主题新建或续写一个清单：

   ```yaml
   wikisource:
     - id: ws-1987-04-13-macau-declaration     # 小写、数字、连字符；ws- 维基文库，rmrb- 人民日报
       title: 中华人民共和国政府和葡萄牙共和国政府关于澳门问题的联合声明   # 维基文库页面标题
       date: 1987-04-13                          # 写作或发生日期，见报日写在 note
       author: 中华人民共和国政府、葡萄牙共和国政府
       kind: party-doc                           # 类别见 docs/fields.md 的 sources 表
       alias: 中葡关于澳门问题的联合声明
       note: 正文落款“1987年4月13日在北京签订”。
   ```

   维基文库以外的网页写在 `web:` 下，另需 `url` 和截取规则（`article`，或 `start`/`end`），用法见 `tools/fetch-web.ts` 文件头。
3. 抓取：`npm run data:fetch -- <id>` 或 `node tools/fetch-web.ts <id>`。原文写入 `sources/`，`research/fetch-log.jsonl` 追加修订号与 SHA-256。
4. 查版权：个人署名、作者去世未满 50 年的作品只存摘录（`excerpt: true` 加 `keep:`），见 `methods.md` 第 6 节。
5. 书目类来源（专著、回忆录、资料库）没有全文，登记在 `content/sources.yaml`，写明 `tier`、`publisher`、`locator`。

## 2. 新增事件

事件写在 `content/events/*.yaml`，按时期分文件；字段见 [`docs/fields.md`](docs/fields.md#events)。

```yaml
- id: 1987-04-13-macau-declaration     # 日期加简短英文
  date: 1987-04-13
  title: 中葡关于澳门问题的联合声明签订
  lane: intl
  weight: 2
  summary: 用自己的话概述，每个事实都要在 cites 的原文里找得到。
  people: []                           # people 的 id
  voices:
    - { voice: doc, text: 原文句子（出处说明）, cite: ws-1987-04-13-macau-declaration, quote: true }
  cites: [ws-1987-04-13-macau-declaration]
```

- `voices` 并列不同立场的说法。标 `quote: true` 的必须逐字出自 `cite`，末尾全角括号里的出处说明不参与比对；不标的是转述。
- 还没有原文出处的事件写 `verify: true`（“待核”），不要省略出处又不标待核。
- 专题事件加 `topics: [<专题 id>]`。

## 3. 新增人物

人物写在 `content/people/*.yaml`，字段见 [`docs/fields.md`](docs/fields.md#people)。

- `factions` 至少一项，第一项是默认归属。派系对不上时宁可不收，不要硬塞。
- `fate` 只记政治处境的变化，按日期先后排列；`1971-09` 排在 `1971-09-12` 之前。
- 完整传记（`life`）至少三节，每节有 `cites`。
- 每个新人物至少出现在一个事件的 `people` 里，或有一条关系（`content/relations.yaml`）。`node tools/people-links.ts` 列出缺这两样的人。
- 在世人物只写公开的职务与经历，不写住址、家庭隐私等个人信息。

## 4. 新增研究结论

结论写在 `research/claims.yaml`，id 依次编号（`C071`、`C072`……）：

- `statement` 是可以被原文检验的判断；`method` 写清怎样得出（检索了哪些词、对读了哪些文件）。
- `evidence` 每条有 `cite`，有 `quote` 的逐字比对。
- `caveats` 写明结论的边界。“某文件没有提到某事”只能由全文检索得出，并列出检索词（`methods.md` 第 3a 节）。
- `status`：`supported`、`partial`、`contested` 或 `open`。结论修改时在 `history` 里加一行。

## 5. 改名与删除

发布过的 id 由 `research/ids.txt` 登记，删掉或改名会让构建失败。确需改动时，在 `content/ids-moved.yaml` 加一行，写明新 id 或撤下的理由：

```yaml
- { id: people/old-id, to: people/new-id, date: 2026-10-13, note: 改用通行拼音 }
```

## 6. 提交前

```bash
npm run build          # 数据校验、类型检查、打包
npm test
npm run test:smoke
```

构建会改写 `research/ids.txt` 和 `docs/fields.md`，与数据一起提交。一个提交只做一件事（一批来源、一批事件、一条结论），提交说明写清楚加了什么。

## 审核规则

构建会自动拒绝：未知或重复的 id、未知出处、日期倒序或超出生卒、没有派系的人物、既无出处又未标待核的记录、原文里找不到的引文、消失的已发布 id。人工审核再看下面几条：

1. **没有无出处的论断。** 概述里的每个事实都要能在 `cites` 的原文里找到；只有工具书可依的写 `verify: true`。
2. **不越过原文。** 原文只写“被关押”就不写“被迫害致死”；原文没有日期就不编日期，用更粗的精度。
3. **数字注明口径。** 死亡、迫害人数写明出处、范围与原文用语，不同出处并列，不取中间值。
4. **多声部并列。** 矛盾的说法都保留，不替读者裁决；本站的判断写成 `editor` 声部或研究结论。
5. **外文原文照录。** 外文引文保留原文并逐字核对，概述用中文。
6. **简体中文。** YAML 里的中文引号用“”‘’，不用 ASCII 双引号。
7. **在世人物**只写公开经历。
8. **版权。** 未满保护期的个人作品只存摘录；图片登记来源、作者与许可。
