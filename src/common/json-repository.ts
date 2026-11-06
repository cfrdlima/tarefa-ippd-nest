import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Stores a collection in a JSON file. Reads are served from memory; every
 * change goes through a queue and only reaches memory after it is on disk.
 */
export class JsonRepository<T extends { id: string }> {
  private readonly filePath: string;
  private items: T[];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(fileName: string) {
    this.filePath = resolve(process.env.DATA_DIR ?? 'data', fileName);
    this.items = this.load();
  }

  findAll(): T[] {
    return this.items;
  }

  findById(id: string): T | undefined {
    return this.items.find((item) => item.id === id);
  }

  insert(build: (id: string) => T): Promise<T> {
    return this.enqueue(async () => {
      const item = build(randomUUID());
      await this.commit([...this.items, item]);
      return item;
    });
  }

  update(id: string, change: (current: T) => T): Promise<T | undefined> {
    return this.enqueue(async () => {
      const current = this.findById(id);
      if (!current) return undefined;
      const updated = change(current);
      await this.commit(
        this.items.map((item) => (item.id === id ? updated : item)),
      );
      return updated;
    });
  }

  remove(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      if (!this.findById(id)) return false;
      await this.commit(this.items.filter((item) => item.id !== id));
      return true;
    });
  }

  private load(): T[] {
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf8')) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  // Writing to a temp file and renaming keeps the JSON intact if the process dies mid-write.
  private async commit(next: T[]): Promise<void> {
    const tempPath = `${this.filePath}.tmp`;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(tempPath, JSON.stringify(next, null, 2));
    await rename(tempPath, this.filePath);
    this.items = next;
  }

  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
