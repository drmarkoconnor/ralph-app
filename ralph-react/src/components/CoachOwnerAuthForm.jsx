import { useState } from 'react'

export default function CoachOwnerAuthForm({
	identityAvailable = true,
	flow = null,
	loading = false,
	onSignIn,
	onAcceptInvite,
	onFinishRecovery,
	onSendRecovery,
}) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [forgotPassword, setForgotPassword] = useState(false)
	const [notice, setNotice] = useState('')

	if (!identityAvailable) {
		return (
			<div className="coach-owner-auth-note" role="status">
				Coach authentication is available on a Netlify preview or the live site. The local
				Vite screen can still be used to review the Coach layout.
			</div>
		)
	}

	const passwordFlow = flow?.type === 'invite' || flow?.type === 'recovery'
	const title =
		flow?.type === 'invite'
			? 'Set the password for your invited Coach account'
			: flow?.type === 'recovery'
				? 'Choose a new Coach password'
				: forgotPassword
					? 'Request a password reset'
					: 'Coach sign in'

	const submit = async (event) => {
		event.preventDefault()
		setNotice('')
		if (passwordFlow && password !== confirmPassword) {
			setNotice('The two passwords do not match.')
			return
		}
		if (flow?.type === 'invite') await onAcceptInvite?.(password)
		else if (flow?.type === 'recovery') await onFinishRecovery?.(password)
		else if (forgotPassword) {
			const sent = await onSendRecovery?.(email)
			if (sent) setNotice('If this is your invited account, a password-reset email is on its way.')
		} else await onSignIn?.(email, password)
	}

	return (
		<form className="coach-owner-auth-form" onSubmit={submit}>
		<strong>{title}</strong>
		{!passwordFlow && (
			<label>
				Email
				<input
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					autoComplete="email"
					required
				/>
			</label>
		)}
		{!forgotPassword && (
			<label>
				{passwordFlow ? 'New password' : 'Password'}
				<input
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete={passwordFlow ? 'new-password' : 'current-password'}
					minLength={8}
					required
				/>
			</label>
		)}
		{passwordFlow && (
			<label>
				Confirm new password
				<input
					type="password"
					value={confirmPassword}
					onChange={(event) => setConfirmPassword(event.target.value)}
					autoComplete="new-password"
					minLength={8}
					required
				/>
			</label>
		)}
		{notice && <span role="status">{notice}</span>}
		<button type="submit" className="ai-coach-login" disabled={loading}>
			{loading
				? 'Please wait…'
				: flow?.type === 'invite'
					? 'Accept invitation'
					: flow?.type === 'recovery'
						? 'Save new password'
						: forgotPassword
							? 'Send reset email'
							: 'Sign in'}
		</button>
		{!passwordFlow && (
			<button
				type="button"
				className="ai-coach-text-button"
				onClick={() => {
					setForgotPassword((current) => !current)
					setNotice('')
				}}>
				{forgotPassword ? 'Back to sign in' : 'Forgot password?'}
			</button>
		)}
	</form>
	)
}
