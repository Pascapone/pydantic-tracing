import { createFileRoute } from "@tanstack/react-router";
import {
  getQueueStats,
  getJobsByStatus,
  getActiveWorkers,
} from "@/lib/queue";

export const Route = createFileRoute("/api/jobs/stats")({
  server: {
    handlers: {
      GET: async () => {
        const [stats, activeWorkers] = await Promise.all([
          getQueueStats(),
          getActiveWorkers(),
        ]);

        const pending = await getJobsByStatus("pending", { limit: 100 });
        const running = await getJobsByStatus("running", { limit: 100 });
        const failed = await getJobsByStatus("failed", { limit: 100 });

        return Response.json({
          queue: stats,
          activeWorkers,
          recent: {
            pending: pending.length,
            running: running.length,
            failed: failed.length,
          },
        });
      },
    },
  },
});
