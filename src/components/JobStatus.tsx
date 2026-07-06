"use client";

import { useTranslations } from 'next-intl';

type JobStage = 'init' | 'validating' | 'crawling' | 'clustering' | 'analyzing' | 'completed' | 'failed';

interface JobStatusProps {
  status: string;
  progressText: string;
  error?: string;
  progressStage?: JobStage;
  progressPercent?: number;
}

export default function JobStatus({ status, progressText, error, progressStage, progressPercent }: JobStatusProps) {
  const t = useTranslations('jobStatus');

  const getProgressBarWidth = (): string => {
    if (status === "completed") return "100%";
    if (status === "failed") return "0%";
    if (typeof progressPercent === 'number') {
      return `${Math.max(0, Math.min(100, progressPercent))}%`;
    }
    // 兜底：根据阶段返回估算百分比
    const stageMap: Record<JobStage, number> = {
      init: 5,
      validating: 10,
      crawling: 30,
      clustering: 55,
      analyzing: 85,
      completed: 100,
      failed: 0
    };
    if (progressStage && progressStage in stageMap) {
      return `${stageMap[progressStage]}%`;
    }
    return "10%";
  };

  const getStageLabel = (): string => {
    if (!progressStage) return '';
    try {
      return t(`stages.${progressStage}` as any);
    } catch {
      return progressStage;
    }
  };
  void getStageLabel; // 预留：未来 UI 可能按阶段显示标签

  if (status === "failed" && error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-red-800">{t('failed')}</span>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-amber-800">{t('completed')}</span>
            <p className="text-xs text-amber-600 mt-0.5">{t('checkResults')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-5 border border-[#E5E4DE]">
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </div>
        <span className="text-sm font-medium text-[#18181B] animate-pulse">{progressText}</span>
      </div>
      <div className="h-1 w-full bg-gray-200 rounded-full mt-4 overflow-hidden">
        <div
          className="h-full loading-bar rounded-full transition-all duration-500"
          style={{ width: getProgressBarWidth() }}
        ></div>
      </div>
    </div>
  );
}
