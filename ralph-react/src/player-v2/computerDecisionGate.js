export function createComputerDecisionGate() {
	let revision = 0
	return {
		issue(fingerprint) {
			revision += 1
			return { revision, fingerprint }
		},
		cancel() {
			revision += 1
		},
		isCurrent(ticket, fingerprint) {
			return !!ticket && ticket.revision === revision && ticket.fingerprint === fingerprint
		},
	}
}
