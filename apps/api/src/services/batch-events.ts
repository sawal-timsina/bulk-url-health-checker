import { createRedisConnection } from "@bulk-url-checker/queue";
import { batchEventsChannel } from "@bulk-url-checker/shared";
import type { Redis } from "ioredis";

type Listener = (message: string) => void;

/**
 * One Redis subscriber connection per API process, fanned out to every SSE
 * client of that process. Channels are subscribed while at least one client
 * watches the batch. Because every instance subscribes to Redis, a worker's
 * event reaches clients no matter which instance they're connected to.
 */
class BatchEventHub {
  private subscriber: Redis | undefined;
  private readonly listeners = new Map<string, Set<Listener>>();

  private getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = createRedisConnection();
      this.subscriber.on("message", (channel: string, message: string) => {
        for (const listener of this.listeners.get(channel) ?? []) {
          listener(message);
        }
      });
    }

    return this.subscriber;
  }

  async subscribe(batchId: string, listener: Listener): Promise<() => Promise<void>> {
    const channel = batchEventsChannel(batchId);
    let set = this.listeners.get(channel);

    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
      await this.getSubscriber().subscribe(channel);
    }

    set.add(listener);

    return async () => {
      set.delete(listener);

      if (set.size === 0 && this.listeners.get(channel) === set) {
        this.listeners.delete(channel);
        await this.getSubscriber().unsubscribe(channel);
      }
    };
  }

  async close() {
    await this.subscriber?.quit();
  }
}

export const batchEventHub = new BatchEventHub();
