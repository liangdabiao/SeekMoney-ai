// 数据源工厂
import { TikHubServiceAdapter } from './tikhub-service';
import { TikTokServiceAdapter } from './tiktok-service';
import { BilibiliServiceAdapter } from './bilibili-service';
import { WeChatServiceAdapter } from './wechat-service';
import { YouTubeServiceAdapter } from './youtube-service';
import { XiaohongshuServiceAdapter } from './xiaohongshu-service';
import { TwitterServiceAdapter } from './twitter-service';
import { RedditServiceAdapter } from './reddit-service';
import { IDataSourceService, DataSourceType, DataSourceResult, DeepCrawlResult, DeepCrawlOptions, TikTokCrawlOptions } from './data-source-interface';

// 数据源工厂类
export class DataSourceFactory {
  static createDataSource(type: DataSourceType): IDataSourceService {
    switch (type) {
      case 'tikhub':
        return new TikHubServiceAdapter();
      case 'tiktok':
        return new TikTokServiceAdapter();
      case 'bilibili':
        return new BilibiliServiceAdapter();
      case 'wechat':
        return new WeChatServiceAdapter();
      case 'youtube':
        return new YouTubeServiceAdapter();
      case 'xiaohongshu':
        return new XiaohongshuServiceAdapter();
      case 'twitter':
        return new TwitterServiceAdapter();
      case 'reddit':
        return new RedditServiceAdapter();
      default:
        throw new Error(`不支持的数据源类型: ${type}`);
    }
  }

  static getSupportedSources(): DataSourceType[] {
    return ['tikhub', 'tiktok', 'bilibili', 'wechat', 'youtube', 'xiaohongshu', 'twitter', 'reddit'];
  }

  static getSourceDisplayName(type: DataSourceType): string {
    const names: Record<DataSourceType, string> = {
      'tikhub': 'douyin API',
      'tiktok': 'TikTok API',
      'bilibili': 'Bilibili API',
      'wechat': '微信视频号',
      'youtube': 'YouTube API',
      'xiaohongshu': '小红书 API',
      'twitter': 'X (Twitter) API',
      'reddit': 'Reddit API'
    };
    return names[type] || type;
  }

  static getSourceDescription(type: DataSourceType): string {
    const descriptions: Record<DataSourceType, string> = {
      'tikhub': 'TikHub API（稳定快速，按需付费）',
      'tiktok': 'TikTok API（国际版，按需付费）',
      'bilibili': 'Bilibili API（哔哩哔哩，按需付费）',
      'wechat': '微信视频号 API（按需付费）',
      'youtube': 'YouTube API（按需付费）',
      'xiaohongshu': '小红书 API（按需付费）',
      'twitter': 'X (Twitter) API（按需付费）',
      'reddit': 'Reddit API（按需付费）'
    };
    return descriptions[type] || '';
  }

  static supportsDeepCrawl(type: DataSourceType): boolean {
    return type === 'tikhub' || type === 'tiktok' || type === 'bilibili' ||
           type === 'wechat' || type === 'youtube' || type === 'xiaohongshu' ||
           type === 'twitter' || type === 'reddit';
  }

  // TikHub专用：创建TikHub数据源
  static createTikHubDataSource(): TikHubServiceAdapter {
    return new TikHubServiceAdapter();
  }

  // TikTok专用：创建TikTok数据源
  static createTikTokDataSource(): TikTokServiceAdapter {
    return new TikTokServiceAdapter();
  }

  // Bilibili专用：创建Bilibili数据源
  static createBilibiliDataSource(): BilibiliServiceAdapter {
    return new BilibiliServiceAdapter();
  }

  // WeChat专用：创建WeChat数据源
  static createWeChatDataSource(): WeChatServiceAdapter {
    return new WeChatServiceAdapter();
  }

  // YouTube专用：创建YouTube数据源
  static createYouTubeDataSource(): YouTubeServiceAdapter {
    return new YouTubeServiceAdapter();
  }

  // Xiaohongshu专用：创建Xiaohongshu数据源
  static createXiaohongshuDataSource(): XiaohongshuServiceAdapter {
    return new XiaohongshuServiceAdapter();
  }

  // Twitter专用：创建Twitter数据源
  static createTwitterDataSource(): TwitterServiceAdapter {
    return new TwitterServiceAdapter();
  }

  // Reddit专用：创建Reddit数据源
  static createRedditDataSource(): RedditServiceAdapter {
    return new RedditServiceAdapter();
  }
}
