import { useEffect, useId, useMemo, useRef, useState } from 'react'

import './AiCoachPanel.css'

const DEFAULT_PHASES = [
	{ id: 'bidding', label: 'Bidding' },
	{ id: 'opening-lead', label: 'Opening lead' },
	{ id: 'card-play', label: 'Card play' },
]

const DEFAULT_QUICK_ACTIONS = [
	{ id: 'count-trumps', label: 'How many trumps remain?' },
	{ id: 'highest-outstanding', label: 'Highest card still outstanding?' },
	{ id: 'what-to-count', label: 'What should I count?' },
]

const DEFAULT_PAID_ACTIONS = [
	{ id: 'nudge', label: 'Gentle nudge', description: 'A short prompt, without naming the answer' },
	{ id: 'explain', label: 'Explain', description: 'Explain the lesson behind this position' },
	{ id: 'compare', label: 'Compare choices', description: 'Discuss the merits of the sensible options' },
	{ id: 'remember', label: 'Remember', description: 'Summarise what to carry into the next decision' },
]

const FOCUSABLE_SELECTOR = [
	'button:not([disabled])',
	'[href]',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',')

function entryTone(role) {
	if (role === 'teacher' || role === 'user') return 'ai-coach-entry--teacher'
	if (role === 'fact' || role === 'local') return 'ai-coach-entry--fact'
	if (role === 'system') return 'ai-coach-entry--system'
	return 'ai-coach-entry--coach'
}

function groupTranscript(transcript, phases) {
	const configured = phases.map((phase) => ({ ...phase, entries: [] }))
	const byId = new Map(configured.map((phase) => [phase.id, phase]))

	for (const entry of transcript) {
		const phaseId = entry.phase || 'card-play'
		if (!byId.has(phaseId)) {
			const fallback = { id: phaseId, label: entry.phaseLabel || phaseId, entries: [] }
			configured.push(fallback)
			byId.set(phaseId, fallback)
		}
		byId.get(phaseId).entries.push(entry)
	}

	return configured.filter((phase) => phase.entries.length > 0)
}

/**
 * Projector-friendly, controlled UI shell for the private AI Coach.
 * It deliberately contains no authentication, bridge-state, or API logic.
 */
