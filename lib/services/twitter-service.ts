// Twitter (X) 数据源服务
// 实现 IDataSourceService 接口，将 Twitter API 数据转换为系统通用格式

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
 * Twitter 服务选项
 */
export interface TwitterServiceOptions {
  maxPosts?: number;
  maxCommentsPerPost?: number;
  enableCache?: boolean;
  requestDelay?: number;
}

/**
 * Twitter 数据源服务
 */
export class TwitterService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: TwitterServiceOptions;

  constructor(client?: TikHubAPIClient, options?: TwitterServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxPosts: 20,
      maxCommentsPerPost: 20,
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
    console.log(`[Twitter Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let cursor = '';
    let totalFetched = 0;

    try {
      while (totalFetched < limit) {
        console.log(`[Twitter Service] 搜索第 ${Math.floor(totalFetched / 20) + 1} 页`);

        const searchResult = await this.client.searchTwitterPosts({
          keyword,
          cursor: cursor || undefined
        });

        if (searchResult.code !== 200) {
          throw new Error(`Twitter API 搜索失败: ${searchResult.message}`);
        }

        // Twitter API 响应格式: { code, data: { tweets: [...], cursor: ... } }
        const tweets = searchResult.data?.tweets || searchResult.data?.data || [];

        if (!Array.isArray(tweets) || tweets.length === 0) {
          console.warn('[Twitter Service] 没有更多结果，停止分页');
          break;
        }

        console.log(`[Twitter Service] 当前页获取到 ${tweets.length} 个结果`);

        const remainingLimit = limit - totalFetched;
        const pageItems = tweets.slice(0, remainingLimit);

        for (const item of pageItems) {
          const post = this.convertSearchResultToPost(item, keyword);
          if (post) {
            videos.push(post);

            if (post.title && post.title.length > 5) {
              rawTexts.push(post.title);
            }
            if (post.description && post.description.length > 10 && post.description !== post.title) {
              rawTexts.push(post.description);
            }
            totalFetched++;
          }
        }

        // 更新游标
        cursor = searchResult.data?.cursor || '';
        if (!cursor || tweets.length < 20) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
      }

      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[Twitter Service] 搜索完成: 获取 ${videos.length} 个推文, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'twitter',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client.getUsageStats()
        }
      };
    } catch (error) {
      console.error('[Twitter Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[Twitter Service] 开始深度搜索: ${keyword}`);

    const maxPosts = options.maxVideos || this.defaultOptions.maxPosts!;
    const maxCommentsPerPost = options.maxCommentsPerVideo || this.defaultOptions.maxCommentsPerPost!;

    const searchResult = await this.searchAndFetch(keyword, maxPosts);
    const postList = searchResult.videos || [];

    if (postList.length === 0) {
      return {
        rawTexts: [],
        videos: [],
        allComments: [],
        videoCount: 0,
        commentCount: 0
      };
    }

    console.log(`[Twitter Service] 开始获取 ${postList.length} 个推文的评论`);

    const allComments: any[] = [];
    const rawTexts: string[] = [];
    const commentTexts: string[] = [];

    for (const post of postList) {
      if (post.title && post.title.length > 5) {
        rawTexts.push(post.title);
      }
      if (post.description && post.description.length > 10) {
        rawTexts.push(post.description);
      }
    }

    const tweetIds = postList
      .map((v: any) => v.tweet_id)
      .filter((id: string | undefined): id is string => !!id);

    const commentsMap = await this.client.getTwitterTweetCommentsBatch(tweetIds, maxCommentsPerPost);

    for (const post of postList) {
      if (!post.tweet_id) continue;

      const comments = commentsMap.get(post.tweet_id) || [];
      const limitedComments = comments.slice(0, maxCommentsPerPost);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, post.title);
        allComments.push(mappedComment);

        const text = comment.text || comment.full_text || '';
        if (text.length > 5) {
          commentTexts.push(text);
        }
      }

      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[Twitter Service] 深度搜索完成: ${postList.length} 个推文, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

    return {
      rawTexts: allTexts,
      videos: postList,
      allComments,
      videoCount: postList.length,
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
   * 将 Twitter 搜索结果转换为通用数据格式
   */
  private convertSearchResultToPost(item: any, sourceKeyword: string): any {
    // Twitter 数据结构可能有多种格式
    const text = item.full_text || item.text || item.content || '';
    const tweetId = item.id_str || item.tweet_id || item.id || '';

    if (!text && !tweetId) {
      console.warn('[Twitter Service] convertSearchResultToPost: 无效的推文数据');
      return null;
    }

    const user = item.user || item.author || {};
    const createTime = item.created_at
      ? new Date(item.created_at).toISOString()
      : new Date().toISOString();

    return {
      title: text.substring(0, 200),
      description: text,
      author: user.name || user.screen_name || user.nickname || '',
      video_url: `https://x.com/i/status/${tweetId}`,
      publish_time: createTime,
      likes: (item.favorite_count || item.like_count || 0).toString(),
      collected_at: new Date().toISOString(),
      comment_count: item.reply_count || item.comment_count || 0,
      // 扩展字段
      tweet_id: tweetId,
      retweet_count: item.retweet_count || 0,
      quote_count: item.quote_count || 0,
      view_count: item.view_count || 0,
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 Twitter 评论转换为数据格式
   */
  private convertCommentToData(comment: any, postTitle: string): any {
    const user = comment.user || comment.author || {};

    return {
      video_title: postTitle,
      comment_text: comment.full_text || comment.text || comment.content || '',
      username: user.name || user.screen_name || user.nickname || '',
      likes: (comment.favorite_count || comment.like_count || 0).toString(),
      comment_id: comment.id_str || comment.id || '',
      create_time: comment.created_at
        ? new Date(comment.created_at).toISOString()
        : new Date().toISOString()
    };
  }
}

/**
 * Twitter 服务适配器（用于工厂模式）
 */
export class TwitterServiceAdapter implements IDataSourceService {
  private service: TwitterService;

  constructor(options?: TwitterServiceOptions) {
    this.service = new TwitterService(undefined, options);
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
