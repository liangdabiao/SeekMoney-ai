// Reddit 数据源服务
// 实现 IDataSourceService 接口，将 Reddit API 数据转换为系统通用格式

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
 * Reddit 服务选项
 */
export interface RedditServiceOptions {
  maxPosts?: number;
  maxCommentsPerPost?: number;
  enableCache?: boolean;
  requestDelay?: number;
  sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
  time?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour';
}

/**
 * Reddit 数据源服务
 */
export class RedditService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: RedditServiceOptions;

  constructor(client?: TikHubAPIClient, options?: RedditServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxPosts: 25,
      maxCommentsPerPost: 30,
      enableCache: true,
      requestDelay: 500,
      sort: 'relevance',
      time: 'month'
    };

    if (options) {
      Object.assign(this.defaultOptions, options);
    }
  }

  /**
   * 基础搜索（不含评论）
   */
  async searchAndFetch(keyword: string, limit: number): Promise<DataSourceResult> {
    console.log(`[Reddit Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let after = '';
    let totalFetched = 0;

    try {
      while (totalFetched < limit) {
        console.log(`[Reddit Service] 搜索第 ${Math.floor(totalFetched / 25) + 1} 页`);

        const searchResult = await this.client.searchRedditPosts({
          keyword,
          sort: this.defaultOptions.sort,
          time: this.defaultOptions.time,
          after: after || undefined
        });

        if (searchResult.code !== 200) {
          throw new Error(`Reddit API 搜索失败: ${searchResult.message}`);
        }

        // Reddit API 响应格式: { code, data: { posts: [...], after: ... } }
        const posts = searchResult.data?.posts || searchResult.data?.children || searchResult.data?.data?.children || [];

        if (!Array.isArray(posts) || posts.length === 0) {
          console.warn('[Reddit Service] 没有更多结果，停止分页');
          break;
        }

        console.log(`[Reddit Service] 当前页获取到 ${posts.length} 个结果`);

        const remainingLimit = limit - totalFetched;
        const pageItems = posts.slice(0, remainingLimit);

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

        // 更新分页游标
        after = searchResult.data?.after || searchResult.data?.data?.after || '';
        if (!after || posts.length < 25) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
      }

      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[Reddit Service] 搜索完成: 获取 ${videos.length} 个帖子, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'reddit',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client.getUsageStats()
        }
      };
    } catch (error) {
      console.error('[Reddit Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[Reddit Service] 开始深度搜索: ${keyword}`);

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

    console.log(`[Reddit Service] 开始获取 ${postList.length} 个帖子的评论`);

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

    const postIds = postList
      .map((v: any) => v.post_id)
      .filter((id: string | undefined): id is string => !!id);

    const commentsMap = await this.client.getRedditPostCommentsBatch(postIds, maxCommentsPerPost);

    for (const post of postList) {
      if (!post.post_id) continue;

      const comments = commentsMap.get(post.post_id) || [];
      const limitedComments = comments.slice(0, maxCommentsPerPost);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, post.title);
        allComments.push(mappedComment);

        const text = comment.body || comment.text || comment.content || '';
        if (text.length > 5) {
          commentTexts.push(text);
        }
      }

      await new Promise(resolve => setTimeout(resolve, this.defaultOptions.requestDelay!));
    }

    const allTexts = [...new Set([...rawTexts, ...commentTexts])];

    console.log(`[Reddit Service] 深度搜索完成: ${postList.length} 个帖子, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

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
   * 将 Reddit 搜索结果转换为通用数据格式
   */
  private convertSearchResultToPost(item: any, sourceKeyword: string): any {
    // Reddit 数据可能嵌套在 data 字段中
    const postData = item.data || item;

    const title = postData.title || '';
    const selftext = postData.selftext || postData.body || '';
    const postId = postData.id || postData.name || '';

    if (!title && !postId) {
      console.warn('[Reddit Service] convertSearchResultToPost: 无效的帖子数据');
      return null;
    }

    const createTime = postData.created_utc
      ? new Date(postData.created_utc * 1000).toISOString()
      : new Date().toISOString();

    const subreddit = postData.subreddit || postData.subreddit_name_prefixed || '';
    const permalink = postData.permalink || '';

    return {
      title: title,
      description: selftext.substring(0, 500),
      author: postData.author || '',
      video_url: permalink ? `https://www.reddit.com${permalink}` : '',
      publish_time: createTime,
      likes: (postData.score || postData.ups || 0).toString(),
      collected_at: new Date().toISOString(),
      comment_count: postData.num_comments || 0,
      // 扩展字段
      post_id: postId,
      subreddit: subreddit,
      upvote_ratio: postData.upvote_ratio || 0,
      awards: postData.total_awards_received || 0,
      is_self: postData.is_self || false,
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 Reddit 评论转换为数据格式
   */
  private convertCommentToData(comment: any, postTitle: string): any {
    const commentData = comment.data || comment;

    return {
      video_title: postTitle,
      comment_text: commentData.body || commentData.text || commentData.content || '',
      username: commentData.author || '',
      likes: (commentData.score || commentData.ups || 0).toString(),
      comment_id: commentData.id || '',
      create_time: commentData.created_utc
        ? new Date(commentData.created_utc * 1000).toISOString()
        : new Date().toISOString(),
      subreddit: commentData.subreddit || ''
    };
  }
}

/**
 * Reddit 服务适配器（用于工厂模式）
 */
export class RedditServiceAdapter implements IDataSourceService {
  private service: RedditService;

  constructor(options?: RedditServiceOptions) {
    this.service = new RedditService(undefined, options);
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
