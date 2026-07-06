// Bilibili 数据源服务
// 实现 IDataSourceService 接口，将 Bilibili API 数据转换为系统通用格式

import {
  TikHubAPIClient,
  createTikHubClient
} from './tikhub-client';
import {
  IDataSourceService,
  DataSourceResult,
  DeepCrawlResult,
  DeepCrawlOptions
} from './data-source-interface';

/**
 * Bilibili 服务选项
 */
export interface BilibiliServiceOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  order?: 'totalrank' | 'click' | 'pubdate' | 'dm' | 'stow';
  duration?: 0 | 1 | 2 | 3 | 4;
  enableCache?: boolean;
  requestDelay?: number; // 请求间隔（毫秒）
}

/**
 * Bilibili 数据源服务
 */
export class BilibiliService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: BilibiliServiceOptions;

  constructor(client?: TikHubAPIClient, options?: BilibiliServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxVideos: 20,
      maxCommentsPerVideo: 20,
      order: 'totalrank', // 综合排序
      duration: 0, // 全部时长
      enableCache: true,
      requestDelay: 500
    };

    if (options) {
      Object.assign(this.defaultOptions, options);
    }
  }

  /**
   * 基础搜索（不含评论）
   */
  async searchAndFetch(keyword: string, limit: number): Promise<DataSourceResult> {
    console.log(`[Bilibili Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let page = 1;
    let totalFetched = 0;

    try {
      // 分页搜索，直到获取足够的数据或没有更多结果
      while (totalFetched < limit) {
        console.log(`[Bilibili Service] 搜索第 ${page} 页`);

        const searchResult = await this.client['searchBilibiliVideos']({
          keyword,
          order: this.defaultOptions.order,
          page,
          page_size: Math.min(42, limit - totalFetched),
          duration: this.defaultOptions.duration
        });

        console.log('[Bilibili Service] API 响应 code:', searchResult.code);

        if (searchResult.code !== 200) {
          throw new Error(`Bilibili API 搜索失败: ${searchResult.message}`);
        }

        // Bilibili API 响应格式: { code, data: { code, message, ttl, data: { result: [...] } } }
        const result = searchResult.data?.data?.result;

        if (!result || !Array.isArray(result)) {
          console.warn('[Bilibili Service] 未找到有效的数据数组');
          console.warn('[Bilibili Service] searchResult.data:', JSON.stringify(searchResult.data, null, 2));
          break;
        }

        // 过滤出视频类型的结果
        const videoResults = result.filter((item: any) => item.type === 'video');
        console.log(`[Bilibili Service] 第 ${page} 页获取到 ${videoResults.length} 个视频结果`);

        if (videoResults.length === 0) {
          console.warn('[Bilibili Service] 没有更多视频结果，停止分页');
          break;
        }

        // 处理当前页的结果
        for (const item of videoResults) {
          if (totalFetched >= limit) break;

          const video = this.convertSearchResultToVideo(item, keyword);
          if (video) {
            videos.push(video);

            // 提取文本内容
            if (video.title && video.title.length > 5) {
              rawTexts.push(video.title);
            }
            if (video.description && video.description.length > 10 && video.description !== video.title) {
              rawTexts.push(video.description);
            }
            totalFetched++;
          }
        }

        console.log(`[Bilibili Service] 当前页处理结果: 累计视频 ${videos.length}, 累计文本 ${rawTexts.length}`);

        // 如果当前页的结果少于请求的数量，说明没有更多结果了
        if (videoResults.length < 42) {
          break;
        }

        page++;

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 去重
      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[Bilibili Service] 搜索完成: 获取 ${videos.length} 个视频, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'bilibili',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client['getUsageStats']()
        }
      };
    } catch (error) {
      console.error('[Bilibili Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[Bilibili Service] 开始深度搜索: ${keyword}`);

    // 合并选项
    const maxVideos = options.maxVideos || this.defaultOptions.maxVideos!;
    const maxCommentsPerVideo = options.maxCommentsPerVideo || this.defaultOptions.maxCommentsPerVideo!;

    // 先搜索视频
    const { videos: videoList } = await this.searchAndFetch(keyword, maxVideos);

    if (videoList.length === 0) {
      return {
        rawTexts: [],
        videos: [],
        allComments: [],
        videoCount: 0,
        commentCount: 0
      };
    }

    console.log(`[Bilibili Service] 开始获取 ${videoList.length} 个视频的评论`);

    // 获取评论
    const allComments: any[] = [];
    const rawTexts: string[] = [];
    const commentTexts: string[] = [];

    // 从视频结果中提取文本
    for (const video of videoList) {
      if (video.title && video.title.length > 5) {
        rawTexts.push(video.title);
      }
      if (video.description && video.description.length > 10) {
        rawTexts.push(video.description);
      }
    }

    // 批量获取评论
    const avIds = videoList
      .map(v => v.aid)
      .filter((id): id is string => !!id);

    const commentsMap = await this.client['getBilibiliVideoCommentsBatch'](avIds, maxCommentsPerVideo);

    // 处理评论数据
    for (const video of videoList) {
      if (!video.aid) continue;

      const comments = commentsMap.get(video.aid) || [];
      const limitedComments = comments.slice(0, maxCommentsPerVideo);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, video.title);
        allComments.push(mappedComment);

        const message = comment.content?.message;
        if (message && message.length > 5) {
          commentTexts.push(message);
        }
      }

      // 添加请求延迟
      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    // 合并所有文本并去重
    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[Bilibili Service] 深度搜索完成: ${videoList.length} 个视频, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

    return {
      rawTexts: allTexts,
      videos: videoList,
      allComments,
      videoCount: videoList.length,
      commentCount: allComments.length
    };
  }

  /**
   * 检查服务可用性
   */
  async checkAvailability(): Promise<boolean> {
    // 对于 Bilibili，我们总是返回 true，让实际请求时再处理错误
    return true;
  }

  /**
   * 获取使用统计
   */
  getUsageStats() {
    return this.client['getUsageStats']();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.client['clearCache']();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.client['getCacheStats']();
  }

  /**
   * 将 Bilibili 搜索结果转换为视频数据格式
   */
  private convertSearchResultToVideo(item: any, sourceKeyword: string): any {
    // Bilibili API 数据结构检查
    if (item.type !== 'video') {
      console.warn('[Bilibili Service] convertSearchResultToVideo: item 不是视频类型', {
        type: item.type
      });
      return null;
    }

    // 转换时间戳
    const pubDate = item.pubdate
      ? new Date(item.pubdate * 1000).toISOString()
      : new Date().toISOString();

    // 移除标题中的 HTML 标签
    const cleanTitle = item.title?.replace(/<[^>]*>/g, '') || '';

    return {
      title: cleanTitle,
      description: item.description || cleanTitle,
      author: item.author || '',
      video_url: item.arcurl || '',
      publish_time: pubDate,
      likes: item.like?.toString() || '0',
      collected_at: new Date().toISOString(),
      comment_count: item.video_review || 0,
      // 扩展字段
      bvid: item.bvid,
      aid: item.id,
      mid: item.mid,
      // 统计数据
      play: item.play?.toString() || '0',
      favorites: item.favorites?.toString() || '0',
      danmaku: item.danmaku?.toString() || '0',
      // 封面图
      pic: item.pic ? `https:${item.pic}` : '',
      // 类型信息
      typename: item.typename || '',
      // 时长
      duration: item.duration || '',
      // 来源
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 Bilibili 评论转换为数据格式
   */
  private convertCommentToData(comment: any, videoTitle: string): any {
    // 转换时间戳
    const createTime = comment.ctime
      ? new Date(comment.ctime * 1000).toISOString()
      : new Date().toISOString();

    const message = comment.content?.message || '';

    return {
      video_title: videoTitle,
      comment_text: message,
      username: comment.member?.uname || '',
      likes: comment.like?.toString() || '0',
      // 扩展字段
      rpid: comment.rpid,
      mid: comment.mid,
      create_time: createTime,
      user_avatar: comment.member?.avatar || '',
      like_count: comment.like || 0,
      reply_count: comment.rcount || 0
    };
  }
}

/**
 * Bilibili 服务适配器（用于工厂模式）
 */
export class BilibiliServiceAdapter implements IDataSourceService {
  private service: BilibiliService;

  constructor(options?: BilibiliServiceOptions) {
    this.service = new BilibiliService(undefined, options);
  }

  async searchAndFetch(keyword: string, limit: number): Promise<DataSourceResult> {
    return await this.service.searchAndFetch(keyword, limit);
  }

  async searchWithComments(keyword: string, options?: DeepCrawlOptions): Promise<DeepCrawlResult> {
    return await this.service.searchWithComments(keyword, options || {});
  }

  async checkAvailability(): Promise<boolean> {
    return await this.service.checkAvailability();
  }

  /**
   * 获取使用统计（Bilibili 特有方法）
   */
  getUsageStats() {
    return this.service.getUsageStats();
  }

  /**
   * 清除缓存（Bilibili 特有方法）
   */
  clearCache(): void {
    this.service.clearCache();
  }

  /**
   * 获取缓存统计（Bilibili 特有方法）
   */
  getCacheStats() {
    return this.service.getCacheStats();
  }
}
