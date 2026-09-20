import { createHash } from 'node:crypto'

import OpenAI from 'openai'

import {
	COACH_MODEL,
	COACH_OUTPUT_JSON_SCHEMA,
	buildCoachInput,
	buildCoachInstructions,
	parseCoachModelOutput,
	type CoachOutput,
	type CoachRequest,
} from './coach-core.mts'

export type CoachUsageSummary = {
	inputTokens: number
	outputTokens: number
	estimatedUsd: number
}

export type GeneratedCoach = {
	coach: CoachOutput
	usage?: CoachUsageSummary
}

function safeUserIdentifier(subject: string) {
	return createHash('sha256').update(subject).digest('hex')
}

export function coachUsageSummary(usage: {
	input_tokens: number
	output_tokens: number
	input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number }
} | null): CoachUsageSummary | undefined {
	if (!usage) return undefined
	const inputTokens = Math.max(0, Number(usage.input_tokens) || 0)
	const outputTokens = Math.max(0, Number(usage.output_tokens) || 0)
	const cachedTokens = Math.min(
		inputTokens,
		Math.max(0, Number(usage.input_tokens_details?.cached_tokens) || 0),
	)
	const cacheWriteTokens = Math.min(
		inputTokens - cachedTokens,
		Math.max(0, Number(usage.input_tokens_details?.cache_write_tokens) || 0),
	)
	const regularInputTokens = Math.max(0, inputTokens - cachedTokens - cacheWriteTokens)

	// GPT-6 Astra Standard short-context estimate: $10/M uncached input,
	// $1/M cached input, $12.50/M cache writes, and $50/M output.
	const estimatedUsd =
		(regularInputTokens * 10 + cachedTokens * 1 + cacheWriteTokens * 12.5 + outputTokens * 50) /
		1_000_000
	return { inputTokens, outputTokens, estimatedUsd: Number(estimatedUsd.toFixed(6)) }
}

export function coachResponseRequest(request: CoachRequest, subject: string, maxOutputTokens: number) {
	return {
		model: COACH_MODEL,
		instructions: buildCoachInstructions(request.intent),
		input: buildCoachInput(request),
		max_output_tokens: maxOutputTokens,
		reasoning: { effort: 'low' as const, context: 'current_turn' as const },
		service_tier: 'default' as const,
		store: false,
		safety_identifier: safeUserIdentifier(subject),
		text: {
			verbosity: 'low' as const,
			format: {
				type: 'json_schema' as const,
				name: 'ralph_bridge_coach',
				description: 'A brief, non-spoiling bridge teaching prompt for the selected learner.',
				strict: true,
				schema: COACH_OUTPUT_JSON_SCHEMA,
			},
		},
	}
}

export async function generateCoach(
	apiKey: string,
	request: CoachRequest,
	subject: string,
	signal: AbortSignal,
	{ maxOutputTokens = 320 }: { maxOutputTokens?: number } = {},
): Promise<GeneratedCoach> {
	const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 30_000 })
	const response = await client.responses.create(
		coachResponseRequest(request, subject, maxOutputTokens),
		{ signal },
	)

	return {
		coach: parseCoachModelOutput(response.output_text),
		usage: coachUsageSummary(response.usage),
	}
}

export function coachGenerationFailure(error: unknown) {
	if (error instanceof OpenAI.APIConnectionTimeoutError) {
		return { status: 504, message: 'The coach took too long to respond. Please try again.' }
	}
	if (error instanceof OpenAI.APIError && error.status === 429) {
		return { status: 503, message: 'The coach is temporarily busy. Please try again shortly.' }
	}
	return { status: 502, message: 'The coach could not respond just now.' }
}
