import { useCallback, useEffect, useState } from 'react'
import {
	acceptInvite,
	getUser,
	handleAuthCallback,
	login,
	logout,
	onAuthChange,
	requestPasswordRecovery,
	updateUser,
} from '@netlify/identity'

function friendlyAuthError(error) {
	if (error?.name === 'MissingIdentityError') {
		return 'Coach sign-in becomes available on the Netlify preview or production site.'
	}
	if (error?.status === 401) return 'That email or password was not accepted.'
	if (error?.status === 403) return 'This account is not permitted to use the Coach.'
	return error?.message || 'Coach sign-in is temporarily unavailable.'
}

let authBootstrapPromise = null

function bootstrapCoachIdentity() {
	if (!authBootstrapPromise) {
		authBootstrapPromise = handleAuthCallback().then(async (callback) => ({
			callback,
			user: callback?.user || (await getUser()),
		}))
	}
	return authBootstrapPromise
}

export function useCoachIdentity({ enabled = true } = {}) {
	const [user, setUser] = useState(null)
	const [loading, setLoading] = useState(enabled)
	const [identityAvailable, setIdentityAvailable] = useState(true)
	const [flow, setFlow] = useState(null)
	const [error, setError] = useState('')

	useEffect(() => {
		if (!enabled) {
			setLoading(false)
			return undefined
		}
		let active = true
		const unsubscribe = onAuthChange((event, currentUser) => {
			if (!active) return
			setUser(currentUser)
			if (event === 'recovery') setFlow({ type: 'recovery' })
		})

		;(async () => {
			try {
				const { callback, user: initialUser } = await bootstrapCoachIdentity()
				if (!active) return
				setIdentityAvailable(true)
				if (callback?.type === 'invite' && callback.token) {
					setFlow({ type: 'invite', token: callback.token })
					setUser(null)
				} else if (callback?.type === 'recovery') {
					setFlow({ type: 'recovery' })
					setUser(callback.user)
				} else {
					setUser(initialUser)
				}
			} catch (authError) {
				if (!active) return
				if (authError?.name === 'MissingIdentityError') setIdentityAvailable(false)
				else setError(friendlyAuthError(authError))
				setUser(await getUser())
			} finally {
				if (active) setLoading(false)
			}
		})()

		return () => {
			active = false
			unsubscribe()
		}
	}, [enabled])

	const runAuthAction = useCallback(async (action) => {
		setLoading(true)
		setError('')
		try {
			const nextUser = await action()
			setIdentityAvailable(true)
			if (nextUser) setUser(nextUser)
			return nextUser
		} catch (authError) {
			if (authError?.name === 'MissingIdentityError') setIdentityAvailable(false)
			setError(friendlyAuthError(authError))
			return null
		} finally {
			setLoading(false)
		}
	}, [])

	const signIn = useCallback(
		(email, password) => runAuthAction(() => login(email.trim(), password)),
		[runAuthAction],
	)

	const signOut = useCallback(
		() =>
			runAuthAction(async () => {
				await logout()
				setUser(null)
				setFlow(null)
				return null
			}),
		[runAuthAction],
	)

	const acceptOwnerInvite = useCallback(
		(password) => {
			if (flow?.type !== 'invite' || !flow.token) return Promise.resolve(null)
			return runAuthAction(async () => {
				const invitedUser = await acceptInvite(flow.token, password)
				setFlow(null)
				return invitedUser
			})
		},
		[flow, runAuthAction],
	)

	const finishPasswordRecovery = useCallback(
		(password) =>
			runAuthAction(async () => {
				const recoveredUser = await updateUser({ password })
				setFlow(null)
				return recoveredUser
			}),
		[runAuthAction],
	)

	const sendPasswordRecovery = useCallback(async (email) => {
		setLoading(true)
		setError('')
		try {
			await requestPasswordRecovery(email.trim())
			setIdentityAvailable(true)
			return true
		} catch (authError) {
			if (authError?.name === 'MissingIdentityError') setIdentityAvailable(false)
			setError(friendlyAuthError(authError))
			return false
		} finally {
			setLoading(false)
		}
	}, [])

	return {
		user,
		loading,
		identityAvailable,
		flow,
		error,
		clearError: () => setError(''),
		signIn,
		signOut,
		acceptOwnerInvite,
		finishPasswordRecovery,
		sendPasswordRecovery,
	}
}
