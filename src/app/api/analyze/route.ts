import { NextRequest, NextResponse } from 'next/server';
import { jobManager } from '../../../../lib/services/job-manager';
import { DataSourceType, TikTokCrawlOptions } from '../../../../lib/services/data-source-interface';

// 输入边界常量（防止滥用）
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 50;
const MAX_TIKTOK_VIDEOS = 50;
const MAX_TIKTOK_COMMENTS_PER_VIDEO = 100;
const MAX_LIMIT = 500;

function clampInt(value: any, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function isSupportedSource(value: any): value is DataSourceType {
  return value === 'tikhub' || value === 'tiktok' || value === 'bilibili'
    || value === 'wechat' || value === 'youtube' || value === 'xiaohongshu';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      keywords,
      limit = 200,
      dataSource = 'tiktok',
      deepCrawl = false,
      maxVideos = 10,
      tiktokConfig,  // TikTok/TikHub 配置
      locale = 'zh'  // 输出语言
    } = body;

    // 验证输入
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "关键词是必需的，且必须是非空数组" },
        { status: 400 }
      );
    }

    // 验证关键词格式与数量
    const validKeywords = keywords
      .filter(k => typeof k === 'string' && k.trim().length > 0)
      .map(k => k.trim().slice(0, MAX_KEYWORD_LENGTH));
    if (validKeywords.length === 0) {
      return NextResponse.json(
        { error: "请提供有效的关键词" },
        { status: 400 }
      );
    }
    if (validKeywords.length > MAX_KEYWORDS) {
      return NextResponse.json(
        { error: `关键词数量不能超过 ${MAX_KEYWORDS} 个` },
        { status: 400 }
      );
    }

    // 验证数据源（仅接受白名单，不静默回退）
    if (!isSupportedSource(dataSource)) {
      return NextResponse.json(
        { error: `不支持的数据源: ${dataSource}。支持的数据源: tikhub, tiktok, bilibili, wechat, youtube, xiaohongshu` },
        { status: 400 }
      );
    }

    const validDataSource: DataSourceType = dataSource;
    const enableDeepCrawl = Boolean(deepCrawl);
    const validLimit = clampInt(limit, 200, 1, MAX_LIMIT);
    const validMaxVideos = clampInt(maxVideos, 10, 1, MAX_TIKTOK_VIDEOS);

    // TikTok 和 TikHub 使用相同的配置结构
    let tikTokOptions: TikTokCrawlOptions | undefined;
    if (tiktokConfig) {
      tikTokOptions = {
        enableComments: Boolean(tiktokConfig.enableComments ?? true),
        maxVideos: clampInt(tiktokConfig.maxVideos, 15, 1, MAX_TIKTOK_VIDEOS),
        maxCommentsPerVideo: clampInt(tiktokConfig.maxCommentsPerVideo, 20, 1, MAX_TIKTOK_COMMENTS_PER_VIDEO),
        enableSubComments: Boolean(tiktokConfig.enableSubComments ?? false)
      };
    }

    // 创建分析任务
    console.log('[API /api/analyze] 准备创建任务:', { validKeywords, validDataSource, validLimit, tikTokOptions });
    const jobId = jobManager.createJob(
      validKeywords,
      validLimit,
      validDataSource,
      enableDeepCrawl,
      validMaxVideos,
      tikTokOptions,
      locale
    );
    console.log('[API /api/analyze] 任务已创建:', jobId);

    // 立即返回任务ID，不等待任务完成
    return NextResponse.json(
      { jobId },
      { status: 202 }
    );

  } catch (error) {
    console.error('[API /api/analyze] 错误:', error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
