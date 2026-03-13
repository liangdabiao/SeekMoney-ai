// 通用数据源接口定义

export type DataSourceType = 'tikhub' | 'tiktok' | 'bilibili' | 'wechat' | 'youtube' | 'xiaohongshu' | 'twitter' | 'reddit';

export interface DataSourceResult {
  rawTexts: string[];
  videos?: any[];
  metadata?: any;
}

export interface DeepCrawlResult {
  rawTexts: string[];
  videos?: any[];
  allComments?: any[];
  videoCount?: number;
  commentCount?: number;
}

export interface DeepCrawlOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
}

// TikHub/TikTok 爬虫配置选项
export interface TikTokCrawlOptions {
  enableComments: boolean;        // 是否爬取评论
  maxVideos: number;              // 视频数量 (TikTok: 5-50, TikHub: 5-30)
  maxCommentsPerVideo: number;    // 每视频评论数 (10-100)
  enableSubComments: boolean;     // 是否爬取二级评论（仅部分平台支持）
}

export interface IDataSourceService {
  /**
   * 搜索并获取数据
   * @param keywords 关键词
   * @param limit 限制数量
   * @returns 包含原始文本的结果
   */
  searchAndFetch(keywords: string, limit: number): Promise<DataSourceResult>;

  /**
   * 深度抓取（含评论）
   * @param keywords 关键词
   * @param options 深度抓取选项
   * @returns 包含视频和评论的完整结果
   */
  searchWithComments?(keywords: string, options?: DeepCrawlOptions): Promise<DeepCrawlResult>;

  /**
   * 检查数据源是否可用（可选）
   */
  checkAvailability?(): Promise<boolean>;
}

