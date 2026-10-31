# research/ —— 研究工作区

这里保存本项目的全部研究过程，目标是**任何人（包括未来的自己）在任何时候都能接着做下去**：知道查过什么、在哪里查的、读到了什么、据此得出了什么结论、还有什么没做。

## 目录

| 路径 | 内容 |
|---|---|
| `manifests/*.yaml` | 来源清单。每条一份一手文献：`id`、维基文库页面标题、日期、作者、类型、别名。是抓取脚本的输入。 |
| `fetch-log.jsonl` | 抓取日志（只追加）。每次抓取记录页面 `revid`、修订时间、SHA-256、字数、许可、成功/缺失。用于复现与版本锁定。 |
| `claims.yaml` | 研究结论 → 证据。每条结论列出逐字引文，构建时自动核对引文确实出现在原文中。 |
| `log/history/*.md` | 各轮次的阶段表原样存档（检索了什么、改了什么、查过没结果的）；早期当日日志也在 `log/`。 |
| `queue.md` | 研究待办，按优先级排列，注明去哪里找。 |
| `methods.md` | 方法与规则：来源分级、“待核”标记、引文核对、版权政策、写作约定。 |
| `milestones.md` | 里程碑与验收标准。 |
| `progress.md` | **进度看板**：当前状态、长期口径、本轮阶段、恢复步骤。中断后先读它。 |
| `audit-v1.md` | v1.0 完整性审计及之后各轮补缺口的结果。 |
| `ids.txt` | 发布过的全部稳定 id，由构建改写；id 消失要在 `content/ids-moved.yaml` 写明去向。 |

原文本身存放在仓库根目录的 `sources/raw/`（维基源码）和 `sources/text/`（清洗后纯文本）。

## 如何接着做

```bash
npm install

# 1. 在维基文库里找准确的页面标题
npm run data:search -- "intitle:红卫兵 1966"

# 2. 把新文献加进 research/manifests/<主题>.yaml，然后抓取（已抓过的会跳过，--force 重抓）
npm run data:fetch            # 全部
npm run data:fetch -- <id>    # 指定

# 3. 全语料检索某个词，看它在哪些文献、何时出现
npm run concordance -- 资产阶级司令部 四旧

# 4. 编写/修改 content/*.yaml 与 research/claims.yaml，然后校验并生成站点数据
npm run data:build

# 5. 本地预览
npm run dev
```

`data:build` 会拒绝以下情况：引用了不存在的人物/事件/来源；人物命运节点日期倒序；事件既无出处又未标记 `verify: true`；**结论或对照表中的引文在原文里找不到**。

当前规模与缺口见 `progress.md` 的“当前状态”，或运行 `node tools/audit.ts`。
