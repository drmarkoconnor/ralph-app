function result(ok, outcome, error) {
	return error === undefined ? { ok, outcome } : { ok, outcome, error }
}

function currentDocument(documentRef) {
	if (documentRef !== undefined) return documentRef
	return typeof document === 'undefined' ? null : document
}

/**
 * Request fullscreen for the whole Player document without leaking Fullscreen
 * API exceptions into the React event handler.
 */
export async function requestPlayerFullscreen(documentRef) {
	const targetDocument = currentDocument(documentRef)
	if (targetDocument?.fullscreenElement) {
		return result(true, 'already-active')
	}

	const requestFullscreen = targetDocument?.documentElement?.requestFullscreen
	if (typeof requestFullscreen !== 'function') {
		return result(false, 'unsupported')
	}

	try {
		await requestFullscreen.call(targetDocument.documentElement)
		return result(true, 'success')
	} catch (error) {
		return result(false, 'denied', error)
	}
}

/**
 * A successful request is owned by the Player only when it actually caused
 * fullscreen. An already-fullscreen document belongs to the browser or the
 * surrounding page and must not be exited by the Player's restore control.
 */
export function playerAcquiredFullscreen(fullscreenResult, fullscreenElement, requestedElement) {
	return (
		fullscreenResult?.ok === true &&
		fullscreenResult.outcome === 'success' &&
		fullscreenElement === requestedElement
	)
}

/**
 * Leave fullscreen when it is active. Calling this while already windowed is a
 * successful no-op, which keeps restore controls safe to use repeatedly.
 */
export async function exitPlayerFullscreen(documentRef) {
	const targetDocument = currentDocument(documentRef)
	if (!targetDocument) {
		return result(false, 'unsupported')
	}
	if (!targetDocument.fullscreenElement) {
		return result(true, 'already-inactive')
	}
	if (typeof targetDocument.exitFullscreen !== 'function') {
		return result(false, 'unsupported')
	}

	try {
		await targetDocument.exitFullscreen.call(targetDocument)
		return result(true, 'success')
	} catch (error) {
		return result(false, 'exit-failure', error)
	}
}
