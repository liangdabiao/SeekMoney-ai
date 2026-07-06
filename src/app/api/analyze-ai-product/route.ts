import { NextRequest, NextResponse } from 'next/server';
import { aiProductJobManager } from '../../../../lib/services/ai-product-job-manager';
import { DataSourceType } from '../../../../lib/services/data-source-interface';

// 输入边界常量（与 /api/analyze 保持一致，防止滥用）
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 50;
const MAX_LIMIT = 200;

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
    const { keywords, limit = 50, dataSource = 'tiktok', locale = 'zh' } = body;

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
    const validLimit = clampInt(limit, 50, 1, MAX_LIMIT);

    // 创建AI产品分析任务
    const jobId = aiProductJobManager.createJob(validKeywords, validLimit, validDataSource, locale);

    // 立即返回任务ID，不等待任务完成
    return NextResponse.json(
      { jobId },
      { status: 202 }
    );

  } catch (error) {
    console.error('[API /api/analyze-ai-product] 错误:', error);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
