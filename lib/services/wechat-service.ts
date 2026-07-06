// WeChat Channels 数据源服务
// 实现 IDataSourceService 接口，将 WeChat Channels API 数据转换为系统通用格式

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
 * WeChat Channels 服务选项
 */
export interface WeChatServiceOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  enableCache?: boolean;
  requestDelay?: number; // 请求间隔（毫秒）
}

/**
 * WeChat Channels 数据源服务
 */
export class WeChatService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: WeChatServiceOptions;

  constructor(client?: TikHubAPIClient, options?: WeChatServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxVideos: 20,
      maxCommentsPerVideo: 20,
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
    console.log(`[WeChat Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let sessionBuffer = '';
    let totalFetched = 0;

    try {
      // 分页搜索，直到获取足够的数据或没有更多结果
      while (totalFetched < limit) {
        console.log(`[WeChat Service] 搜索第 ${Math.floor(totalFetched / 20) + 1} 页`);

        const searchResult = await this.client['searchWeChatVideos']({
          keywords: keyword,
          sessionBuffer
        });

        console.log('[WeChat Service] API 响应 code:', searchResult.code);

        if (searchResult.code !== 200) {
          throw new Error(`WeChat Channels API 搜索失败: ${searchResult.message}`);
        }

        // WeChat API 响应格式: { code, data: { results: { data: [{ subBoxes: [{ items: [...] }] }] } } }
        const results = searchResult.data?.results;
        const dataArray = results?.data || [];

        if (!Array.isArray(dataArray)) {
          console.warn('[WeChat Service] 未找到有效的数据数组');
          break;
        }

        const mediaList: any[] = [];
        for (const box of dataArray) {
          const subBoxes = box?.subBoxes || [];
          for (const subBox of subBoxes) {
            const items = subBox?.items || [];
            mediaList.push(...items);
          }
        }

        console.log(`[WeChat Service] 第 ${Math.floor(totalFetched / 20) + 1} 页获取到 ${mediaList.length} 个结果`);

        if (mediaList.length === 0) {
          console.warn('[WeChat Service] 没有更多结果，停止分页');
          break;
        }

        // 处理当前页的结果
        const remainingLimit = limit - totalFetched;
        const pageItems = mediaList.slice(0, remainingLimit);

        for (const item of pageItems) {
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

        console.log(`[WeChat Service] 当前页处理结果: 累计视频 ${videos.length}, 累计文本 ${rawTexts.length}`);

        // 如果当前页的结果少于请求数量，说明没有更多结果了
        if (mediaList.length < 20) {
          break;
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 去重
      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[WeChat Service] 搜索完成: 获取 ${videos.length} 个视频, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'wechat',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client['getUsageStats']()
        }
      };
    } catch (error) {
      console.error('[WeChat Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[WeChat Service] 开始深度搜索: ${keyword}`);

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

    console.log(`[WeChat Service] 开始获取 ${videoList.length} 个视频的评论`);

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
    const videoIds = videoList
      .map(v => v.id)
      .filter((id): id is string => !!id);

    const commentsMap = await this.client['getWeChatVideoCommentsBatch'](videoIds, maxCommentsPerVideo);

    // 处理评论数据
    for (const video of videoList) {
      if (!video.id) continue;

      const comments = commentsMap.get(video.id) || [];
      const limitedComments = comments.slice(0, maxCommentsPerVideo);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, video.title);
        allComments.push(mappedComment);

        if (comment.content && comment.content.length > 5) {
          commentTexts.push(comment.content);
        }
      }

      // 添加请求延迟
      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    // 合并所有文本并去重
    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[WeChat Service] 深度搜索完成: ${videoList.length} 个视频, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

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
    // 对于 WeChat，我们总是返回 true，让实际请求时再处理错误
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
   * 将 WeChat Channels 搜索结果转换为视频数据格式
   */
  private convertSearchResultToVideo(item: any, sourceKeyword: string): any {
    if (!item.docID) {
      console.warn('[WeChat Service] convertSearchResultToVideo: item 缺少 docID 字段');
      return null;
    }

    const description = item.desc || '';

    const videoUrl = '';

    const createTime = item.pubTime
      ? new Date(item.pubTime * 1000).toISOString()
      : new Date().toISOString();

    const cleanTitle = item.title || '';

    return {
      title: cleanTitle,
      description: description,
      author: item.nickName || '',
      video_url: videoUrl,
      publish_time: createTime,
      likes: item.likeNum || '0',
      collected_at: new Date().toISOString(),
      comment_count: 0,
      // 扩展字段
      id: item.docID,
      hash_id: item.hashDocID || '',
      username: item.username || '',
      // 媒体信息
      duration: item.duration || '',
      width: item.width || 0,
      height: item.height || 0,
      thumb_url: item.image || '',
      // 来源
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 WeChat 评论转换为数据格式
   */
  private convertCommentToData(comment: any, videoTitle: string): any {
    // 转换时间戳
    const createTime = comment.createtime
      ? new Date(comment.createtime * 1000).toISOString()
      : new Date().toISOString();

    const content = comment.content || '';

    return {
      video_title: videoTitle,
      comment_text: content,
      username: comment.nickname || '',
      likes: comment.like_count?.toString() || '0',
      // 扩展字段
      comment_id: comment.comment_id,
      username_raw: comment.username || '',
      head_url: comment.head_url || '',
      like_count: comment.like_count || 0,
      create_time: createTime,
      ip_region: comment.ip_region_info?.region_text || ''
    };
  }
}

/**
 * WeChat Channels 服务适配器（用于工厂模式）
 */
export class WeChatServiceAdapter implements IDataSourceService {
  private service: WeChatService;

  constructor(options?: WeChatServiceOptions) {
    this.service = new WeChatService(undefined, options);
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
   * 获取使用统计（WeChat 特有方法）
   */
  getUsageStats() {
    return this.service.getUsageStats();
  }

  /**
   * 清除缓存（WeChat 特有方法）
   */
  clearCache(): void {
    this.service.clearCache();
  }

  /**
   * 获取缓存统计（WeChat 特有方法）
   */
  getCacheStats() {
    return this.service.getCacheStats();
  }
}
