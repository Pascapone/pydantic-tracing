import { describe, expect, it } from 'vitest';
import type { Span } from '@/types/tracing';
import { processSpanTree } from './traceTree';

const makeSpan = (overrides: Partial<Span> & Pick<Span, 'id' | 'name' | 'spanType'>): Span => ({
  id: overrides.id,
  name: overrides.name,
  spanType: overrides.spanType,
  startTime: overrides.startTime ?? 0,
  endTime: overrides.endTime,
  durationUs: overrides.durationUs,
  attributes: overrides.attributes ?? {},
  status: overrides.status ?? 'OK',
  statusMessage: overrides.statusMessage,
  events: overrides.events ?? [],
  parentId: overrides.parentId,
  children: overrides.children ?? [],
});

describe('processSpanTree', () => {
  it('hoists meaningful children from filtered model.request spans', () => {
    const reasoning = makeSpan({
      id: 'reasoning-1',
      name: 'model.reasoning',
      spanType: 'model.reasoning',
      startTime: 3,
      attributes: { 'model.reasoning': 'Thinking...' },
    });

    const finalResponse = makeSpan({
      id: 'response-final-1',
      name: 'model.response:final',
      spanType: 'model.response',
      startTime: 4,
    });

    const nestedRequest = makeSpan({
      id: 'request-nested-1',
      name: 'model.request:nested',
      spanType: 'model.request',
      startTime: 2,
      children: [reasoning],
    });

    const request = makeSpan({
      id: 'request-1',
      name: 'model.request:test',
      spanType: 'model.request',
      startTime: 1,
      children: [nestedRequest, finalResponse],
    });

    const root = makeSpan({
      id: 'agent-1',
      name: 'agent.run:research',
      spanType: 'agent.run',
      startTime: 0,
      children: [request],
    });

    const processed = processSpanTree([root]);
    const rootChildren = processed[0]?.children ?? [];

    expect(processed).toHaveLength(1);
    expect(rootChildren.map((span) => span.spanType)).toEqual([
      'model.reasoning',
      'model.response',
    ]);
    expect(rootChildren.map((span) => span.name)).toEqual([
      'model.reasoning',
      'model.response:final',
    ]);
  });

  it('filters non-final model.response spans but preserves their processed children', () => {
    const reasoning = makeSpan({
      id: 'reasoning-2',
      name: 'model.reasoning',
      spanType: 'model.reasoning',
      startTime: 2,
    });

    const streamingResponse = makeSpan({
      id: 'response-stream-1',
      name: 'model.response:chunk',
      spanType: 'model.response',
      startTime: 1,
      children: [reasoning],
    });

    const root = makeSpan({
      id: 'agent-2',
      name: 'agent.run:research',
      spanType: 'agent.run',
      startTime: 0,
      children: [streamingResponse],
    });

    const processed = processSpanTree([root]);
    const rootChildren = processed[0]?.children ?? [];

    expect(rootChildren).toHaveLength(1);
    expect(rootChildren[0].spanType).toBe('model.reasoning');
    expect(rootChildren[0].name).toBe('model.reasoning');
  });
});

