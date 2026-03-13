"use client";

import { useState } from "react";
import { useTranslations } from 'next-intl';

export type DataSourceType = 'tikhub' | 'tiktok' | 'bilibili' | 'wechat' | 'youtube' | 'xiaohongshu' | 'twitter' | 'reddit';

// TikTok/TikHub 配置接口
export interface TikTokConfig {
  enableComments: boolean;
  maxVideos: number;
  maxCommentsPerVideo: number;
  enableSubComments: boolean;
}

interface AnalysisFormProps {
  onSubmit: (
    keywords: string[],
    dataSource: DataSourceType,
    deepCrawl: boolean,
    maxVideos: number,
    tiktokConfig?: TikTokConfig
  ) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onSubmit, isLoading }: AnalysisFormProps) {
  const t = useTranslations('form');
  const [keywords, setKeywords] = useState("");
  const [dataSource, setDataSource] = useState<DataSourceType>('tiktok');
  const [deepCrawl, setDeepCrawl] = useState(false);
  const [maxVideos, setMaxVideos] = useState(5);

  // TikTok/TikHub 通用配置
  const [tiktokConfig, setTiktokConfig] = useState<TikTokConfig>({
    enableComments: true,
    maxVideos: 15,
    maxCommentsPerVideo: 20,
    enableSubComments: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!keywords.trim()) {
      return;
    }

    // 将输入的关键词按逗号分割，去除空白，过滤空值
    const keywordArray = keywords
      .split(",")
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);

    if (keywordArray.length > 0) {
      // TikTok 和 TikHub 使用相同的配置
      onSubmit(keywordArray, dataSource, tiktokConfig.enableComments, tiktokConfig.maxVideos, tiktokConfig);
    }
  };

  const getSourceDisplayName = () => {
    switch (dataSource) {
      case 'tikhub': return t('dataSource.tikhub');
      case 'tiktok': return t('dataSource.tiktok');
      case 'bilibili': return t('dataSource.bilibili');
      case 'wechat': return t('dataSource.wechat');
      case 'youtube': return t('dataSource.youtube');
      case 'xiaohongshu': return t('dataSource.xiaohongshu');
      case 'twitter': return t('dataSource.twitter');
      case 'reddit': return t('dataSource.reddit');
      default: return dataSource;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 数据源选择 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('dataSource.label')}
        </label>
        <div className="relative">
          <select
            id="dataSource"
            value={dataSource}
            onChange={(e) => {
              const newSource = e.target.value as DataSourceType;
              setDataSource(newSource);
            }}
            disabled={isLoading}
            className="w-full bg-[#FBFBF9] text-[#18181B] font-medium py-3 px-4 rounded-xl appearance-none border border-transparent focus:border-[#18181B] focus:bg-white focus:ring-0 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="tiktok">🌟 TikTok</option>
            <option value="tikhub">▶️ 抖音</option>
            <option value="bilibili">📺 Bilibili</option>
            <option value="wechat">💬 微信视频号</option>
            <option value="youtube">▶️ YouTube</option>
            <option value="xiaohongshu">📕 小红书</option>
            <option value="twitter">🐦 X (Twitter)</option>
            <option value="reddit">🤖 Reddit</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* 关键词输入 */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {t('keywords.label')}
        </label>
        <input
          type="text"
          id="keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          disabled={isLoading}
          placeholder={t('keywords.placeholder')}
          className="w-full bg-[#FBFBF9] text-[#18181B] font-medium py-3 px-4 rounded-xl border border-transparent outline-none focus:bg-amber-50 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 placeholder-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* TikHub 配置面板 */}
      {dataSource === 'tikhub' && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl space-y-4 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">{t('tikhubConfig.title')}</div>
              <div className="text-xs text-gray-600 mb-3">{t('tikhubConfig.description')}</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {t('tikhubConfig.statusAvailable')}
                </span>
                <span className="text-gray-500">{t('tikhubConfig.pricing')}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-blue-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">{t('tikhubConfig.commentsNote')}</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </div>
            </label>

            {/* 视频数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>30</span>
              </div>
            </div>

            {/* 每视频评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>50</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-blue-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-blue-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TikTok 配置面板 */}
      {dataSource === 'tiktok' && (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl space-y-4 border border-purple-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">TikTok API 配置</div>
              <div className="text-xs text-gray-600 mb-3">国际版 TikTok 数据源，基于 TikHub API</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  API 服务可用
                </span>
                <span className="text-gray-500">按请求计费，约 ¥0.01/次</span>
              </div>
            </div>
          </div>

          <div className="border-t border-purple-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">获取评论数据可提高分析准确性</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </div>
            </label>

            {/* 视频数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* 每视频评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-purple-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-purple-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bilibili 配置面板 */}
      {dataSource === 'bilibili' && (
        <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl space-y-4 border border-pink-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM17.693 15.36c.533 0 .84-.249.84-.747V8.587c0-.498-.307-.747-.84-.747h-.933c-.533 0-.84.249-.84.747v6.026c0 .498.307.747.84.747zm-4.8 0c.533 0 .84-.249.84-.747V8.587c0-.498-.307-.747-.84-.747h-.933c-.533 0-.84.249-.84.747v6.026c0 .498.307.747.84.747zm-4.8 0c.533 0 .84-.249.84-.747V8.587c0-.498-.307-.747-.84-.747h-.933c-.533 0-.84.249-.84.747v6.026c0 .498.307.747.84.747z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">Bilibili API 配置</div>
              <div className="text-xs text-gray-600 mb-3">哔哩哔哩数据源，基于 TikHub API</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  API 服务可用
                </span>
                <span className="text-gray-500">按请求计费，约 ¥0.01/次</span>
              </div>
            </div>
          </div>

          <div className="border-t border-pink-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">获取弹幕/评论数据可提高分析准确性</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
              </div>
            </label>

            {/* 视频数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="42"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>42</span>
              </div>
            </div>

            {/* 每视频评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>50</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-pink-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-pink-600">
                  ~¥{((tiktokConfig.maxVideos / 42 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WeChat 配置面板 */}
      {dataSource === 'wechat' && (
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl space-y-4 border border-emerald-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">微信视频号 API 配置</div>
              <div className="text-xs text-gray-600 mb-3">微信视频号数据源，基于 TikHub API</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  API 服务可用
                </span>
                <span className="text-gray-500">按请求计费，约 ¥0.01/次</span>
              </div>
            </div>
          </div>

          <div className="border-t border-emerald-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">获取评论数据可提高分析准确性</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </label>

            {/* 视频数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>20</span>
              </div>
            </div>

            {/* 每视频评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>30</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-emerald-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-emerald-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube 配置面板 */}
      {dataSource === 'youtube' && (
        <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl space-y-4 border border-red-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">YouTube API 配置</div>
              <div className="text-xs text-gray-600 mb-3">YouTube 数据源，基于 TikHub API</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  API 服务可用
                </span>
                <span className="text-gray-500">按请求计费，约 ¥0.01/次</span>
              </div>
            </div>
          </div>

          <div className="border-t border-red-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">获取评论数据可提高分析准确性</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </div>
            </label>

            {/* 视频数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {/* 每视频评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-red-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-red-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Xiaohongshu 配置面板 */}
      {dataSource === 'xiaohongshu' && (
        <div className="p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl space-y-4 border border-rose-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">小红书 API 配置</div>
              <div className="text-xs text-gray-600 mb-3">小红书数据源，基于 TikHub API</div>

              {/* API 状态指示 */}
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  API 服务可用
                </span>
                <span className="text-gray-500">按请求计费，约 ¥0.01/次</span>
              </div>
            </div>
          </div>

          <div className="border-t border-rose-200 pt-4 space-y-4">
            {/* 爬取评论开关 */}
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">获取评论数据可提高分析准确性</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
              </div>
            </label>

            {/* 笔记数量滑块 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.videos')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>30</span>
              </div>
            </div>

            {/* 每笔记评论数滑块 */}
            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}

            {/* 成本预估 */}
            <div className="pt-2 border-t border-rose-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-rose-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Twitter 配置面板 */}
      {dataSource === 'twitter' && (
        <div className="p-4 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl space-y-4 border border-sky-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">X (Twitter) API 配置</div>
              <div className="text-xs text-gray-600 mb-3">X (Twitter) 数据源，基于 TikHub API</div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {t('tikhubConfig.statusAvailable')}
                </span>
                <span className="text-gray-500">{t('tikhubConfig.pricing')}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-sky-200 pt-4 space-y-4">
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">{t('tikhubConfig.commentsNote')}</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
              </div>
            </label>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.posts')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>50</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-sky-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-sky-600">
                  ~¥{((tiktokConfig.maxVideos / 20 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reddit 配置面板 */}
      {dataSource === 'reddit' && (
        <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl space-y-4 border border-orange-100">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#18181B] mb-1">Reddit API 配置</div>
              <div className="text-xs text-gray-600 mb-3">Reddit 数据源，基于 TikHub API</div>

              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {t('tikhubConfig.statusAvailable')}
                </span>
                <span className="text-gray-500">{t('tikhubConfig.pricing')}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-orange-200 pt-4 space-y-4">
            <label className="flex items-center justify-between group cursor-pointer">
              <div className="pointer-events-none">
                <span className="block text-sm font-medium text-[#18181B]">{t('douyinNewConfig.enableComments')}</span>
                <span className="text-xs text-gray-500">{t('tikhubConfig.commentsNote')}</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={tiktokConfig.enableComments}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    enableComments: e.target.checked
                  }))}
                  disabled={isLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </div>
            </label>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.videoCount')}</label>
                <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                  {tiktokConfig.maxVideos} {t('units.posts')}
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                value={tiktokConfig.maxVideos}
                onChange={(e) => setTiktokConfig(prev => ({
                  ...prev,
                  maxVideos: parseInt(e.target.value)
                }))}
                disabled={isLoading}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>

            {tiktokConfig.enableComments && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-600 uppercase">{t('douyinNewConfig.commentsPerVideo')}</label>
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded shadow-sm">
                    {tiktokConfig.maxCommentsPerVideo} {t('units.comments')}
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={tiktokConfig.maxCommentsPerVideo}
                  onChange={(e) => setTiktokConfig(prev => ({
                    ...prev,
                    maxCommentsPerVideo: parseInt(e.target.value)
                  }))}
                  disabled={isLoading}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>10</span>
                  <span>100</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-orange-200">
              <div className="text-xs text-gray-600">
                <span className="font-medium">{t('tikhubConfig.costEstimate')}:</span>
                <span className="ml-2 font-mono text-orange-600">
                  ~¥{((tiktokConfig.maxVideos / 25 * 0.01 + (tiktokConfig.enableComments ? tiktokConfig.maxVideos * (tiktokConfig.maxCommentsPerVideo / 20) * 0.01 : 0)).toFixed(2))}
                </span>
                <span className="text-gray-400 ml-1">{t('tikhubConfig.perAnalysis')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isLoading || !keywords.trim()}
        className="w-full bg-[#18181B] text-white font-bold py-4 rounded-xl shadow-lg shadow-[#18181B]/20 hover:scale-[1.02] hover:shadow-[#18181B]/30 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>{t('submit.analyzing')}</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('submit.start')}
          </>
        )}
      </button>

      {/* 提示信息 */}
      {keywords.trim() && (
        <div className="text-xs text-gray-500 text-center">
          {t('hint.from')} <strong className="text-[#18181B]">{getSourceDisplayName()}</strong>
          <span className={
            dataSource === 'tiktok' ? "text-purple-600" :
            dataSource === 'bilibili' ? "text-pink-600" :
            dataSource === 'wechat' ? "text-emerald-600" :
            dataSource === 'youtube' ? "text-red-600" :
            dataSource === 'xiaohongshu' ? "text-rose-600" :
            dataSource === 'twitter' ? "text-sky-600" :
            dataSource === 'reddit' ? "text-orange-600" :
            "text-blue-600"
          }>
            {' '}{t('hint.videos', { count: tiktokConfig.maxVideos })}
            {tiktokConfig.enableComments && t('hint.comments', { count: tiktokConfig.maxCommentsPerVideo })}
          </span>
          {' '}{t('hint.analyze')}
        </div>
      )}
    </form>
  );
}
