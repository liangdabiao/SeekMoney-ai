English | [中文](./README.md)

# SeekMoney - User Pain Point Discoverer

![logo](./assets/logo.png)

A web application that helps indie developers automatically discover user pain points from social media, with intelligent clustering analysis and AI-powered product solution generation.

**Core Features:**
- Multi-platform data collection (Douyin, Xiaohongshu, TikTok, Bilibili, WeChat Channels, YouTube, X (Twitter), Reddit)
- Semantic clustering based on GLM embedding-3 + DBSCAN algorithm
- Deep analysis using GLM-4.6 thinking model
- Intelligent priority scoring system (demand intensity + market size + competition)
- Full trilingual support (Simplified Chinese / Traditional Chinese / English)

## Features

### Pain Point Analysis Module
- **Multi-Platform Data Collection**
  - Douyin (TikTok China)
  - TikTok (International)
  - Bilibili
  - WeChat Channels
  - YouTube (V3 API with Shorts support)
  - Xiaohongshu (Little Red Book)
  - X (Twitter)
  - Reddit
- **Intelligent Semantic Clustering**
  - Videos and comments clustered separately to avoid semantic confusion
  - Vector representation based on GLM embedding-3
  - DBSCAN density clustering for automatic topic discovery
  - Supports multiple embedding providers (GLM, OpenAI)
- **Deep AI Analysis** (GLM-4.6 Thinking Model)
  - Pain Depth: Surface pain → Root causes → User scenarios → Emotional intensity
  - Market Landscape: Existing solutions → Unmet needs → Opportunity analysis
  - MVP Plan: Core features → Validation hypotheses → First users → Cost estimation
  - Market size score (0-5)
- **Priority Scoring System**
  - Demand intensity: Based on cluster size and discussion热度
  - Market size: AI-evaluated market potential
  - Competition: Existing solution analysis
  - Automatic sorting by综合得分
- **Data Quality Grading**
  - exploratory (<50): Exploratory,建议进一步验证
  - preliminary (50-200): Preliminary conclusions, suitable for initial research
  - reliable (≥200): High confidence, statistically significant
- **Result Display & Export**
  - Visual table display with sorting and filtering
  - Click to view detailed source content and representative items
  - One-click CSV export
  - Raw data export (with cluster groups)

### AI Product Suggestion Module
- AI product manager role auto-generates product solutions
- Includes core features, tech stack, development roadmap
- Evaluates implementation difficulty and market potential

### Multi-language Support
- Simplified Chinese / Traditional Chinese / English interface switching
- AI analysis results automatically output in the current language
- Internationalized URL routing (`/zh/`, `/zh-TW/`, `/en/`)
- Auto-detect browser language preference

## Data Sources

All data sources are powered by TikHub API, providing unified and stable data collection.

| Source | Platform | Description |
|--------|----------|-------------|
| Douyin | Douyin | Chinese version of TikTok, largest short video platform |
| TikTok | TikTok | International version, global users |
| Bilibili | Bilibili | Leading video sharing platform in China |
| WeChat Channels | WeChat | Short video feature within WeChat |
| YouTube | YouTube | World's largest video platform (V3 API with Shorts search) |
| Xiaohongshu | Xiaohongshu | Lifestyle sharing community |
| X (Twitter) | Twitter | Global mainstream social media platform |
| Reddit | Reddit | World's largest forum community platform |

### TikHub API Advantages
- **Multi-Platform**: One API for 8 major platforms
- **Stable & Reliable**: No crawler maintenance, avoids anti-crawling restrictions
- **Pay Per Use**: ~$0.01/request, 24-hour cache reduces costs
- **Developer Friendly**: RESTful API with comprehensive documentation and SDKs
- **Compliance**: Official API interface, avoids legal risks

## Preview

> For more screenshots and resources, browse the [assets folder](./assets/).

<img src="./assets/demo-preview-result.png" alt="Preview" style="zoom: 63%;" />

<img src="./assets/demo-preview-result1.png" alt="Preview" style="zoom: 63%;" />

## Quick Start

### Requirements

- Node.js >= 18
- Python >= 3.10
- npm or pnpm

### 1. Install Dependencies

