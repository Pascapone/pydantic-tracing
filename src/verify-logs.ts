
import { executePythonJob } from "./lib/queue/worker";
import { join } from "path";

async function run() {
  console.log("Starting verification...");
  try {
    // Run a job that doesn't exist or just a basic one to trigger the worker startup
    // Since we added prints at the VERY START of main(), they should appear regardless of job success
    await executePythonJob("test-job-id", {
      type: "custom",
      handler: "test",
    });
  } catch (e) {
    console.log("Job finished (likely failed, which is expected):", e.message);
  }
}

run();
