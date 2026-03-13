// TikHub API Client
// TikHub API 客户端 - 封装抖音搜索和评论获取功能，以及 TikTok API

import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * TikHub API 客户端配置
 */
export interface TikHubClientConfig {
  apiToken: string;
  baseURL?: string;
  useChinaDomain?: boolean;
  timeout?: number;
  maxRetries?: number;
  enableCache?: boolean;
}

/**
 * 搜索请求参数
 */
export interface SearchRequest {
  keyword: string;
  cursor?: number;
  sort_type?: '0' | '1' | '2';  // 0=综合, 1=最多点赞, 2=最新
  publish_time?: '0' | '1' | '7' | '180';  // 0=不限, 1=一天, 7=一周, 180=半年
  filter_duration?: '0' | '0-1' | '1-5' | '5-10000';  // 时长筛选
  content_type?: '0' | '1' | '2' | '3';  // 0=不限, 1=视频, 2=图片, 3=文章
}

/**
 * 搜索响应数据
 */
export interface SearchResponse {
  code: number;
  message: string;
  message_zh?: string;
  data?: {
    status_code: number;
    data?: SearchResultItem[];
    cursor?: number;
    has_more?: boolean;
    cursor_text?: string;
  };
  cursor?: number;
  search_id?: string;
  backtrace?: string;
  has_more?: boolean;
  cache_url?: string;
  cache_message?: string;
}

/**
 * 搜索结果项
 */
export interface SearchResultItem {
  type: number;
  aweme_info?: {
    aweme_id: string;
    desc: string;
    create_time: number;
    author?: {
      uid: string;
      sec_uid?: string;
      nickname: string;
      avatar_thumb?: { url_list: string[] };
      avatar_medium?: { url_list: string[] };
      signature?: string;
      is_verified?: boolean;
    };
    statistics?: {
      comment_count: number;
      digg_count: number;
      share_count: number;
      play_count: number;
      collect_count: number;
    };
    video?: {
      play_addr?: { url_list: string[] };
      cover?: { url_list: string[] };
      dynamic_cover?: { url_list: string[] };
      duration: number;
      width?: number;
      height?: number;
    };
    music?: {
      id_str?: string;
      title?: string;
      author?: string;
    };
    cha_list?: Array<{
      cha_name: string;
      share_url?: string;
    }>;
    share_url: string;
  };
}

/**
 * 评论请求参数
 */
export interface CommentsRequest {
  aweme_id: string;
  cursor?: number;
  count?: number;
}

/**
 * 评论响应数据
 */
export interface CommentsResponse {
  code: number;
  message: string;
  data?: {
    comments: CommentItem[];
    cursor?: number;
    has_more?: boolean;
    total?: number;
  };
  cache_url?: string;
}

/**
 * 评论项
 */
export interface CommentItem {
  cid: string;
  text: string;
  aweme_id: string;
  create_time: number;
  digg_count: number;
  reply_comment_total?: number;
  user?: {
    uid: string;
    nickname: string;
    avatar_thumb?: { url_list: string[] };
    sec_uid?: string;
  };
  ip_label?: string;
}

/**
 * 使用统计信息
 */
export interface UsageStats {
  requestCount: number;
  searchRequests: number;
  commentsRequests: number;
  costEstimate: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * 缓存条目
 */
interface CacheEntry {
  data: any;
  expiresAt: number;
  cacheUrl?: string;
}

/**
 * TikHub API 客户端类
 */
export class TikHubAPIClient {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry> = new Map();
  private requestCount: number = 0;
  private searchRequests: number = 0;
  private commentsRequests: number = 0;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private costEstimate: number = 0;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
  private readonly COST_PER_REQUEST = 0.01; // 假设每次请求0.01元

