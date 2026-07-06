// ==================== 语义聚类服务 ====================
// 完整实现：数据清洗 + Embedding + DBSCAN 聚类

import { createEmbeddingProvider, createConfigFromEnv, IEmbeddingProvider } from './EmbeddingProvider';
import { DataCleaner } from './DataCleaner';
import { DBSCAN } from 'density-clustering';
import { similarity } from 'ml-distance';

// 余弦距离 = 1 - 余弦相似度
const cosineDistance = (a: number[], b: number[]) => 1 - similarity.cosine(a, b);

// ==================== 类型定义 ====================

export interface ClusterResult {
  representative: string;
  texts: string[];
  indices: number[];
  size: number;
  avgQuality: number;
  keywords: string[];
}

export interface ClusteringOptions {
  eps?: number; // DBSCAN 邻域半径 (余弦距离)
  minSamples?: number; // 最小样本数
  minQuality?: number; // 最小质量分数
  maxClusters?: number; // 最大簇数量
  enableCleaning?: boolean; // 是否启用数据清洗
}

export interface ClusteringResult {
  clusters: ClusterResult[];
  noise: string[];
  noiseCount: number;
  totalTexts: number;
  cleanedTexts: number;
  clusteredTexts: number;
  clusterCount: number;
  provider: string;
  model: string;
  dimension: number;
  duration: number; // 毫秒
  cost: number; // CNY
  stats: {
    avgClusterSize: number;
    maxClusterSize: number;
    minClusterSize: number;
    silhouetteScore?: number;
  };
}

export interface ProcessStep {
  name: string;
  duration: number;
  details?: any;
}

// ==================== 聚类服务 ====================

export class ClusteringService {
  private embeddingProvider: IEmbeddingProvider;
  private dataCleaner: DataCleaner;
  private defaultOptions: ClusteringOptions;
  private steps: ProcessStep[] = [];

  constructor(
    embeddingProvider?: IEmbeddingProvider,
    options?: ClusteringOptions
  ) {
    this.embeddingProvider = embeddingProvider || createEmbeddingProvider(createConfigFromEnv());
    this.dataCleaner = new DataCleaner();
    this.defaultOptions = {
      eps: 0.3, // 余弦距离阈值 (越小越严格)
      minSamples: 3, // 最小簇大小
      minQuality: 0.5, // 最小质量分数
      maxClusters: 50, // 最大簇数量
      enableCleaning: true,
      ...options
    };
  }

  /**
   * 完整的语义聚类流程
   */
  async cluster(texts: string[], options?: ClusteringOptions): Promise<ClusteringResult> {
    const startTime = Date.now();
    this.steps = [];

    const opts = { ...this.defaultOptions, ...options };

    console.log(`[ClusteringService] 开始处理 ${texts.length} 条文本`);
    console.log(`[ClusteringService] 提供商: ${this.embeddingProvider.getName()} | 模型: ${this.embeddingProvider.getModel()}`);

    // Step 1: 数据清洗
    let cleanTexts = texts;
    let cleanScores: number[] = [];
    const originalCount = texts.length;

    if (opts.enableCleaning) {
      const cleanResult = this.step('数据清洗', () => {
        return this.dataCleaner.clean(texts);
      });
      cleanTexts = cleanResult.texts;
      cleanScores = cleanResult.scores;
      console.log(`[ClusteringService] 清洗后: ${cleanTexts.length}/${originalCount} 条保留`);
    }

    if (cleanTexts.length < opts.minSamples!) {
      console.warn(`[ClusteringService] 清洗后文本数量 (${cleanTexts.length}) 小于最小样本数 (${opts.minSamples})`);
      return this.createEmptyResult(originalCount, cleanTexts.length, Date.now() - startTime);
    }

    // Step 2: 获取 Embeddings
    const embeddings = await this.stepAsync('获取 Embeddings', async () => {
      return await this.embeddingProvider.getEmbeddings(cleanTexts);
    });

    // Step 3: DBSCAN 聚类
    const dbscanResult = this.step('DBSCAN 聚类', () => {
      return this.runDBSCAN(embeddings, opts.eps!, opts.minSamples!);
    });

    // Step 5: 整理结果
    const clusters = this.step('整理结果', () => {
      return this.organizeClusters(
        dbscanResult.clusters,
        cleanTexts,
        cleanScores,
        opts.maxClusters!
      );
    });

    const duration = Date.now() - startTime;
    const providerStats = this.embeddingProvider.getStats();

    const result: ClusteringResult = {
      clusters,
      noise: dbscanResult.noise.map((idx: number) => cleanTexts[idx]),
      noiseCount: dbscanResult.noise.length,
      totalTexts: originalCount,
      cleanedTexts: cleanTexts.length,
      clusteredTexts: cleanTexts.length - dbscanResult.noise.length,
      clusterCount: clusters.length,
      provider: this.embeddingProvider.getName(),
      model: this.embeddingProvider.getModel(),
      dimension: this.embeddingProvider.getDimension(),
      duration,
      cost: providerStats.estimatedCost,
      stats: {
        avgClusterSize: clusters.length > 0
          ? Math.round(clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length)
          : 0,
        maxClusterSize: clusters.length > 0 ? Math.max(...clusters.map(c => c.size)) : 0,
        minClusterSize: clusters.length > 0 ? Math.min(...clusters.map(c => c.size)) : 0
      }
    };

    this.logResult(result);
    return result;
  }

