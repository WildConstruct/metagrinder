import type { Transport } from './types';

/**
 * Anthropic Messages API transport. The network call is the untested boundary;
 * the tested seam is the caching/validation wrapper around it. Returns raw text;
 * the caller's schema does the validation.
 *
 * Model defaults to the latest Opus; override via METAGRINDER_ANTHROPIC_MODEL.
 * Requires ANTHROPIC_API_KEY. JSON-only output is requested in the system prompt.
 */
export function anthropicTransport(opts?: {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}): { transport: Transport; model: string } {
  const model = opts?.model ?? process.env.METAGRINDER_ANTHROPIC_MODEL ?? 'claude-opus-4-8';
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  const doFetch = opts?.fetchImpl ?? fetch;
  const maxTokens = opts?.maxTokens ?? 4096;

  const transport: Transport = async ({ system, prompt }) => {
    if (!apiKey) throw new Error('anthropicTransport: ANTHROPIC_API_KEY is not set');
    const res = await doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(system !== undefined ? { system: `${system}\n\nReturn only a single JSON object. No prose, no code fences.` }
          : { system: 'Return only a single JSON object. No prose, no code fences.' }),
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) throw new Error(`anthropic API error ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (body.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    return { rawText: text };
  };

  return { transport, model };
}