```bash
# Clone the project
git clone https://github.com/your-username/SeekMoney-ai.git
cd SeekMoney-ai

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# TikHub API Configuration (Required - Data Collection)
# Register at: https://api.tikhub.io/
TIKHUB_API_TOKEN=your_tikhub_api_token_here
TIKHUB_USE_CHINA_DOMAIN=false
TIKHUB_ENABLE_CACHE=true

# LLM API Configuration (Required - AI Analysis)
# Current support: Zhipu GLM (for pain point deep analysis)
# Register at: https://open.bigmodel.cn/
GLM_API_KEY=your_glm_api_key_here
GLM_MODEL_NAME=glm-4.6
GLM_EMBEDDING_MODEL=embedding-3

# Embedding Provider Selection (Optional)
# Options: 'zhipuai' (default) | 'openai' | 'auto'
EMBEDDING_PROVIDER=zhipuai

# If choosing OpenAI Embedding, configure:
# OPENAI_API_KEY=sk-your_openai_api_key_here
# OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### Configuration Notes

**Required:**
1. **TIKHUB_API_TOKEN**: Data collection API, supports 8 platforms
2. **GLM_API_KEY**: Zhipu AI API, for pain point deep analysis

**Optional:**
- **EMBEDDING_PROVIDER**: Choose embedding provider
  - `zhipuai` (default): Use Zhipu AI embedding-3
  - `openai`: Use OpenAI text-embedding-3-small
  - `auto`: Auto-select (prioritizes OpenAI)

> **Note**: Current version primarily uses Zhipu GLM for AI analysis. The embedding part can optionally use OpenAI as an alternative.

### 3. Run the Project

```bash
# Development mode
npm run dev

# Production build
npm run build
npm run start
```

Visit http://localhost:3000

## User Guide

### Pain Point Analysis (Home Page)

1. Select data source (Douyin, TikTok, Bilibili, WeChat Channels, YouTube, Xiaohongshu, X (Twitter), Reddit)
2. Enter keywords, separated by commas, e.g., `camping, beginner, gear`
3. Optionally enable video comment fetching (slower but richer data)
4. Click Start Analysis and wait for results
5. Click any row to view detailed source content, or export CSV

> **TikHub API Note**: Based on TikHub API data acquisition service, no login required, pay per use. Each analysis costs approximately $0.01-0.5, depending on data volume.

### AI Product Suggestions (/ai-product)

1. Enter keywords for your target domain
2. AI will analyze user feedback and generate a complete product solution
3. View product name, features, tech stack, development plan, etc.

### Language Switching

- Click the language switcher in the top right corner to switch between Simplified Chinese / Traditional Chinese / English
- First visit will auto-detect browser language preference
- AI analysis results will automatically output in the current language
- You can also access directly via URL: `/zh/`, `/zh-TW/`, or `/en/`

## Project Structure

```
SeekMoney-ai/
├── src/
│   ├── app/
│   │   ├── [locale]/             # Internationalized dynamic routes
│   │   │   ├── page.tsx          # Home - Pain Point Analysis
│   │   │   ├── ai-product/page.tsx # AI Product Suggestions
│   │   │   └── layout.tsx        # i18n layout (NextIntlClientProvider)
│   │   ├── layout.tsx            # Root layout
│   │   └── api/
│   │       ├── analyze/          # Create analysis job
│   │       ├── jobs/[jobId]/     # Query job status
│   │       ├── analyze-ai-product/
│   │       ├── ai-product-jobs/[jobId]/
│   │       └── health/           # Health check
│   ├── components/
│   │   ├── AnalysisForm.tsx      # Analysis form
│   │   ├── JobStatus.tsx         # Job status display
│   │   ├── ResultsTable.tsx      # Results table
│   │   ├── DetailModal.tsx       # Pain point detail modal
│   │   ├── LoadingAnimation.tsx  # Loading animation
│   │   ├── DataQualityBanner.tsx # Data quality indicator
│   │   ├── AIProductCard.tsx     # AI product card
│   │   ├── AIProductDetailModal.tsx
│   │   ├── ExportButton.tsx      # CSV export
│   │   ├── RawDataExportButton.tsx # Raw data export
│   │   └── LanguageSwitcher.tsx  # Language switcher
│   ├── i18n/                     # Internationalization config
│   │   ├── config.ts             # Language config (supported locales)
│   │   ├── navigation.ts         # i18n navigation utilities
│   │   └── request.ts            # Translation message loading
│   ├── messages/                 # Translation files
│   │   ├── zh.json               # Simplified Chinese translations
│   │   ├── zh-TW.json            # Traditional Chinese translations
│   │   └── en.json               # English translations
│   ├── middleware.ts             # i18n routing middleware
│   └── lib/
│       └── design-tokens.ts      # Design system tokens
├── lib/
│   ├── services/
│   │   ├── job-manager.ts        # Job management core
│   │   ├── tikhub-client.ts      # TikHub API client
│   │   ├── tikhub-service.ts     # Douyin data source service
│   │   ├── tiktok-service.ts     # TikTok data source service
│   │   ├── bilibili-service.ts   # Bilibili data source service
│   │   ├── wechat-service.ts     # WeChat data source service
│   │   ├── youtube-service.ts    # YouTube data source service (V3 API)
│   │   ├── xhs-service.ts        # Xiaohongshu data source service
│   │   ├── twitter-service.ts    # X (Twitter) data source service
│   │   ├── reddit-service.ts     # Reddit data source service
│   │   ├── glm-service.ts        # GLM LLM service
│   │   ├── clustering-service.ts # Clustering service (Python integration)
│   │   ├── priority-scoring.ts   # Priority scoring system
│   │   ├── ai-product-service.ts # AI product analysis
│   │   ├── ai-product-job-manager.ts
│   │   ├── data-source-factory.ts
│   │   └── data-source-interface.ts
│   ├── services/clustering/      # TypeScript clustering service
│   │   ├── EmbeddingProvider.ts  # Embedding provider (supports OpenAI/GLM)
│   │   └── ...
│   ├── semantic_clustering.py    # Python semantic clustering
│   └── utils/
│       └── python-detector.ts    # Python command detection
├── .env.example                  # Environment variable template
├── package.json
├── requirements.txt              # Python dependencies
└── tsconfig.json
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | Next.js 15 + React 19 |
| Styling | Tailwind CSS 4 |
| Internationalization | next-intl |
| Data Fetching | SWR (job status polling) |
| Backend | Next.js API Routes |
| Data Collection | TikHub API |
| AI Analysis | Zhipu GLM-4.6 (thinking model) + embedding-3 |
| Clustering Algorithm | GLM embedding-3 + DBSCAN / TypeScript native clustering |
| Task Queue | In-memory job management (supports async processing) |

