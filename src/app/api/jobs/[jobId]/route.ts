import { NextRequest, NextResponse } from 'next/server';
import { jobManager, RawVideoData, RawCommentData, ClusteredDataGroup } from '../../../../../lib/services/job-manager';
import { ClusterResult } from '../../../../../lib/services/clustering-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    console.log('[API /api/jobs/[jobId]] 查询任务:', jobId);

    if (!jobId) {
      return NextResponse.json(
        { error: "任务ID是必需的" },
        { status: 400 }
      );
    }

    // 从任务管理器获取任务状态
    const job = jobManager.getJob(jobId);

    if (!job) {
      console.error('[API /api/jobs/[jobId]] 任务不存在:', jobId);
      console.error('[API /api/jobs/[jobId]] 当前任务列表:', jobManager.getAllJobIds());
      console.error('[API /api/jobs/[jobId]] 任务统计:', jobManager.getJobStats());
      return NextResponse.json(
        { error: "任务不存在。服务器可能已重启，请重新提交分析任务。" },
        { status: 404 }
      );
    }

    console.log('[API /api/jobs/[jobId]] 任务状态:', { jobId, status: job.status, progress: job.progress });

    // 构造响应
    const response: {
      jobId: string;
      status: string;
      progress: string;
      progressStage?: 'init' | 'validating' | 'crawling' | 'clustering' | 'analyzing' | 'completed' | 'failed';
      progressPercent?: number;
      keywords?: string[];
      results?: ClusterResult[];
      rawData?: {
        videos: RawVideoData[];
        comments: RawCommentData[];
        rawTexts: string[];
      };
      clusteredData?: ClusteredDataGroup[];
      error?: string;
    } = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      progressStage: job.progressStage,
      progressPercent: job.progressPercent,
      keywords: job.keywords
    };

    // 如果任务完成，包含结果
    if (job.status === "completed" && job.results) {
      response.results = job.results;
      // 包含原始数据
      if (job.rawData) {
        response.rawData = job.rawData;
      }
      // 包含聚类数据
      if (job.clusteredData) {
        response.clusteredData = job.clusteredData;
      }
    }

    // 如果任务失败，包含错误信息
    if (job.status === "failed") {
      response.error = job.error || "任务执行失败";
    }

    return NextResponse.json(response);

  } catch {
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}