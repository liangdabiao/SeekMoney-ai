import fs from 'fs';
import path from 'path';

export interface VideoData {
  title: string;
  author: string;
  video_url: string;
  publish_time?: string;
  likes: string;
  collected_at: string;
  comment_count?: number;
  description?: string;
  aweme_id?: string;
  collected_count?: string;
  share_count?: string;
  play_count?: string;
  author_uid?: string;
  author_avatar?: string;
}

export interface CommentData {
  video_title: string;
  comment_text: string;
  username: string;
  likes: string;
  cid?: string;
  create_time?: number;
  ip_label?: string;
}

export interface ClusterData {
  clusterId: number;
  size: number;
  centroid?: number[];
  keywords?: string[];
  videos: VideoData[];
  comments: CommentData[];
}

export interface ClusteringStats {
  totalClusters: number;
  totalVideos: number;
  totalComments: number;
  noisePoints: number;
  avgClusterSize: number;
  processingTime: number;
  provider?: string;
  model?: string;
  cost?: number;
}

export interface AnalysisMetadata {
  jobId: string;
  keywords: string[];
  dataSource: string;
  createdAt: string;
  totalVideos: number;
  totalComments: number;
  totalRawTexts: number;
  clusterCount: number;
  locale: string;
  deepCrawl: boolean;
  tikTokOptions?: {
    enableComments: boolean;
    maxVideos: number;
    maxCommentsPerVideo: number;
    enableSubComments: boolean;
  };
}

export interface AnalysisSummary {
  overview: {
    dataCollection: {
      videosCollected: number;
      commentsCollected: number;
      rawTextsCollected: number;
      dataSource: string;
      keywords: string[];
    };
    clustering: {
      clustersFormed: number;
      avgClusterSize: number;
      noisePoints: number;
    };
  };
  qualityAssessment: {
    dataReliability: 'reliable' | 'preliminary' | 'exploratory';
    recommendation: string;
  };
  topClusters?: {
    id: number;
    size: number;
    theme: string;
  }[];
}

interface SaveResult {
  success: boolean;
  folderPath: string;
  files: string[];
  error?: string;
}

export class AnalysisStorageService {
  private baseFolder: string;

  constructor(baseFolder?: string) {
    // 优先级: 构造参数 > SEAGULL_STORAGE_DIR 环境变量 > 默认 ./analysis-results
    // 设为空字符串可禁用持久化（适合 serverless 环境）
    const envDir = process.env.SEAGULL_STORAGE_DIR;
    if (baseFolder !== undefined) {
      this.baseFolder = baseFolder;
    } else if (envDir && envDir.trim().length > 0) {
      this.baseFolder = path.isAbsolute(envDir) ? envDir : path.join(process.cwd(), envDir);
    } else {
      this.baseFolder = path.join(process.cwd(), 'analysis-results');
    }
    this.ensureBaseFolder();
  }

  private ensureBaseFolder(): void {
    if (!fs.existsSync(this.baseFolder)) {
      fs.mkdirSync(this.baseFolder, { recursive: true });
      console.log(`[AnalysisStorage] 创建基础文件夹: ${this.baseFolder}`);
    }
  }

  private sanitizeFolderName(name: string): string {
    return name
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  }

  createAnalysisFolder(jobId: string, keyword: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const sanitizedKeyword = this.sanitizeFolderName(keyword);
    const folderName = `${timestamp}_${sanitizedKeyword}_${jobId.slice(0, 8)}`;
    const folderPath = path.join(this.baseFolder, folderName);

    const subfolders = ['raw-data', 'clustering', 'analysis'];
    for (const subfolder of subfolders) {
      const subfolderPath = path.join(folderPath, subfolder);
      if (!fs.existsSync(subfolderPath)) {
        fs.mkdirSync(subfolderPath, { recursive: true });
      }
    }

    console.log(`[AnalysisStorage] 创建分析文件夹: ${folderPath}`);
    return folderPath;
  }

