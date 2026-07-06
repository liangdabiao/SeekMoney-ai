// Xiaohongshu (小红书) 数据源服务
// 实现 IDataSourceService 接口，将 Xiaohongshu API 数据转换为系统通用格式

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
 * Xiaohongshu 服务选项
 */
export interface XiaohongshuServiceOptions {
  maxNotes?: number;
  maxCommentsPerNote?: number;
  enableCache?: boolean;
  requestDelay?: number; // 请求间隔（毫秒）
}

/**
 * Xiaohongshu 数据源服务
 */
export class XiaohongshuService implements IDataSourceService {
  private client: TikHubAPIClient;
  private defaultOptions: XiaohongshuServiceOptions;

  constructor(client?: TikHubAPIClient, options?: XiaohongshuServiceOptions) {
    this.client = client || createTikHubClient();
    this.defaultOptions = {
      maxNotes: 20,
      maxCommentsPerNote: 20,
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
    console.log(`[Xiaohongshu Service] 开始搜索关键词: ${keyword}, 限制: ${limit}`);

    const rawTexts: string[] = [];
    const videos: any[] = [];
    let totalFetched = 0;

    try {
      // 分页搜索，直到获取足够的数据或没有更多结果
      while (totalFetched < limit) {
        console.log(`[Xiaohongshu Service] 搜索第 ${Math.floor(totalFetched / 20) + 1} 页`);

        const searchResult = await this.client['searchXiaohongshuNotes']({
          keyword,
          page: Math.floor(totalFetched / 20) + 1,
          sort: 'general',
          noteType: '_0'
        });

        console.log('[Xiaohongshu Service] API 响应 code:', searchResult.code);

        if (searchResult.code !== 200) {
          throw new Error(`Xiaohongshu API 搜索失败: ${searchResult.message}`);
        }

        // Xiaohongshu API 响应格式: { code, data: { code, data: { items: [...] } } }
        const innerData = searchResult.data?.data;
        const itemsList = innerData?.items || [];

        if (!Array.isArray(itemsList)) {
          console.warn('[Xiaohongshu Service] 未找到有效的数据数组');
          break;
        }

        console.log(`[Xiaohongshu Service] 第 ${Math.floor(totalFetched / 20) + 1} 页获取到 ${itemsList.length} 个结果`);

        if (itemsList.length === 0) {
          console.warn('[Xiaohongshu Service] 没有更多结果，停止分页');
          break;
        }

        // 处理当前页的结果
        const remainingLimit = limit - totalFetched;
        const pageItems = itemsList.slice(0, remainingLimit);

        for (const item of pageItems) {
          const note = this.convertSearchResultToNote(item, keyword);
          if (note) {
            videos.push(note);

            // 提取文本内容
            if (note.title && note.title.length > 5) {
              rawTexts.push(note.title);
            }
            if (note.description && note.description.length > 10 && note.description !== note.title) {
              rawTexts.push(note.description);
            }
            totalFetched++;
          }
        }

        console.log(`[Xiaohongshu Service] 当前页处理结果: 累计笔记 ${videos.length}, 累计文本 ${rawTexts.length}`);

        // 如果当前页的结果少于请求数量，说明没有更多结果了
        if (itemsList.length < 20) {
          break;
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 去重
      const uniqueTexts = [...new Set(rawTexts)].filter(t => t.trim().length > 5);

      console.log(`[Xiaohongshu Service] 搜索完成: 获取 ${videos.length} 个笔记, ${uniqueTexts.length} 条文本`);

      return {
        rawTexts: uniqueTexts,
        videos,
        metadata: {
          source: 'xiaohongshu',
          keyword,
          totalResults: videos.length,
          returnedResults: videos.length,
          usage: this.client['getUsageStats']()
        }
      };
    } catch (error) {
      console.error('[Xiaohongshu Service] 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 深度搜索（含评论）
   */
  async searchWithComments(keyword: string, options: DeepCrawlOptions): Promise<DeepCrawlResult> {
    console.log(`[Xiaohongshu Service] 开始深度搜索: ${keyword}`);

    // 合并选项
    const maxNotes = options.maxVideos || this.defaultOptions.maxNotes!;
    const maxCommentsPerNote = options.maxCommentsPerVideo || this.defaultOptions.maxCommentsPerNote!;

    // 先搜索笔记
    const { videos: noteList } = await this.searchAndFetch(keyword, maxNotes);

    if (noteList.length === 0) {
      return {
        rawTexts: [],
        videos: [],
        allComments: [],
        videoCount: 0,
        commentCount: 0
      };
    }

    console.log(`[Xiaohongshu Service] 开始获取 ${noteList.length} 个笔记的评论`);

    // 获取评论
    const allComments: any[] = [];
    const rawTexts: string[] = [];
    const commentTexts: string[] = [];

    // 从笔记结果中提取文本
    for (const note of noteList) {
      if (note.title && note.title.length > 5) {
        rawTexts.push(note.title);
      }
      if (note.description && note.description.length > 10) {
        rawTexts.push(note.description);
      }
    }

    // 批量获取评论
    const noteIds = noteList
      .map(v => v.id)
      .filter((id): id is string => !!id);

    const commentsMap = await this.client['getXiaohongshuNoteCommentsBatch'](noteIds, maxCommentsPerNote);

    // 处理评论数据
    for (const note of noteList) {
      if (!note.id) continue;

      const comments = commentsMap.get(note.id) || [];
      const limitedComments = comments.slice(0, maxCommentsPerNote);

      for (const comment of limitedComments) {
        const mappedComment = this.convertCommentToData(comment, note.title);
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

    console.log(`[Xiaohongshu Service] 深度搜索完成: ${noteList.length} 个笔记, ${allComments.length} 条评论, ${allTexts.length} 条文本`);

    return {
      rawTexts: allTexts,
      videos: noteList,
      allComments,
      videoCount: noteList.length,
      commentCount: allComments.length
    };
  }

  /**
   * 检查服务可用性
   */
  async checkAvailability(): Promise<boolean> {
    // 对于 Xiaohongshu，我们总是返回 true，让实际请求时再处理错误
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
   * 将 Xiaohongshu 搜索结果转换为笔记数据格式
   */
  private convertSearchResultToNote(item: any, sourceKeyword: string): any {
    if (!item.note || !item.note.id) {
      console.warn('[Xiaohongshu Service] convertSearchResultToNote: item 缺少 id 字段');
      return null;
    }

    const note = item.note;

    // 提取缩略图
    const imagesList = note.images_list || [];
    const firstImage = imagesList[0] || {};
    const thumbUrl = firstImage.url_size_large || firstImage.url || '';

    // 提取描述（截取前500字符）
    const desc = note.desc || '';
    const description = desc.length > 500 ? desc.substring(0, 500) : desc;

    // 构建小红书笔记链接
    const noteUrl = `https://www.xiaohongshu.com/explore/${note.id}`;

    // 转换时间戳（小红书使用秒级时间戳）
    const createTime = note.timestamp
      ? new Date(note.timestamp * 1000).toISOString()
      : new Date().toISOString();

    return {
      title: note.title || '',
      description: description,
      author: note.user?.nickname || '',
      video_url: noteUrl,
      publish_time: createTime,
      likes: note.liked_count?.toString() || '0',
      collected_at: new Date().toISOString(),
      comment_count: note.comments_count || 0,
      // 扩展字段
      id: note.id,
      type: note.type || 'normal',
      userid: note.user?.userid || '',
      nickname: note.user?.nickname || '',
      user_images: note.user?.images || '',
      // 媒体信息
      images_list: imagesList,
      thumb_url: thumbUrl,
      cover_image_index: note.cover_image_index || 0,
      // 互动数据
      liked_count: note.liked_count || 0,
      collected_count: note.collected_count || 0,
      share_count: note.shared_count || 0,
      // 来源
      source_keyword: sourceKeyword
    };
  }

  /**
   * 将 Xiaohongshu 评论转换为数据格式
   */
  private convertCommentToData(comment: any, noteTitle: string): any {
    // 转换时间戳
    const createTime = comment.time
      ? new Date(comment.time * 1000).toISOString()
      : new Date().toISOString();

    const content = comment.content || '';

    return {
      video_title: noteTitle,
      comment_text: content,
      username: comment.user?.nickname || '',
      likes: comment.like_count?.toString() || '0',
      // 扩展字段
      comment_id: comment.id,
      userid: comment.user?.userid || '',
      nickname: comment.user?.nickname || '',
      user_images: comment.user?.images || '',
      like_count: comment.like_count || 0,
      sub_comment_count: comment.sub_comment_count || 0,
      create_time: createTime,
      note_id: comment.note_id
    };
  }
}

/**
 * Xiaohongshu 服务适配器（用于工厂模式）
 */
export class XiaohongshuServiceAdapter implements IDataSourceService {
  private service: XiaohongshuService;

  constructor(options?: XiaohongshuServiceOptions) {
    this.service = new XiaohongshuService(undefined, options);
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
   * 获取使用统计（Xiaohongshu 特有方法）
   */
  getUsageStats() {
    return this.service.getUsageStats();
  }

  /**
   * 清除缓存（Xiaohongshu 特有方法）
   */
  clearCache(): void {
    this.service.clearCache();
  }

  /**
   * 获取缓存统计（Xiaohongshu 特有方法）
   */
  getCacheStats() {
    return this.service.getCacheStats();
  }
}