## Core Architecture

### Task Processing Flow

```
User Input (keywords + data source)
    ↓
DataSourceFactory → Crawler Service
    ↓
Raw Video Data + Comment Data
    ↓
Separate Clustering (videos vs comments to avoid semantic confusion)
    ↓
Python/TS Clustering Service
  - Data Cleaning: Noise filtering, quality scoring
  - Vectorization: GLM embedding-3
  - Clustering: DBSCAN + cosine distance
    ↓
Cluster Results (with representative texts)
    ↓
GLM-4.6 Deep Analysis (per cluster)
  - Pain Depth (surface → root causes → scenarios)
  - Market Landscape (existing solutions → unmet needs)
  - MVP Plan (features → validation → timeline)
  - Market Size Score (0-5)
    ↓
Priority Scoring (demand + market + competition)
    ↓
Sorted Results → Frontend Display
```

### Design Patterns

- **Factory Pattern**: `DataSourceFactory` abstracts data sources, supports dynamic switching
- **Service Layer Pattern**: Clear business logic layering
- **Job Queue**: Asynchronous processing with status polling support
- **Adapter Pattern**: Unified interface for different platform APIs

## API Configuration

### TikHub API (Required - Data Collection)

**Sign Up**: https://api.tikhub.io/

**Features**:
- Multi-platform support: Douyin, Xiaohongshu, TikTok, Bilibili, WeChat Channels, YouTube, X (Twitter), Reddit
- Stable & reliable: API interface, no anti-crawling risks
- Pay per use: ~$0.01/request
- 24-hour cache: Free repeat requests
- Usage monitoring: Supports `getUsageStats()` method

**Configuration Example**:
```env
TIKHUB_API_TOKEN=your_tikhub_api_token_here
TIKHUB_USE_CHINA_DOMAIN=false  # Use China domain
TIKHUB_ENABLE_CACHE=true       # Enable 24-hour cache
```

### LLM API (Required - AI Pain Point Analysis)

The system uses LLM for deep pain point analysis. Currently supports Zhipu GLM.

