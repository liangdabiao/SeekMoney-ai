// ==================== 聚类分析服务 - TypeScript 版本 ====================
// 使用新的 TypeScript 语义聚类，替代 Python 版本
// 基于: density-clustering + ml-distance + OpenAI/智谱AI Embedding

import { ClusteringService as TSClusteringService, createClusteringService } from './clustering/ClusteringService';

export interface SemanticCluster {
  representative_text: string;
  size: number;
  texts: string[];
  keywords?: string[];
}

export interface ClusteringResult {
  success: boolean;
  clusters: SemanticCluster[];
  noise: string[];
  noiseCount: number;
  total_clusters: number;
  total_texts: number;
  clustered_texts?: number;
  provider?: string;
  model?: string;
  duration?: number;
  cost?: number;
  error?: string;
}

export interface ClusterResult {
  id: string;
  size: number;
  analysis: {
    one_line_pain: string;
    paid_interest: "High" | "Medium" | "Low";
    rationale: string;
    potential_product: string;

    // 新增深度分析维度
    pain_depth?: {
      surface_pain: string;
      root_causes: string[];
      user_scenarios: string[];
      emotional_intensity: number;
    };

    market_landscape?: {
      existing_solutions: Array<{
        name: string;
        limitation: string;
      }>;
      unmet_needs: string[];
      opportunity: string;
    };

    mvp_plan?: {
      core_features: string[];
      validation_hypotheses: Array<{
        hypothesis: string;
        test_method: string;
      }>;
      first_users: string;
      timeline: string;
      estimated_cost: string;
    };

    keyword_relevance?: number;
  };
  representative_texts: string[];
  priority_score?: {
    demand_intensity: number;
    market_size: number;
    competition: number;
    overall: number;
    level: 'High' | 'Medium' | 'Low';
  };
}

/**
 * 聚类服务 - TypeScript 版本
 */
export class ClusteringService {
  private tsService: TSClusteringService;

  constructor() {
    // 使用新的 TypeScript 聚类服务
    this.tsService = createClusteringService({
      providerType: 'auto', // 自动选择提供商 (OpenAI 优先)
      embeddingOptions: {
        eps: 0.3,        // 余弦距离阈值
        minSamples: 3,   // 最小簇大小
        enableCleaning: true // 启用数据清洗
      }
    });
  }

  /**
   * 调用 TypeScript 语义聚类服务
   * 使用 OpenAI/智谱AI Embedding + DBSCAN 算法
   */
  public async clusterTextsWithEmbeddings(
    texts: string[],
    options: {
      eps?: number;
      minSamples?: number;
      minLength?: number;
    } = {}
  ): Promise<ClusteringResult> {
    try {
      console.log(`[TS Clustering] 开始聚类 ${texts.length} 条文本`);

      const result = await this.tsService.cluster(texts, {
        eps: options.eps,
        minSamples: options.minSamples,
        enableCleaning: true
      });

      // 转换为旧格式
      const clusters: SemanticCluster[] = result.clusters.map(c => ({
        representative_text: c.representative,
        size: c.size,
        texts: c.texts,
        keywords: c.keywords
      }));

      console.log(`[TS Clustering] 聚类完成: ${clusters.length} 个簇, ${result.noiseCount} 个噪声点`);

      return {
        success: true,
        clusters,
        noise: result.noise,
        noiseCount: result.noiseCount,
        total_clusters: clusters.length,
        total_texts: result.cleanedTexts,
        clustered_texts: result.clusteredTexts,
        provider: result.provider,
        model: result.model,
        duration: result.duration,
        cost: result.cost
      };

    } catch (error: any) {
      console.error('[TS Clustering] 聚类失败:', error.message);
      return {
        success: false,
        clusters: [],
        noise: [],
        noiseCount: 0,
        total_clusters: 0,
        total_texts: texts.length,
        error: error.message
      };
    }
  }

