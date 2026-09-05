#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { stableDealToHands } from '../../src/player-v2/bridgeV2.js'
import { canonicalCoachDeal } from '../../src/player-v2/coach/coachDealFingerprint.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectDirectory = path.resolve(scriptDirectory, '../..')
const publicDirectory = path.join(projectDirectory, 'public', 'competitions')
const generatedCataloguePath = path.join(
	projectDirectory,
	'src',
	'data',
	'competitionPacks.generated.js',
)
const PACK_SCHEMA_VERSION = 1
const IMPORTER_ID = 'ralph-usbf-competition-importer-v1'
const RETRIEVED_ON = '2026-09-05'
const COACH_POLICY = 'authenticated-entitlement'

const SOURCES = Object.freeze([
	{
		id: 'usbf-2026-open-final-segment-1',
		title: '2026 Open USBC Final — Segment 1',
		shortTitle: 'Play the 2026 US Final',
		event: 'Open United States Bridge Championship Final',
		date: '2026-04-20',
		recordDateOverride: '2026.04.20',
		sourceCorrectionNote:
			'The source PBN labels these Final Segment 1 records 2026.04.13; the official USBF daily schedule places Final Segment 1 on 2026.04.20.',
		boardNumbers: Array.from({ length: 15 }, (_, index) => index + 1),
		preferredRoom: 'Open',
		sourceUrl:
			'https://www.usbf.org/docs/2026usbc/lb_files/2026_open_f/2026_open_f_s1_Final1.pbn',
		eventUrl: 'https://www.usbf.org/2026-usbcs/links-to-complete-bidding-and-play-records',
		expectedSourceSha256: '8418b7aa4433d56994f0c2b6a3f9cc4b2f6cabaaccfcafbf4d6b7f2a52c80a77',
		attribution:
			'United States Bridge Federation (USBF); bidding and play captured by LoveBridge.',
		rightsNote:
			'Official publicly downloadable tournament record. No explicit redistribution licence was located; retain attribution and review permission before commercial publication.',
	},
	{
		id: 'usbf-2019-open-quarterfinal-segment-4',
		title: '2019 Open USBC Quarterfinal — Match 3, Segment 4',
		shortTitle: 'Compare Two Expert Tables',
		event: 'Open United States Bridge Championship Quarterfinal',
		date: '2019-05-15',
		boardNumbers: Array.from({ length: 15 }, (_, index) => index + 16),
		preferredRoom: 'Open',
		sourceUrl: 'https://usbf.org/docs/vugraphs/USBC2019/pbns/USBC2019_QF_3_s4.pbn',
		eventUrl: 'https://usbf.org/docs/vugraphs/USBC2019/USBC2019_QF_3_s4_scores.html',
		expectedSourceSha256: '9f45ba98ee581d1edbee97befe7161d8a8a1855dcb23de68951e5ea6cf76c707',
		attribution:
			'United States Bridge Federation (USBF); tournament record published through the USBF vugraph archive.',
		rightsNote:
			'Official publicly downloadable tournament record. No explicit redistribution licence was located; retain attribution and review permission before commercial publication.',
	},
])

function sha256(value) {
	return createHash('sha256').update(value).digest('hex')
}

function normalizeText(value) {
	return String(value || '')
		.replace(/^\uFEFF/, '')
		.replace(/\r\n?/g, '\n')
}

function parseTags(raw) {
	const tags = new Map()
	for (const match of raw.matchAll(/^\[([^\s]+)\s+"([^"]*)"\]\s*$/gm)) {
		const values = tags.get(match[1]) || []
		values.push(match[2])
		tags.set(match[1], values)
	}
	return tags
}

function tag(record, name) {
	return record.tags.get(name)?.at(-1) || ''
}

