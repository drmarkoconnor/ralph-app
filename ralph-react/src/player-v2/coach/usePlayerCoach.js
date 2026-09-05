import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCoachIdentity } from '../../hooks/useCoachIdentity.js'
import { buildLearnerCoachContext } from './buildCoachContext.js'
import { getBridgeCoachAccess, requestBridgeCoach } from './coachClient.js'
import { buildCoachDealFingerprint } from './coachDealFingerprint.js'
import {
	coachDecisionForState,
	coachOfferWasSeen,
	compactCoachReply,
	rememberCoachOffer,
} from './playerCoachState.js'

const DEFAULT_CONTACT_EMAIL = 'bridge@markoconnor.ai'

function accessIsAuthorized(access) {
	return (
		access?.authorized === true ||
		access?.access === 'owner' ||
		access?.access === 'subscriber'
	)
}

export function usePlayerCoach({ state, derived, controlledSeats, enabled = true }) {
	const identity = useCoachIdentity({ enabled })
	const [access, setAccess] = useState(null)
	const [accessLoading, setAccessLoading] = useState(enabled)
	const [accessError, setAccessError] = useState('')
	const [accessOpen, setAccessOpen] = useState(false)
	const [signInOpen, setSignInOpen] = useState(false)
	const [offerSeen, setOfferSeen] = useState(() => coachOfferWasSeen())
	const [nudgeState, setNudgeState] = useState('idle')
	const [nudgeMessage, setNudgeMessage] = useState('')
	const [lastIntent, setLastIntent] = useState('nudge')
	const requestAbortRef = useRef(null)
	const accessRequestRef = useRef(0)
	const autoOfferOpenRef = useRef(false)

	const decision = useMemo(
		() => (enabled ? coachDecisionForState(state, derived, controlledSeats) : null),
		[state, derived, controlledSeats, enabled],
	)
	const context = useMemo(() => {
		if (!decision) return null
		return buildLearnerCoachContext(state, {
			trigger: 'manual',
			learnerSeat: decision.learnerSeat,
			controlledSeats: [...controlledSeats],
		})
	}, [decision, state, controlledSeats])
	const positionKey = context
		? `${state.index}:${context.eventKey}:${decision?.learnerSeat || 'S'}`
		: ''
	const authorized = accessIsAuthorized(access)

	const refreshAccess = useCallback(async () => {
		if (!enabled) {
			setAccessLoading(false)
			return null
		}
		const requestId = accessRequestRef.current + 1
		accessRequestRef.current = requestId
		setAccessLoading(true)
		setAccessError('')
		try {
			const nextAccess = await getBridgeCoachAccess()
			if (accessRequestRef.current !== requestId) return null
			setAccess(nextAccess)
			if (accessIsAuthorized(nextAccess)) {
				setAccessOpen(false)
				setSignInOpen(false)
			}
			return nextAccess
		} catch (error) {
			if (accessRequestRef.current !== requestId) return null
			setAccess(null)
			setAccessError(error?.message || 'Coach access could not be checked just now.')
			return null
		} finally {
			if (accessRequestRef.current === requestId) setAccessLoading(false)
		}
	}, [enabled])

	useEffect(() => {
		if (!enabled) {
			accessRequestRef.current += 1
			requestAbortRef.current?.abort()
			requestAbortRef.current = null
			setAccess(null)
			setAccessLoading(false)
			setAccessOpen(false)
			setSignInOpen(false)
			autoOfferOpenRef.current = false
			return
		}
		if (identity.loading) return
		void refreshAccess()
	}, [enabled, identity.loading, identity.user?.id, refreshAccess])

	useEffect(() => {
		if (enabled && identity.flow) {
			autoOfferOpenRef.current = false
			setAccessOpen(true)
			setSignInOpen(true)
		}
	}, [enabled, identity.flow])

	useEffect(() => {
		if (decision || !autoOfferOpenRef.current) return
		autoOfferOpenRef.current = false
		setAccessOpen(false)
	}, [decision])

	useEffect(() => {
		if (!enabled || offerSeen || accessLoading || identity.loading || authorized || !decision) {
			return
		}
		rememberCoachOffer()
		setOfferSeen(true)
		autoOfferOpenRef.current = true
		setAccessOpen(true)
	}, [accessLoading, authorized, decision, enabled, identity.loading, offerSeen])

	useEffect(() => {
		requestAbortRef.current?.abort()
		requestAbortRef.current = null
		setNudgeState('idle')
		setNudgeMessage('')
		setLastIntent('nudge')
	}, [positionKey])

	useEffect(
		() => () => {
			requestAbortRef.current?.abort()
			accessRequestRef.current += 1
		},
		[],
	)

	const markOfferSeen = useCallback(() => {
		rememberCoachOffer()
		setOfferSeen(true)
	}, [])

	const openAccess = useCallback(() => {
		markOfferSeen()
		autoOfferOpenRef.current = false
		setAccessOpen(true)
	}, [markOfferSeen])

	const closeAccess = useCallback(() => {
		markOfferSeen()
		autoOfferOpenRef.current = false
		setAccessOpen(false)
		setSignInOpen(false)
		identity.clearError()
	}, [identity, markOfferSeen])

	const openSignIn = useCallback(() => {
		markOfferSeen()
		autoOfferOpenRef.current = false
		setAccessOpen(true)
		setSignInOpen(true)
	}, [markOfferSeen])

	const runIdentityAction = useCallback(
		async (action) => {
			const result = await action()
			if (result) await refreshAccess()
			return result
		},
		[refreshAccess],
	)

	const requestNudge = useCallback(
		async (intent = 'nudge') => {
			if (!enabled) return
			if (!authorized) {
				openAccess()
				return
			}
			if (!context || !decision) return
			requestAbortRef.current?.abort()
			const controller = new AbortController()
			requestAbortRef.current = controller
			setLastIntent(intent)
			setNudgeState('loading')
			setNudgeMessage('')
			try {
				const dealFingerprint = await buildCoachDealFingerprint(state)
				const payload = await requestBridgeCoach({
					context,
					dealFingerprint,
					intent,
					signal: controller.signal,
				})
				if (controller.signal.aborted) return
				setNudgeMessage(compactCoachReply(payload?.coach, intent))
				setNudgeState('response')
				if (payload?.meta?.access === 'owner' || payload?.meta?.access === 'subscriber') {
					setAccess((current) => ({
						...(current || {}),
						authorized: true,
						access: payload.meta.access,
					}))
				}
				if (access?.access === 'subscriber') void refreshAccess()
			} catch (error) {
				if (controller.signal.aborted || error?.name === 'AbortError') return
				if (error?.accessRequired || error?.status === 401 || error?.status === 403) {
					setNudgeState('access-required')
					setNudgeMessage('Sign in with an active Coach account to request another nudge.')
					setAccessOpen(true)
					void refreshAccess()
					return
				}
				setNudgeState('error')
				setNudgeMessage(error?.message || 'The Coach could not respond just now.')
			} finally {
				if (requestAbortRef.current === controller) requestAbortRef.current = null
			}
		},
		[access?.access, authorized, context, decision, enabled, openAccess, refreshAccess, state],
	)

	const dismissNudge = useCallback(() => {
		requestAbortRef.current?.abort()
		requestAbortRef.current = null
		setNudgeState('idle')
		setNudgeMessage('')
		setLastIntent('nudge')
	}, [])

	const entitlement = access?.entitlement || access?.usage || null
	const usageLabel =
		access?.access === 'subscriber' && Number.isFinite(entitlement?.dealsUsed)
			? `${entitlement.dealsUsed} of ${entitlement.dealLimit || 100} deals used`
			: access?.access === 'owner'
				? 'Private owner access'
				: ''

	return {
		enabled,
		eligible: enabled && !!decision,
		decision,
		authorized,
		access,
		accessLoading: accessLoading || identity.loading,
		accessError,
		accessOpen: enabled && accessOpen,
		signInOpen,
		nudgeState,
		nudgeMessage,
		lastIntent,
		usageLabel,
		contactEmail: access?.contactEmail || DEFAULT_CONTACT_EMAIL,
		identity,
		openAccess,
		closeAccess,
		openSignIn,
		setSignInOpen,
		requestNudge,
		dismissNudge,
		refreshAccess,
		signIn: (email, password) => runIdentityAction(() => identity.signIn(email, password)),
		acceptInvite: (password) => runIdentityAction(() => identity.acceptOwnerInvite(password)),
		finishRecovery: (password) =>
			runIdentityAction(() => identity.finishPasswordRecovery(password)),
		sendRecovery: identity.sendPasswordRecovery,
		signOut: async () => {
			await identity.signOut()
			setAccess(null)
			autoOfferOpenRef.current = false
			setAccessOpen(true)
			setSignInOpen(true)
			await refreshAccess()
		},
	}
}
