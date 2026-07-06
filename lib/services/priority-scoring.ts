// 优先级评分系统
// 根据需求强度、市场规模、竞争度计算综合优先级

export interface PriorityScore {
  demand_intensity: number;  // 需求强度 0-5
  market_size: number;        // 市场规模 0-5
  competition: number;        // 竞争度 0-5 (反向指标，5=低竞争)
  overall: number;            // 综合得分 0-5
  level: 'High' | 'Medium' | 'Low';
}

export class PriorityScorer {
  /**
   * 计算需求强度（0-5分）
   * 基于聚类大小、情绪强度
   */
  calculateDemandIntensity(
    clusterSize: number,
    totalSize: number,
    emotionalIntensity: number
  ): number {
    // 基础分：基于聚类占比
    const sizeRatio = clusterSize / totalSize;
    const sizeScore = Math.min(5, sizeRatio * 10); // 10%占比 = 1分，最高5分

    // 情绪加成：0-5的情绪强度最多贡献1分
    const emotionBoost = (emotionalIntensity / 5) * 1.0;

    const total = Math.min(5, sizeScore + emotionBoost);
    return Math.round(total * 10) / 10; // 保留一位小数
  }

  /**
   * 计算市场规模（0-5分）
   * 结合数据维度得分（40%）和 GLM 评估的市场规模（60%）
   */
  calculateMarketSize(
    clusterSize: number,
    totalDataSize: number,
    glmMarketScore: number  // GLM 评估的市场规模 0-5
  ): number {
    // 数据维度得分：基于聚类占比和数据量
    let dataScore = 2.5;  // 基础分

    if (totalDataSize >= 50) {
      // 数据量充足时，基于聚类占比计算
      const sizeRatio = clusterSize / totalDataSize;
      dataScore = Math.min(5, 2.0 + sizeRatio * 15);  // 基础2分，占比加成最多3分

      // 数据量加成
      if (totalDataSize >= 200) {
        dataScore = Math.min(5, dataScore + 0.5);
      } else if (totalDataSize >= 100) {
        dataScore = Math.min(5, dataScore + 0.3);
      }
    }

    // 加权计算：数据维度 40% + GLM评估 60%
    const total = dataScore * 0.4 + glmMarketScore * 0.6;

    return Math.round(total * 10) / 10;
  }

  /**
   * 计算竞争度（0-5分，反向指标）
   * 5分=蓝海，0分=红海
   * 基于LLM分析的现有解决方案数量，使用连续函数以区分 4 vs 100 个竞品
   */
  calculateCompetition(existingSolutions: Array<{ name: string; limitation: string }>): number {
    // 过滤掉"待调研"、"解析失败"等无效方案
    const validSolutions = existingSolutions.filter(
      s => !s.name.includes('待调研') &&
           !s.name.includes('解析失败') &&
           !s.name.includes('API调用失败')
    );

    const validCount = validSolutions.length;

    // 连续函数：f(n) = 5 / (1 + n)
    //   0 个 = 5.0 (纯蓝海)
    //   1 个 = 2.5
    //   4 个 = 1.0
    //   9 个 = 0.5
    //  99 个 ≈ 0.05 (极度红海)
    // 这样既能体现 4 vs 100 的差距，又保留对 0 竞品的强奖励
    const score = 5 / (1 + validCount);
    return Math.round(score * 100) / 100;
  }

  /**
   * 计算综合优先级
   * 加权公式：需求40% + 市场30% + 竞争30%
   */
  calculatePriority(
    demandIntensity: number,
    marketSize: number,
    competition: number
  ): PriorityScore {
    const overall = demandIntensity * 0.4 + marketSize * 0.3 + competition * 0.3;

    let level: 'High' | 'Medium' | 'Low';
    if (overall >= 3.5) {
      level = 'High';
    } else if (overall >= 2.5) {
      level = 'Medium';
    } else {
      level = 'Low';
    }

    return {
      demand_intensity: demandIntensity,
      market_size: marketSize,
      competition: competition,
      overall: Math.round(overall * 10) / 10,
      level
    };
  }

  /**
   * 完整评分流程（一次性计算所有维度）
   */
  scoreCluster(params: {
    clusterSize: number;
    totalDataSize: number;
    emotionalIntensity: number;
    glmMarketScore: number;  // GLM 评估的市场规模 0-5
    existingSolutions: Array<{ name: string; limitation: string }>;
  }): PriorityScore {
    const demandScore = this.calculateDemandIntensity(
      params.clusterSize,
      params.totalDataSize,
      params.emotionalIntensity
    );

    const marketScore = this.calculateMarketSize(
      params.clusterSize,
      params.totalDataSize,
      params.glmMarketScore
    );

    const competitionScore = this.calculateCompetition(params.existingSolutions);

    return this.calculatePriority(demandScore, marketScore, competitionScore);
  }
}