  /**
   * 兼容旧接口的聚类方法
   * 内部使用新的语义聚类
   */
  public async clusterTexts(texts: string[], minClusterSize?: number): Promise<string[][]> {
    const result = await this.clusterTextsWithEmbeddings(texts, {
      minSamples: minClusterSize
    });

    if (!result.success || result.clusters.length === 0) {
      // 降级到基础聚类
      console.warn('语义聚类失败，使用基础聚类');
      return this.fallbackCluster(texts, minClusterSize);
    }

    // 转换为旧格式
    return result.clusters.map(c => c.texts);
  }

  /**
   * 获取语义聚类结果（新格式）
   */
  public async getSemanticClusters(texts: string[]): Promise<SemanticCluster[]> {
    const result = await this.clusterTextsWithEmbeddings(texts);

    if (!result.success) {
      console.warn('语义聚类失败:', result.error);
      return [];
    }

    return result.clusters;
  }

  /**
   * 降级聚类算法（当 TypeScript 服务不可用时）
   * 使用简单的关键词匹配
   */
  private fallbackCluster(texts: string[], minClusterSize?: number): string[][] {
    if (texts.length === 0) return [];

    // 最小聚类大小至少为3，保证统计意义
    const effectiveMinSize = Math.max(minClusterSize || 3, 3);

    // 如果数据量太小无法形成有意义的聚类，返回空数组
    if (texts.length < effectiveMinSize) {
      console.warn(`数据量(${texts.length})不足以形成有意义的聚类(需要至少${effectiveMinSize}条)`);
      return [];
    }

    // 简单的关键词聚类
    const clusters: Map<string, string[]> = new Map();
    const keywords = ['价格', '质量', '服务', '功能', '使用', '推荐', '问题', '效果',
                      '怎么', '求', '哪里', '如何', '为什么', '不会', '难'];

    for (const text of texts) {
      let assigned = false;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          const existing = clusters.get(keyword) || [];
          existing.push(text);
          clusters.set(keyword, existing);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const others = clusters.get('其他') || [];
        others.push(text);
        clusters.set('其他', others);
      }
    }

    const result = Array.from(clusters.values()).filter(c => c.length >= effectiveMinSize);

    // 如果过滤后没有结果，检查是否可以放宽要求
    if (result.length === 0 && texts.length >= 3) {
      console.warn('Fallback聚类未找到匹配，尝试将所有文本作为单个聚类');
      return [texts];
    }

    return result;
  }

  /**
   * 为每个聚类选择代表性文本
   */
  public getRepresentativeTexts(cluster: string[], maxCount: number = 5): string[] {
    if (cluster.length <= maxCount) {
      return cluster;
    }

    // 选择长度适中的文本
    const scored = cluster.map(text => ({
      text,
      score: this.calculateRepresentativeness(text, cluster)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map(item => item.text);
  }

  /**
   * 计算文本代表性分数
   */
  private calculateRepresentativeness(text: string, _cluster: string[]): number {
    const textLength = text.length;

    // 惩罚过短或过长的文本
    let lengthScore = 1.0;
    if (textLength < 10) lengthScore = 0.5;
    if (textLength > 200) lengthScore = 0.7;
    if (textLength >= 20 && textLength <= 100) lengthScore = 1.2;

    // 包含问题关键词加分
    const painKeywords = ['怎么', '难', '坑', '贵', '问题', '希望', '不懂'];
    let keywordScore = 0;
    for (const keyword of painKeywords) {
      if (text.includes(keyword)) {
        keywordScore += 0.3;
      }
    }

    return lengthScore + keywordScore;
  }

  /**
   * 生成聚类ID
   */
  public generateClusterId(index: number): string {
    return `cluster-${index + 1}`;
  }

  /**
   * 获取服务统计信息
   */
  public getStats() {
    return this.tsService.getStats();
  }

  /**
   * 获取提供商信息
   */
  public getProviderInfo() {
    return this.tsService.getProviderInfo();
  }
}

// 导出单例
export const clusteringService = new ClusteringService();
