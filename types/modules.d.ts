// 类型声明 - 用于没有自带类型的 npm 包

declare module 'density-clustering' {
  type DistanceFunction = (a: number[], b: number[]) => number;

  export class DBSCAN {
    public eps: number;
    public minPts: number;
    public clusters: number[][];
    public noise: number[];
    constructor(eps?: number, minPts?: number);
    public run(
      dataset: number[][],
      epsilon?: number,
      minPts?: number,
      distance?: DistanceFunction
    ): number[][];
  }

  export class OPTICS {
    public eps: number;
    public minPts: number;
    public clusters: number[][];
    public noise: number[];
    public reachability: number[];
    public orderedList: number[];
    constructor(eps?: number, minPts?: number, distance?: DistanceFunction);
    public run(
      dataset: number[][],
      epsilon?: number,
      minPts?: number,
      distance?: DistanceFunction
    ): number[][];
  }

  export class KMEANS {
    public k: number;
    public maxIterations: number;
    public clusters: number[][];
    public centroids: number[][];
    constructor(k?: number, maxIterations?: number, distance?: DistanceFunction);
    public run(dataset: number[][], k?: number): number[][];
  }

  const _default: { DBSCAN: typeof DBSCAN; OPTICS: typeof OPTICS; KMEANS: typeof KMEANS };
  export default _default;
}
