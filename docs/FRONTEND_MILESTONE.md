# 前端里程碑文档（my-app）

> 文档版本：与仓库当前实现同步，便于交接与后续迭代。  
> 栈：**Next.js 16（App Router）** + **React 19** + **Ant Design 6** + **Tailwind CSS 4**。

---

## 一、全栈里程碑摘要（便于对齐）

| 层级               | 里程碑                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **后端**           | Nest 全局前缀 `/api`；<br />文档入库 `POST /api/documents/ingest`（Demo 固定 **RecursiveCharacterTextSplitter · chunkSize 1000 · overlap 150**）；<br />向量检索与 RAG **`/api/rag/search`**、<br />流式对话 **`/api/rag/chat`**（SSE，`data: {JSON}`）；<br />Embedding 等见 `back_end`。 |
| **前端（本文档）** | 文档上传与**可调 / 提示后端写死**的切片预览；RAG **search** 调试区；**chat** SSE 消费、`react-markdown` 流式渲染、**meta 引用**与 **o200k token** 统计；`NEXT_PUBLIC_API_URL` 指向后端 Origin。                                                                                            |

---

## 二、技术栈与依赖（前端特有）

| 类别       | 依赖                                          | 用途                                                                                    |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| 框架       | `next@16`、`react@19`                         | App Router、RSC/客户端组件拆分                                                          |
| UI         | `antd@6`、`@ant-design/icons`                 | 布局、表单、卡片、折叠等                                                                |
| AI 对话 UI | `@ant-design/x`                               | `Sender`、`XProvider`（对话输入；需 **客户端 + 动态 `ssr: false`** 避免服务端渲染异常） |
| RAG / 文本 | `@langchain/core`、`@langchain/textsplitters` | 与后端一致的 **Recursive / Markdown** 切片预览（`splitTextToIndexedChunks`）            |
| Token      | `js-tiktoken`（`o200k_base`）                 | `lib/rag-tokens.ts` · `countTokens`，切片统计与对话区 **o200k** 计数                    |
| Markdown   | `react-markdown@10`                           | 流式正文渲染（自定义 `components` 基础样式）                                            |
| 其它       | `zod`、`zustand`、`immer`                     | 已列入依赖，可按功能逐步使用                                                            |

**包管理**：推荐使用 **pnpm**（若本机 `npm install` 异常，可用 pnpm 安装依赖）。

---

## 三、目录结构（前端源码）

