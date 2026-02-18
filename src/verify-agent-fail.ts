
import { executePythonJob } from "./lib/queue/worker";

async function run() {
  console.log("Starting verification with failing agent...");
  try {
    // This job will try to run an agent, which we suspect is failing
    // causing a crash.
    await executePythonJob("test-agent-job-fail", {
      type: "agent.run",
      agent: "research",
      prompt: "This is a test prompt",
      // We don't need real model access if it crashes before that
    });
  } catch (e) {
    console.log("Job finished with error (expected):");
    console.log(e.message);
  }
}

run();