  constructor(config: TikHubClientConfig) {
    const baseURL = config.baseURL ||
      (config.useChinaDomain ? 'https://api.tikhub.dev' : 'https://api.tikhub.io');

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 60000,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 添加请求拦截器用于日志
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[TikHub API] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[TikHub API] Request error:', error);
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器用于错误处理
    this.client.interceptors.response.use(
      (response) => {
        // 记录缓存信息
        if (response.data?.cache_url) {
          console.log('[TikHub API] Cache URL available:', response.data.cache_url);
        }
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          console.error(`[TikHub API] Error ${error.response.status}:`, error.response.data);
        } else if (error.request) {
          console.error('[TikHub API] No response received:', error.message);
        } else {
          console.error('[TikHub API] Request setup error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 带重试的请求方法
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;
        
        if (axios.isAxiosError(error)) {
          const errorInfo = {
            attempt,
            maxRetries,
            code: error.code,
            message: error.message,
            hasResponse: !!error.response,
            status: error.response?.status,
            hasRequest: !!error.request,
            url: error.config?.url,
            method: error.config?.method
          };
          
          console.error(`[TikHub API] 请求失败 (尝试 ${attempt}/${maxRetries}):`, errorInfo);
          
          if (error.response) {
            console.error(`[TikHub API] 响应错误详情:`, {
              status: error.response.status,
              data: error.response.data,
              headers: error.response.headers
            });

            // 只对服务器错误 (5xx) 进行重试
            // 4xx 客户端错误不应重试，直接抛出
            if (error.response.status >= 400 && error.response.status < 500) {
              console.error(`[TikHub API] 客户端错误 (${error.response.status})，不再重试`);
              throw error;
            } else if (error.response.status >= 500) {
              console.error(`[TikHub API] 服务器错误 (${error.response.status})，将重试`);
            }
          } else if (error.request) {
            console.error(`[TikHub API] 无响应错误详情:`, {
              message: error.message,
              code: error.code,
              errno: (error as any).errno,
              syscall: (error as any).syscall
            });
          }
        } else {
          console.error(`[TikHub API] 非axios错误 (尝试 ${attempt}/${maxRetries}):`, {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
        }
        
        if (attempt < maxRetries) {
          const delay = delayMs * attempt;
          console.log(`[TikHub API] 等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * 搜索视频
   */
  async searchVideos(params: SearchRequest): Promise<SearchResponse> {
    return this.requestWithRetry(async () => {
      const cacheKey = `search_${JSON.stringify(params)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.cacheHits++;
        console.log('[TikHub API] Using cached search result');
        return cached;
      }
      this.cacheMisses++;

      this.requestCount++;
      this.searchRequests++;

      console.log(`[TikHub API] 发起搜索请求:`, {
        keyword: params.keyword,
        cursor: params.cursor,
        sort_type: params.sort_type,
        publish_time: params.publish_time
      });

      const response = await this.client.post<SearchResponse>(
        '/api/v1/douyin/search/fetch_general_search_v1',
        {
          keyword: params.keyword,
          cursor: params.cursor || 0,
          sort_type: params.sort_type || '0',
          publish_time: params.publish_time || '0',
          filter_duration: params.filter_duration || '0',
          content_type: params.content_type || '1',
          search_id: '',
          backtrace: ''
        }
      );

      const data = response.data;

      console.log('[TikHub API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasDataData: !!data.data?.data,
        hasDataDataData: !!data.data?.data?.data,
        dataDataType: typeof data.data?.data,
        dataDataIsArray: Array.isArray(data.data?.data),
        dataDataDataType: typeof data.data?.data?.data,
        dataDataDataIsArray: Array.isArray(data.data?.data?.data),
        hasMore: data.data?.has_more,
        cursor: data.data?.cursor,
        searchId: data.data?.search_id,
        cacheUrl: data.cache_url,
        dataKeys: data.data ? Object.keys(data.data) : []
      });

      if (data.data?.data) {
        const dataStr = JSON.stringify(data.data.data);
        if (dataStr.length < 500) {
          console.log('[TikHub API] data.data 内容:', dataStr);
        } else {
          console.log('[TikHub API] data.data 类型:', Array.isArray(data.data.data) ? `数组(长度:${data.data.data.length})` : typeof data.data.data);
        }
      }

      if (data.cache_url) {
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    }, 3, 1500);
  }

  /**
   * 获取视频评论
   */
  async getVideoComments(
    awemeId: string,
    cursor: number = 0,
    count: number = 20
  ): Promise<CommentsResponse> {
    try {
      return await this.requestWithRetry(async () => {
        const cacheKey = `comments_${awemeId}_${cursor}_${count}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.cacheHits++;
          console.log('[TikHub API] Using cached comments result');
          return cached;
        }
        this.cacheMisses++;

        this.requestCount++;
        this.commentsRequests++;

        console.log(`[TikHub API] 发起评论请求:`, {
          awemeId,
          cursor,
          count
        });

        const response = await this.client.get<CommentsResponse>(
          '/api/v1/douyin/web/fetch_video_comments',
          {
            params: {
              aweme_id: awemeId,
              cursor: cursor.toString(),
              count: count.toString()
            }
          }
        );

        const data = response.data;

        if (data.cache_url) {
          this.setCache(cacheKey, data, data.cache_url);
        }

        this.costEstimate += this.COST_PER_REQUEST;

        return data;
      }, 3, 1500);
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        console.warn(`[TikHub API] 视频 ${awemeId} 评论获取失败 (400)，返回空列表`);
        return {
          code: 200,
          message: '评论获取失败，返回空列表',
          data: {
            comments: [],
            cursor: 0,
            has_more: false,
            total: 0
          }
        };
      }
      throw error;
    }
  }

  /**
   * 批量获取视频评论
   */
  async getVideoCommentsBatch(
    awemeIds: string[],
    maxCommentsPerVideo: number
  ): Promise<Map<string, CommentItem[]>> {
    const result = new Map<string, CommentItem[]>();

    for (const awemeId of awemeIds) {
      try {
        const comments: CommentItem[] = [];
        let cursor = 0;
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerVideo) {
          const response = await this.getVideoComments(
            awemeId,
            cursor,
            Math.min(20, maxCommentsPerVideo - comments.length)
          );

          console.log('[TikHub API] 评论响应:', {
            code: response.code,
            hasData: !!response.data,
            hasComments: !!response.data?.comments,
            commentCount: response.data?.comments?.length || 0
          });

          if (response.code !== 200 || !response.data) {
            console.warn('[TikHub API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const commentList = response.data.comments || [];
          comments.push(...commentList);

          // 检查是否还有更多评论
          // has_more 和 cursor 在 response.data 的根级别
          hasMore = (response.data.has_more === 1 || response.data.has_more === true);
          cursor = response.data.cursor || 0;

          console.log(`[TikHub API] 已获取 ${comments.length} 条评论，has_more: ${hasMore}, cursor: ${cursor}`);

          // 避免请求过快
          await this.delay(300);
        }

        result.set(awemeId, comments);
      } catch (error) {
        console.error(`[TikHub API] Failed to fetch comments for ${awemeId}:`, error);
        result.set(awemeId, []);
      }
    }

    return result;
  }

  /**
   * 检查 API 健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.searchVideos({ keyword: 'test' });
      // 检查是否是认证错误
      if (response.code === 401 || response.code === 403) {
        console.warn('[TikHub API] 认证失败，请检查 API Token');
        return false;
      }
      return response.code === 200;
    } catch (error) {
      console.warn('[TikHub API] 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取使用统计信息
   */
  getUsageStats(): UsageStats {
    return {
      requestCount: this.requestCount,
      searchRequests: this.searchRequests,
      commentsRequests: this.commentsRequests,
      costEstimate: this.costEstimate,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.requestCount = 0;
    this.searchRequests = 0;
    this.commentsRequests = 0;
    this.costEstimate = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[TikHub API] Cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      expiresAt: new Date(entry.expiresAt).toISOString(),
      remaining: Math.max(0, entry.expiresAt - now),
      hasCacheUrl: !!entry.cacheUrl
    }));

    return {
      size: this.cache.size,
      entries,
      hitRate: this.requestCount > 0
        ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: any, cacheUrl?: string): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.CACHE_TTL,
      cacheUrl
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== TikTok API 方法 ====================

  /**
   * TikTok 搜索参数
   */
  async searchTiktokVideos(params: {
    keyword: string;
    offset?: number;
    search_id?: string;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keyword: params.keyword,
      offset: params.offset || 0
    };

    if (params.search_id) {
      queryParams.search_id = params.search_id;
    }

    try {
      const response = await this.client.get(
        '/api/v1/tiktok/web/fetch_general_search',
        { params: queryParams }
      );

      const data = response.data;

      // 添加详细的 API 响应日志
      console.log('[TikTok API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasDataData: !!data.data?.data,
        hasDataDataData: !!data.data?.data?.data,
        dataDataType: typeof data.data?.data,
        dataDataIsArray: Array.isArray(data.data?.data),
        dataDataDataType: typeof data.data?.data?.data,
        dataDataDataIsArray: Array.isArray(data.data?.data?.data),
        hasMore: data.data?.has_more,
        cursor: data.data?.cursor,
        searchId: data.data?.search_id,
        cacheUrl: data.cache_url,
        dataKeys: data.data ? Object.keys(data.data) : []
      });

      // 如果数据量较少，输出完整数据结构以便调试
      if (data.data?.data) {
        const dataStr = JSON.stringify(data.data.data);
        if (dataStr.length < 500) {
          console.log('[TikTok API] data.data 内容:', dataStr);
        } else {
          console.log('[TikTok API] data.data 类型:', Array.isArray(data.data.data) ? `数组(长度:${data.data.data.length})` : typeof data.data.data);
        }
      }

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `tiktok_search_${JSON.stringify(params)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `TikTok API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 TikTok 视频评论
   */
  async getTikTokVideoComments(
    awemeId: string,
    cursor: number = 0,
    count: number = 20
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    try {
      const response = await this.client.get(
        '/api/v1/tiktok/web/fetch_post_comment',
        {
          params: {
            aweme_id: awemeId,
            cursor: cursor.toString(),
            count: count.toString()
          }
        }
      );

      const data = response.data;

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `tiktok_comments_${awemeId}_${cursor}_${count}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `TikTok API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 TikTok 视频评论
   */
  async getTikTokVideoCommentsBatch(
    awemeIds: string[],
    maxCommentsPerVideo: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const awemeId of awemeIds) {
      try {
        const comments: any[] = [];
        let cursor = 0;
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerVideo) {
          const response = await this.getTikTokVideoComments(
            awemeId,
            cursor,
            Math.min(20, maxCommentsPerVideo - comments.length)
          );

          console.log('[TikTok API] 评论响应:', {
            code: response.code,
            hasData: !!response.data,
            hasComments: !!response.data?.comments,
            commentCount: response.data?.comments?.length || 0
          });

          if (response.code !== 200 || !response.data?.comments) {
            console.warn('[TikTok API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const commentList = response.data.comments;
          comments.push(...commentList);

          // 检查是否还有更多评论
          hasMore = response.data.has_more === 1 || response.data.has_more === true;
          cursor = response.data.cursor || 0;

          console.log(`[TikTok API] 已获取 ${comments.length} 条评论，hasMore: ${hasMore}, cursor: ${cursor}`);

          // 避免请求过快
          await this.delay(300);
        }

        result.set(awemeId, comments);
      } catch (error) {
        console.error(`[TikTok API] Failed to fetch comments for ${awemeId}:`, error);
        result.set(awemeId, []);
      }
    }

    return result;
  }

  // ==================== Bilibili API 方法 ====================

  /**
   * Bilibili 搜索参数
   */
  async searchBilibiliVideos(params: {
    keyword: string;
    order?: 'totalrank' | 'click' | 'pubdate' | 'dm' | 'stow';
    page?: number;
    page_size?: number;
    duration?: 0 | 1 | 2 | 3 | 4;
    pubtime_begin_s?: number;
    pubtime_end_s?: number;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keyword: params.keyword,
      order: params.order || 'totalrank',
      page: params.page || 1,
      page_size: params.page_size || 42,
      duration: params.duration || 0
    };

    if (params.pubtime_begin_s !== undefined) {
      queryParams.pubtime_begin_s = params.pubtime_begin_s;
    }
    if (params.pubtime_end_s !== undefined) {
      queryParams.pubtime_end_s = params.pubtime_end_s;
    }

    try {
      const response = await this.client.get(
        '/api/v1/bilibili/web/fetch_general_search',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Bilibili API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasDataData: !!data.data?.data,
        hasResult: !!data.data?.data?.result,
        resultCount: data.data?.data?.result?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `bilibili_search_${JSON.stringify(params)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Bilibili API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 Bilibili 视频评论
   */
  async getBilibiliVideoComments(
    bvId: string,
    pn: number = 1
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    try {
      const response = await this.client.get(
        '/api/v1/bilibili/web/fetch_video_comments',
        {
          params: {
            bv_id: bvId,
            pn: pn.toString()
          }
        }
      );

      const data = response.data;

      console.log('[Bilibili API] 评论响应:', {
        code: data.code,
        hasData: !!data.data,
        hasReplies: !!data.data?.replies,
        replyCount: data.data?.replies?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `bilibili_comments_${bvId}_${pn}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Bilibili API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 Bilibili 视频评论
   */
  async getBilibiliVideoCommentsBatch(
    bvIds: string[],
    maxCommentsPerVideo: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const bvId of bvIds) {
      try {
        const comments: any[] = [];
        let pn = 1;
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerVideo) {
          const response = await this.getBilibiliVideoComments(
            bvId,
            pn
          );

          if (response.code !== 200 || !response.data?.replies) {
            console.warn('[Bilibili API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const replyList = response.data.replies;
          comments.push(...replyList);

          // Bilibili API 返回 page 信息
          const page = response.data.data?.page;
          if (page) {
            hasMore = pn * page.size < page.count;
          } else {
            hasMore = replyList.length >= 20;
          }

          pn++;

          console.log(`[Bilibili API] 已获取 ${comments.length} 条评论，has_more: ${hasMore}`);

          // 避免请求过快
          await this.delay(300);
        }

        result.set(bvId, comments);
      } catch (error) {
        console.error(`[Bilibili API] Failed to fetch comments for ${bvId}:`, error);
        result.set(bvId, []);
      }
    }

    return result;
  }

  // ==================== WeChat Channels API 方法 ====================

  /**
   * WeChat Channels 搜索参数
   */
  async searchWeChatVideos(params: {
    keywords: string;
    sessionBuffer?: string;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keywords: params.keywords
    };

    // Only add session_buffer if it has a value
    if (params.sessionBuffer && params.sessionBuffer.length > 0) {
      queryParams.session_buffer = params.sessionBuffer;
    }

    console.log('[WeChat Channels API] 请求参数:', JSON.stringify(queryParams));

    try {
      const response = await this.client.get(
        '/api/v1/wechat_channels/fetch_default_search',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[WeChat Channels API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasMediaList: !!data.data?.media_list,
        mediaCount: data.data?.media_list?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `wechat_search_${JSON.stringify(params)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[WeChat Channels API] 请求失败:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            params: error.config?.params
          }
        });
        throw new Error(
          `WeChat Channels API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 WeChat Channels 视频评论
   */
  async getWeChatVideoComments(
    id: string,
    lastBuffer?: string
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    const queryParams: any = {
      id: id
    };

    if (lastBuffer) {
      queryParams.lastBuffer = lastBuffer;
    }

    try {
      const response = await this.client.get(
        '/api/v1/wechat_channels/fetch_comments',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[WeChat Channels API] 评论响应:', {
        code: data.code,
        hasData: !!data.data,
        hasCommentInfo: !!data.data?.comment_info,
        commentCount: data.data?.comment_info?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `wechat_comments_${id}_${lastBuffer || 'first'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `WeChat Channels API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 WeChat Channels 视频评论
   */
  async getWeChatVideoCommentsBatch(
    ids: string[],
    maxCommentsPerVideo: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const id of ids) {
      try {
        const comments: any[] = [];
        let lastBuffer = '';
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerVideo) {
          const response = await this.getWeChatVideoComments(
            id,
            lastBuffer
          );

          if (response.code !== 200 || !response.data?.comment_info) {
            console.warn('[WeChat Channels API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const commentList = response.data.comment_info;
          comments.push(...commentList);

          // 检查是否还有更多评论
          lastBuffer = response.data?.last_buffer || '';
          hasMore = lastBuffer !== '' && commentList.length >= 10;

          console.log(`[WeChat Channels API] 已获取 ${comments.length} 条评论，has_more: ${hasMore}`);

          // 避免请求过快
          await this.delay(300);
        }

        result.set(id, comments);
      } catch (error) {
        console.error(`[WeChat Channels API] Failed to fetch comments for ${id}:`, error);
        result.set(id, []);
      }
    }

    return result;
  }

  // ==================== YouTube API 方法 (V3) ====================

  /**
   * YouTube 通用搜索 (V3 - get_general_search)
   * 支持高级过滤：上传时间、时长、内容类型、功能、排序
   * 支持 need_format=true 返回清洗后的结构化数据
   */
  async searchYouTubeVideos(params: {
    search_query: string;
    language_code?: string;
    country_code?: string;
    continuation_token?: string;
    // V3 新增高级过滤参数
    upload_date?: 'last_hour' | 'today' | 'this_week' | 'this_month' | 'this_year';
    duration?: 'under_4_minutes' | '4_20_minutes' | 'over_20_minutes';
    type?: 'video' | 'channel' | 'playlist' | 'movie';
    features?: string;   // e.g. 'hd', '4k', 'subtitles', 'creative_commons', 'live', 'vr180'
    sort_by?: 'relevance' | 'upload_date' | 'view_count' | 'rating';
    need_format?: boolean;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      search_query: params.search_query,
      language_code: params.language_code || 'en',
      country_code: params.country_code || 'us',
      need_format: params.need_format !== false  // 默认启用 need_format
    };

    if (params.continuation_token) {
      queryParams.continuation_token = params.continuation_token;
    }
    if (params.upload_date) {
      queryParams.upload_date = params.upload_date;
    }
    if (params.duration) {
      queryParams.duration = params.duration;
    }
    if (params.type) {
      queryParams.type = params.type;
    }
    if (params.features) {
      queryParams.features = params.features;
    }
    if (params.sort_by) {
      queryParams.sort_by = params.sort_by;
    }

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_general_search',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[YouTube API V3] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasFormattedData: !!data.data?.formatted_data,
        videoCount: data.data?.formatted_data?.videos?.length || data.data?.videos?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `youtube_search_${JSON.stringify(queryParams)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * YouTube Shorts 专用搜索 (V3 - get_shorts_search)
   * 支持 need_format=true 返回清洗后的 Shorts 结果
   */
  async searchYouTubeShorts(params: {
    search_query: string;
    language_code?: string;
    country_code?: string;
    continuation_token?: string;
    need_format?: boolean;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      search_query: params.search_query,
      language_code: params.language_code || 'en',
      country_code: params.country_code || 'us',
      need_format: params.need_format !== false
    };

    if (params.continuation_token) {
      queryParams.continuation_token = params.continuation_token;
    }

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_shorts_search',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[YouTube API V3] Shorts搜索响应:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        shortsCount: data.data?.formatted_data?.shorts?.length || 0,
        cacheUrl: data.cache_url
      });

      if (data.cache_url) {
        const cacheKey = `youtube_shorts_search_${JSON.stringify(queryParams)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube Shorts API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 YouTube 视频详情 (V3 - get_video_info_v3)
   * 通过解析 HTML 和 YouTube 原生 API 提高稳定性
   */
  async getYouTubeVideoInfo(videoId: string): Promise<any> {
    this.requestCount++;

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_video_info_v3',
        { params: { video_id: videoId } }
      );

      const data = response.data;

      if (data.cache_url) {
        const cacheKey = `youtube_video_info_${videoId}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube API 视频详情获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 YouTube 视频评论 (V3 - get_video_comments)
   * 升级到 V3 爬虫，支持 sort_by=top/newest，已移除 RapidAPI 依赖
   * 支持 need_format=true 返回清洗后的评论数据
   */
  async getYouTubeVideoComments(
    videoId: string,
    continuationToken?: string,
    sortBy?: 'top' | 'newest'
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    const queryParams: any = {
      video_id: videoId,
      need_format: true,
      sort_by: sortBy || 'top'
    };

    if (continuationToken) {
      queryParams.continuation_token = continuationToken;
    }

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_video_comments',
        { params: queryParams }
      );

      const data = response.data;

      // V3 格式化数据在 formatted_data 中
      const commentCount = data.data?.formatted_data?.comments?.length
        || data.data?.comments?.length || 0;

      console.log('[YouTube API V3] 评论响应详情:', {
        code: data.code,
        message: data.message,
        commentCount,
        hasFormattedData: !!data.data?.formatted_data,
        cacheUrl: data.cache_url
      });

      if (data.cache_url) {
        const cacheKey = `youtube_comments_${videoId}_${sortBy || 'top'}_${continuationToken || 'first'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 YouTube 视频评论
   */
  async getYouTubeVideoCommentsBatch(
    videoIds: string[],
    maxCommentsPerVideo: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const videoId of videoIds) {
      try {
        const comments: any[] = [];
        let continuationToken = '';
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerVideo) {
          const response = await this.getYouTubeVideoComments(
            videoId,
            continuationToken
          );

          // V3: 优先使用 formatted_data，兼容旧格式
          const commentList = response.data?.formatted_data?.comments
            || response.data?.comments || [];

          if (response.code !== 200 || commentList.length === 0) {
            console.warn('[YouTube API V3] 评论响应格式不符合预期或无更多评论，停止获取');
            break;
          }

          comments.push(...commentList);

          // 检查是否还有更多评论
          continuationToken = response.data?.formatted_data?.continuation_token
            || response.data?.continuation_token || '';
          hasMore = continuationToken !== '' && commentList.length >= 10;

          console.log(`[YouTube API V3] 已获取 ${comments.length} 条评论，has_more: ${hasMore}`);

          await this.delay(300);
        }

        result.set(videoId, comments);
      } catch (error) {
        console.error(`[YouTube API V3] Failed to fetch comments for ${videoId}:`, error);
        result.set(videoId, []);
      }
    }

    return result;
  }

  /**
   * 获取 YouTube 频道 ID (V3 - get_channel_id_v2)
   * 支持多种 URL 格式：@username, /channel/, /c/, /user/
   */
  async getYouTubeChannelId(channelUrl: string): Promise<any> {
    this.requestCount++;

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_channel_id_v2',
        { params: { channel_url: channelUrl } }
      );

      const data = response.data;

      if (data.cache_url) {
        const cacheKey = `youtube_channel_id_${channelUrl}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube API 频道ID获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 YouTube 频道视频列表 (V3 - get_channel_videos_v3)
   * 支持分页，统一格式化输出
   */
  async getYouTubeChannelVideos(params: {
    channel_id: string;
    continuation_token?: string;
    need_format?: boolean;
  }): Promise<any> {
    this.requestCount++;

    const queryParams: any = {
      channel_id: params.channel_id,
      need_format: params.need_format !== false
    };

    if (params.continuation_token) {
      queryParams.continuation_token = params.continuation_token;
    }

    try {
      const response = await this.client.get(
        '/api/v1/youtube/web/get_channel_videos_v3',
        { params: queryParams }
      );

      const data = response.data;

      if (data.cache_url) {
        const cacheKey = `youtube_channel_videos_${params.channel_id}_${params.continuation_token || 'first'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `YouTube API 频道视频获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  // ==================== Xiaohongshu (小红书) API 方法 ====================

  /**
   * Xiaohongshu 搜索笔记
   */
  async searchXiaohongshuNotes(params: {
    keyword: string;
    page?: number;
    sort?: 'general' | 'popularity_descending' | 'time_descending' | 'comment_descending' | 'collect_descending';
    noteType?: '_0' | '_1' | '_2' | '_3';
    noteTime?: string;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keyword: params.keyword,
      page: params.page || 1,
      sort: params.sort || 'general',
      noteType: params.noteType || '_0'
    };

    if (params.noteTime) {
      queryParams.noteTime = params.noteTime;
    }

    try {
      const response = await this.client.get(
        '/api/v1/xiaohongshu/web/search_notes',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Xiaohongshu API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        hasItems: !!data.data?.items,
        itemCount: data.data?.items?.length || 0,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `xiaohongshu_search_${JSON.stringify(queryParams)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Xiaohongshu API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 Xiaohongshu 笔记评论
   */
  async getXiaohongshuNoteComments(
    noteId: string,
    lastCursor?: string
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    const queryParams: any = {
      note_id: noteId
    };

    if (lastCursor) {
      queryParams.lastCursor = lastCursor;
    }

    try {
      const response = await this.client.get(
        '/api/v1/xiaohongshu/web/get_note_comments',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Xiaohongshu API] 评论响应详情:', {
        code: data.code,
        message: data.message,
        commentCount: data.data?.comments?.length || 0,
        hasMore: data.data?.has_more,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `xiaohongshu_comments_${noteId}_${lastCursor || 'first'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      // 更新成本预估
      this.costEstimate += this.COST_PER_REQUEST;

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Xiaohongshu API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 Xiaohongshu 笔记评论
   */
  async getXiaohongshuNoteCommentsBatch(
    noteIds: string[],
    maxCommentsPerNote: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const noteId of noteIds) {
      try {
        const comments: any[] = [];
        let lastCursor = '';
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerNote) {
          const response = await this.getXiaohongshuNoteComments(
            noteId,
            lastCursor
          );

          if (response.code !== 200 || !response.data?.comments) {
            console.warn('[Xiaohongshu API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const commentList = response.data.comments;
          comments.push(...commentList);

          // 检查是否还有更多评论
          hasMore = response.data?.has_more === true;
          lastCursor = response.data?.cursor || '';

          console.log(`[Xiaohongshu API] 已获取 ${comments.length} 条评论，has_more: ${hasMore}`);

          // 避免请求过快
          await this.delay(300);
        }

        result.set(noteId, comments);
      } catch (error) {
        console.error(`[Xiaohongshu API] Failed to fetch comments for ${noteId}:`, error);
        result.set(noteId, []);
      }
    }

    return result;
  }
  // ==================== Twitter (X) API 方法 ====================

  /**
   * Twitter 搜索推文
   */
  async searchTwitterPosts(params: {
    keyword: string;
    cursor?: string;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keyword: params.keyword
    };

    if (params.cursor) {
      queryParams.cursor = params.cursor;
    }

    try {
      const response = await this.client.get(
        '/api/v1/twitter/web/fetch_search_timeline',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Twitter API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        cacheUrl: data.cache_url
      });

      // 存储缓存
      if (data.cache_url) {
        const cacheKey = `twitter_search_${JSON.stringify(params)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Twitter API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 Twitter 推文评论
   */
  async getTwitterTweetComments(
    tweetId: string,
    cursor?: string
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    const queryParams: any = {
      tweet_id: tweetId
    };

    if (cursor) {
      queryParams.cursor = cursor;
    }

    try {
      const response = await this.client.get(
        '/api/v1/twitter/web/fetch_tweet_comments',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Twitter API] 评论响应详情:', {
        code: data.code,
        message: data.message,
        commentCount: data.data?.comments?.length || 0,
        cacheUrl: data.cache_url
      });

      if (data.cache_url) {
        const cacheKey = `twitter_comments_${tweetId}_${cursor || 'first'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Twitter API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 Twitter 推文评论
   */
  async getTwitterTweetCommentsBatch(
    tweetIds: string[],
    maxCommentsPerTweet: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const tweetId of tweetIds) {
      try {
        const comments: any[] = [];
        let cursor = '';
        let hasMore = true;

        while (hasMore && comments.length < maxCommentsPerTweet) {
          const response = await this.getTwitterTweetComments(
            tweetId,
            cursor
          );

          if (response.code !== 200 || !response.data?.comments) {
            console.warn('[Twitter API] 评论响应格式不符合预期，停止获取评论');
            break;
          }

          const commentList = response.data.comments;
          comments.push(...commentList);

          cursor = response.data?.cursor || '';
          hasMore = cursor !== '' && commentList.length >= 10;

          console.log(`[Twitter API] 已获取 ${comments.length} 条评论，has_more: ${hasMore}`);

          await this.delay(300);
        }

        result.set(tweetId, comments);
      } catch (error) {
        console.error(`[Twitter API] Failed to fetch comments for ${tweetId}:`, error);
        result.set(tweetId, []);
      }
    }

    return result;
  }

  // ==================== Reddit API 方法 ====================

  /**
   * Reddit 搜索帖子
   */
  async searchRedditPosts(params: {
    keyword: string;
    sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
    time?: 'all' | 'year' | 'month' | 'week' | 'day' | 'hour';
    after?: string;
  }): Promise<any> {
    this.requestCount++;
    this.searchRequests++;

    const queryParams: any = {
      keyword: params.keyword,
      sort: params.sort || 'relevance',
      time: params.time || 'month'
    };

    if (params.after) {
      queryParams.after = params.after;
    }

    try {
      const response = await this.client.get(
        '/api/v1/reddit/search_posts',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Reddit API] 搜索响应详情:', {
        code: data.code,
        message: data.message,
        hasData: !!data.data,
        cacheUrl: data.cache_url
      });

      if (data.cache_url) {
        const cacheKey = `reddit_search_${JSON.stringify(params)}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Reddit API 搜索失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 获取 Reddit 帖子评论
   */
  async getRedditPostComments(
    postId: string,
    sort?: 'best' | 'top' | 'new' | 'controversial' | 'old'
  ): Promise<any> {
    this.requestCount++;
    this.commentsRequests++;

    const queryParams: any = {
      post_id: postId,
      sort: sort || 'top'
    };

    try {
      const response = await this.client.get(
        '/api/v1/reddit/fetch_post_comments',
        { params: queryParams }
      );

      const data = response.data;

      console.log('[Reddit API] 评论响应详情:', {
        code: data.code,
        message: data.message,
        commentCount: data.data?.comments?.length || 0,
        cacheUrl: data.cache_url
      });

      if (data.cache_url) {
        const cacheKey = `reddit_comments_${postId}_${sort || 'top'}`;
        this.setCache(cacheKey, data, data.cache_url);
      }

      this.costEstimate += this.COST_PER_REQUEST;
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Reddit API 评论获取失败: ${error.response?.status} ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * 批量获取 Reddit 帖子评论
   */
  async getRedditPostCommentsBatch(
    postIds: string[],
    maxCommentsPerPost: number
  ): Promise<Map<string, any[]>> {
    const result = new Map<string, any[]>();

    for (const postId of postIds) {
      try {
        const response = await this.getRedditPostComments(postId);

        if (response.code !== 200 || !response.data?.comments) {
          console.warn('[Reddit API] 评论响应格式不符合预期');
          result.set(postId, []);
          continue;
        }

        const comments = response.data.comments.slice(0, maxCommentsPerPost);
        result.set(postId, comments);

        console.log(`[Reddit API] 帖子 ${postId} 获取 ${comments.length} 条评论`);

        await this.delay(300);
      } catch (error) {
        console.error(`[Reddit API] Failed to fetch comments for ${postId}:`, error);
        result.set(postId, []);
      }
    }

    return result;
  }
}

/**
 * 创建默认的 TikHub API 客户端实例
 */
export function createTikHubClient(): TikHubAPIClient {
  const apiToken = process.env.TIKHUB_API_TOKEN || process.env.TIKHUB_API_KEY;

  if (!apiToken) {
    throw new Error(
      'TIKHUB_API_TOKEN or TIKHUB_API_KEY environment variable is required. ' +
      'Please set it in your .env.local file. ' +
      'Get your API token from: https://api.tikhub.io/'
    );
  }

  return new TikHubAPIClient({
    apiToken,
    useChinaDomain: process.env.TIKHUB_USE_CHINA_DOMAIN === 'true',
    timeout: parseInt(process.env.TIKHUB_TIMEOUT || '30000'),
    enableCache: process.env.TIKHUB_ENABLE_CACHE !== 'false'
  });
}

// 导出单例实例
let globalClient: TikHubAPIClient | null = null;

export function getGlobalTikHubClient(): TikHubAPIClient {
  if (!globalClient) {
    globalClient = createTikHubClient();
  }
  return globalClient;
}
