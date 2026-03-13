// YouTube 数据源服务 (V3)
// 实现 IDataSourceService 接口，使用 TikHub YouTube V3 API
// 支持 get_general_search、get_shorts_search、get_video_comments (V3)
// 支持 need_format=true 返回清洗后的结构化数据

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
 * YouTube 服务选项
 */
export interface YouTubeServiceOptions {
  maxVideos?: number;
  maxCommentsPerVideo?: number;
  enableCache?: boolean;
  requestDelay?: number;
  languageCode?: string;
  countryCode?: string;
  // V3 新增选项
  uploadDate?: 'last_hour' | 'today' | 'this_week' | 'this_month' | 'this_year';
  duration?: 'under_4_minutes' | '4_20_minutes' | 'over_20_minutes';
  sortBy?: 'relevance' | 'upload_date' | 'view_count' | 'rating';
  includeShorts?: boolean;
}

/**
 * YouTube 数据源服务 (V3)
 */
export class YouTubeService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: YouTubeServiceOptions;

  constructor(client?: TikHubAPIClient, options?: YouTubeServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxVideos: 20,
      maxCommentsPerVideo: 20,
      enableCache: true,
      requestDelay: 500,
      languageCode: 'en',
      countryCode: 'us',
      sortBy: 'relevance',
      includeShorts: false
    };

    if (options) {
      Object.assign(this.defaultOptions, options);
    }
  }

  /**
   * 基础搜索（不含评论）- 使用 V3 get_general_search
   */
  async searchAndFetch(keyword: string, limit: number): Promise<DataSourceResult> {
    console.log(`[YouTube Service V3] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let totalFetched = 0;
    let continuationToken = '';

    try {
      while (totalFetched < limit) {
        console.log(`[YouTube Service V3] 搜索第 ${Math.floor(totalFetched / 20) + 1} 页`);

        const searchResult = await this.client.searchYouTubeVideos({
          search_query: keyword,
          language_code: this.defaultOptions.languageCode,
          country_code: this.defaultOptions.countryCode,
          upload_date: this.defaultOptions.uploadDate,
          duration: this.defaultOptions.duration,
          sort_by: this.defaultOptions.sortBy,
          type: 'video',
          need_format: true,
          continuation_token: continuationToken || undefined
        });

        console.log('[YouTube Service V3] API 响应 code:', searchResult.code);

        if (searchResult.code !== 200) {
          throw new Error(`YouTube API 搜索失败: ${searchResult.message}`);
        }

        // V3 格式化数据优先从 formatted_data 中取，兼容旧格式
        const formattedData = searchResult.data?.formatted_data;
        const videoList = formattedData?.videos
          || searchResult.data?.videos
          || searchResult.data?.data
          || [];

        if (!Array.isArray(videoList) || videoList.length === 0) {
          console.warn('[YouTube Service V3] 没有更多结果，停止分页');
          break;
        }

        console.log(`[YouTube Service V3] 当前页获取到 ${videoList.length} 个结果`);

        const remainingLimit = limit - totalFetched;
        const pageItems = videoList.slice(0, remainingLimit);

        for (const item of pageItems) {
          const video = this.convertSearchResultToVideo(item, keyword);
          if (video) {
            videos.push(video);

            if (video.title && video.title.length > 5) {
              rawTexts.push(video.title);
            }
            if (video.description && video.description.length > 10 && video.description !== video.title) {
              rawTexts.push(video.description);
            }
            totalFetched++;
          }
        }

        console.log(`[YouTube Service V3] 当前页处理结果: 累计视频 ${videos.length}, 累计文本 ${rawTexts.length}`);

        // 更新分页 token
        continuationToken = formattedData?.continuation_token
          || searchResult.data?.continuation_token || '';

        if (!continuationToken || videoList.length < 20) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 如果启用了 Shorts 搜索，额外搜索 Shorts
      if (this.defaultOptions.includeShorts && videos.length < limit) {
        try {
          const shortsResult = await this.client.searchYouTubeShorts({
            search_query: keyword,
            language_code: this.defaultOptions.languageCode,
            country_code: this.defaultOptions.countryCode,
            need_format: true
          });

          if (shortsResult.code === 200) {
            const shortsList = shortsResult.data?.formatted_data?.shorts
              || shortsResult.data?.shorts || [];
            const remainingLimit = limit - totalFetched;

            for (const item of shortsList.slice(0, remainingLimit)) {
              const video = this.convertShortsResultToVideo(item, keyword);
              if (video) {
                videos.push(video);
                if (video.title && video.title.length > 5) {
                  rawTexts.push(video.title);
                }
                totalFetched++;
              }
            }

            console.log(`[YouTube Service V3] Shorts 搜索补充了 ${shortsList.length} 个结果`);
          }
        } catch (error) {
          console.warn('[YouTube Service V3] Shorts 搜索失败，跳过:', error);
        }
      }

      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[YouTube Service V3] 搜索完成: 获取 ${videos.length} 个视频, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'youtube',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          apiVersion: 'v3',
          usage: this.client.getUsageStats()
        }
      };
    } catch (error) {
      console.error('[YouTube Service V3] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）- 评论使用 V3 get_video_comments
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[YouTube Service V3] 开始深度搜索: ${keyword}`);

    const maxVideos = options.maxVideos || this.defaultOptions.maxVideos!;
    const maxCommentsPerVideo = options.maxCommentsPerVideo || this.defaultOptions.maxCommentsPerVideo!;

    const searchResult = await this.searchAndFetch(keyword, maxVideos);
    const videoList = searchResult.videos || [];

    if (videoList.length === 0) {
      return {
        rawTexts: [],
        videos: [],
        allComments: [],
        videoCount: 0,
        commentCount: 0
      };
    }

    console.log(`[YouTube Service V3] 开始获取 ${videoList.length} 个视频的评论`);

    const allComments: any[] = [];
    const rawTexts: string[] = [];
    const commentTexts: string[] = [];

    for (const video of videoList) {
      if (video.title && video.title.length > 5) {
        rawTexts.push(video.title);
      }
      if (video.description && video.description.length > 10) {
        rawTexts.push(video.description);
      }
    }

    // 批量获取评论 (V3)
    const videoIds = videoList
      .map((v: any) => v.id || v.video_id)
      .filter((id: string | undefined): id is string => !!id);

    const commentsMap = await this.client.getYouTubeVideoCommentsBatch(videoIds, maxCommentsPerVideo);

    for (const video of videoList) {
      const videoId = video.id || video.video_id;
      if (!videoId) continue;

      const comments = commentsMap.get(videoId) || [];
      const limitedComments = comments.slice(0, maxCommentsPerVideo);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, video.title);
        allComments.push(mappedComment);

        // V3 格式化评论: content 字段
        const text = comment.content || comment.text || '';
        if (text.length > 5) {
          commentTexts.push(text);
        }
      }

      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[YouTube Service V3] 深度搜索完成: ${videoList.length} 个视频, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

    return {
      rawTexts: allTexts,
      videos: videoList,
      allComments,
      videoCount: videoList.length,
      commentCount: allComments.length
    };
  }

  async checkAvailability(): Promise<boolean> {
    return true;
  }

  getUsageStats() {
    return this.client.getUsageStats();
  }

  clearCache(): void {
    this.client.clearCache();
  }

  getCacheStats() {
    return this.client.getCacheStats();
  }

  /**
   * 将 YouTube V3 搜索结果转换为视频数据格式
   * 兼容 need_format=true 的清洗数据和原始数据
   */
  private convertSearchResultToVideo(item: any, sourceKeyword: string): any {
    // V3 formatted_data 中的视频 ID 字段可能是 video_id 或 id
    const videoId = item.video_id || item.id || '';

    if (!videoId) {
      console.warn('[YouTube Service V3] convertSearchResultToVideo: 缺少 video_id 字段');
      return null;
    }

    const thumbnails = item.thumbnails || item.thumbnail || [];
    const thumbUrl = Array.isArray(thumbnails)
      ? (thumbnails.find((t: any) => t.width >= 720) || thumbnails[0])?.url || ''
      : (typeof thumbnails === 'string' ? thumbnails : '');

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const description = item.description ? item.description.substring(0, 500) : '';

    return {
      title: item.title || '',
      description: description,
      author: item.author || item.channel_name || item.channel_title || '',
      video_url: videoUrl,
      publish_time: item.published_time || item.publish_date || new Date().toISOString(),
      likes: (item.view_count || item.number_of_views || 0).toString(),
      collected_at: new Date().toISOString(),
      comment_count: item.comment_count || 0,
      // 扩展字段
      id: videoId,
      video_id: videoId,
      video_length: item.video_length || item.duration || '',
      number_of_views: item.view_count || item.number_of_views || 0,
      channel_id: item.channel_id || '',
      thumbnails: Array.isArray(thumbnails) ? thumbnails : [],
      thumb_url: thumbUrl,
      is_live: item.is_live_content || item.is_live || false,
      category: item.category || '',
      type: item.type || 'NORMAL',
      keywords: item.keywords || [],
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 YouTube Shorts 搜索结果转换为视频数据格式
   */
  private convertShortsResultToVideo(item: any, sourceKeyword: string): any {
    const videoId = item.video_id || item.id || '';

    if (!videoId) {
      return null;
    }

    const videoUrl = `https://www.youtube.com/shorts/${videoId}`;

    return {
      title: item.title || '',
      description: '',
      author: item.author || item.channel_name || '',
      video_url: videoUrl,
      publish_time: item.published_time || new Date().toISOString(),
      likes: (item.view_count || 0).toString(),
      collected_at: new Date().toISOString(),
      comment_count: 0,
      id: videoId,
      video_id: videoId,
      type: 'SHORTS',
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 YouTube V3 评论转换为数据格式
   * 兼容 need_format=true 的清洗评论数据
   */
  private convertCommentToData(comment: any, videoTitle: string): any {
    // V3 格式化数据中 author 可能是对象或直接是字段
    const author = comment.author || {};
    const authorName = typeof author === 'string'
      ? author
      : (author.display_name || author.name || comment.author_name || '');

    return {
      video_title: videoTitle,
      comment_text: comment.content || comment.text || '',
      username: authorName,
      likes: (comment.like_count || comment.likes || 0).toString(),
      // 扩展字段
      comment_id: comment.comment_id || comment.id || '',
      channel_id: author.channel_id || '',
      channel_url: author.channel_url || '',
      avatar_url: author.avatar_url || author.thumbnail || '',
      is_verified: author.is_verified || false,
      is_creator: author.is_creator || false,
      published_time: comment.published_time || comment.time || '',
      reply_count: comment.reply_count || 0,
      like_count: comment.like_count || comment.likes || 0,
      reply_level: comment.reply_level || 0
    };
  }
}

/**
 * YouTube 服务适配器（用于工厂模式）
 */
export class YouTubeServiceAdapter implements IDataSourceService {
  private service: YouTubeService;

  constructor(options?: YouTubeServiceOptions) {
    this.service = new YouTubeService(undefined, options);
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

  getUsageStats() {
    return this.service.getUsageStats();
  }

  clearCache(): void {
    this.service.clearCache();
  }

  getCacheStats() {
    return this.service.getCacheStats();
  }
}
