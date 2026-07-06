// TikTok 数据源服务
// 实现 IDataSourceService 接口，将 TikTok API 数据转换为系统通用格式

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
 * TikTok 服务选项
 */
export interface TikTokServiceOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  enableCache?: boolean;
  requestDelay?: number; // 请求间隔（毫秒）
}

/**
 * TikTok 数据源服务
 */
export class TikTokService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: TikTokServiceOptions;

  constructor(client?: TikHubAPIClient, options?: TikTokServiceOptions) {
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
    console.log(`[TikTok Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let hasMore = true;
    let totalFetched = 0;

    try {
      // 分页搜索，直到获取足够的数据或没有更多结果
      while (hasMore && totalFetched < limit) {
        const pageNumber = Math.floor(totalFetched / 20) + 1;
        console.log(`[TikTok Service] 搜索第 ${pageNumber} 页`);

        const searchResult = await this.client['searchTiktokVideos']({
          keyword,
          offset: totalFetched,
          search_id: ''
        });

        console.log('[TikTok Service] API 响应 code:', searchResult.code);
        console.log('[TikTok Service] API 完整响应结构:', JSON.stringify({
          hasData: !!searchResult.data,
          hasDataData: !!searchResult.data?.data,
          dataDataType: typeof searchResult.data?.data,
          dataDataIsArray: Array.isArray(searchResult.data?.data),
          hasDataDataData: !!searchResult.data?.data?.data,
          dataDataDataType: typeof searchResult.data?.data?.data,
          dataDataDataIsArray: Array.isArray(searchResult.data?.data?.data),
          hasMore: searchResult.data?.has_more,
          cursor: searchResult.data?.cursor,
          searchId: searchResult.data?.search_id
        }, null, 2));

        if (searchResult.code !== 200) {
          throw new Error(`TikTok API 搜索失败: ${searchResult.message}`);
        }

        // TikTok API 响应格式: { code, data: { status_code, data: [ { type: 1, item: {...} } ] } }
        // 支持多种可能的数据结构
        let items: any[] = [];

        // 尝试多种可能的数据结构
        if (searchResult.data?.data?.data && Array.isArray(searchResult.data.data.data)) {
          console.log('[TikTok Service] 使用三层嵌套数据结构: data.data.data');
          items = searchResult.data.data.data;
        } else if (searchResult.data?.data && Array.isArray(searchResult.data.data)) {
          console.log('[TikTok Service] 使用两层嵌套数据结构: data.data');
          items = searchResult.data.data;
        } else if (Array.isArray(searchResult.data?.data)) {
          console.log('[TikTok Service] 使用备用数据结构: data (as array)');
          items = searchResult.data.data;
        } else {
          console.warn('[TikTok Service] 未找到有效的数据数组');
          console.warn('[TikTok Service] searchResult.data:', JSON.stringify(searchResult.data, null, 2));
          hasMore = false;
        }

        if (items.length > 0) {
          // 更新分页信息
          // TikTok API 通常不直接返回 has_more，需要通过数据量判断
          hasMore = items.length >= 20; // 如果返回20条，可能还有更多
          console.log('[TikTok Service] 更新 has_more:', hasMore, '(基于数据量判断)');
        } else {
          console.warn('[TikTok Service] 数据数组为空，停止分页');
          hasMore = false;
        }

        console.log(`[TikTok Service] 第 ${Math.floor(totalFetched / 20) + 1} 页获取到 ${items.length} 个结果, has_more: ${hasMore}`);

        // 处理当前页的结果
        const remainingLimit = limit - totalFetched;
        const pageItems = items.slice(0, remainingLimit);

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
          }
        }

        console.log(`[TikTok Service] 当前页处理结果: 总数 ${pageItems.length}, 有效视频 ${videos.length - (totalFetched - pageItems.length)}, 累计视频 ${videos.length}`);

        totalFetched += pageItems.length;

        // 如果当前页的结果少于请求的数量，说明没有更多结果了
        if (items.length < 20) {
          hasMore = false;
        }

        // 避免请求过快
        if (hasMore && totalFetched < limit) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 去重
      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[TikTok Service] 搜索完成: 获取 ${videos.length} 个视频, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'tiktok',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client['getUsageStats']()
        }
      };
    } catch (error) {
      console.error('[TikTok Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[TikTok Service] 开始深度搜索: ${keyword}`);

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

    console.log(`[TikTok Service] 开始获取 ${videoList.length} 个视频的评论`);

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
    const awemeIds = videoList
      .map(v => v.aweme_id)
      .filter((id): id is string => !!id);

    const commentsMap = await this.client['getTikTokVideoCommentsBatch'](awemeIds, maxCommentsPerVideo);

    // 处理评论数据
    for (const video of videoList) {
      if (!video.aweme_id) continue;

      const comments = commentsMap.get(video.aweme_id) || [];
      const limitedComments = comments.slice(0, maxCommentsPerVideo);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, video.title);
        allComments.push(mappedComment);

        if (comment.text && comment.text.length > 5) {
          commentTexts.push(comment.text);
        }
      }

      // 添加请求延迟
      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    // 合并所有文本并去重
    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[TikTok Service] 深度搜索完成: ${videoList.length} 个视频, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

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
    // 对于 TikTok，我们总是返回 true，让实际请求时再处理错误
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
   * 将 TikTok 搜索结果转换为视频数据格式
   */
  private convertSearchResultToVideo(item: any, _sourceKeyword: string): any {
    // TikTok 数据结构: { type: 1, item: { id, desc, createTime, author, video, ... } }
    const tiktokItem = item.item;
    
    // 添加调试日志
    if (!tiktokItem) {
      console.warn('[TikTok Service] convertSearchResultToVideo: item 缺少 item 字段', {
        itemType: item.type,
        hasItem: !!item.item,
        itemKeys: Object.keys(item)
      });
      return null;
    }

    // 转换时间戳
    const createTime = tiktokItem.createTime
      ? new Date(tiktokItem.createTime * 1000).toISOString()
      : new Date().toISOString();

    // 提取标题（优先使用 desc）
    const title = tiktokItem.desc || '';

    return {
      title: title,
      description: tiktokItem.desc,
      author: tiktokItem.author?.nickname || '',
      video_url: tiktokItem.share_url || '',
      publish_time: createTime,
      likes: tiktokItem.stats?.digg_count?.toString() || '0',
      collected_at: new Date().toISOString(),
      comment_count: tiktokItem.stats?.comment_count || 0,
      // 扩展字段
      aweme_id: tiktokItem.id,
      collected_count: tiktokItem.stats?.collect_count?.toString() || '0',
      share_count: tiktokItem.stats?.share_count?.toString() || '0',
      play_count: tiktokItem.stats?.play_count?.toString() || '0'
    };
  }

  /**
   * 将 TikTok 评论转换为数据格式
   */
  private convertCommentToData(comment: any, videoTitle: string): any {
    // 转换时间戳
    const createTime = comment.create_time
      ? new Date(comment.create_time * 1000).toISOString()
      : new Date().toISOString();

    return {
      video_title: videoTitle,
      comment_text: comment.text || '',
      username: comment.author?.nickname || '',
      likes: comment.digg_count?.toString() || '0',
      // 扩展字段
      comment_id: comment.cid,
      aweme_id: comment.aweme_id,
      create_time: createTime,
      user_avatar: comment.author?.avatar_thumb || ''
    };
  }
}

/**
 * TikTok 服务适配器（用于工厂模式）
 */
export class TikTokServiceAdapter implements IDataSourceService {
  private service: TikTokService;

  constructor(options?: TikTokServiceOptions) {
    this.service = new TikTokService(undefined, options);
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
   * 获取使用统计（TikTok 特有方法）
   */
  getUsageStats() {
    return this.service.getUsageStats();
  }

  /**
   * 清除缓存（TikTok 特有方法）
   */
  clearCache(): void {
    this.service.clearCache();
  }

  /**
   * 获取缓存统计（TikTok 特有方法）
   */
  getCacheStats() {
    return this.service.getCacheStats();
  }
}
