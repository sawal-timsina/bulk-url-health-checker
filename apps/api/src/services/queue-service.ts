import { urlCheckQueue } from "@bulk-url-checker/queue";
import type { UrlCheckJob } from "@bulk-url-checker/shared";
import { Job, type JobProgress } from "bullmq";

export async function enqueueUrlCheck(job: UrlCheckJob): Promise<Job<UrlCheckJob, any, string, JobProgress>> {
  return urlCheckQueue.add("check-url", job, {
    jobId: `url-check-${job.urlId}`,
  });
}
