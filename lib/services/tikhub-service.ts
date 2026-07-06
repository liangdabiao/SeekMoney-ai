// TikHub 数据源服务
// 实现 IDataSourceService 接口，将 TikHub API 数据转换为系统通用格式

import {
  TikHubAPIClient,
  SearchResultItem,
  CommentItem,
  createTikHubClient
} from './tikhub-client';
import {
  IDataSourceService,
  DataSourceResult,
  DeepCrawlResult,
  DeepCrawlOptions
} from './data-source-interface';

/**
 * TikHub 服务选项
 */
export interface TikHubServiceOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  sortType?: '0' | '1' | '2';
  publishTime?: '0' | '1' | '7' | '180';
  enableCache?: boolean;
  requestDelay?: number; // 请求间隔（毫秒）
}

/**
 * TikHub 数据源服务
 */
export class TikHubService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: TikHubServiceOptions;

  constructor(client?: TikHubAPIClient, options?: TikHubServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxVideos: 20,
      maxCommentsPerVideo: 20,
      sortType: '0', // 综合排序（与 request.log 一致）
      publishTime: '0', // 不限时间（与 request.log 一致）
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
    console.log(`[TikHub Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let cursor = 0;
    let searchId = '';
    let hasMore = true;
    let totalFetched = 0;

    try {
      // 分页搜索，直到获取足够的数据或没有更多结果
      while (hasMore && totalFetched < limit) {
        console.log(`[TikHub Service] 搜索第 ${Math.floor(totalFetched / 20) + 1} 页, cursor: ${cursor}`);

        const searchResult = await this.client['searchVideos']({
          keyword,
          cursor,
          sort_type: this.defaultOptions.sortType,
          publish_time: this.defaultOptions.publishTime,
          search_id: searchId
        });

        console.log('[TikHub Service] API 响应 code:', searchResult.code);
        console.log('[TikHub Service] API 完整响应结构:', JSON.stringify({
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
          throw new Error(`TikHub API 搜索失败: ${searchResult.message}`);
        }

        // TikHub API 响应格式: { code, data: { status_code, data: [items], cursor, has_more, search_id } }
        // 支持多种可能的数据结构
        let items: any[] = [];

        // 尝试多种可能的数据结构
        if (searchResult.data?.data?.data && Array.isArray(searchResult.data.data.data)) {
          console.log('[TikHub Service] 使用三层嵌套数据结构: data.data.data');
          items = searchResult.data.data.data;
        } else if (searchResult.data?.data && Array.isArray(searchResult.data.data)) {
          console.log('[TikHub Service] 使用两层嵌套数据结构: data.data');
          items = searchResult.data.data;
        } else if (Array.isArray(searchResult.data?.data)) {
          console.log('[TikHub Service] 使用备用数据结构: data (as array)');
          items = searchResult.data.data;
        } else {
          console.warn('[TikHub Service] 未找到有效的数据数组');
          console.warn('[TikHub Service] searchResult.data:', JSON.stringify(searchResult.data, null, 2));
          hasMore = false;
        }

        if (items.length > 0) {
          // 更新分页信息 - has_more 和 cursor 在 data 的根级别
          if (searchResult.data.data?.has_more !== undefined) {
            hasMore = searchResult.data.data.has_more === 1 || searchResult.data.data.has_more === true;
            console.log('[TikHub Service] 更新 has_more:', hasMore, '(原始值:', searchResult.data.data.has_more, ')');
          } else if (searchResult.data?.has_more !== undefined) {
            hasMore = searchResult.data.has_more === 1 || searchResult.data.has_more === true;
            console.log('[TikHub Service] 更新 has_more:', hasMore, '(从 data 层读取，原始值:', searchResult.data.has_more, ')');
          }
          if (searchResult.data.data?.cursor !== undefined) {
            cursor = searchResult.data.data.cursor;
            console.log('[TikHub Service] 更新 cursor:', cursor);
          } else if (searchResult.data?.cursor !== undefined) {
            cursor = searchResult.data.cursor;
            console.log('[TikHub Service] 更新 cursor:', cursor, '(从 data 层读取)');
          }
          if (searchResult.data.data?.search_id) {
            searchId = searchResult.data.data.search_id;
            console.log('[TikHub Service] 更新 search_id:', searchId);
          } else if (searchResult.data?.search_id) {
            searchId = searchResult.data.search_id;
            console.log('[TikHub Service] 更新 search_id:', searchId, '(从 data 层读取)');
          }
        } else {
          console.warn('[TikHub Service] 数据数组为空，停止分页');
          hasMore = false;
        }

        console.log(`[TikHub Service] 第 ${Math.floor(totalFetched / 20) + 1} 页获取到 ${items.length} 个结果, has_more: ${hasMore}`);

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

        console.log(`[TikHub Service] 当前页处理结果: 总数 ${pageItems.length}, 有效视频 ${videos.length - (totalFetched - pageItems.length)}, 累计视频 ${videos.length}`);

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

      console.log(`[TikHub Service] 搜索完成: 获取 ${videos.length} 个视频, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'tikhub',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client['getUsageStats']()
        }
      };
    } catch (error) {
      console.error('[TikHub Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[TikHub Service] 开始深度搜索: ${keyword}`);

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

    console.log(`[TikHub Service] 开始获取 ${videoList.length} 个视频的评论`);

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

    const commentsMap = await this.client['getVideoCommentsBatch'](awemeIds, maxCommentsPerVideo);

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
      await this.delay(this.defaultOptions.requestDelay!);
    }

    // 合并所有文本并去重
    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[TikHub Service] 深度搜索完成: ${videoList.length} 个视频, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

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
   * 注意：TikHub API 需要有效的 Token，如果检查失败我们仍然允许使用（让实际请求时再报错）
   */
  async checkAvailability(): Promise<boolean> {
    // 对于 TikHub，我们总是返回 true，让实际请求时再处理错误
    // 这样可以避免因为 Token 配置问题而阻止用户使用
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
   * 将搜索结果转换为视频数据格式
   */
  private convertSearchResultToVideo(item: SearchResultItem, sourceKeyword: string): any {
    const aweme = item.aweme_info;
    
    // 添加调试日志
    if (!aweme) {
      console.warn('[TikHub Service] convertSearchResultToVideo: item 缺少 aweme_info', {
        itemType: item.type,
        hasAwemeInfo: !!item.aweme_info,
        itemKeys: Object.keys(item)
      });
      return null;
    }

    // 转换时间戳
    const createTime = aweme.create_time
      ? new Date(aweme.create_time * 1000).toISOString()
      : new Date().toISOString();

    // 提取标题（优先使用 desc）
    const title = aweme.desc || '';

    return {
      title: title,
      description: aweme.desc,
      author: aweme.author?.nickname || '',
      video_url: aweme.share_url || '',
      publish_time: createTime,
      likes: aweme.statistics?.digg_count?.toString() || '0',
      collected_at: new Date().toISOString(),
      comment_count: aweme.statistics?.comment_count || 0,
      // 扩展字段
      aweme_id: aweme.aweme_id,
      collected_count: aweme.statistics?.collect_count?.toString() || '0',
      share_count: aweme.statistics?.share_count?.toString() || '0',
      play_count: aweme.statistics?.play_count?.toString() || '0',
      // 作者信息
      author_uid: aweme.author?.uid,
      author_avatar: aweme.author?.avatar_thumb?.url_list?.[0] || '',
      // 视频信息
      duration: aweme.video?.duration,
      cover_url: aweme.video?.cover?.url_list?.[0] || '',
      // 标签信息
      hashtags: aweme.cha_list?.map(c => c.cha_name).join(', ') || '',
      // 来源
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将评论转换为数据格式
   */
  private convertCommentToData(comment: CommentItem, videoTitle: string): any {
    // 转换时间戳
    const createTime = comment.create_time
      ? new Date(comment.create_time * 1000).toISOString()
      : new Date().toISOString();

    return {
      video_title: videoTitle,
      comment_text: comment.text,
      username: comment.user?.nickname || '',
      likes: comment.digg_count?.toString() || '0',
      // 扩展字段
      comment_id: comment.cid,
      aweme_id: comment.aweme_id,
      create_time: createTime,
      ip_location: comment.ip_label || '',
      user_avatar: comment.user?.avatar_thumb?.url_list?.[0] || '',
      reply_count: comment.reply_comment_total || 0
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * TikHub 服务适配器（用于工厂模式）
 */
export class TikHubServiceAdapter implements IDataSourceService {
  private service: TikHubService;

  constructor(options?: TikHubServiceOptions) {
    this.service = new TikHubService(undefined, options);
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
   * 获取使用统计（TikHub 特有方法）
   */
  getUsageStats() {
    return this.service.getUsageStats();
  }

  /**
   * 清除缓存（TikHub 特有方法）
   */
  clearCache(): void {
    this.service.clearCache();
  }

  /**
   * 获取缓存统计（TikHub 特有方法）
   */
  getCacheStats() {
    return this.service.getCacheStats();
  }
}
