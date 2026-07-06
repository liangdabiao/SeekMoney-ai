// 任务管理服务
import { v4 as uuidv4 } from 'uuid';
import { DataSourceFactory } from './data-source-factory';
import { DataSourceType, TikTokCrawlOptions } from './data-source-interface';
import { ClusteringService, ClusterResult } from './clustering-service';
import { GLMService } from './glm-service';
import { PriorityScorer, PriorityScore } from './priority-scoring';
import { AnalysisStorageService, VideoData, CommentData, ClusterData, ClusteringStats, AnalysisSummary, AnalysisMetadata } from './analysis-storage-service';

// 原始视频数据接口
export interface RawVideoData {
  title: string;
  author: string;
  video_url: string;
  publish_time?: string;
  likes: string;
  collected_at: string;
  comment_count?: number;
  description?: string;
}

// 原始评论数据接口
export interface RawCommentData {
  video_title: string;
  comment_text: string;
  username: string;
  likes: string;
}

// 聚类数据接口
export interface ClusteredDataGroup {
  clusterId: number;
  size: number;
  videos: RawVideoData[];
  comments: RawCommentData[];
}

export interface Job {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: string;
  progressStage: 'init' | 'validating' | 'crawling' | 'clustering' | 'analyzing' | 'completed' | 'failed';
  progressPercent: number;
  keywords: string[];
  limit: number;
  dataSource: DataSourceType;
  deepCrawl: boolean;  // 是否深度抓取（含评论）
  maxVideos?: number;  // 深度抓取时的最大视频数
  tikTokOptions?: TikTokCrawlOptions;  // 新版抖音完整配置
  locale: string;  // 输出语言
  startTime: number;
  results?: ClusterResult[];
  crawlStats?: {       // 抓取统计
    videoCount?: number;
    commentCount?: number;
    textCount?: number;
  };
  // 数据质量元信息
  dataQuality?: {
    level: 'reliable' | 'preliminary' | 'exploratory';  // 可靠样本 | 初步验证 | 小样本探索
    totalDataSize: number;
    clusterCount: number;
    averageClusterSize: number;
  };
  // 原始数据存储
  rawData?: {
    videos: RawVideoData[];
    comments: RawCommentData[];
    rawTexts: string[];
  };
  // 聚类后的数据分组
  clusteredData?: ClusteredDataGroup[];
  error?: string;
}

export interface CreateJobOptions {
  keywords: string[];
  limit?: number;
  dataSource?: DataSourceType;
  deepCrawl?: boolean;
  maxVideos?: number;
}

// 实际的 JobManager 实现类
class JobManagerImpl {
  private jobs: Map<string, Job> = new Map();
  private clusteringService: ClusteringService;
  private glmService: GLMService;
  private priorityScorer: PriorityScorer;
  private storageService: AnalysisStorageService;

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.clusteringService = new ClusteringService();
    this.glmService = new GLMService();
    this.priorityScorer = new PriorityScorer();
    this.storageService = new AnalysisStorageService();
    console.log('[JobManagerImpl] 初始化 JobManager');

