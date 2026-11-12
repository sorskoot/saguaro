import type { IRepository } from './interfaces/IRepository';
import type { CollectionStore } from './db/CollectionStore';
import type { ParkingLotItem } from '../types';

export class ParkingLotRepository implements IRepository<ParkingLotItem> {
  constructor(private readonly store: CollectionStore<ParkingLotItem>) {}

  findAll(): ParkingLotItem[] {
    return this.store.findAll();
  }

  findById(id: string): ParkingLotItem | undefined {
    return this.store.findById(id);
  }

  /** Items that have not been promoted to a task or dismissed yet, oldest first. */
  findOpen(): ParkingLotItem[] {
    return this.store.findAll().filter((item) => !item.resolution);
  }

  save(item: ParkingLotItem): void {
    this.store.save(item);
  }

  delete(id: string): void {
    this.store.delete(id);
  }
}
