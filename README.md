[English](./README.EN.md) | 中文

# SeekMoney - 找商机：用户痛点发现器


一个帮助创业者从社交媒体找商机，自动发现用户核心痛点的 Web 应用，支持智能聚类分析和产品方案生成。

**核心功能：**
- 多平台数据采集（抖音、小红书、TikTok、Bilibili、微信视频号、YouTube、X (Twitter)、Reddit）
- 基于 openai兼容/GLM + embedding + DBSCAN 的语义聚类算法
- 调用  openai兼容/GLM-4.7 思考模型深度分析用户痛点
- 智能优先级评分系统（需求强度 + 市场规模 + 竞争度）
- 完整的中文简体/繁体/英文三语支持

## 功能特性

### 痛点分析模块
- **多平台数据采集**
  - 抖音
  - TikTok（国际版）
  - Bilibili（B站）
  - 微信视频号
  - YouTube（V3 API）
  - 小红书
  - X (Twitter)
  - Reddit
- **智能语义聚类**
  - 视频/评论分别聚类，避免语义层次混淆
  - 基于  openai兼容/GLM embedding  的向量表示
  - DBSCAN 密度聚类算法，自动发现主题
  - 支持多种 embedding 提供商（GLM、OpenAI）
- **深度 AI 分析**（ openai兼容/GLM-4.7 思考模型）
  - 痛点深度：表面痛点 → 根本原因 → 用户场景 → 情感强度
  - 市场格局：现有方案 → 未满足需求 → 机会分析
  - MVP 计划：核心功能 → 验证假设 → 首批用户 → 成本估算
  - 市场规模评分（0-5 分）
- **优先级评分系统**
  - 需求强度：基于聚类规模和讨论热度
  - 市场规模：AI 评估的市场潜力
  - 竞争度：现有解决方案分析
  - 综合得分自动排序
- **数据质量分级**
  - exploratory（<50 条）：探索性，建议进一步验证
  - preliminary（50-200 条）：初步结论，适合初期研究
  - reliable（≥200 条）：高置信度，统计显著
- **结果展示与导出**
  - 可视化表格展示，支持排序和筛选
  - 点击查看详细原文和代表性内容
  - 一键导出 CSV 格式报告
  - 原始数据导出（含聚类分组）

### AI 产品建议模块
- AI 产品经理角色自动生成产品方案
- 包含核心功能、技术栈、开发路线图
- 评估实现难度和市场潜力

### 多语言支持
- 支持简体中文/繁體中文/英文界面切换
- AI 分析结果根据当前语言自动输出对应语言
- URL 路由国际化（`/zh/`、`/zh-TW/`、`/en/`）
- 自动检测浏览器语言偏好

## 数据源说明

所有数据源均基于 TikHub API，提供统一、稳定的数据采集服务。

| 数据源 | 平台 | 说明 |
|--------|------|------|
| 抖音 | Douyin | 中国版抖音，最大的短视频平台 |
| TikTok | TikTok | 国际版抖音，全球用户 |
| Bilibili | Bilibili | 中国领先的视频分享平台 |
| 微信视频号 | WeChat | 微信内置短视频功能 |
| YouTube | YouTube | 全球最大视频平台（V3 API，支持 Shorts 搜索） |
| 小红书 | Xiaohongshu | 生活方式分享社区 |
| X (Twitter) | Twitter | 全球主流社交媒体平台 |
| Reddit | Reddit | 全球最大论坛社区平台 |

### TikHub API 优势
- **多平台统一**：一个 API 接入 8 个主流平台
- **稳定可靠**：无需维护爬虫，避免反爬限制
- **按需付费**：约 $0.01/次请求，24 小时缓存降低成本
- **开发友好**：RESTful API，完善的文档和 SDK
- **合规安全**：官方 API 接口，避免法律风险

## 运行预览

> 更多界面截图与资源文件，请浏览 [ assets 文件夹](./assets/)。

<img src="./assets/图片1.png" alt="image-20251223210939459" style="zoom: 63%;" />

<img src="./assets/图片2.png" alt="image-20251223210939459" style="zoom: 63%;" />
<img src="./assets/图片3.png" alt="image-20251223210939459" style="zoom: 63%;" />
<img src="./assets/图片4.png" alt="image-20251223210939459" style="zoom: 63%;" />
<img src="./assets/图片5.png" alt="image-20251223210939459" style="zoom: 63%;" />
<img src="./assets/图片6.png" alt="image-20251223210939459" style="zoom: 63%;" />
<img src="./assets/图片7.png" alt="image-20251223210939459" style="zoom: 63%;" />


## 快速开始

### 环境要求

- Node.js >= 18 
- npm 或 pnpm

### 1. 安装依赖

```bash
# 克隆项目
git clone https://github.com/liangdabiao/SeekMoney-ai.git
cd SeekMoney-ai

# 安装 Node.js 依赖
npm install
 
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件：

```env
# TikHub API 配置 (必需 - 数据采集)
# 注册地址: https://api.tikhub.io/
TIKHUB_API_TOKEN=your_tikhub_api_token_here
TIKHUB_USE_CHINA_DOMAIN=false
TIKHUB_ENABLE_CACHE=true

