import { coachRequestSchema, validationIssues, type CoachRequest } from './coach-core.mts'

export const MAX_COACH_REQUEST_BYTES = 32_768

type CoachSchema<T> = {
	safeParse(value: unknown):
		| { success: true; data: T }
		| { success: false; error: Parameters<typeof validationIssues>[0] }
}

export function coachResponseHeaders(extra: Record<string, string> = {}) {
	return {
		'Cache-Control': 'no-store, private',
		'Content-Type': 'application/json; charset=utf-8',
		'X-Content-Type-Options': 'nosniff',
		...extra,
	}
}

export function coachJson(data: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: coachResponseHeaders(headers),
	})
}

export async function readCoachRequest<T = CoachRequest>(
	request: Request,
	schema: CoachSchema<T> = coachRequestSchema as CoachSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
	if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
		return { ok: false, response: coachJson({ error: 'Content-Type must be application/json.' }, 415) }
	}

	const contentLength = Number(request.headers.get('content-length') || 0)
	if (contentLength > MAX_COACH_REQUEST_BYTES) {
		return { ok: false, response: coachJson({ error: 'Coach request is too large.' }, 413) }
	}

	let bodyText = ''
	try {
		bodyText = await request.text()
	} catch {
		return { ok: false, response: coachJson({ error: 'Could not read coach request.' }, 400) }
	}
	if (!bodyText || new TextEncoder().encode(bodyText).byteLength > MAX_COACH_REQUEST_BYTES) {
		return {
			ok: false,
			response: coachJson(
				{ error: 'Coach request is empty or too large.' },
				bodyText ? 413 : 400,
			),
		}
	}

	let body: unknown
	try {
		body = JSON.parse(bodyText)
	} catch {
		return {
			ok: false,
			response: coachJson({ error: 'Coach request must contain valid JSON.' }, 400),
		}
	}

	const parsed = schema.safeParse(body)
	if (!parsed.success) {
		return {
			ok: false,
			response: coachJson(
				{ error: 'Coach context was rejected.', issues: validationIssues(parsed.error) },
				400,
			),
		}
	}
	return { ok: true, data: parsed.data }
}
