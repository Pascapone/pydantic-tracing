import { createFileRoute } from "@tanstack/react-router";
import {
  createJob,
  getJob,
  getJobWithLogs,
  getJobsByUser,
  getQueueStats,
} from "@/lib/queue";

export const Route = createFileRoute("/api/jobs/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId");
        const status = url.searchParams.get("status");
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        if (url.searchParams.get("stats") === "true") {
          const stats = await getQueueStats();
          return Response.json({ stats });
        }

        if (url.searchParams.get("id")) {
          const includeLogs = url.searchParams.get("logs") === "true";
          const job = includeLogs
            ? await getJobWithLogs(url.searchParams.get("id")!)
            : await getJob(url.searchParams.get("id")!);

          if (!job) {
            return Response.json({ error: "Job not found" }, { status: 404 });
          }

          return Response.json({ job });
        }

        if (!userId) {
          return Response.json({ error: "userId is required" }, { status: 400 });
        }

        const jobs = await getJobsByUser(userId, {
          status: status as
            | "pending"
            | "running"
            | "completed"
            | "failed"
            | "cancelled"
            | undefined,
          limit,
          offset,
        });

        return Response.json({ jobs });
      },

      POST: async ({ request }: { request: Request }) => {
        const body = await request.json();
        const { type, payload, options, userId } = body;

        if (!type || !payload) {
          return Response.json(
            { error: "type and payload are required" },
            { status: 400 }
          );
        }

        const validTypes = [
          "ai.generate_text",
          "ai.generate_image",
          "ai.analyze_data",
          "ai.embeddings",
          "data.process",
          "data.transform",
          "data.export",
          "custom",
        ];

        if (!validTypes.includes(type)) {
          return Response.json(
            { error: "Invalid job type", validTypes },
            { status: 400 }
          );
        }

        const jobId = await createJob({
          type,
          payload,
          userId,
          options,
        });

        return Response.json({ jobId, status: "created" }, { status: 201 });
      },
    },
  },
});