# LLM API 配置 (必需 - AI 分析)
# 当前支持:  openai兼容/智谱 GLM (用于痛点深度分析)
# 注册地址: https://open.bigmodel.cn/
GLM_API_KEY=your_glm_api_key_here
GLM_MODEL_NAME=glm-4.7
GLM_EMBEDDING_MODEL=embedding-3
  

# 如果选择使用 OpenAI Embedding，需要配置: 
# GLM_EMBEDDING_MODEL=text-embedding-3-small
```

#### 配置说明

**必需配置：**
1. **TIKHUB_API_TOKEN**：数据采集 API，支持 8 个平台
2. **GLM_API_KEY**：智谱 AI API，用于痛点深度分析
 
 

### 3. 运行项目

```bash
# 开发模式
npm run dev

# 生产构建
npm run build
npm run start
```

访问 http://localhost:3000

## 使用指南

### 痛点分析（主页）

1. 选择数据源（抖音、TikTok、Bilibili、微信视频号、YouTube、小红书、X (Twitter)、Reddit）
2. 输入关键词，多个用逗号分隔，如：`露营, 新手, 装备`
3. 可选开启获取视频评论（更耗时但数据更丰富）
4. 点击开始分析，等待结果
5. 点击任意行查看详细原文，或导出 CSV

> **TikHub API 说明**：基于 TikHub API 的数据获取服务，无需登录，按需付费。每次分析约 $0.01-0.5，具体取决于数据量。
 

### 语言切换

- 页面右上角点击语言切换器可切换简体中文/繁體中文/英文
- 首次访问会自动检测浏览器语言偏好
- AI 分析结果会根据当前语言自动输出对应语言
- 也可通过 URL 直接访问：`/zh/`、`/zh-TW/` 或 `/en/`

## 项目结构

```
SeekMoney-ai/
├── src/
│   ├── app/
│   │   ├── [locale]/             # 国际化动态路由
│   │   │   ├── page.tsx          # 主页 - 痛点分析
│   │   │   ├── ai-product/page.tsx # AI产品建议页
│   │   │   └── layout.tsx        # 国际化布局（NextIntlClientProvider）
│   │   ├── layout.tsx            # 根布局
│   │   └── api/
│   │       ├── analyze/          # 创建分析任务
│   │       ├── jobs/[jobId]/     # 查询任务状态
│   │       ├── analyze-ai-product/
│   │       ├── ai-product-jobs/[jobId]/
│   │       └── health/           # 健康检查
│   ├── components/
│   │   ├── AnalysisForm.tsx      # 分析表单
│   │   ├── JobStatus.tsx         # 任务状态显示
│   │   ├── ResultsTable.tsx      # 结果表格
│   │   ├── DetailModal.tsx       # 痛点详情弹窗
│   │   ├── LoadingAnimation.tsx  # 加载动画
│   │   ├── DataQualityBanner.tsx # 数据质量提示
│   │   ├── AIProductCard.tsx     # AI产品卡片
│   │   ├── AIProductDetailModal.tsx
│   │   ├── ExportButton.tsx      # CSV导出
│   │   ├── RawDataExportButton.tsx # 原始数据导出
│   │   └── LanguageSwitcher.tsx  # 语言切换器
│   ├── i18n/                     # 国际化配置
│   │   ├── config.ts             # 语言配置（支持的语言列表）
│   │   ├── navigation.ts         # 国际化导航工具
│   │   └── request.ts            # 翻译消息加载
│   ├── messages/                 # 翻译文件
│   │   ├── zh.json               # 简体中文翻译
│   │   ├── zh-TW.json            # 繁體中文翻译
│   │   └── en.json               # 英文翻译
│   ├── middleware.ts             # 国际化路由中间件
│   └── lib/
│       └── design-tokens.ts      # 设计系统标记
├── lib/
│   ├── services/
│   │   ├── job-manager.ts        # 任务管理核心
│   │   ├── tikhub-client.ts      # TikHub API 客户端
│   │   ├── tikhub-service.ts     # 抖音数据源服务
│   │   ├── tiktok-service.ts     # TikTok 数据源服务
│   │   ├── bilibili-service.ts   # Bilibili 数据源服务
│   │   ├── wechat-service.ts     # 微信数据源服务
│   │   ├── youtube-service.ts    # YouTube 数据源服务 (V3 API)
│   │   ├── xhs-service.ts        # 小红书数据源服务
│   │   ├── twitter-service.ts    # X (Twitter) 数据源服务
│   │   ├── reddit-service.ts     # Reddit 数据源服务
│   │   ├── glm-service.ts        # GLM 大模型服务
│   │   ├── clustering-service.ts # 聚类服务(Python集成)
│   │   ├── priority-scoring.ts   # 优先级评分系统
│   │   ├── ai-product-service.ts # AI产品分析
│   │   ├── ai-product-job-manager.ts
│   │   ├── data-source-factory.ts
│   │   └── data-source-interface.ts
│   ├── services/clustering/      # TypeScript 聚类服务
│   │   ├── EmbeddingProvider.ts  # Embedding 提供商(支持 OpenAI/GLM)
│   │   └── ...
│   ├── semantic_clustering.py    # Python 语义聚类
│   └── utils/
│       └── python-detector.ts    # Python 命令检测
├── .env.example                  # 环境变量模板
├── package.json
├── requirements.txt              # Python 依赖
└── tsconfig.json
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 15 + React 19 |
| 样式 | Tailwind CSS 4 |
| 国际化 | next-intl |
| 数据请求 | SWR (任务状态轮询) |
| 后端 | Next.js API Routes |
| 数据采集 | TikHub API |
| AI 分析 | 智谱 GLM-4.7（思考模型）+ embedding-3 |
| 聚类算法 | GLM embedding-3 + DBSCAN / TypeScript 原生聚类 |
| 任务队列 | 内存任务管理（支持异步处理） |

