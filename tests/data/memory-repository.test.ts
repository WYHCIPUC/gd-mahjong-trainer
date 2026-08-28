import { runRepositoryContractTests } from './contract';
import { MemoryRepository } from '../../src/data/memory-repository';

runRepositoryContractTests('MemoryRepository', async () => new MemoryRepository());
