import type { Span } from '@/types/tracing';

/**
 * Determine whether a span should be directly visible in the timeline.
 * - model.request is hidden (noise)
 * - model.response is hidden unless it is the final response
 */
const shouldDisplaySpan = (span: Span): boolean => {
  if (span.spanType === 'model.request') {
    return false;
  }

  if (span.spanType === 'model.response') {
    return span.name.includes(':final');
  }

  return true;
};

/**
 * Recursively process span tree while preserving relevant descendants.
 *
 * If a span is filtered out, its processed children are hoisted one level up.
 * This prevents losing important nested spans (for example model.reasoning)
 * that were captured below filtered model.request/model.response nodes.
 */
export const processSpanTree = (spans: Span[]): Span[] => {
  const processed: Span[] = [];

  for (const span of spans) {
    const children = span.children ? processSpanTree(span.children) : [];
    const spanWithChildren: Span = {
      ...span,
      children,
    };

    if (shouldDisplaySpan(span)) {
      processed.push(spanWithChildren);
    } else {
      processed.push(...children);
    }
  }

  return processed.sort((a, b) => a.startTime - b.startTime);
};