#### Zhipu GLM (Default)

**Sign Up**: https://open.bigmodel.cn/

**Model Description**:
- `glm-4.6`: Latest thinking model with deep reasoning capabilities
- `embedding-3`: Semantic vector model for clustering

**Configuration Example**:
```env
GLM_API_KEY=your_glm_api_key_here
GLM_MODEL_NAME=glm-4.6
GLM_EMBEDDING_MODEL=embedding-3
```

### Embedding Configuration (Optional)

Semantic clustering supports multiple embedding providers, switchable via environment variables.

#### Configuration Options

```env
# Embedding Provider Selection
EMBEDDING_PROVIDER=zhipuai  # Options: 'zhipuai' | 'openai' | 'auto'

# Zhipu Embedding (default)
GLM_EMBEDDING_MODEL=embedding-3

# OpenAI Embedding (optional)
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
OPENAI_BASE_URL=https://api.openai.com/v1     # Optional, supports proxy
```

#### Provider Comparison

| Provider | Model | Dimensions | Features |
|----------|-------|------------|----------|
| Zhipu AI | embedding-3 | 1024 | Optimized for Chinese, cost-effective |
| OpenAI | text-embedding-3-small | 512 | Excellent for English, fast |
| OpenAI | text-embedding-3-large | 3072 | Highest precision, higher cost |

> **Note**: Current version LLM analysis only supports Zhipu GLM. The embedding part can optionally use OpenAI. Full OpenAI LLM support is under development.

## FAQ

### Q: How much does TikHub API cost?
A: TikHub API charges per request, approximately $0.01/request. A typical analysis (3 keywords, 20 videos, 30 comments per video) costs about $0.5. Supports 24-hour caching, repeat access is free.

### Q: Why is TikHub API recommended?
A:
- **Stability**: API interface, no anti-crawling risks
- **Multi-platform**: One API for 6 major platforms
- **Speed**: Fast response, no page loading wait
- **Cost**: Pay per use, ~$0.01/request
- **Compliance**: Official API interface, avoids legal risks
- **Cache**: 24-hour cache, free repeat requests

### Q: How to deploy on a server?
A:
1. Ensure TikHub API Token and GLM API Key are configured
2. Ensure Node.js and Python environments are installed
3. Run `npm run build && npm start`

### Q: Too few or too many clustering results?
A:
- **Too few**: Try more keywords, or lower the `minClusterSize` parameter
- **Too many**: Increase keyword specificity, or raise the `eps` parameter (clustering distance threshold)

### Q: Which platforms are supported?
A: Currently supports 8 platforms: Douyin, TikTok, Bilibili, WeChat Channels, YouTube, Xiaohongshu, X (Twitter), Reddit. All data sources are powered by TikHub API.

### Q: Can I use OpenAI instead of Zhipu GLM?
A: Partially. Current version:
- **LLM Analysis (pain point deep analysis)**: Only supports Zhipu GLM, no alternative available
- **Embedding (semantic clustering)**: Can use OpenAI by setting `EMBEDDING_PROVIDER=openai` and configuring `OPENAI_API_KEY`

Full OpenAI LLM support is under development.

### Q: How to use OpenAI Embedding?
A: Configure in `.env.local`:
```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
```

### Q: What does data quality grading mean?
A:
- **exploratory (<50)**: Small sample size,建议进一步验证
- **preliminary (50-200)**: Medium confidence, suitable for initial research
- **reliable (≥200)**: High confidence, statistically significant

## Roadmap

### Completed
- [x] TikHub API data source support (8 platforms)
- [x] Pain point clustering analysis
- [x] AI product solution generation
- [x] Deep crawling (with comments)
- [x] Multi-language support (Simplified Chinese / Traditional Chinese / English)
- [x] Data quality grading
- [x] Priority scoring system
- [x] Raw data export
- [x] X (Twitter) platform support
- [x] Reddit platform support
- [x] YouTube V3 API upgrade (Shorts search, formatted data)
- [x] Traditional Chinese (zh-TW) locale support

### Planned
- [ ] User history record saving
- [ ] More data sources (Zhihu, Weibo, Instagram)
- [ ] Trend analysis features
- [ ] Competitor analysis module
- [ ] Database persistence
- [ ] User authentication system
- [ ] Team collaboration features

## License

This project is licensed under the MIT License.
