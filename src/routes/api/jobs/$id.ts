import { createFileRoute } from "@tanstack/react-router";
import {
  getJob,
  getJobWithLogs,
  cancelJob,
  retryJob,
  updateJobStatus,
} from "@/lib/queue";

export const Route = createFileRoute("/api/jobs/$id")({
  server: {
    handlers: {
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        const url = new URL(request.url);
        const includeLogs = url.searchParams.get("logs") === "true";

        const job = includeLogs
          ? await getJobWithLogs(params.id)
          : await getJob(params.id);

        if (!job) {
          return Response.json({ error: "Job not found" }, { status: 404 });
        }

        return Response.json({ job });
      },

      DELETE: async ({ params }: { params: { id: string } }) => {
        const cancelled = await cancelJob(params.id);

        if (!cancelled) {
          return Response.json(
            { error: "Job not found or cannot be cancelled" },
            { status: 400 }
          );
        }

        return Response.json({ status: "cancelled" });
      },

      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        const body = await request.json();
        const action = body.action;

        if (action === "retry") {
          const retried = await retryJob(params.id);

          if (!retried) {
            return Response.json(
              { error: "Job not found or cannot be retried" },
              { status: 400 }
            );
          }

          return Response.json({ status: "retrying" });
        }

        if (action === "update") {
          const { status, progress, progressMessage, result, error } = body;

          await updateJobStatus(params.id, status, {
            progress,
            progressMessage,
            result,
            error,
          });

          return Response.json({ status: "updated" });
        }

        return Response.json({ error: "Invalid action" }, { status: 400 });
      },
    },
  },
});