```text
my-app/
├── app/
│   ├── layout.tsx              # 根布局、字体与全局样式入口
│   ├── page.tsx                # 首页（入口链接）
│   ├── globals.css
│   ├── rag/
│   │   ├── page.tsx            # 路由：/rag
│   │   ├── RagUploadClient.tsx # 文档粘贴/上传 → ingest；切片预览容器
│   │   └── ChunkPreviewPanel.tsx
│   └── ragSearch/
│       ├── page.tsx            # 路由：/ragSearch（薄封装）
│       ├── RagSearchLayout.tsx # 三栏：占位 | 对话 | search 调试
│       ├── RagChatPanel.tsx    # SSE 对话 + Markdown + 引用 + o200k
│       └── RagSearchPanel.tsx  # POST /api/rag/search 原始 JSON
├── lib/
│   ├── rag-api.ts              # 后端 Origin、路径常量、fetch 封装
│   ├── rag-split-config.ts     # Demo 切片常量（与后端 constants 一致）
│   ├── langchain-split.ts      # LangChain 切片 + 原文 offset 对齐
│   ├── rag-tokens.ts           # o200k `countTokens`
│   └── rag-sse-parse.ts        # fetch body → getReader → SSE `data:` 解析
├── docs/
│   └── FRONTEND_MILESTONE.md   # 本文件
├── next.config.ts
├── package.json
└── tsconfig.json               # paths: `@/*` → 项目根
```

---

## 四、路由与页面职责

| 路径         | 组件入口              | 说明                                                                                                                                                                                                       |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | `app/page.tsx`        | 首页；可扩展导航至 RAG 相关页                                                                                                                                                                              |
| `/rag`       | `app/rag/page.tsx`    | **文档入库**：粘贴或上传 `.txt`/`.md`，`POST /api/documents/ingest`；展示返回 `documentId`、`chunkCount`、`splitConfig` 等                                                                                 |
| `/rag`       | `ChunkPreviewPanel`   | **切片可视化**：LangChain **RecursiveCharacter / Markdown** 可调；顶部 **Alert** 提示 **入库参数已在后端写死**（1000/150/recursive）；条带图 + 折叠块预览                                                  |
| `/ragSearch` | `RagSearchLayout.tsx` | 左栏占位；中栏 **RAG 对话**；右栏 **search** 调试                                                                                                                                                          |
| `/ragSearch` | `RagChatPanel.tsx`    | **Sender** 提交 → `postRagChatStream` → `consumeRagChatSse`；首包 **meta** 展示 **documentId / chunkIndex / score**；正文 **react-markdown**；推理折叠；**Card extra**：o200k **正文 / 推理 / 合计** token |
| `/ragSearch` | `RagSearchPanel.tsx`  | `POST /api/rag/search`，JSON 格式化输出                                                                                                                                                                    |

**SSR 说明**：`RagChatPanel` 经 `next/dynamic(..., { ssr: false })` 在 **`RagSearchLayout`（客户端组件）** 中加载，以满足 `@ant-design/x` 在浏览器侧的运行要求（Next 16 不允许在 **Server Component** 里对 `dynamic` 使用 `ssr: false`）。

---

## 五、环境变量

| 变量                  | 含义                            | 示例                    |
| --------------------- | ------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | 后端 **Origin**，**无**末尾斜杠 | `http://localhost:3025` |

未设置时，代码内默认 `http://localhost:3025`，与 Nest 默认端口一致。

---

## 六、API 客户端约定（`lib/rag-api.ts`）

所有业务路径相对于 Origin，且带全局前缀 **`/api`**：

| 方法                  | 路径常量                | 说明                                                                                                      |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `postDocumentsIngest` | `/api/documents/ingest` | JSON：`text`、`filename?`                                                                                 |
| `postRagSearch`       | `/api/rag/search`       | JSON：`query`、`topK?`、`documentId?`                                                                     |
| `postRagChatStream`   | `/api/rag/chat`         | JSON：`message`、`topK?`、`documentId?`；返回 **`text/event-stream`**；支持 **`RequestInit.signal`** 中止 |

---

## 七、流式协议（前端解析侧）

- 使用 **`response.body.getReader()`** + **`TextDecoder`**（封装在 **`consumeRagChatSse`**）。
- 按 SSE 习惯以 **`\\n\\n`** 分帧，每行 **`data: <JSON>`**。
- 事件类型（与后端对齐）：**`meta`**（含 `hits` 摘要）、**`token`**、**`reasoning`**、**`done`**、**`error`** 等。

---

## 八、切片与 Token 策略说明

- **入库**：后端固定 **RecursiveCharacterTextSplitter，chunkSize 1000，chunkOverlap 150**（与 `lib/rag-split-config.ts` / 后端 `rag-split.constants.ts` 注释一致）。
- **预览**：用户可在前端切换 **Recursive / Markdown** 与 **chunkSize / chunkOverlap**；仅影响浏览器内预览，**Alert** 已说明与入库差异。
- **Token**：统一 **`o200k_base`** 估算（展示用，非计费依据）。

---

## 九、已知限制与后续可选项

1. **首页**：当前入口较简，可汇总 `/rag`、`/ragSearch` 及环境说明。
2. **对话历史**：未持久化；「历史 TODO」占位。
3. **Markdown**：未接语法高亮（Shiki / highlight.js）；可按需增强 `mdComponents`。
4. **国际化**：可按 Ant Design `ConfigProvider` locale 与 `@ant-design/x` 文档接入中文文案统一。

---

## 十、本地开发与构建

```bash
cd my-app
pnpm install
pnpm run dev      # 开发
pnpm run build    # 生产构建
```

确保后端已启动且 `NEXT_PUBLIC_API_URL` 可访问，否则入库 / 检索 / 对话请求将失败。

---

_本文档随功能迭代更新；重大变更请同步修改本节与「全栈里程碑摘要」。_
