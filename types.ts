
export enum MappingType {
  DIRECT = 'Direct Mapped',
  TWO_WAY = '2-way Set Associative'
}

export enum ReplacementPolicy {
  LRU = 'LRU',
  FIFO = 'FIFO'
}

export interface SensorData {
  id: number;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  address: number; // Hex-simulated memory address
}

export interface CacheBlock {
  id: number;
  tag: number | null;
  data: SensorData | null;
  lastUsed: number;
  insertedAt: number;
  isDirty: boolean;
}

export interface SimulationResult {
  hit: boolean;
  replacedId: number | null;
  cache: CacheBlock[];
}

export interface MetricPoint {
  time: string;
  hitRatio: number;
  amat: number;
}