export default function AiCoachPanel({
	isOpen,
	onClose,
	sessionKey = '',
	authStatus = 'signed-out',
	authMessage = '',
	authContent = null,
	authTitle = 'Sign in to continue with AI Coach',
	authDescription = 'The bridge player remains free to use. Sign in for further paid AI coaching, or request access from the teacher.',
	ownerLabel = 'Private owner access',
	onLogin,
	onLogout,
	focusSeat = 'S',
	focusSeatName = 'South',
	activePhase = 'bidding',
	phases = DEFAULT_PHASES,
	manualTeachingMode = true,
	onManualTeachingModeChange,
	transcript = [],
	loading = false,
	loadingMessage = 'Coach is preparing a short teaching prompt…',
	error = '',
	quickActions = DEFAULT_QUICK_ACTIONS,
	onQuickAction,
	paidActions = DEFAULT_PAID_ACTIONS,
	onPaidAction,
	showFollowUp = true,
	onSubmitFollowUp,
	followUpPlaceholder = 'Ask a follow-up without revealing hidden hands…',
	usageLabel = 'Paid calls are protected',
	actionsDisabled = false,
	closeOnBackdrop = true,
}) {
	const titleId = useId()
	const descriptionId = useId()
	const panelRef = useRef(null)
	const closeButtonRef = useRef(null)
	const transcriptRef = useRef(null)
	const transcriptEndRef = useRef(null)
	const [followUp, setFollowUp] = useState('')
	const [stickToBottom, setStickToBottom] = useState(true)
	const groupedTranscript = useMemo(
		() => groupTranscript(transcript, phases),
		[transcript, phases],
	)
	const activePhaseLabel =
		phases.find((phase) => phase.id === activePhase)?.label || activePhase || 'Current position'
	const isSignedIn = authStatus === 'signed-in' || authStatus === 'authenticated'
	const isCheckingAuth = authStatus === 'checking' || authStatus === 'loading'

	useEffect(() => {
		setFollowUp('')
		setStickToBottom(true)
	}, [sessionKey])

	useEffect(() => {
		if (!isOpen) {
			setFollowUp('')
			setStickToBottom(true)
		}
	}, [isOpen])

	useEffect(() => {
		if (!isOpen) return undefined
		const previouslyFocused = document.activeElement
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)
		const onKeyDown = (event) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				onClose?.()
				return
			}
			if (event.key !== 'Tab' || !panelRef.current) return

			const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
			if (!focusable.length) {
				event.preventDefault()
				panelRef.current.focus()
				return
			}
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault()
				first.focus()
			}
		}

		document.addEventListener('keydown', onKeyDown)
		return () => {
			window.clearTimeout(focusTimer)
			document.removeEventListener('keydown', onKeyDown)
			document.body.style.overflow = previousOverflow
			previouslyFocused?.focus?.()
		}
	}, [isOpen, onClose])

	useEffect(() => {
		if (!isOpen || !stickToBottom) return
		transcriptEndRef.current?.scrollIntoView({ block: 'nearest' })
	}, [isOpen, transcript, loading, stickToBottom])

	if (!isOpen) return null

	const handleTranscriptScroll = () => {
		const element = transcriptRef.current
		if (!element) return
		const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
		setStickToBottom(distanceFromBottom < 80)
	}

	const handleFollowUpSubmit = (event) => {
		event.preventDefault()
		const question = followUp.trim()
		if (!question || loading || actionsDisabled || !onSubmitFollowUp) return
		onSubmitFollowUp(question)
		setFollowUp('')
	}

	const handleBackdropMouseDown = (event) => {
		if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
	}

	return (
		<div className="ai-coach-overlay" onMouseDown={handleBackdropMouseDown}>
			<section
				ref={panelRef}
				className="ai-coach-panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
				tabIndex={-1}>
				<header className="ai-coach-header">
					<div className="ai-coach-heading">
						<p className="ai-coach-eyebrow">{ownerLabel}</p>
						<h2 id={titleId}>AI Coach</h2>
						<p id={descriptionId} className="ai-coach-subtitle">
							Gentle bridge prompts using only information the learner is allowed to know.
						</p>
					</div>
					<div className="ai-coach-header-actions">
						<div className="ai-coach-seat" aria-label={`Coaching focus: ${focusSeatName}`}>
							<span className="ai-coach-seat-letter" aria-hidden="true">
								{focusSeat}
							</span>
							<span>{focusSeatName}</span>
						</div>
						<button
							ref={closeButtonRef}
							type="button"
							className="ai-coach-close"
							onClick={onClose}
							aria-label="Close AI Coach">
							<span aria-hidden="true">×</span>
						</button>
					</div>
				</header>

				{!isSignedIn ? (
					<div className="ai-coach-auth" aria-live="polite">
						<div className="ai-coach-lock" aria-hidden="true">
							Private
						</div>
						<h3>{isCheckingAuth ? 'Checking Coach access…' : authTitle}</h3>
						<p>{authDescription}</p>
						{authMessage && <p className="ai-coach-auth-message">{authMessage}</p>}
						{!isCheckingAuth && authContent}
						{!isCheckingAuth && !authContent && (
							<button type="button" className="ai-coach-login" onClick={onLogin} disabled={!onLogin}>
								Owner sign in
							</button>
						)}
					</div>
				) : (
					<>
						<div className="ai-coach-toolbar">
							<div>
								<span className="ai-coach-toolbar-label">Current stage</span>
								<strong>{activePhaseLabel}</strong>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={manualTeachingMode}
								className={`ai-coach-mode ${manualTeachingMode ? 'ai-coach-mode--active' : ''}`}
								onClick={() => onManualTeachingModeChange?.(!manualTeachingMode)}
								disabled={!onManualTeachingModeChange}>
								<span className="ai-coach-mode-indicator" aria-hidden="true" />
								<span>
									<strong>Manual safe mode</strong>
									<small>
										{manualTeachingMode
											? 'Coach responds only when you ask'
											: 'Automatic coaching may use paid calls'}
									</small>
								</span>
							</button>
							{onLogout && (
								<button type="button" className="ai-coach-text-button" onClick={onLogout}>
									Sign out
								</button>
							)}
						</div>

						{error && (
							<div className="ai-coach-error" role="alert">
								<strong>Coach unavailable.</strong> {error}
							</div>
						)}

						<div
							ref={transcriptRef}
							className="ai-coach-transcript"
							onScroll={handleTranscriptScroll}
							aria-label="AI Coach conversation"
							aria-live="polite">
							{groupedTranscript.length === 0 && !loading ? (
								<div className="ai-coach-empty">
									<strong>Ready when you are.</strong>
									<p>
										Use a free fact button, or request a gentle AI nudge for the current
										position.
									</p>
								</div>
							) : (
								groupedTranscript.map((phase) => (
									<section key={phase.id} className="ai-coach-phase" aria-labelledby={`${titleId}-${phase.id}`}>
										<h3 id={`${titleId}-${phase.id}`}>{phase.label}</h3>
										<ol>
											{phase.entries.map((entry, index) => (
												<li
													key={entry.id || `${phase.id}-${index}`}
													className={`ai-coach-entry ${entryTone(entry.role)}`}>
													<div className="ai-coach-entry-meta">
														<strong>{entry.label || (entry.role === 'teacher' ? 'You' : 'Coach')}</strong>
														{entry.time && <time>{entry.time}</time>}
													</div>
													<p>{entry.text}</p>
												</li>
											))}
										</ol>
									</section>
								))
							)}
							{loading && (
								<div className="ai-coach-loading" role="status">
									<span className="ai-coach-loading-dot" aria-hidden="true" />
									{loadingMessage}
								</div>
							)}
							<div ref={transcriptEndRef} />
						</div>

						<footer className="ai-coach-footer">
							<section className="ai-coach-action-section" aria-labelledby={`${titleId}-free-actions`}>
								<div className="ai-coach-section-heading">
									<h3 id={`${titleId}-free-actions`}>Known facts</h3>
									<span className="ai-coach-free-badge">No AI cost</span>
								</div>
								<div className="ai-coach-quick-actions">
									{quickActions.map((action) => (
										<button
											type="button"
											key={action.id}
											onClick={() => onQuickAction?.(action.id)}
											disabled={action.disabled || !onQuickAction}>
											{action.label}
										</button>
									))}
								</div>
							</section>

							<section className="ai-coach-action-section" aria-labelledby={`${titleId}-paid-actions`}>
								<div className="ai-coach-section-heading">
									<h3 id={`${titleId}-paid-actions`}>Ask the coach</h3>
									<span className="ai-coach-paid-badge">Uses paid AI</span>
								</div>
								<div className="ai-coach-paid-actions">
									{paidActions.map((action) => (
										<button
											type="button"
											key={action.id}
											onClick={() => onPaidAction?.(action.id)}
											disabled={loading || actionsDisabled || action.disabled || !onPaidAction}
											aria-label={`${action.label}. Uses paid AI.`}>
											<strong>{action.label}</strong>
											{action.description && <small>{action.description}</small>}
										</button>
									))}
								</div>
							</section>

							{showFollowUp && onSubmitFollowUp && (
								<form className="ai-coach-follow-up" onSubmit={handleFollowUpSubmit}>
									<label htmlFor={`${titleId}-follow-up`}>Ask a follow-up question</label>
									<div>
										<input
											id={`${titleId}-follow-up`}
											type="text"
											value={followUp}
											onChange={(event) => setFollowUp(event.target.value)}
											placeholder={followUpPlaceholder}
											maxLength={500}
											disabled={loading || actionsDisabled}
										/>
										<button
											type="submit"
											disabled={!followUp.trim() || loading || actionsDisabled}
											aria-label="Ask the AI Coach. Uses paid AI.">
											Ask coach
										</button>
									</div>
								</form>
							)}

							<div className="ai-coach-usage">
								<span>{usageLabel}</span>
								<span>Hidden hands are never sent</span>
							</div>
						</footer>
					</>
				)}
			</section>
		</div>
	)
}