function sectionBody(raw, sectionName) {
	const lines = raw.split('\n')
	const start = lines.findIndex((line) =>
		new RegExp(`^\\[${sectionName}\\s+"`, 'i').test(line.trim()),
	)
	if (start < 0) return ''
	const body = []
	for (let index = start + 1; index < lines.length; index += 1) {
		const line = lines[index]
		if (/^\s*\[/.test(line)) break
		body.push(line)
	}
	return body.join('\n').trim()
}

function parseRecords(sourceText) {
	const text = normalizeText(sourceText)
	const starts = [...text.matchAll(/^\[Event\s+"/gm)].map((match) => match.index)
	if (!starts.length) throw new Error('The source did not contain any PBN Event records.')
	return starts.map((start, index) => {
		const end = starts[index + 1] ?? text.length
		const raw = text.slice(start, end).trim()
		const tags = parseTags(raw)
		const boardNumber = Number(tags.get('Board')?.at(-1))
		if (!Number.isInteger(boardNumber) || boardNumber < 1) {
			throw new Error(`Record ${index + 1} has no valid Board tag.`)
		}
		return {
			raw,
			tags,
			boardNumber,
			room: tags.get('Room')?.at(-1) || 'Unspecified',
			auctionBody: sectionBody(raw, 'Auction'),
			playBody: sectionBody(raw, 'Play'),
		}
	})
}

function cardTokens(playBody) {
	return playBody
		.split(/\s+/)
		.map((token) => token.trim().toUpperCase())
		.filter((token) => /^[SHDC](?:[2-9TJQKA])$/.test(token))
}

function auctionCalls(auctionBody) {
	return auctionBody
		.replace(/=\d+=|\$\d+/g, ' ')
		.split(/\s+/)
		.map((token) => token.replace(/[.,;:]+$/g, '').trim().toUpperCase())
		.filter((token) => /^(?:PASS|P|X|XX|[1-7](?:C|D|H|S|N|NT))$/.test(token))
}

function normalizeVulnerability(value) {
	const vulnerability = String(value || '').trim().toUpperCase()
	if (vulnerability === 'NS') return 'NS'
	if (vulnerability === 'EW') return 'EW'
	if (vulnerability === 'ALL' || vulnerability === 'BOTH') return 'All'
	return 'None'
}

function validatedDeal(record) {
	const deal = tag(record, 'Deal')
	const hands = stableDealToHands(deal)
	const cards = Object.values(hands).flat()
	for (const seat of ['N', 'E', 'S', 'W']) {
		if (hands[seat]?.length !== 13) {
			throw new Error(`${record.boardNumber} ${record.room}: ${seat} does not have 13 cards.`)
		}
	}
	const identities = cards.map((card) => `${card.suit}:${card.rank}`)
	if (cards.length !== 52 || new Set(identities).size !== 52) {
		throw new Error(`${record.boardNumber} ${record.room}: deal is not a unique 52-card deck.`)
	}
	return hands
}

function dealFingerprint(record) {
	const hands = validatedDeal(record)
	const canonical = canonicalCoachDeal({
		board: {
			dealer: tag(record, 'Dealer'),
			vul: normalizeVulnerability(tag(record, 'Vulnerable')),
		},
		hands,
	})
	if (!canonical) throw new Error(`${record.boardNumber} ${record.room}: Coach canonical deal failed.`)
	return sha256(canonical)
}

function normalizedContract(value) {
	return String(value || '')
		.trim()
		.toUpperCase()
		.replace(/^([1-7])N(XX|X)?$/, '$1NT$2')
}

function contractOutcome(contract, tricksTaken) {
	const level = Number(String(contract).match(/^([1-7])/)?.[1])
	if (!level || !Number.isInteger(tricksTaken)) return null
	const difference = tricksTaken - (level + 6)
	return difference === 0 ? '=' : difference > 0 ? `+${difference}` : String(difference)
}

function normalizedNsScore(rawScore, declarer) {
	const raw = String(rawScore || '').trim()
	const explicit = raw.match(/^(NS|EW)\s+([+-]?\d+)$/i)
	if (explicit) {
		const value = Number(explicit[2])
		return explicit[1].toUpperCase() === 'NS' ? value : -value
	}
	if (!/^[+-]?\d+$/.test(raw)) return null
	const value = Number(raw)
	return ['N', 'S'].includes(String(declarer || '').toUpperCase()) ? value : -value
}

function resultSummary(record) {
	const playCards = cardTokens(record.playBody)
	const contract = normalizedContract(tag(record, 'Contract'))
	const declarer = tag(record, 'Declarer').toUpperCase()
	const tricksTaken = Number(tag(record, 'Result'))
	const rawScore = tag(record, 'Score')
	return {
		room: record.room,
		contract,
		declarer,
		tricksTaken: Number.isInteger(tricksTaken) ? tricksTaken : null,
		contractOutcome: contractOutcome(contract, tricksTaken),
		score: {
			raw: rawScore,
			ns: normalizedNsScore(rawScore, declarer),
		},
		auctionCallCount: auctionCalls(record.auctionBody).length,
		recordedPlayCardCount: playCards.length,
		recordedPlayComplete: playCards.length === 52,
		recordedPlayEndedByClaim: /(^|\s)\*(\s|$)/.test(record.playBody),
		openingLead: playCards[0] || null,
		playLeader: tag(record, 'Play') || null,
	}
}

function comparisonResult(record) {
	const summary = resultSummary(record)
	return {
		room: summary.room,
		contract: summary.contract,
		declarer: summary.declarer,
		result: summary.tricksTaken,
		outcome: summary.contractOutcome,
		scoreNS: summary.score.ns,
		openingLead: summary.openingLead,
		auctionCallCount: summary.auctionCallCount,
		recordedPlayCardCount: summary.recordedPlayCardCount,
		recordedPlayComplete: summary.recordedPlayComplete,
		recordedPlayEndedByClaim: summary.recordedPlayEndedByClaim,
	}
}

function metadataTags(source, fingerprint) {
	return [
		`[CompetitionPack "${source.id}"]`,
		`[CompetitionSource "${source.sourceUrl}"]`,
		`[CompetitionSourceSHA256 "${source.expectedSourceSha256}"]`,
		`[CompetitionDealFingerprint "${fingerprint}"]`,
		`[CoachPolicy "${COACH_POLICY}"]`,
		`[Attribution "${source.attribution}"]`,
	]
}

function normalizeRecordForPlayer(raw, source) {
	// Some USBF exports use the valid PBN shorthand `N` for no-trumps, while
	// Ralph's player contract model uses `NT`. Keep the reviewed source checksum
	// in metadata, but make the checked-in playable copy unambiguous to the app.
	// Participant and team names are not needed for teaching or score comparison,
	// so the static public copy removes them while keeping room results intact.
	const normalized = raw
		.replace(/^\[(?:North|East|South|West|HomeTeam|VisitTeam)\s+"[^"]*"\]\s*\n?/gim, '')
		.replace(
			/^\[Contract "([1-7])N(XX|X)?"\]\s*$/gm,
			(_line, level, doubleStatus = '') => `[Contract "${level}NT${doubleStatus}"]`,
		)
	if (!source.recordDateOverride) return normalized
	return normalized.replace(
		/^\[(Date|EventDate) "[^"]*"\]\s*$/gm,
		(_line, tagName) => `[${tagName} "${source.recordDateOverride}"]`,
	)
}

function renderRecord(record, source, fingerprint) {
	const lines = normalizeRecordForPlayer(record.raw, source).split('\n')
	const insertionIndex = lines.findIndex((line) => /^\[(Auction|Play)\s+"/.test(line.trim()))
	lines.splice(insertionIndex >= 0 ? insertionIndex : lines.length, 0, ...metadataTags(source, fingerprint))
	return lines.join('\n').trim()
}

function recordsByBoard(records) {
	const grouped = new Map()
	for (const record of records) {
		const entries = grouped.get(record.boardNumber) || []
		entries.push(record)
		grouped.set(record.boardNumber, entries)
	}
	return grouped
}

function buildPack(source, sourceBytes, resolvedUrl = source.sourceUrl) {
	const sourceSha256 = sha256(sourceBytes)
	if (sourceSha256 !== source.expectedSourceSha256) {
		throw new Error(
			`${source.id}: upstream SHA-256 changed. Expected ${source.expectedSourceSha256}, received ${sourceSha256}. Review the source before updating the allowlist.`,
		)
	}
	const records = parseRecords(sourceBytes.toString('utf8'))
	const grouped = recordsByBoard(records)
	const actualBoards = [...grouped.keys()].sort((left, right) => left - right)
	if (JSON.stringify(actualBoards) !== JSON.stringify(source.boardNumbers)) {
		throw new Error(`${source.id}: board numbers differ from the reviewed allowlist.`)
	}

	const selectedRecords = []
	const boards = []
	for (const boardNumber of source.boardNumbers) {
		const boardRecords = grouped.get(boardNumber) || []
		if (boardRecords.length !== 2) {
			throw new Error(`${source.id}: board ${boardNumber} does not have exactly two room records.`)
		}
		const roomNames = boardRecords.map((record) => record.room).sort()
		if (JSON.stringify(roomNames) !== JSON.stringify(['Closed', 'Open'])) {
			throw new Error(`${source.id}: board ${boardNumber} does not contain Open and Closed rooms.`)
		}
		const deals = new Set(boardRecords.map((record) => tag(record, 'Deal').replace(/\s+/g, ' ').trim()))
		if (deals.size !== 1) {
			throw new Error(`${source.id}: room deals differ for board ${boardNumber}.`)
		}
		const fingerprints = new Set(boardRecords.map(dealFingerprint))
		if (fingerprints.size !== 1) {
			throw new Error(`${source.id}: room fingerprints differ for board ${boardNumber}.`)
		}
		const fingerprint = [...fingerprints][0]
		const selected =
			boardRecords.find((record) => record.room === source.preferredRoom) ||
			[...boardRecords].sort(
				(left, right) => cardTokens(right.playBody).length - cardTokens(left.playBody).length,
			)[0]
		const roomResults = boardRecords
			.map(resultSummary)
			.sort((left, right) => left.room.localeCompare(right.room))
		const openScore = roomResults.find((result) => result.room === 'Open')?.score.ns
		const closedScore = roomResults.find((result) => result.room === 'Closed')?.score.ns
		selectedRecords.push(renderRecord(selected, source, fingerprint))
		boards.push({
			boardNumber,
			dealer: tag(selected, 'Dealer'),
			vulnerability: normalizeVulnerability(tag(selected, 'Vulnerable')),
			dealFingerprint: fingerprint,
			coachPolicy: COACH_POLICY,
			coachAllowed: true,
			selectedRoom: selected.room,
			selectionRule: `${source.preferredRoom} room preferred; recorded-play length is the fallback`,
			selectedResult: resultSummary(selected),
			roomResults,
			comparison:
				Number.isFinite(openScore) && Number.isFinite(closedScore)
					? { openMinusClosedNsPoints: openScore - closedScore }
					: null,
		})
	}

	const pbn = [
		'% PBN 2.1',
		`% Static educational competition pack generated by ${IMPORTER_ID}`,
		`% Source: ${source.sourceUrl}`,
		`% Source SHA-256: ${sourceSha256}`,
		'%',
		...selectedRecords,
	].join('\n\n') + '\n'
	const pbnSha256 = sha256(pbn)
	const metadataPath = `/competitions/${source.id}.json`
	const pbnPath = `/competitions/${source.id}.pbn`
	const metadata = {
		schemaVersion: PACK_SCHEMA_VERSION,
		id: source.id,
		title: source.title,
		shortTitle: source.shortTitle,
		event: source.event,
		date: source.date,
		organizer: 'United States Bridge Federation',
		format: 'teams',
		scoring: 'IMP',
		boardCount: boards.length,
		boardNumbers: source.boardNumbers,
		pbnPath,
		metadataPath,
		asset: { sha256: pbnSha256, recordCount: selectedRecords.length },
		anonymization: {
			playerNameTagsRemoved: true,
			teamNameTagsRemoved: true,
			playerNamesStoredInMetadata: false,
			teamNamesStoredInMetadata: false,
		},
		source: {
			url: source.sourceUrl,
			resolvedUrl,
			eventUrl: source.eventUrl,
			sha256: sourceSha256,
			retrievedOn: RETRIEVED_ON,
			attribution: source.attribution,
			rightsNote: source.rightsNote,
			recordCount: records.length,
			rooms: ['Open', 'Closed'],
			...(source.sourceCorrectionNote
				? { correctionNote: source.sourceCorrectionNote }
				: {}),
		},
		coachPolicy: {
			mode: COACH_POLICY,
			coachAllowed: true,
			anonymousTrialAllowed: false,
			reason:
				'Competition replay is free; AI Coach nudges require an authenticated owner or subscriber entitlement.',
			fingerprintAlgorithm:
				'SHA-256 of the Player Coach v1 canonical JSON containing dealer, vulnerability and sorted N/E/S/W hands.',
		},
		boards,
		boardComparisons: boards.map((board) => ({
			boardNumber: board.boardNumber,
			dealFingerprint: board.dealFingerprint,
			coachAllowed: true,
			selectedRoom: board.selectedRoom,
			selectedResult: comparisonResult(
				grouped
					.get(board.boardNumber)
					.find((record) => record.room === board.selectedRoom),
			),
			referenceResults: grouped
				.get(board.boardNumber)
				.map(comparisonResult)
				.sort((left, right) => left.room.localeCompare(right.room)),
			comparison: board.comparison,
		})),
	}
	return { source, pbn, metadata }
}

function json(value) {
	return `${JSON.stringify(value, null, 2)}\n`
}

function containsObjectKey(value, forbiddenKey) {
	if (!value || typeof value !== 'object') return false
	if (Array.isArray(value)) {
		return value.some((entry) => containsObjectKey(entry, forbiddenKey))
	}
	return Object.entries(value).some(
		([key, entry]) => key.toLowerCase() === forbiddenKey || containsObjectKey(entry, forbiddenKey),
	)
}

function buildManifest(packs) {
	return {
		schemaVersion: PACK_SCHEMA_VERSION,
		generatedBy: IMPORTER_ID,
		generatedFromReviewedSourcesOn: RETRIEVED_ON,
		runtimeNetworkRequired: false,
		coachPolicy: COACH_POLICY,
		packCount: packs.length,
		dealCount: packs.reduce((total, pack) => total + pack.metadata.boardCount, 0),
		packs: packs.map(({ metadata }) => ({
			id: metadata.id,
			title: metadata.title,
			shortTitle: metadata.shortTitle,
			event: metadata.event,
			date: metadata.date,
			organizer: metadata.organizer,
			format: metadata.format,
			scoring: metadata.scoring,
			boardCount: metadata.boardCount,
			boardNumbers: metadata.boardNumbers,
			pbnPath: metadata.pbnPath,
			metadataPath: metadata.metadataPath,
			pbnSha256: metadata.asset.sha256,
			source: metadata.source,
			coachPolicy: metadata.coachPolicy,
		})),
	}
}

function buildCoachPolicy(packs) {
	const entries = packs.flatMap(({ metadata }) =>
		metadata.boards.map((board) => ({
			fingerprint: board.dealFingerprint,
			packId: metadata.id,
			boardNumber: board.boardNumber,
		})),
	)
	entries.sort((left, right) => left.fingerprint.localeCompare(right.fingerprint))
	const duplicateFingerprints = entries.filter(
		(entry, index) => index > 0 && entry.fingerprint === entries[index - 1].fingerprint,
	)
	if (duplicateFingerprints.length) {
		throw new Error('Competition packs unexpectedly contain duplicate canonical deals.')
	}
	return {
		schemaVersion: PACK_SCHEMA_VERSION,
		policy: COACH_POLICY,
		coachAllowed: true,
		anonymousTrialAllowed: false,
		fingerprintAlgorithm: 'ralph-player-coach-canonical-deal-v1-sha256',
		dealCount: entries.length,
		entries,
	}
}

function buildFrontendCatalogue(packs) {
	return packs.map(({ metadata }) => ({
		id: metadata.id,
		title: metadata.title,
		shortTitle: metadata.shortTitle,
		event: metadata.event,
		date: metadata.date,
		boardCount: metadata.boardCount,
		boardNumbers: metadata.boardNumbers,
		pbnPath: metadata.pbnPath,
		metadataPath: metadata.metadataPath,
		sourcePageUrl: metadata.source.eventUrl,
		sourceFileUrl: metadata.source.url,
		attribution: metadata.source.attribution,
		rightsNote: metadata.source.rightsNote,
		coachAllowed: true,
		coachPolicy: metadata.coachPolicy.mode,
	}))
}

function frontendCatalogueModule(catalogue) {
	return `// Generated by ${IMPORTER_ID}. Do not edit by hand.\n` +
		`export const competitionPacks = Object.freeze(${JSON.stringify(catalogue, null, 2)})\n\n` +
		`export default competitionPacks\n`
}

async function fetchSource(source) {
	const response = await fetch(source.sourceUrl, {
		headers: { 'User-Agent': 'RalphBridgeCompetitionImporter/1.0' },
		redirect: 'follow',
	})
	if (!response.ok) throw new Error(`${source.id}: download failed with HTTP ${response.status}.`)
	return {
		bytes: Buffer.from(await response.arrayBuffer()),
		resolvedUrl: response.url || source.sourceUrl,
	}
}

async function writePackOutputs(packs) {
	await mkdir(publicDirectory, { recursive: true })
	for (const pack of packs) {
		await writeFile(path.join(publicDirectory, `${pack.source.id}.pbn`), pack.pbn, 'utf8')
		await writeFile(
			path.join(publicDirectory, `${pack.source.id}.json`),
			json(pack.metadata),
			'utf8',
		)
	}
	const manifest = buildManifest(packs)
	const policy = buildCoachPolicy(packs)
	const catalogue = buildFrontendCatalogue(packs)
	await writeFile(path.join(publicDirectory, 'manifest.json'), json(manifest), 'utf8')
	await writeFile(path.join(publicDirectory, 'coach-policy.json'), json(policy), 'utf8')
	await writeFile(generatedCataloguePath, frontendCatalogueModule(catalogue), 'utf8')
}

async function checkOutputs() {
	const manifest = JSON.parse(await readFile(path.join(publicDirectory, 'manifest.json'), 'utf8'))
	const policy = JSON.parse(await readFile(path.join(publicDirectory, 'coach-policy.json'), 'utf8'))
	if (manifest.schemaVersion !== PACK_SCHEMA_VERSION || manifest.packCount !== SOURCES.length) {
		throw new Error('Competition manifest version or pack count is invalid.')
	}
	if (manifest.coachPolicy !== COACH_POLICY) {
		throw new Error('Competition manifest Coach access policy is invalid.')
	}
	let checkedDeals = 0
	const checkedFingerprints = []
	for (const source of SOURCES) {
		const metadata = JSON.parse(
			await readFile(path.join(publicDirectory, `${source.id}.json`), 'utf8'),
		)
		const pbn = await readFile(path.join(publicDirectory, `${source.id}.pbn`), 'utf8')
		if (metadata.source.url !== source.sourceUrl || metadata.source.sha256 !== source.expectedSourceSha256) {
			throw new Error(`${source.id}: checked-in source identity differs from the allowlist.`)
		}
		if (sha256(pbn) !== metadata.asset.sha256) {
			throw new Error(`${source.id}: checked-in PBN asset checksum is invalid.`)
		}
		const records = parseRecords(pbn)
		if (records.length !== source.boardNumbers.length || metadata.boards.length !== records.length) {
			throw new Error(`${source.id}: checked-in board count is invalid.`)
		}
		if (metadata.boardComparisons?.length !== records.length) {
			throw new Error(`${source.id}: frontend comparison count is invalid.`)
		}
		if (
			metadata.coachPolicy?.mode !== COACH_POLICY ||
			metadata.coachPolicy?.coachAllowed !== true ||
			metadata.coachPolicy?.anonymousTrialAllowed !== false ||
			containsObjectKey(metadata, 'players')
		) {
			throw new Error(`${source.id}: Coach access or anonymized metadata is invalid.`)
		}
		for (const [index, record] of records.entries()) {
			const expectedBoard = source.boardNumbers[index]
			if (record.boardNumber !== expectedBoard || tag(record, 'CoachPolicy') !== COACH_POLICY) {
				throw new Error(`${source.id}: board ordering or Coach policy tag is invalid.`)
			}
			if (!/^[1-7](?:C|D|H|S|NT)(?:XX|X)?$/.test(tag(record, 'Contract'))) {
				throw new Error(`${source.id}: board ${expectedBoard} has a player-incompatible contract.`)
			}
			if (
				source.recordDateOverride &&
				(tag(record, 'Date') !== source.recordDateOverride ||
					tag(record, 'EventDate') !== source.recordDateOverride)
			) {
				throw new Error(`${source.id}: board ${expectedBoard} does not contain the reviewed date correction.`)
			}
			if (
				[...record.tags.keys()].some((key) =>
					['north', 'east', 'south', 'west', 'hometeam', 'visitteam'].includes(
						key.toLowerCase(),
					),
				) ||
				metadata.boards[index].coachAllowed !== true ||
				metadata.boardComparisons[index].coachAllowed !== true
			) {
				throw new Error(`${source.id}: board ${expectedBoard} is not anonymized or Coach-enabled.`)
			}
			const fingerprint = dealFingerprint(record)
			if (
				fingerprint !== tag(record, 'CompetitionDealFingerprint') ||
				fingerprint !== metadata.boards[index].dealFingerprint ||
				fingerprint !== metadata.boardComparisons[index].dealFingerprint
			) {
				throw new Error(`${source.id}: board ${expectedBoard} fingerprint is invalid.`)
			}
			if (
				metadata.boardComparisons[index].referenceResults?.length !== 2 ||
				metadata.boardComparisons[index].referenceResults.some(
					(result) => !['Open', 'Closed'].includes(result.room) || !Number.isFinite(result.scoreNS),
				)
			) {
				throw new Error(`${source.id}: board ${expectedBoard} comparison scores are invalid.`)
			}
			checkedFingerprints.push(fingerprint)
			checkedDeals += 1
		}
	}
	const policyFingerprints = policy.entries.map(({ fingerprint }) => fingerprint).sort()
	if (
		policy.policy !== COACH_POLICY ||
		policy.coachAllowed !== true ||
		policy.anonymousTrialAllowed !== false ||
		policy.dealCount !== checkedDeals ||
		JSON.stringify(policyFingerprints) !== JSON.stringify(checkedFingerprints.sort())
	) {
		throw new Error('Generated Coach policy does not match the checked-in competition deals.')
	}
	const catalogueModule = await readFile(generatedCataloguePath, 'utf8')
	const expectedCatalogue = frontendCatalogueModule(
		buildFrontendCatalogue(
			manifest.packs.map((pack) => ({
				metadata: {
					...pack,
					source: pack.source,
				},
			})),
		),
	)
	if (catalogueModule !== expectedCatalogue) {
		throw new Error('Generated frontend competition catalogue is stale.')
	}
	if (manifest.dealCount !== checkedDeals) {
		throw new Error('Competition manifest deal count is invalid.')
	}
	return { packs: SOURCES.length, deals: checkedDeals, fingerprints: checkedFingerprints.length }
}

async function main() {
	const mode = process.argv[2]
	if (mode === '--fetch') {
		const packs = []
		for (const source of SOURCES) {
			const downloaded = await fetchSource(source)
			packs.push(buildPack(source, downloaded.bytes, downloaded.resolvedUrl))
		}
		await writePackOutputs(packs)
		const checked = await checkOutputs()
		console.log(`Imported and validated ${checked.deals} deals across ${checked.packs} allowlisted USBF packs.`)
		return
	}
	if (mode === '--check') {
		const checked = await checkOutputs()
		console.log(`Validated ${checked.deals} deals and ${checked.fingerprints} Coach-policy fingerprints across ${checked.packs} static packs.`)
		return
	}
	throw new Error(
		'Choose --fetch to refresh the two allowlisted USBF sources, or --check to validate checked-in assets without network access.',
	)
}

await main()