  /**
   * 运行同步步骤并记录
   */
  private step<T>(name: string, fn: () => T): T {
    const start = Date.now();
    const result = fn();
    const duration = Date.now() - start;
    this.steps.push({ name, duration });
    console.log(`[ClusteringService] ${name}: ${duration}ms`);
    return result;
  }

  /**
   * 运行异步步骤并记录
   */
  private stepAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    return new Promise(async (resolve) => {
      const start = Date.now();
      const result = await fn();
      const duration = Date.now() - start;
      this.steps.push({ name, duration });
      console.log(`[ClusteringService] ${name}: ${duration}ms`);
      resolve(result);
    });
  }

  /**
   * 运行 DBSCAN 算法
   * density-clustering 的 run 方法: run(dataset, epsilon, minPts, distanceFunction)
   */
  private runDBSCAN(embeddings: number[][], eps: number, minSamples: number) {
    const dbscan = new DBSCAN();

    // 使用余弦距离函数
    // 注意: density-clustering 的 run 方法期望距离函数返回 distance, 不是 similarity
    const clusters = dbscan.run(embeddings, eps, minSamples, cosineDistance);
    const noise = dbscan.noise || [];

    console.log(`[ClusteringService] 发现 ${clusters.length} 个簇, ${noise.length} 个噪声点`);

    return { clusters, noise };
  }

  /**
   * 整理聚类结果
   */
  private organizeClusters(
    clusters: number[][],
    texts: string[],
    scores: number[],
    maxClusters: number
  ): ClusterResult[] {
    const results: ClusterResult[] = [];

    for (let i = 0; i < clusters.length && i < maxClusters; i++) {
      const cluster = clusters[i];
      const clusterTexts = cluster.map(idx => texts[idx]);
      const clusterScores = cluster.map(idx => scores[idx] || 0);

      // 选择代表性文本 (最长且包含白名单关键词)
      const representative = this.selectRepresentative(clusterTexts);

      // 提取关键词 (简单版)
      const keywords = this.extractKeywords(clusterTexts);

      results.push({
        representative,
        texts: clusterTexts,
        indices: cluster,
        size: cluster.length,
        avgQuality: clusterScores.reduce((a, b) => a + b, 0) / clusterScores.length,
        keywords
      });
    }

    // 按簇大小排序
    return results.sort((a, b) => b.size - a.size);
  }

  /**
   * 选择代表性文本
   */
  private selectRepresentative(texts: string[]): string {
    if (texts.length === 0) return '';

    // 优先选择包含白名单关键词的文本
    const cleaner = new DataCleaner();
    const withKeyword = texts.filter(t => cleaner.hasWhitelistKeyword(t));
    if (withKeyword.length > 0) {
      return withKeyword.sort((a, b) => b.length - a.length)[0];
    }

    // 否则选择最长的文本
    return texts.sort((a, b) => b.length - a.length)[0];
  }

  /**
   * 提取关键词 (简单实现)
   */
  private extractKeywords(texts: string[]): string[] {
    const keywords = new Set<string>();
    const commonWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这'];

    for (const text of texts) {
      // 提取 2-4 字的词语
      const words = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      for (const word of words) {
        if (!commonWords.includes(word) && word.length >= 2) {
          keywords.add(word);
        }
      }
    }

    return Array.from(keywords).slice(0, 5);
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(totalTexts: number, cleanedTexts: number, duration: number): ClusteringResult {
    return {
      clusters: [],
      noise: [],
      noiseCount: 0,
      totalTexts,
      cleanedTexts,
      clusteredTexts: 0,
      clusterCount: 0,
      provider: this.embeddingProvider.getName(),
      model: this.embeddingProvider.getModel(),
      dimension: this.embeddingProvider.getDimension(),
      duration,
      cost: 0,
      stats: {
        avgClusterSize: 0,
        maxClusterSize: 0,
        minClusterSize: 0
      }
    };
  }

  /**
   * 记录结果日志
   */
  private logResult(result: ClusteringResult): void {
    console.log('\n[ClusteringService] ===== 聚类结果 =====');
    console.log(`[ClusteringService] 原始文本: ${result.totalTexts} 条`);
    console.log(`[ClusteringService] 清洗后: ${result.cleanedTexts} 条`);
    console.log(`[ClusteringService] 聚类数: ${result.clusterCount} 个`);
    console.log(`[ClusteringService] 噪声点: ${result.noiseCount} 个`);
    console.log(`[ClusteringService] 平均簇大小: ${result.stats.avgClusterSize}`);
    console.log(`[ClusteringService] 用时: ${result.duration}ms`);
    console.log(`[ClusteringService] 成本: ¥${result.cost.toFixed(4)}`);
    console.log(`[ClusteringService] 提供商: ${result.provider} (${result.model})`);
    console.log('[ClusteringService] 步骤耗时:');
    for (const step of this.steps) {
      console.log(`[ClusteringService]   - ${step.name}: ${step.duration}ms`);
    }
    console.log('[ClusteringService] ======================\n');
  }

  /**
   * 获取处理步骤
   */
  getSteps(): ProcessStep[] {
    return [...this.steps];
  }

  /**
   * 切换 Embedding 提供商
   */
  switchProvider(provider: IEmbeddingProvider): void {
    this.embeddingProvider = provider;
    console.log(`[ClusteringService] 已切换到 ${provider.getName()}`);
  }

  /**
   * 获取提供商信息
   */
  getProviderInfo() {
    return {
      name: this.embeddingProvider.getName(),
      model: this.embeddingProvider.getModel(),
      dimension: this.embeddingProvider.getDimension(),
      costPerMillion: this.embeddingProvider.getCostPerMillionTokens()
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.embeddingProvider.getStats();
  }

  /**
   * 获取数据清洗器
   */
  getDataCleaner(): DataCleaner {
    return this.dataCleaner;
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建聚类服务
 */
export function createClusteringService(options?: {
  providerType?: 'openai' | 'zhipuai' | 'auto';
  embeddingOptions?: ClusteringOptions;
}): ClusteringService {
  const providerType = options?.providerType || 'auto';

  let provider: IEmbeddingProvider;
  if (providerType === 'auto') {
    provider = createEmbeddingProvider(createConfigFromEnv());
  } else {
    provider = createEmbeddingProvider({
      type: providerType,
      [providerType]: {
        apiKey: providerType === 'openai'
          ? process.env.OPENAI_API_KEY!
          : process.env.GLM_API_KEY!
      }
    });
  }

  return new ClusteringService(provider, options?.embeddingOptions);
}

// ==================== 导出 ====================

export default ClusteringService;
