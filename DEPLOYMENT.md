# SeekMoney AI 宝塔部署指南

> 本指南针对宝塔 Linux 面板，尽可能使用可视化操作，减少命令行操作。

---

## 一、环境准备

### 1.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 操作系统 | CentOS 7+ / Ubuntu 20.04+ | CentOS 8 / Ubuntu 22.04 |
| CPU | 1核 | 2核及以上 |
| 内存 | 2GB | 4GB及以上 |
| 硬盘 | 10GB | 20GB及以上 |

### 1.2 端口准备

确保以下端口已在防火墙/安全组中放行：

| 端口 | 用途 |
|------|------|
| 80 | HTTP 访问 |
| 443 | HTTPS 访问 |
| 3000 | Next.js 默认服务端口 |

---

## 二、宝塔面板基础配置

### 2.1 安装宝塔面板

如果尚未安装宝塔，执行以下命令（仅这一步需要命令行）：

```bash
# CentOS 安装命令
yum install -y wget && wget -O install.sh https://download.bt.cn/install/install_6.0.sh && sh install.sh ed8484bec

# Ubuntu/Debian 安装命令
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
```

安装完成后，记录面板地址、用户名和密码。

### 2.2 安装必要软件

登录宝塔面板后，进入 **软件商店**：

1. 搜索并安装 **PM2 管理器**（用于管理 Node.js 进程）
2. 搜索并安装 **Nginx**（用于反向代理）

---

## 三、Node.js 环境配置

### 3.1 安装 Node.js 版本

1. 进入 **软件商店** → **运行环境**
2. 找到 **Node.js 版本管理**，点击 **设置**
3. 在弹出的窗口中，选择 Node.js 版本：**20.x**（推荐）或 **18.x**
4. 点击 **安装**，等待安装完成

### 3.2 验证 Node.js 版本

（可选）在宝塔终端中验证：

```bash
node -v  # 应显示 v20.x.x
npm -v   # 应显示 10.x.x
```

---

## 四、项目部署

### 4.1 创建网站

1. 进入 **网站** → **添加站点**
2. 填写信息：
   - **域名**：输入你的域名（如 `ai.example.com`），如果没有域名可先填服务器 IP
   - **根目录**：设置为 `/www/wwwroot/seekmoney-ai/.next/static`
   - **PHP版本**：选择 **纯静态**（因为 Next.js 是 Node.js 项目）
   - **数据库**：**不创建**（本项目无需数据库）
3. 点击 **提交**

### 4.2 上传项目文件

#### 方法一：通过宝塔文件管理器上传（推荐）

1. 进入 **文件** → `/www/wwwroot/`
2. 创建文件夹 `seekmoney-ai`
3. 进入 `seekmoney-ai` 文件夹
4. 点击 **上传**，选择本地项目打包后的文件（或直接上传源码）

#### 方法二：通过 Git 拉取（如果项目在 Git 仓库）

1. 进入 **网站** → 目标站点 → **设置** → **Git 部署**
2. 填写：
   - **远程仓库地址**：你的 Git 仓库地址
   - **分支**：`main` 或 `master`
   - **用户名/密码**：Git 账号信息（或使用 SSH Key）
3. 点击 **保存设置**
4. 点击 **立即部署**

### 4.3 安装依赖

1. 进入 **软件商店** → **PM2 管理器** → **设置**
2. 找到 **项目列表**，点击 **添加项目**
3. 填写：
   - **项目名称**：`seekmoney-ai`
   - **启动文件**：`node_modules/.bin/next`
   - **项目目录**：`/www/wwwroot/seekmoney-ai`
   - **运行命令**：留空
4. 先不要点击 **提交**，先点击 **高级设置**
5. 在 **环境变量** 中添加（详见下方配置）

> ⚠️ 注意：首次部署需要先安装依赖，见下方步骤

### 4.4 安装 npm 依赖（首次部署）

1. 进入 **软件商店** → **PM2 管理器** → **终端**
2. 进入项目目录：
   ```bash
   cd /www/wwwroot/seekmoney-ai
   ```
3. 安装依赖：
   ```bash
   npm install
   ```
4. 等待安装完成（可能需要几分钟）

---

## 五、环境变量配置

### 5.1 创建 .env 文件

1. 进入 **文件** → `/www/wwwroot/seekmoney-ai/`
2. 创建文件 `.env`
3. 填入以下内容（替换为你的真实配置）：

```env
# ==================== 必配项 ====================

# 一、智谱 AI GLM API 配置
# 注册地址: https://open.bigmodel.cn/
GLM_API_KEY=你的智谱API密钥
GLM_MODEL_NAME=glm-4.6
GLM_EMBEDDING_MODEL=embedding-3
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
GLM_BASE_EMBEDDING_URL=https://open.bigmodel.cn/api/paas/v4/embeddings

# Embedding 提供商选择: 'auto' | 'openai' | 'zhipuai'
EMBEDDING_PROVIDER=zhipuai

# 二、TikHub API (数据抓取服务)
# 注册地址: https://tikhub.io/
TIKHUB_API_TOKEN=你的TikHub令牌
TIKHUB_TIMEOUT=60000

# ==================== 一般无需修改 ====================

PYTHONIOENCODING=utf-8
HEADLESS=true
LOG_LEVEL=info
NODE_ENV=production
```