  async saveVideos(folderPath: string, videos: VideoData[], keywords: string[]): Promise<SaveResult> {
    try {
      const data = {
        keywords,
        exportedAt: new Date().toISOString(),
        totalCount: videos.length,
        videos
      };

      const filePath = path.join(folderPath, 'raw-data', 'videos.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['raw-data/videos.json']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveComments(folderPath: string, comments: CommentData[], keywords: string[]): Promise<SaveResult> {
    try {
      const data = {
        keywords,
        exportedAt: new Date().toISOString(),
        totalCount: comments.length,
        comments
      };

      const filePath = path.join(folderPath, 'raw-data', 'comments.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['raw-data/comments.json']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveRawTexts(folderPath: string, rawTexts: string[], keywords: string[]): Promise<SaveResult> {
    try {
      const data = {
        keywords,
        exportedAt: new Date().toISOString(),
        totalCount: rawTexts.length,
        rawTexts: [...new Set(rawTexts)]
      };

      const filePath = path.join(folderPath, 'raw-data', 'raw-texts.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['raw-data/raw-texts.json']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveClusters(folderPath: string, clusters: ClusterData[], stats: ClusteringStats): Promise<SaveResult> {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        stats,
        clusters
      };

      const filePath = path.join(folderPath, 'clustering', 'clusters.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      const statsData = {
        exportedAt: new Date().toISOString(),
        ...stats
      };

      const statsPath = path.join(folderPath, 'clustering', 'clustering-stats.json');
      fs.writeFileSync(statsPath, JSON.stringify(statsData, null, 2), 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['clustering/clusters.json', 'clustering/clustering-stats.json']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveSummary(folderPath: string, summary: AnalysisSummary, _locale: string = 'zh'): Promise<SaveResult> {
    try {
      const filePath = path.join(folderPath, 'analysis', 'summary.json');
      fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8');

      let reportContent = `# 分析报告\n\n`;
      reportContent += `生成时间: ${new Date().toISOString()}\n\n`;

      reportContent += `## 数据概览\n\n`;
      reportContent += `- 关键词: ${summary.overview.dataCollection.keywords.join(', ')}\n`;
      reportContent += `- 数据来源: ${summary.overview.dataCollection.dataSource}\n`;
      reportContent += `- 收集视频: ${summary.overview.dataCollection.videosCollected} 个\n`;
      reportContent += `- 收集评论: ${summary.overview.dataCollection.commentsCollected} 条\n`;
      reportContent += `- 原始文本: ${summary.overview.dataCollection.rawTextsCollected} 条\n\n`;

      reportContent += `## 聚类分析\n\n`;
      reportContent += `- 形成聚类: ${summary.overview.clustering.clustersFormed} 个\n`;
      reportContent += `- 平均聚类大小: ${summary.overview.clustering.avgClusterSize.toFixed(2)}\n`;
      reportContent += `- 噪声点: ${summary.overview.clustering.noisePoints} 个\n\n`;

      reportContent += `## 数据质量评估\n\n`;
      reportContent += `- 可靠性等级: ${summary.qualityAssessment.dataReliability}\n`;
      reportContent += `- 建议: ${summary.qualityAssessment.recommendation}\n\n`;

      if (summary.topClusters && summary.topClusters.length > 0) {
        reportContent += `## 主要聚类\n\n`;
        for (const cluster of summary.topClusters) {
          reportContent += `- 聚类 #${cluster.id}: ${cluster.size} 条，主题: ${cluster.theme}\n`;
        }
      }

      const reportPath = path.join(folderPath, 'analysis', 'report.md');
      fs.writeFileSync(reportPath, reportContent, 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['analysis/summary.json', 'analysis/report.md']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveMetadata(folderPath: string, metadata: AnalysisMetadata): Promise<SaveResult> {
    try {
      const filePath = path.join(folderPath, 'metadata.json');
      fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');

      return {
        success: true,
        folderPath,
        files: ['metadata.json']
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: [],
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  async saveAll(
    jobId: string,
    keywords: string[],
    data: {
      videos: VideoData[];
      comments: CommentData[];
      rawTexts: string[];
      clusters: ClusterData[];
      stats: ClusteringStats;
      metadata: AnalysisMetadata;
      summary: AnalysisSummary;
    },
    locale: string = 'zh'
  ): Promise<SaveResult> {
    console.log(`[AnalysisStorage] 开始保存分析结果: ${jobId}`);
    console.log(`[AnalysisStorage] 关键词: ${keywords.join(', ')}`);
    console.log(`[AnalysisStorage] 视频数: ${data.videos.length}, 评论数: ${data.comments.length}`);

    const folderPath = this.createAnalysisFolder(jobId, keywords[0]);
    const allFiles: string[] = [];

    try {
      const videosResult = await this.saveVideos(folderPath, data.videos, keywords);
      if (videosResult.success) {
        allFiles.push(...videosResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存视频失败: ${videosResult.error}`);
      }

      const commentsResult = await this.saveComments(folderPath, data.comments, keywords);
      if (commentsResult.success) {
        allFiles.push(...commentsResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存评论失败: ${commentsResult.error}`);
      }

      const textsResult = await this.saveRawTexts(folderPath, data.rawTexts, keywords);
      if (textsResult.success) {
        allFiles.push(...textsResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存原文失败: ${textsResult.error}`);
      }

      const clustersResult = await this.saveClusters(folderPath, data.clusters, data.stats);
      if (clustersResult.success) {
        allFiles.push(...clustersResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存聚类失败: ${clustersResult.error}`);
      }

      const summaryResult = await this.saveSummary(folderPath, data.summary, locale);
      if (summaryResult.success) {
        allFiles.push(...summaryResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存摘要失败: ${summaryResult.error}`);
      }

      const metadataResult = await this.saveMetadata(folderPath, data.metadata);
      if (metadataResult.success) {
        allFiles.push(...metadataResult.files);
      } else {
        console.error(`[AnalysisStorage] 保存元信息失败: ${metadataResult.error}`);
      }

      console.log(`[AnalysisStorage] 保存完成! 文件: ${allFiles.join(', ')}`);
      console.log(`[AnalysisStorage] 文件夹: ${folderPath}`);

      return {
        success: true,
        folderPath,
        files: allFiles
      };
    } catch (error) {
      return {
        success: false,
        folderPath,
        files: allFiles,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  getBaseFolder(): string {
    return this.baseFolder;
  }

  listAnalysisFolders(): string[] {
    if (!fs.existsSync(this.baseFolder)) {
      return [];
    }

    return fs.readdirSync(this.baseFolder)
      .filter(name => fs.statSync(path.join(this.baseFolder, name)).isDirectory())
      .sort()
      .reverse();
  }

  getAnalysisInfo(folderName: string): { createdAt: string; keywords: string[]; jobId: string } | null {
    const folderPath = path.join(this.baseFolder, folderName);
    const metadataPath = path.join(folderPath, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as AnalysisMetadata;
      return {
        createdAt: metadata.createdAt,
        keywords: metadata.keywords,
        jobId: metadata.jobId
      };
    } catch {
      return null;
    }
  }
}

let storageService: AnalysisStorageService | null = null;

export function getAnalysisStorageService(): AnalysisStorageService {
  if (!storageService) {
    storageService = new AnalysisStorageService();
  }
  return storageService;
}

export function createAnalysisStorageService(baseFolder?: string): AnalysisStorageService {
  return new AnalysisStorageService(baseFolder);
}
