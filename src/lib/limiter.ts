/** Runs at most `limit` tasks at once. The others wait, and start in the order they arrived. */
export class Limiter {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  /** Hands the slot straight to the next waiting task, so `running` never overshoots. */
  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }
}
