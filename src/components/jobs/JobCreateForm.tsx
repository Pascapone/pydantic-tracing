import { useState } from "react";
import { JOB_TEMPLATES, type JobTemplateKey, type CreateJobInput } from "@/lib/hooks/use-jobs";
import { Sparkles, Image, Database, Loader2, X } from "lucide-react";

const templateIcons: Record<string, React.ReactNode> = {
  sparkles: <Sparkles size={20} />,
  image: <Image size={20} />,
  data: <Database size={20} />,
};

interface JobCreateFormProps {
  onSubmit: (input: CreateJobInput) => Promise<void>;
  isSubmitting?: boolean;
}

export function JobCreateForm({ onSubmit, isSubmitting }: JobCreateFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplateKey>("textGeneration");
  const [payload, setPayload] = useState<Record<string, unknown>>(
    JOB_TEMPLATES.textGeneration.defaultPayload
  );
  const [error, setError] = useState<string | null>(null);

  const template = JOB_TEMPLATES[selectedTemplate];

  const handleTemplateChange = (key: JobTemplateKey) => {
    setSelectedTemplate(key);
    setPayload(JOB_TEMPLATES[key].defaultPayload);
    setError(null);
  };

  const handleFieldChange = (key: string, value: unknown) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate required fields
    const promptField = template.fields.find((f) => f.key === "prompt") as Record<string, unknown> | undefined;
    if (promptField?.required && !payload.prompt) {
      setError("Please fill in the required field");
      return;
    }

    // For data processing, try to parse JSON input
    let finalPayload = { ...payload };
    if (selectedTemplate === "dataProcessing" && typeof payload.input === "string") {
      try {
        finalPayload.input = JSON.parse(payload.input as string);
      } catch {
        setError("Invalid JSON format for input data");
        return;
      }
    }

    // Add example prompts if empty
    if (!finalPayload.prompt) {
      if (selectedTemplate === "textGeneration") {
        finalPayload.prompt = "Write a short poem about technology and innovation.";
      } else if (selectedTemplate === "imageGeneration") {
        finalPayload.prompt = "A serene mountain landscape at sunset with a calm lake reflection.";
      }
    }

    try {
      await onSubmit({
        type: template.type,
        payload: finalPayload,
        options: { priority: 5 },
      });
      setPayload(template.defaultPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Create New Job
      </h2>

      <div className="flex gap-3 mb-6">
        {(Object.keys(JOB_TEMPLATES) as JobTemplateKey[]).map((key) => {
          const t = JOB_TEMPLATES[key];
          const isSelected = selectedTemplate === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTemplateChange(key)}
              className={`flex-1 p-4 rounded-xl border transition-all ${
                isSelected
                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 dark:border-cyan-500/50"
                  : "border-slate-200 hover:border-cyan-300 dark:border-slate-600 dark:hover:border-cyan-500/30"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg mx-auto mb-2 ${
                  isSelected
                    ? "bg-cyan-500 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-gray-400"
                }`}
              >
                {templateIcons[t.icon]}
              </div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white text-center">
                {t.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-gray-400 text-center mt-1">
                {t.description}
              </p>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {template.fields.map((field) => {
            const isRequired = "required" in field && Boolean(field.required);
            const step = "step" in field ? (field.step as number | undefined) : undefined;
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1.5">
                  {field.label}
                  {isRequired ? <span className="text-red-500 ml-1">*</span> : null}
                </label>

                {field.type === "textarea" && (
                  <textarea
                    value={String(payload[field.key] || "")}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={String(payload[field.key] || "")}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "number" && (
                  <input
                    type="number"
                    value={payload[field.key] as number}
                    onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value))}
                    min={field.min}
                    max={field.max}
                    step={step}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <X size={16} />
              {error}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Creating...
            </>
          ) : (
            <>
              {templateIcons[template.icon]}
              Start {template.name}
            </>
          )}
        </button>
      </form>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-gray-400">
          <strong>Quick Start:</strong> Leave the prompt empty to use an example. Jobs run asynchronously and you'll see results in the job list.
        </p>
      </div>
    </div>
  );
}
