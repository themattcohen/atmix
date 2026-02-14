import { Queue, Worker, Job } from "bullmq"
import { getRedisConnection } from "@/lib/redis"

// Re-export the shared Redis connection for backward compatibility
const getConnection = getRedisConnection

// Lazy queue — only created when first accessed
let _extractionQueue: Queue | null = null

function getExtractionQueue(): Queue {
  if (!_extractionQueue) {
    _extractionQueue = new Queue("extraction", {
      connection: getConnection() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 5000,
        },
      },
    })
  }
  return _extractionQueue
}

export const extractionQueue = {
  get add() { return getExtractionQueue().add.bind(getExtractionQueue()) },
  get getJob() { return getExtractionQueue().getJob.bind(getExtractionQueue()) },
}

export interface ExtractionJobData {
  statementId: string
  filingYearId: string
  practiceId: string
  filePath: string
  fileType: string
  pageCount?: number
}

export async function enqueueExtraction(data: ExtractionJobData): Promise<string> {
  const job = await getExtractionQueue().add("extract-statement", data, {
    jobId: `extract-${data.statementId}`,
  })
  return job.id || data.statementId
}

export async function getJobStatus(jobId: string) {
  const job = await getExtractionQueue().getJob(jobId)
  if (!job) return null
  const state = await job.getState()
  return {
    id: job.id,
    state,
    progress: job.progress,
    data: job.data,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  }
}

export { getConnection, Queue, Worker, Job }
export type { Job as BullJob }