    // 启动定期清理任务：每小时清理一次超过24小时的旧任务
    this.startAutoCleanup();
  }

  // 启动自动清理
  private startAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 每小时执行一次清理
    this.cleanupInterval = setInterval(() => {
      const beforeCount = this.jobs.size;
      this.cleanupExpiredJobs(24 * 60 * 60 * 1000); // 24小时
      const afterCount = this.jobs.size;
      if (beforeCount > afterCount) {
        console.log(`[JobManager] 自动清理完成: 删除了 ${beforeCount - afterCount} 个过期任务`);
      }
    }, 60 * 60 * 1000); // 1小时

    console.log('[JobManager] 自动清理任务已启动 (每小时清理一次超过24小时的旧任务)');
  }

  // 停止自动清理
  private stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[JobManager] 自动清理任务已停止');
    }
  }

  // 获取所有任务（用于调试）
  public getJobsMap() {
    return this.jobs;
  }

  // 创建新任务
  public createJob(
    keywords: string[],
    limit: number = 200,
    dataSource: DataSourceType = 'tiktok',
    deepCrawl: boolean = false,
    maxVideos: number = 10,
    tikTokOptions?: TikTokCrawlOptions,
    locale: string = 'zh'
  ): string {
    const jobId = uuidv4();
    console.log('[JobManager] 创建任务:', { jobId, keywords, dataSource, tikTokOptions });

    const job: Job = {
      jobId,
      status: 'processing',
      progress: '正在初始化...',
      progressStage: 'init',
      progressPercent: 5,
      keywords,
      limit,
      dataSource,
      deepCrawl,
      maxVideos,
      tikTokOptions,
      locale,
      startTime: Date.now()
    };

    this.jobs.set(jobId, job);
    console.log('[JobManager] 任务已存储到 Map，当前任务数:', this.jobs.size);

    // 异步执行任务
    this.executeJob(jobId).catch((error) => {
      console.error('[JobManager] 任务执行失败:', error);
      this.updateJobStatus(jobId, 'failed', `任务执行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    });

    return jobId;
  }

  // 获取任务状态
  public getJob(jobId: string): Job | null {
    const job = this.jobs.get(jobId);
    console.log('[JobManager] 查询任务:', { jobId, found: !!job, totalJobs: this.jobs.size });
    if (!job) {
      console.log('[JobManager] 现有任务ID列表:', Array.from(this.jobs.keys()));
    }
    return job || null;
  }

  // 获取所有任务ID（调试用）
  public getAllJobIds(): string[] {
    return Array.from(this.jobs.keys());
  }

  // 获取任务统计（调试用）
  public getJobStats() {
    return {
      totalJobs: this.jobs.size,
      processing: Array.from(this.jobs.values()).filter(j => j.status === 'processing').length,
      completed: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
      failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length
    };
  }

  // 更新任务状态
  private updateJobStatus(
    jobId: string,
    status: Job['status'],
    progress?: string,
    error?: string,
    stage?: Job['progressStage'],
    percent?: number
  ): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      if (progress) job.progress = progress;
      if (error) job.error = error;
      if (stage) job.progressStage = stage;
      if (typeof percent === 'number') job.progressPercent = Math.max(0, Math.min(100, percent));
    }
  }

  // 执行完整的分析任务
  private async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error('[JobManager] executeJob: 任务不存在，无法执行:', jobId);
      return;
    }

    console.log('[JobManager] executeJob: 开始执行任务:', jobId);

    try {
      // 创建数据源服务
      console.log('[JobManager] 创建数据源服务:', job.dataSource);
      const dataSourceService = DataSourceFactory.createDataSource(job.dataSource);
      const sourceName = DataSourceFactory.getSourceDisplayName(job.dataSource);
      console.log('[JobManager] 数据源服务已创建:', sourceName);

      // 步骤1: 检查数据源可用性（如果支持）
      if (dataSourceService.checkAvailability) {
        this.updateJobStatus(jobId, 'processing', `正在验证${sourceName}数据源...`, undefined, 'validating', 10);
        console.log('[JobManager] 检查数据源可用性...');
        const isAvailable = await dataSourceService.checkAvailability();
        console.log('[JobManager] 数据源可用性:', isAvailable);
        if (!isAvailable) {
          throw new Error(`${sourceName}数据源不可用，请检查配置`);
        }
      }

      // 步骤2: 抓取数据
      this.updateJobStatus(jobId, 'processing', '开始抓取数据...', undefined, 'crawling', 20);
      const allRawTexts: string[] = [];
      const allVideos: RawVideoData[] = [];
      const allComments: RawCommentData[] = [];
      // 建立文本索引到原始数据的映射
      const textToSourceMap: Map<string, { type: 'video' | 'comment', data: RawVideoData | RawCommentData }> = new Map();
      let totalVideoCount = 0;
      let totalCommentCount = 0;

      for (let i = 0; i < job.keywords.length; i++) {
        const keyword = job.keywords[i];

        // 根据是否深度抓取选择不同的方法
        if (job.deepCrawl && dataSourceService.searchWithComments) {
          // 深度抓取模式（含评论）
          this.updateJobStatus(jobId, 'processing', `正在深度抓取 "${keyword}" 相关数据（含评论）...`);

          // 为 TikTok 和 TikHub 使用完整配置
          const crawlOptions = (job.dataSource === 'tiktok' || job.dataSource === 'tikhub') && job.tikTokOptions
            ? {
                maxVideos: job.tikTokOptions.maxVideos,
                maxCommentsPerVideo: job.tikTokOptions.maxCommentsPerVideo
              }
            : {
                maxVideos: job.maxVideos || 10,
                maxCommentsPerVideo: 30
              };

          const result = await dataSourceService.searchWithComments(keyword, crawlOptions);

          allRawTexts.push(...result.rawTexts);
          totalVideoCount += result.videoCount || 0;
          totalCommentCount += result.commentCount || 0;

          // 保存原始视频数据
          if (result.videos) {
            for (const video of result.videos) {
              const videoData: RawVideoData = {
                title: video.title || '',
                author: video.author || '',
                video_url: video.video_url || '',
                publish_time: video.publish_time,
                likes: video.likes || '0',
                collected_at: video.collected_at || new Date().toISOString(),
                comment_count: video.comment_count,
                description: video.description
              };
              allVideos.push(videoData);

              // 建立视频标题到数据的映射
              if (videoData.title) {
                textToSourceMap.set(videoData.title, { type: 'video', data: videoData });
              }
            }
          }

          // 保存原始评论数据
          if (result.allComments) {
            for (const comment of result.allComments) {
              const commentData: RawCommentData = {
                video_title: comment.video_title || '',
                comment_text: comment.comment_text || '',
                username: comment.username || '',
                likes: comment.likes || '0'
              };
              allComments.push(commentData);

              // 建立评论文本到数据的映射
              if (commentData.comment_text) {
                textToSourceMap.set(commentData.comment_text, { type: 'comment', data: commentData });
              }
            }
          }
        } else {
          // 标准抓取模式
          this.updateJobStatus(jobId, 'processing', `正在从${sourceName}抓取 "${keyword}" 相关数据...`);

          const result = await dataSourceService.searchAndFetch(
            keyword,
            Math.floor(job.limit / job.keywords.length)
          );

          allRawTexts.push(...result.rawTexts);

          // 保存原始视频数据（标准模式）
          if (result.videos) {
            for (const video of result.videos) {
              const videoData: RawVideoData = {
                title: video.title || '',
                author: video.author || '',
                video_url: video.video_url || '',
                publish_time: video.publish_time,
                likes: video.likes || '0',
                collected_at: video.collected_at || new Date().toISOString(),
                comment_count: video.comment_count,
                description: video.description
              };
              allVideos.push(videoData);

              // 建立视频标题到数据的映射
              if (videoData.title) {
                textToSourceMap.set(videoData.title, { type: 'video', data: videoData });
              }
            }
          }
        }
      }

      // 保存抓取统计
      job.crawlStats = {
        videoCount: totalVideoCount || allVideos.length,
        commentCount: totalCommentCount || allComments.length,
        textCount: allRawTexts.length
      };

      // 保存原始数据
      job.rawData = {
        videos: allVideos,
        comments: allComments,
        rawTexts: allRawTexts
      };

      if (allRawTexts.length === 0) {
        throw new Error('未能获取到任何相关数据');
      }

      // 步骤3: 分离视频和评论进行聚类（避免不同语义层次混淆）
      this.updateJobStatus(jobId, 'processing', '正在进行语义聚类分析...', undefined, 'clustering', 45);

      // 3.1 视频内容聚类
      const videoTexts = allVideos.map(v => v.title).filter(t => t && t.length > 0);
      let videoClusters: string[][] = [];
      let totalNoiseCount = 0;
      if (videoTexts.length > 0) {
        this.updateJobStatus(jobId, 'processing', `正在对 ${videoTexts.length} 条视频内容进行聚类...`, undefined, 'clustering', 50);
        const videoResult = await this.clusteringService.clusterTextsWithEmbeddings(videoTexts);
        videoClusters = videoResult.clusters.map(c => c.texts);
        totalNoiseCount += videoResult.noiseCount;
        console.log(`视频聚类完成: ${videoClusters.length} 个聚类, ${videoResult.noiseCount} 个噪声点`);
      }

      // 3.2 评论内容聚类
      const commentTexts = allComments.map(c => c.comment_text).filter(t => t && t.length > 0);
      let commentClusters: string[][] = [];
      if (commentTexts.length > 0) {
        this.updateJobStatus(jobId, 'processing', `正在对 ${commentTexts.length} 条评论内容进行聚类...`, undefined, 'clustering', 60);
        const commentResult = await this.clusteringService.clusterTextsWithEmbeddings(commentTexts);
        commentClusters = commentResult.clusters.map(c => c.texts);
        totalNoiseCount += commentResult.noiseCount;
        console.log(`评论聚类完成: ${commentClusters.length} 个聚类, ${commentResult.noiseCount} 个噪声点`);
      }

      // 合并聚类结果（视频聚类在前，评论聚类在后）
      const clusters = [...videoClusters, ...commentClusters];

      // 如果没有聚类结果，将所有文本作为单个未分类组
      if (clusters.length === 0) {
        const totalTexts = videoTexts.length + commentTexts.length;
        console.warn(
          `数据量较少(${totalTexts}条)，无法形成有意义的聚类。\n` +
          `当前数据：${videoTexts.length}条视频，${commentTexts.length}条评论。\n` +
          `将所有数据作为单个未分类组返回。`
        );
        
        // 将所有文本合并为一个聚类
        const allTexts = [...videoTexts, ...commentTexts];
        if (allTexts.length > 0) {
          clusters.push(allTexts);
        } else {
          throw new Error('未能获取到任何相关数据');
        }
      }

      console.log(`总聚类数: ${clusters.length} (视频: ${videoClusters.length}, 评论: ${commentClusters.length})`);
      if (clusters.length < 3) {
        console.warn(`⚠️ 聚类数量较少(${clusters.length}个)，可能需要更多数据或调整关键词以获得更丰富的分析结果`);
      }

      // 构建聚类数据分组（用于导出）
      const clusteredDataGroups: ClusteredDataGroup[] = [];
      const videoClusterCount = videoClusters.length;

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const clusterVideos: RawVideoData[] = [];
        const clusterComments: RawCommentData[] = [];

        // 判断当前聚类是视频聚类还是评论聚类
        const isVideoCluster = i < videoClusterCount;

        if (isVideoCluster) {
          // 视频聚类：从textToSourceMap中找对应的视频数据
          for (const text of cluster) {
            const source = textToSourceMap.get(text);
            if (source && source.type === 'video') {
              clusterVideos.push(source.data as RawVideoData);
            }
          }
        } else {
          // 评论聚类：从textToSourceMap中找对应的评论数据
          for (const text of cluster) {
            const source = textToSourceMap.get(text);
            if (source && source.type === 'comment') {
              clusterComments.push(source.data as RawCommentData);
            }
          }
        }

        clusteredDataGroups.push({
          clusterId: i,
          size: cluster.length,
          videos: clusterVideos,
          comments: clusterComments
        });
      }

      // 保存聚类数据
      job.clusteredData = clusteredDataGroups;

      // 步骤4: LLM分析每个聚类
      this.updateJobStatus(jobId, 'processing', '正在调用LLM分析...', undefined, 'analyzing', 70);
      const results: ClusterResult[] = [];

      for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const representativeTexts = this.clusteringService.getRepresentativeTexts(cluster, 8);

        try {
          // 调用GLM分析聚类（传递关键词、数据规模和语言）
          const analysis = await this.glmService.analyzeCluster(
            representativeTexts,
            job.keywords,
            allRawTexts.length,
            job.locale
          );

          // 计算优先级分数
          const priorityScore = this.priorityScorer.scoreCluster({
            clusterSize: cluster.length,
            totalDataSize: allRawTexts.length,
            emotionalIntensity: analysis.pain_depth?.emotional_intensity || 2,
            glmMarketScore: analysis.market_size_score || 2.5,
            existingSolutions: analysis.market_landscape?.existing_solutions || []
          });

          const result: ClusterResult = {
            id: this.clusteringService.generateClusterId(i),
            size: cluster.length,
            analysis: {
              one_line_pain: analysis.one_line_pain || '用户痛点待分析',
              paid_interest: analysis.paid_interest || 'Medium',
              rationale: analysis.rationale || '基于用户评论分析',
              potential_product: analysis.potential_product || '产品概念待构思',

              // 新增深度分析维度
              pain_depth: analysis.pain_depth,
              market_landscape: analysis.market_landscape,
              mvp_plan: analysis.mvp_plan,
              keyword_relevance: analysis.keyword_relevance
            },
            representative_texts: representativeTexts.slice(0, 5),
            priority_score: priorityScore
          };

          results.push(result);

          // 更新进度 (analyzing 阶段: 70% + 25% * (i+1)/clusters.length)
          const analyzePercent = 70 + Math.floor(25 * (i + 1) / clusters.length);
          const progress = `正在分析聚类 ${i + 1}/${clusters.length}...`;
          this.updateJobStatus(jobId, 'processing', progress, undefined, 'analyzing', analyzePercent);

          // 避免API调用过快
          if (i < clusters.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`聚类 ${i} 分析失败:`, error);
          // 创建一个默认结果
          const result: ClusterResult = {
            id: this.clusteringService.generateClusterId(i),
            size: cluster.length,
            analysis: {
              one_line_pain: `基于 ${job.keywords.join(', ')} 的用户需求痛点`,
              paid_interest: 'Medium',
              rationale: '由于LLM分析失败，基于聚类大小和代表性文本推断',
              potential_product: `针对 ${job.keywords.join(', ')} 用户的解决方案`
            },
            representative_texts: representativeTexts.slice(0, 5)
          };
          results.push(result);
        }
      }

      // 按优先级排序（从高到低）
      results.sort((a, b) => {
        const scoreA = a.priority_score?.overall || 0;
        const scoreB = b.priority_score?.overall || 0;
        return scoreB - scoreA;
      });

      // 步骤5: 添加数据质量元信息
      const totalDataSize = allRawTexts.length;
      const clusterCount = results.length;
      const averageClusterSize = clusterCount > 0
        ? Math.round(results.reduce((sum, r) => sum + r.size, 0) / clusterCount)
        : 0;

      let qualityLevel: 'reliable' | 'preliminary' | 'exploratory';
      if (totalDataSize < 50) {
        qualityLevel = 'exploratory';
      } else if (totalDataSize < 200) {
        qualityLevel = 'preliminary';
      } else {
        qualityLevel = 'reliable';
      }

      job.dataQuality = {
        level: qualityLevel,
        totalDataSize,
        clusterCount,
        averageClusterSize
      };

      // 步骤6: 完成任务并保存数据
      job.results = results;
      job.status = 'completed';
      job.progress = '分析完成';
      job.progressStage = 'completed';
      job.progressPercent = 100;

      // 保存分析结果到文件系统
      this.saveAnalysisResults(job, results, allVideos, allComments, allRawTexts, totalDataSize, clusterCount, averageClusterSize, totalNoiseCount);

    } catch (error) {
      this.updateJobStatus(jobId, 'failed', '任务失败', error instanceof Error ? error.message : '未知错误', 'failed');
    }
  }

  // 保存分析结果到文件系统
  private async saveAnalysisResults(
    job: Job,
    results: ClusterResult[],
    allVideos: RawVideoData[],
    allComments: RawCommentData[],
    allRawTexts: string[],
    totalDataSize: number,
    clusterCount: number,
    averageClusterSize: number,
    noiseCount: number
  ): Promise<void> {
    try {
      console.log('[JobManager] 开始保存分析结果...');

      const sourceName = DataSourceFactory.getSourceDisplayName(job.dataSource);

      // 准备视频数据
      const videos: VideoData[] = allVideos.map(v => ({
        title: v.title,
        author: v.author,
        video_url: v.video_url,
        publish_time: v.publish_time,
        likes: v.likes,
        collected_at: v.collected_at,
        comment_count: v.comment_count,
        description: v.description
      }));

      // 准备评论数据
      const comments: CommentData[] = allComments.map(c => ({
        video_title: c.video_title,
        comment_text: c.comment_text,
        username: c.username,
        likes: c.likes
      }));

      // 准备聚类数据
      const clusters: ClusterData[] = results.map(result => ({
        clusterId: parseInt(result.id, 10),
        size: result.size,
        videos: [],
        comments: []
      }));

      // 准备聚类统计
      const clusteringStats: ClusteringStats = {
        totalClusters: clusterCount,
        totalVideos: allVideos.length,
        totalComments: allComments.length,
        noisePoints: noiseCount,
        avgClusterSize: averageClusterSize,
        processingTime: Date.now() - job.startTime
      };

      // 准备分析摘要
      const summary: AnalysisSummary = {
        overview: {
          dataCollection: {
            videosCollected: allVideos.length,
            commentsCollected: allComments.length,
            rawTextsCollected: allRawTexts.length,
            dataSource: sourceName,
            keywords: job.keywords
          },
          clustering: {
            clustersFormed: clusterCount,
            avgClusterSize: averageClusterSize,
            noisePoints: clusteringStats.noisePoints
          }
        },
        qualityAssessment: {
          dataReliability: job.dataQuality?.level || 'preliminary',
          recommendation: this.getQualityRecommendation(job.dataQuality?.level || 'preliminary', allVideos.length, allComments.length)
        },
        topClusters: results.slice(0, 5).map(r => ({
          id: parseInt(r.id, 10),
          size: r.size,
          theme: r.analysis?.one_line_pain || '未命名聚类'
        }))
      };

      // 准备元数据
      const metadata: AnalysisMetadata = {
        jobId: job.jobId,
        keywords: job.keywords,
        dataSource: sourceName,
        createdAt: new Date(job.startTime).toISOString(),
        totalVideos: allVideos.length,
        totalComments: allComments.length,
        totalRawTexts: allRawTexts.length,
        clusterCount,
        locale: job.locale,
        deepCrawl: job.deepCrawl,
        tikTokOptions: job.tikTokOptions
      };

      // 调用保存服务
      const saveResult = await this.storageService.saveAll(
        job.jobId,
        job.keywords,
        {
          videos,
          comments,
          rawTexts: allRawTexts,
          clusters,
          stats: clusteringStats,
          metadata,
          summary
        },
        job.locale
      );

      if (saveResult.success) {
        console.log('[JobManager] ✅ 分析结果已保存到:', saveResult.folderPath);
        console.log('[JobManager] 保存的文件:', saveResult.files.join(', '));
      } else {
        console.error('[JobManager] ❌ 保存分析结果失败:', saveResult.error);
      }
    } catch (error) {
      console.error('[JobManager] 保存分析结果时出错:', error);
    }
  }

  // 获取质量建议
  private getQualityRecommendation(level: string, _videoCount: number, _commentCount: number): string {
    switch (level) {
      case 'reliable':
        return '数据量充足，分析结果可靠。建议基于聚类结果进行深入的产品开发和市场策略制定。';
      case 'preliminary':
        return '数据量中等，结果仅供参考。建议增加数据量或扩大关键词范围以获得更准确的分析。';
      case 'exploratory':
        return '数据量较少，结果为探索性质。建议增加抓取数量或尝试更多相关关键词。';
      default:
        return '请收集更多数据以获得可靠的分析结果。';
    }
  }

  // 清理过期任务（可选）
  public cleanupExpiredJobs(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.startTime > maxAge) {
        this.jobs.delete(jobId);
      }
    }
  }
}

// 获取或创建全局 JobManager 实例（在热重载时保持不变）
// 统一使用 globalThis，避免 Node 端 `global` 与浏览器 `window` 上的差异
declare global {
  var _jobManagerInstance: JobManagerImpl | undefined;
}

function getGlobalJobManager(): JobManagerImpl {
  if (!globalThis._jobManagerInstance) {
    globalThis._jobManagerInstance = new JobManagerImpl();
    console.log('[JobManager] 创建新的全局 JobManager 实例');
  }
  return globalThis._jobManagerInstance;
}

// 导出全局实例（带类型）
export const jobManager: JobManagerImpl = getGlobalJobManager();

// 为了向后兼容，重新导出所有需要的类型
export type { ClusterResult, PriorityScore };