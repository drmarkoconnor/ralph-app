import CoachOwnerAuthForm from './CoachOwnerAuthForm.jsx'
import SouthCoachNudge from './SouthCoachNudge.jsx'

function CoachAccessCard({ coach, presentationMode = false, className = '' }) {
	const signedIn = !!coach.identity.user
	const configured = coach.access?.configured !== false && coach.access?.enabled !== false
	return (
		<aside
			className={`player-coach-access ${presentationMode ? 'player-coach-access--presentation' : ''} ${className}`.trim()}
			aria-label="AI Coach access">
			<div className="player-coach-access__heading">
				<div>
					<span>Optional teaching aid</span>
					<strong>AI Coach</strong>
				</div>
				<button type="button" onClick={coach.closeAccess} aria-label="Close AI Coach access">
					×
				</button>
			</div>
			{!configured ? (
				<p className="player-coach-access__notice" role="status">
					Coach calls are temporarily unavailable. The bridge player still works normally.
				</p>
			) : signedIn && !coach.authorized ? (
				<>
					<p className="player-coach-access__notice">
						This signed-in account is not currently authorised for AI Coach.
					</p>
					<div className="player-coach-access__actions">
						<a className="player-coach-access__primary" href={`mailto:${coach.contactEmail}?subject=AI%20Coach%20access`}>
							Email Mark
						</a>
						<button type="button" className="player-coach-access__secondary" onClick={coach.signOut}>
							Sign out
						</button>
					</div>
				</>
			) : coach.signInOpen || coach.identity.flow ? (
				<>
					<p className="player-coach-access__intro">Sign in with an invited Coach account.</p>
					<CoachOwnerAuthForm
						identityAvailable={coach.identity.identityAvailable}
						flow={coach.identity.flow}
						loading={coach.identity.loading}
						onSignIn={coach.signIn}
						onAcceptInvite={coach.acceptInvite}
						onFinishRecovery={coach.finishRecovery}
						onSendRecovery={coach.sendRecovery}
					/>
					{!coach.identity.flow && (
						<button
							type="button"
							className="player-coach-access__secondary"
							onClick={() => coach.setSignInOpen(false)}>
							Back
						</button>
					)}
				</>
			) : (
				<>
					<p className="player-coach-access__price">£10 per month</p>
					<p className="player-coach-access__intro">
						Gentle bidding and play nudges for up to 100 AI-assisted deals each month. The
						 Bridge Player stays free.
					</p>
					<div className="player-coach-access__actions">
						<a className="player-coach-access__primary" href={`mailto:${coach.contactEmail}?subject=AI%20Coach%20access`}>
							Email Mark
						</a>
						<button type="button" className="player-coach-access__secondary" onClick={coach.openSignIn}>
							Sign in
						</button>
					</div>
				</>
			)}
			{(coach.identity.error || coach.accessError) && (
				<p className="player-coach-access__error" role="alert">
					{coach.identity.error || coach.accessError}
				</p>
			)}
		</aside>
	)
}

export default function PlayerCoachNudge({ coach, presentationMode = false, className = '' }) {
	if (!coach?.eligible) return null
	if (presentationMode && !coach.authorized) return null
	if (coach.accessLoading) {
		return (
			<div className={`player-coach-locked ${className}`.trim()} role="status">
				Checking AI Coach…
			</div>
		)
	}
	if (!coach.authorized) {
		if (coach.accessOpen) {
			return (
				<CoachAccessCard
					coach={coach}
					presentationMode={presentationMode}
					className={className}
				/>
			)
		}
		return (
			<button
				type="button"
				className={`player-coach-locked ${className}`.trim()}
				onClick={coach.openAccess}
				aria-label="Open AI Coach access information">
				<span aria-hidden="true">🔒</span> AI Coach
			</button>
		)
	}

	return (
		<SouthCoachNudge
			state={coach.nudgeState}
			message={coach.nudgeMessage}
			onRequest={() => coach.requestNudge('nudge')}
			onMore={
				coach.nudgeState === 'response' && coach.lastIntent === 'nudge'
					? () => coach.requestNudge('explain')
					: undefined
			}
			onClose={coach.nudgeState === 'idle' ? undefined : coach.dismissNudge}
			disabled={coach.nudgeState === 'loading'}
			presentationMode={presentationMode}
			focusSeat={coach.decision.learnerSeat}
			focusSeatName={coach.decision.focusName}
			requestLabel="Nudge me"
			moreLabel="Explain principle"
			usageLabel={coach.usageLabel}
			className={className}
		/>
	)
}
