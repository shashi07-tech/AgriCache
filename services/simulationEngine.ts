
import { MappingType, ReplacementPolicy, CacheBlock, SensorData, SimulationResult } from '../types';

export class CacheSimulationEngine {
  private size: number;
  private mapping: MappingType;
  private policy: ReplacementPolicy;
  private counter: number = 0;

  constructor(size: number, mapping: MappingType, policy: ReplacementPolicy) {
    this.size = size;
    this.mapping = mapping;
    this.policy = policy;
  }

  access(address: number, data: SensorData, currentCache: CacheBlock[]): SimulationResult {
    this.counter++;
    const tag = Math.floor(address / this.size);
    
    if (this.mapping === MappingType.DIRECT) {
      const index = address % this.size;
      const block = currentCache[index];

      if (block.tag === tag) {
        // Hit
        const newCache = [...currentCache];
        newCache[index] = { ...block, lastUsed: this.counter };
        return { hit: true, replacedId: null, cache: newCache };
      } else {
        // Miss
        const newCache = [...currentCache];
        newCache[index] = {
          ...block,
          tag,
          data,
          lastUsed: this.counter,
          insertedAt: this.counter
        };
        return { hit: false, replacedId: index, cache: newCache };
      }
    } else {
      // 2-way Set Associative
      const numSets = this.size / 2;
      const setIndex = address % numSets;
      const setIndices = [setIndex * 2, setIndex * 2 + 1];
      
      const hitIndex = setIndices.find(idx => currentCache[idx].tag === tag);

      if (hitIndex !== undefined) {
        // Hit
        const newCache = [...currentCache];
        newCache[hitIndex] = { ...currentCache[hitIndex], lastUsed: this.counter };
        return { hit: true, replacedId: null, cache: newCache };
      } else {
        // Miss - Replacement logic
        let replaceIndex: number;
        
        if (this.policy === ReplacementPolicy.LRU) {
          replaceIndex = currentCache[setIndices[0]].lastUsed < currentCache[setIndices[1]].lastUsed 
            ? setIndices[0] 
            : setIndices[1];
        } else {
          // FIFO
          replaceIndex = currentCache[setIndices[0]].insertedAt < currentCache[setIndices[1]].insertedAt 
            ? setIndices[0] 
            : setIndices[1];
        }

        const newCache = [...currentCache];
        newCache[replaceIndex] = {
          id: replaceIndex,
          tag,
          data,
          lastUsed: this.counter,
          insertedAt: this.counter,
          isDirty: false
        };
        return { hit: false, replacedId: replaceIndex, cache: newCache };
      }
    }
  }

  static createEmptyCache(size: number): CacheBlock[] {
    return Array.from({ length: size }, (_, i) => ({
      id: i,
      tag: null,
      data: null,
      lastUsed: 0,
      insertedAt: 0,
      isDirty: false
    }));
  }
}