## 核心架构

### 任务处理流程

```
用户输入（关键词 + 数据源）
    ↓
DataSourceFactory → 爬虫服务
    ↓
原始视频数据 + 评论数据
    ↓
分别聚类（视频 vs 评论，避免语义混淆）
    ↓
Python/TS 聚类服务
  - 数据清洗：噪音过滤、质量评分
  - 向量化：GLM embedding-3
  - 聚类：DBSCAN + 余弦距离
    ↓
聚类结果（含代表性文本）
    ↓
GLM-4.7 深度分析（每类）
  - 痛点深度（表面 → 根因 → 场景）
  - 市场格局（现有方案 → 未满足需求）
  - MVP 计划（功能 → 验证 → 时间线）
  - 市场规模评分（0-5）
    ↓
优先级评分（需求 + 市场 + 竞争）
    ↓
排序结果 → 前端展示
```

### 设计模式

- **工厂模式**：`DataSourceFactory` 抽象数据源，支持动态切换
- **服务层模式**：清晰的业务逻辑分层
- **任务队列**：异步处理，支持状态轮询
- **适配器模式**：统一不同平台 API 的接口

## API 配置

### TikHub API（必需 - 数据采集）

**注册地址**：https://api.tikhub.io/

**特点**：
- 支持多平台：抖音、小红书、TikTok、Bilibili、微信视频号、YouTube、X (Twitter)、Reddit
- 稳定可靠：API 接口，无反爬风险
- 按需付费：约 $0.01/次请求
- 24 小时缓存：重复请求免费
- 用量监控：支持 `getUsageStats()` 方法查询

**配置示例**：
```env
TIKHUB_API_TOKEN=your_tikhub_api_token_here
TIKHUB_USE_CHINA_DOMAIN=false  # 是否使用中国域名
TIKHUB_ENABLE_CACHE=true       # 启用 24 小时缓存
```
 
## 常见问题

### Q: TikHub API 如何收费？
A: TikHub API 按请求计费，约 $0.01/次。一次典型分析（3 个关键词，20 个视频，每个视频 30 条评论）大约花费 $0.5。支持 24 小时缓存，重复访问不收费。

### Q: 为什么推荐使用 TikHub API？
A:
- **稳定性**：API 接口，无反爬风险
- **多平台**：一个 API 支持 8 个主流平台
- **速度**：快速响应，无需等待页面加载
- **成本**：按需付费，约 $0.01/次请求
- **合规**：官方 API 接口，避免法律风险
- **缓存**：24 小时缓存，重复请求免费

### Q: 如何在服务器部署？
A:
1. 确保已配置 TikHub API Token 和 GLM API Key
2. 确保 Node.js 和 Python 环境已安装
3. 运行 `npm run build && npm start`

### Q: 聚类结果太少或太多？
A:
- **结果太少**：尝试更多关键词，或降低 `minClusterSize` 参数
- **结果太多**：增加关键词精确度，或提高 `eps` 参数（聚类距离阈值）

### Q: 支持哪些平台？
A: 目前支持 8 个平台：抖音、TikTok、Bilibili、微信视频号、YouTube、小红书、X (Twitter)、Reddit。所有数据源均基于 TikHub API。

### Q: 可以使用 OpenAI 替代智谱 GLM 吗？
A: 部分可以。当前版本：
- **LLM 分析（痛点深度分析）**：仅支持智谱 GLM，暂不支持替代
- **Embedding（语义聚类）**：可选择使用 OpenAI，通过设置 `EMBEDDING_PROVIDER=openai` 并配置 `OPENAI_API_KEY` 即可

完整 OpenAI LLM 支持正在开发中。

### Q: 如何使用 OpenAI Embedding？
A: 在 `.env.local` 中配置：
```env 
 EMBEDDING_MODEL选择 text-embedding-3-small  # 或 text-embedding-3-large
```

### Q: 数据质量分级是什么意思？
A:
- **exploratory（<50）**：样本量小，建议进一步验证
- **preliminary（50-200）**：中等置信度，适合初期研究
- **reliable（≥200）**：高置信度，统计显著

## 许可证

本项目采用 MIT License。

项目前端和思路参考和fork了： https://github.com/weiyf2/deeppoint-ai ，感谢作者开源。
