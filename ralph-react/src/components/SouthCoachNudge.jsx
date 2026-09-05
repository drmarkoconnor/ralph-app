import { useId } from 'react'

import './SouthCoachNudge.css'

const NUDGE_STATES = new Set(['idle', 'loading', 'response', 'error', 'access-required'])

const DEFAULT_MESSAGES = {
	response: 'Pause and use the auction and cards already played before choosing your next action.',
	error: 'The Coach could not respond just now.',
	'access-required': 'Open the private Coach to sign in and request a nudge.',
}

function announcementFor(state, message, focusSeatName) {
	if (state === 'loading') return `AI Coach for ${focusSeatName}: ${message}`
	if (state === 'response') return `AI Coach nudge for ${focusSeatName}: ${message}`
	if (state === 'error') return `AI Coach for ${focusSeatName} is unavailable: ${message}`
	if (state === 'access-required') return `AI Coach access required for ${focusSeatName}: ${message}`
	return ''
}

/**
 * Compact, normal-flow UI for a seat-adjacent coaching nudge.
 * Authentication, API calls, request cancellation, and transcript state stay with the caller.
 */
export default function SouthCoachNudge({
	state = 'idle',
	message = '',
	onRequest,
	onMore,
	onClose,
	disabled = false,
	presentationMode = false,
	focusSeat = 'S',
	focusSeatName = 'South',
	requestLabel = 'Ask for a nudge',
	loadingLabel = '',
	moreLabel = 'More',
	usageLabel = '',
	className = '',
}) {
	const labelId = useId()
	const messageId = useId()
	const safeState = NUDGE_STATES.has(state) ? state : 'idle'
	const displayedSeat = String(focusSeat || 'S').trim().toUpperCase() || 'S'
	const displayedSeatName = String(focusSeatName || displayedSeat || 'South').trim() || 'South'
	const resolvedLoadingLabel = loadingLabel || `Thinking about ${displayedSeatName}’s decision…`
	const resolvedMessage =
		safeState === 'loading'
			? resolvedLoadingLabel
			: String(message || DEFAULT_MESSAGES[safeState] || '')
	const announcement = announcementFor(safeState, resolvedMessage, displayedSeatName)
	const showMore = safeState !== 'idle' && safeState !== 'loading' && !!onMore
	const showRetry = safeState === 'error' && !!onRequest
	const showActions = showRetry || showMore || !!onClose
	const effectiveMoreLabel =
		safeState === 'access-required' && moreLabel === 'More' ? 'Open Coach' : moreLabel

	const handleKeyDown = (event) => {
		if (event.key !== 'Escape' || !onClose) return
		event.preventDefault()
		event.stopPropagation()
		onClose()
	}

	return (
		<aside
			className={`south-coach-nudge south-coach-nudge--${safeState} ${
				presentationMode ? 'south-coach-nudge--presentation' : ''
			} ${className}`.trim()}
			aria-labelledby={labelId}
			aria-busy={safeState === 'loading'}
			onKeyDown={handleKeyDown}>
			<span className="south-coach-nudge__announcement" role="status" aria-live="polite" aria-atomic="true">
				{announcement}
			</span>

			<div className="south-coach-nudge__identity" aria-label={`Coaching focus: ${displayedSeatName}`}>
				<span className="south-coach-nudge__seat" aria-hidden="true">
					{displayedSeat}
				</span>
				<strong id={labelId}>
					{displayedSeatName} ·{' '}
					{safeState === 'access-required'
						? 'Coach access'
						: safeState === 'error'
							? 'Coach unavailable'
							: 'AI Coach'}
				</strong>
				{usageLabel && <span className="south-coach-nudge__usage">{usageLabel}</span>}
			</div>

			{safeState === 'idle' ? (
				<button
					type="button"
					className="south-coach-nudge__request"
					onClick={onRequest}
					disabled={disabled || !onRequest}
					aria-label={`${requestLabel} for ${displayedSeatName}'s current decision`}>
					{requestLabel}
				</button>
			) : (
				<div className="south-coach-nudge__content">
					{safeState === 'loading' && (
						<span className="south-coach-nudge__loading-mark" aria-hidden="true" />
					)}
					<p id={messageId}>{resolvedMessage}</p>
				</div>
			)}

			{showActions && (
				<div
					className="south-coach-nudge__actions"
					aria-label={`AI Coach nudge actions for ${displayedSeatName}`}
					aria-describedby={safeState === 'idle' ? undefined : messageId}>
					{showRetry && (
						<button type="button" onClick={onRequest} disabled={disabled}>
							Try again
						</button>
					)}
					{showMore && (
						<button type="button" onClick={onMore} disabled={disabled}>
							{effectiveMoreLabel}
						</button>
					)}
					{onClose && (
						<button
							type="button"
							className="south-coach-nudge__close"
							onClick={onClose}
							aria-label={`Dismiss AI Coach nudge for ${displayedSeatName}`}>
							Close
						</button>
					)}
				</div>
			)}
		</aside>
	)
}