### 5.2 配置说明

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `GLM_API_KEY` | 智谱AI API密钥，必需 | `sk-xxxxxxxx` |
| `GLM_MODEL_NAME` | 使用的模型名称 | `glm-4.6` |
| `GLM_EMBEDDING_MODEL` | Embedding模型 | `embedding-3` |
| `TIKHUB_API_TOKEN` | TikHub数据抓取服务令牌，必需 | `tk-xxxxxxxx` |
| `HEADLESS` | 服务器环境设为 `true` | `true` |
| `NODE_ENV` | 生产环境设为 `production` | `production` |

---

## 六、构建项目

### 6.1 执行构建

1. 进入 **软件商店** → **PM2 管理器** → **终端**
2. 进入项目目录并执行构建：
   ```bash
   cd /www/wwwroot/seekmoney-ai
   npm run build
   ```
3. 等待构建完成（可能需要几分钟）
4. 构建成功后会显示类似如下内容：
   ```
   ✓ Generating static pages (6/6)
   ✓ Finalizing page optimization ...
   ```

---

## 七、PM2 进程管理配置

### 7.1 添加 PM2 项目

1. 进入 **软件商店** → **PM2 管理器** → **设置**
2. 点击 **添加项目**
3. 填写：
   - **项目名称**：`seekmoney-ai`
   - **启动文件**：`node_modules/.bin/next`
   - **项目目录**：`/www/wwwroot/seekmoney-ai`
4. 点击 **高级设置**：
   - **端口**：`3000`（或自定义端口）
   - **运行命令参数**：`start -p 3000`
   - **环境变量**：可再次确认 `.env` 文件中的配置
5. 点击 **提交**

### 7.2 启动项目

1. 在 PM2 管理器中找到刚添加的项目
2. 点击 **启动**
3. 查看状态是否变为 **运行中**

### 7.3 验证服务

（可选）在宝塔终端中验证：

```bash
curl http://localhost:3000
```

如果返回 HTML 内容，说明服务已正常启动。

---

## 八、Nginx 反向代理配置

### 8.1 配置反向代理

1. 进入 **网站** → 目标站点 → **设置** → **反向代理**
2. 点击 **添加反向代理**
3. 填写：
   - **代理名称**：`seekmoney-ai`
   - **目标URL**：`http://127.0.0.1:3000`
   - **发送域名**：勾选
   - **代理协议**：`HTTP`
4. 点击 **提交**

### 8.2 配置 SSL（可选但推荐）

1. 进入 **网站** → 目标站点 → **设置** → **SSL**
2. 选择 **Let's Encrypt**
3. 勾选你的域名
4. 点击 **申请**
5. 申请成功后，勾选 **强制 HTTPS**

---

## 九、安全设置

### 9.1 禁用不需要的端口

1. 进入 **安全** → **防火墙**
2. 确保只放行必要端口：`80`、`443`、`22`（SSH）
3. 如果使用自定义端口，也需要放行

### 9.2 隐藏网站标识

1. 进入 **网站** → 目标站点 → **设置** → **网站安全**
2. 开启 **隐藏响应头中的 PHP 版本**
3. 开启 **禁止跨站请求（XSS）**

---

## 十、常见问题排查

### 10.1 项目启动失败

1. 进入 **PM2 管理器** → 项目 → **日志**
2. 查看错误信息：
   - 如果提示 `MODULE_NOT_FOUND`：运行 `npm install`
   - 如果提示端口被占用：更换端口或关闭占用进程
   - 如果提示环境变量缺失：检查 `.env` 文件

### 10.2 访问网站显示 502 Bad Gateway

1. 检查 PM2 服务是否运行
2. 检查反向代理配置是否正确
3. 检查防火墙是否放行端口

### 10.3 构建失败

1. 检查 Node.js 版本是否为 18+
2. 检查 npm 依赖是否安装完整
3. 查看构建日志中的错误信息

### 10.4 内存不足

1. 进入 **PM2 管理器** → **设置** → **进程守护**
2. 调整 **内存限制**
3. 考虑升级服务器配置

---

## 十一、部署完成验证

### 验证步骤

1. 打开浏览器，访问你的域名（如 `https://ai.example.com`）
2. 检查页面是否正常加载
3. 尝试执行一次分析任务，验证：
   - API 调用是否正常
   - 数据抓取是否正常
   - 评论获取是否正常
   - 分析结果是否生成

---

## 十二、日常维护

### 12.1 重启项目

1. 进入 **PM2 管理器** → 项目 → **重启**

### 12.2 更新项目

1. 通过 Git 部署或文件上传更新代码
2. 执行 `npm install`（如果有依赖变更）
3. 执行 `npm run build`
4. 重启 PM2 项目

### 12.3 查看日志

1. 进入 **PM2 管理器** → 项目 → **日志**
2. 查看运行日志和错误日志

---

## 附录：项目结构说明

```
seekmoney-ai/
├── .env                    # 环境变量配置
├── package.json            # 项目依赖配置
├── next.config.ts          # Next.js 配置
├── src/                    # 源代码目录
│   ├── app/                # 前端页面
│   ├── lib/                # 后端服务
│   │   └── services/       # 核心业务逻辑
├── lib/                    # 通用库（后端）
│   └── services/           # 数据抓取、分析服务
├── analysis-results/       # 分析结果存储目录
└── .next/                  # 构建输出目录
```

---

> 📝 **注意事项**：
> 1. `.env` 文件包含敏感信息，请勿提交到版本控制
> 2. 建议定期备份 `.env` 文件和 `analysis-results` 目录
> 3. 生产环境建议开启 HTTPS
> 4. 如果服务器内存较小（<2GB），建议使用 `--max-old-space-size` 参数限制内存使用
