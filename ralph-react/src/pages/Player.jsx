// Truly minimal Player rebuild (legacy code removed)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createInitialManualState, playCardManual } from '../lib/manualPlayEngine'
import { rightOf, partnerOf, isDefender, hcpValue, parseTrump, dealToHands, computeDuplicateScore, neededToSet, validateAuction, parsePlayMoves, parsePlayScript, isSeatVul, evaluateTrick } from '../lib/bridgeCore'

// --- Tiny helpers ---
const seatName = s => s==='N'? 'North': s==='E'? 'East': s==='S'? 'South':'West'
const suitSymbol = s => s==='Spades'? '♠': s==='Hearts'? '♥': s==='Diamonds'? '♦':'♣'

// Very small PBN parser (Boards + tags we actually use)
function parsePbn(text){
	const lines=text.split(/\r?\n/); const out=[]; let cur=null; const tagLine=/^\[(\w+)(?:\s+"(.*)")?\]\s*(.*)$/; const push=()=>{ if(cur) out.push(cur); cur=null }
	for(const raw of lines){ const lineRaw=raw; const line=lineRaw.trim(); if(!line) continue; const m=line.match(tagLine); if(m){ const k=m[1]; const v=(m[2]||'').trim(); const trailing=(m[3]||'').trim(); if(k==='Board'){ if(cur) push(); cur={board:v, dealer:'N', vul:'None', deal:'', auction:[], auctionDealer:'N', play:'', playLeader:'', notes:[], system:'', theme:'', interf:'', ddpar:'', scoring:''} }
		if(!cur) cur={board:v||'', dealer:'N', vul:'None', deal:'', auction:[], auctionDealer:'N', play:'', playLeader:'', notes:[], system:'', theme:'', interf:'', ddpar:'', scoring:''};
		switch(k){
			case 'Dealer': cur.dealer=v||'N'; break;
			case 'Vulnerable': cur.vul=v||'None'; break;
			case 'Deal': cur.deal=v; break;
			case 'Auction': cur.auctionDealer=v||cur.dealer; cur._mode='a'; if(trailing) cur.auction.push(...trailing.split(/\s+/).filter(Boolean)); break;
			case 'Play': cur.playLeader=v||cur.dealer; cur._mode='p'; if(trailing) cur.play += (cur.play? ' ':'')+trailing; break;
			case 'Contract': cur.contract=v; break;
			case 'Declarer': cur.declarer=v; break;
			case 'Note': cur.notes.push(v); break;
			case 'System': cur.system=v; break;
			case 'Theme': cur.theme=v; break;
			case 'Interf': cur.interf=v; break;
			case 'DDPar': cur.ddpar=v; break;
			case 'Scoring': cur.scoring=v; break;
			default: break;
		}
		continue
	}
	if(cur){ if(cur._mode==='a'){ if(/^[^-]/.test(line)) cur.auction.push(...line.split(/\s+/).filter(Boolean)) } else if(cur._mode==='p'){ cur.play += (cur.play?' ':'')+line } }
	}
	push(); return out.filter(b=> b.deal)
}

// --- UI Atoms ---
function SeatPanel({ id, remaining, turnSeat, trick, onPlay, visible, dealer, vul, declarer, showHCP, lastAutoSeat, compact }){
	const hand=remaining?.[id]||[]
	const hcp=hand.reduce((s,c)=> s + hcpValue(c.rank),0)
	const suitOrder=['Spades','Hearts','Diamonds','Clubs'] // reversed order requirement
	const grouped=Object.fromEntries(suitOrder.map(s=> [s, hand.filter(c=> c.suit===s).sort((a,b)=> '2345678910JQKA'.indexOf(a.rank)-'2345678910JQKA'.indexOf(b.rank))]))
	const leadSuit = trick.length>0 && trick.length<4 ? trick[0].card.suit : null
	const mustFollow = leadSuit && hand.some(c=> c.suit===leadSuit)
	const isTurn=turnSeat===id
	return <div className={`rounded-xl border ${compact?'w-52':'w-60'} overflow-hidden bg-white ${compact?'text-[11px]':''} ${isTurn?'border-red-500':'border-gray-300'} ${lastAutoSeat===id?'ring-2 ring-sky-300 animate-pulse':''}`}>
		<div className={`px-2 py-1 text-[11px] font-semibold flex items-center justify-between ${isTurn?'bg-red-50': (id==='N'||id==='S')? 'bg-indigo-50':'bg-gray-50'}`}>
			<span>{seatName(id)}{dealer===id && <span className='ml-1 text-[9px] bg-amber-500 text-white px-1 rounded'>D</span>}</span>
			<span className='flex items-center gap-1'>
				{isSeatVul(vul,id) && <span className='text-[8px] px-1 rounded bg-rose-600 text-white'>V</span>}
				{(visible || showHCP) && <span className='text-[10px] opacity-70'>HCP {hcp}</span>}
			</span>
		</div>
		<div className='p-2 flex flex-col gap-2'>
			{suitOrder.map(s => <div key={s} className='flex items-center gap-2'>
				<div className={`w-6 text-center text-xl ${s==='Hearts'||s==='Diamonds'?'text-red-600':'text-black'}`}>{suitSymbol(s)}</div>
				<div className='flex flex-wrap gap-1 flex-1'>
					{visible ? grouped[s].map(c=>{ const legal=!isTurn || !leadSuit || !mustFollow || c.suit===leadSuit; return <button key={c.id} disabled={!legal||!isTurn} onClick={()=> onPlay(id,c.id)} className={`px-1 text-sm rounded ${legal&&isTurn? 'hover:bg-gray-100':'opacity-40 cursor-not-allowed'}`}>{c.rank}</button> }) : <span className='italic text-gray-400 text-sm'>hidden</span>}
					{visible && grouped[s].length===0 && <span className='text-gray-300'>-</span>}
				</div>
			</div>)}
		</div>
	</div>
}

function ScorePanel({ tricksDecl, tricksDef, needed, contract, declarer, result }){
	return <div className='rounded border bg-white p-2 text-[11px] space-y-0.5'>
		<div>Declarer: <span className='font-semibold'>{declarer||'-'}</span></div>
		<div>Contract: <span className='font-semibold'>{contract||'-'}</span></div>
		<div>Declarer tricks: <span className='font-semibold'>{tricksDecl}</span></div>
		<div>Defender tricks: <span className='font-semibold'>{tricksDef}</span></div>
		<div>Defend to set: <span className='font-semibold'>{needed||'-'}</span></div>
		{result && !result.partial && <div>Result: <span className='font-semibold'>{result.resultText}</span>{typeof result.score==='number' && <span className='ml-1 font-semibold'>{result.score>0?'+':''}{result.score}</span>}</div>}
	</div>
}

function MiniTrick({ trick, winner, turnSeat, lastAutoPlay }){
	const order=['N','E','S','W']
	return <div className='rounded border bg-white p-2'>
		<div className='text-[11px] text-gray-600 mb-1 flex items-center justify-between'>
			<span>Current Trick</span>
			{lastAutoPlay && <span className='text-[9px] text-sky-600 font-medium'>AUTO {lastAutoPlay.seat}</span>}
		</div>
		<div className='grid grid-cols-2 gap-2 w-40 mx-auto'>
			{order.map(seat=>{ const t=trick.find(x=>x.seat===seat); const win=trick.length===4 && winner===seat; const turn=turnSeat===seat; return <div key={seat} className={`h-14 rounded-md border flex flex-col items-center justify-center text-[11px] font-semibold relative ${win?'border-emerald-500 ring-1 ring-emerald-400':'border-gray-300'} ${turn?'bg-yellow-50':'bg-white'}`}> <div className='text-[8px] text-gray-500 absolute top-0 left-0 px-1 py-0.5'>{seat}</div>{t? <div className={`${t.card.suit==='Hearts'||t.card.suit==='Diamonds'?'text-red-600':'text-gray-900'} text-lg`}>{t.card.rank}{suitSymbol(t.card.suit)}</div> : <span className='text-gray-300'>—</span>}</div> })}
		</div>
	</div>
}

// Cross style current trick display (N at top, S bottom, W left, E right)
function CrossTrick({ trick=[], winner, turnSeat, lastAutoPlay }){
	const cardFor = seat => trick.find(t=> t.seat===seat)
	const CardBox = ({seat}) => { const t=cardFor(seat); const win = winner===seat && trick.length===4; const turn = turnSeat===seat; return (
		<div className={`w-16 h-20 rounded-md border flex flex-col items-center justify-center text-[11px] font-semibold shadow-sm ${win? 'border-emerald-500 ring-2 ring-emerald-400':'border-gray-300'} ${turn? 'bg-yellow-50':'bg-white'}`}>
			<div className='text-[9px] text-gray-500 mb-0.5'>{seat}</div>
			{t? <div className={`text-base ${t.card.suit==='Hearts'||t.card.suit==='Diamonds'?'text-red-600':'text-gray-900'}`}>{t.card.rank}{suitSymbol(t.card.suit)}</div> : <span className='text-gray-300 text-sm'>—</span>}
		</div>
	) }
	return (
		<div className='relative w-64 h-64 mx-auto rounded-xl border bg-white/80 backdrop-blur-sm shadow-inner flex items-center justify-center'>
			<div className='absolute top-2 left-1/2 -translate-x-1/2'><CardBox seat='N' /></div>
			<div className='absolute bottom-2 left-1/2 -translate-x-1/2'><CardBox seat='S' /></div>
			<div className='absolute left-2 top-1/2 -translate-y-1/2'><CardBox seat='W' /></div>
			<div className='absolute right-2 top-1/2 -translate-y-1/2'><CardBox seat='E' /></div>
			<div className='text-[10px] absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-sky-600 text-white shadow'>{lastAutoPlay? `AUTO ${lastAutoPlay.seat}`:'Current Trick'}</div>
		</div>
	)
}

function AdvicePanel({ entries }){
	if(!entries || !entries.length) return <div className='text-xs italic text-gray-400'>Declarer advice will appear here as you play.</div>
	const latest=entries[entries.length-1]
	const face = latest.quality==='good'? '😃' : latest.quality==='bad'? '😕':'🙂'
	return <div className='text-sm bg-gradient-to-br from-indigo-50 via-white to-violet-50 border border-indigo-200 shadow rounded-lg p-3 space-y-2 w-64'>
		<div className='flex items-center justify-between'>
			<div className='font-semibold text-indigo-700 flex items-center gap-1'>Declarer Insight <span>{face}</span></div>
			<div className={`text-[10px] uppercase font-medium px-2 py-0.5 rounded ${latest.quality==='good'? 'bg-green-100 text-green-700': latest.quality==='bad' ? 'bg-rose-100 text-rose-700':'bg-gray-100 text-gray-600'}`}>{latest.quality}</div>
		</div>
		<div className='text-gray-700 leading-snug'>{latest.why}</div>
		<div className='text-indigo-800 text-[13px] font-medium'>Next Thought</div>
		<div className='text-indigo-700 leading-snug'>{latest.next}</div>
		{latest.principle && <div className='text-[11px] text-indigo-900 bg-indigo-100/60 border border-indigo-200 px-2 py-1 rounded'>{latest.principle}</div>}
		{entries.length>1 && <details className='text-[11px] mt-1'>
			<summary className='cursor-pointer text-gray-500 hover:text-gray-700'>Previous advice history</summary>
			<ul className='mt-1 max-h-40 overflow-auto space-y-1 pr-1'>
				{[...entries].slice(-15,-1).reverse().map(e=> <li key={e.id} className='border-l pl-2 text-[11px] leading-snug'>
					<span className='font-semibold'>{e.card}</span> – <span className='italic'>{e.quality}</span>: {e.why}
				</li>)}
			</ul>
		</details>}
	</div>
}

function CompletedTricks({ tricks }){ if(!tricks || !tricks.length) return null; return <div className='rounded border bg-white p-2 max-h-48 overflow-auto w-60'>
	<div className='text-[11px] text-gray-600 mb-1'>Completed Tricks</div>
	<table className='w-full text-[10px]'><thead><tr className='text-gray-600'><th className='text-left'>#</th><th className='text-left'>Winner</th><th className='text-left'>Cards (N E S W)</th></tr></thead><tbody>
		{tricks.map(t=>{ const order=['N','E','S','W']; const cards=order.map(s=>{ const it=t.cards.find(c=> c.seat===s); return it? `${it.card.rank}${it.card.suit[0]}`:'—' }); return <tr key={t.no} className='border-t'><td className='py-0.5 pr-1'>{t.no}</td><td className='py-0.5 pr-1 font-semibold'>{t.winner}</td><td className='py-0.5 font-mono'>{cards.join(' ')}</td></tr> })}
	</tbody></table>
</div> }

function PreUpload({ onChooseFile }){ return <div className='max-w-lg mx-auto mt-10 text-center rounded border bg-white p-6'>
	<h2 className='text-lg font-semibold mb-2'>Load a PBN file</h2>
	<p className='text-sm text-gray-600 mb-4'>Choose a PBN tournament file to begin exploring deals.</p>
	<button onClick={onChooseFile} className='px-3 py-1.5 rounded bg-sky-600 text-white text-sm'>Choose PBN…</button>
</div> }

// --- Root Component ---
export default function Player(){
	const [deals,setDeals]=useState([])
	const [index,setIndex]=useState(0)
	const [selectedName,setSelectedName]=useState('')
	const current=deals[index]
	const [manualDeclarer,setManualDeclarer]=useState('')
	const [manualLevel,setManualLevel]=useState('')
	const [manualStrain,setManualStrain]=useState('')
	const [manualDbl,setManualDbl]=useState('')
	const [hideDefenders,setHideDefenders]=useState(false)
	const [fastAutoDef,setFastAutoDef]=useState(false)
	const [aiDifficulty,setAiDifficulty]=useState('Intermediate')
	const [signalMode,setSignalMode]=useState('Standard')
	const [showAiLog,setShowAiLog]=useState(true)
	const [pauseAtTrickEnd,setPauseAtTrickEnd]=useState(false)
	const [remaining,setRemaining]=useState(null)
	const [trick,setTrick]=useState([])
	const [turnSeat,setTurnSeat]=useState(null)
	const [tricksDecl,setTricksDecl]=useState(0)
	const [tricksDef,setTricksDef]=useState(0)
	const [completedTricks,setCompletedTricks]=useState(0)
	const [trickComplete,setTrickComplete]=useState(false)
	const [history,setHistory]=useState([])
	const [manualMoves,setManualMoves]=useState([])
	const [playIdx,setPlayIdx]=useState(0)
	const [flashWinner,setFlashWinner]=useState(null)
	const [completedTrickList,setCompletedTrickList]=useState([])
	const [lastAutoSeat,setLastAutoSeat]=useState(null)
	const [lastAutoPlay,setLastAutoPlay]=useState(null)
	const [aiLogs,setAiLogs]=useState([])
	const [adviceEntries,setAdviceEntries]=useState([]) // learning feedback entries
	const [showAdvice,setShowAdvice]=useState(true)
	const [showCompletedTricks,setShowCompletedTricks]=useState(true)
	// Planning state
	const [planWinners,setPlanWinners]=useState('')
	const [planLosers,setPlanLosers]=useState('')
	const [actualWinners,setActualWinners]=useState(null)
	const [actualLosers,setActualLosers]=useState(null)
	const [planSubmitted,setPlanSubmitted]=useState(false)
	const [planEvaluated,setPlanEvaluated]=useState(false)
	const [preAnalysis,setPreAnalysis]=useState(null) // snapshot info for planning panel
	const [showAuctionModal,setShowAuctionModal]=useState(false)
	const [planningOpen,setPlanningOpen]=useState(true)
	const playIdxRef=useRef(0)
	const pauseRef=useRef(false)
	const fileRef=useRef(null)
	const initialTrumpRef=useRef(null) // {decl,dummy,defenders,total}

	const validatedAuction=useMemo(()=>{ if(!current) return {legal:false}; const calls=Array.isArray(current.auction)? current.auction:[]; if(!calls.length) return {legal:false}; return validateAuction(current.auctionDealer||current.dealer||'N', calls) },[current])
	// modal trigger if no auction / contract present
	useEffect(()=>{ if(current){ if(!(current.auction&&current.auction.length) && !current.contract && !manualLevel && !manualStrain){ setShowAuctionModal(true) } else { setShowAuctionModal(false) } } },[current,manualLevel,manualStrain])
	const effDeclarer = manualDeclarer || current?.declarer || (validatedAuction.legal? validatedAuction.declarer:'') || ''
	const effContract = useMemo(()=>{ if(manualLevel && manualStrain) return `${manualLevel}${manualStrain}${manualDbl}`; return current?.contract || (validatedAuction.legal? validatedAuction.contract:'') || '' },[manualLevel,manualStrain,manualDbl,current?.contract,validatedAuction])
	const effTrump=parseTrump(effContract)
	const hands = useMemo(()=>{ if(!current?.deal) return null; try { return dealToHands(current.deal) } catch { return null } },[current?.deal])
	const playMoves=useMemo(()=>{ if(current?.play?.length){ try { return parsePlayMoves(current.playLeader,current.play,effContract) } catch { return [] } } if(current?.playScript){ try { return parsePlayScript(current.playScript) } catch { return [] } } return [] },[current?.play,current?.playLeader,current?.playScript,effContract])
	const usingManual=playMoves.length===0

	useEffect(()=>{ if(!hands){ setRemaining(null); setTrick([]); setTurnSeat(null); setTricksDecl(0); setTricksDef(0); setCompletedTricks(0); setHistory([]); setManualMoves([]); setCompletedTrickList([]); setPlayIdx(0); return } const leader= effDeclarer? rightOf(effDeclarer): current?.dealer || 'N'; const init=createInitialManualState(hands,current?.playLeader||leader, effTrump, effDeclarer); setRemaining(init.remaining); setTrick(init.trick); setTurnSeat(init.turnSeat); setTricksDecl(init.tricksDecl); setTricksDef(init.tricksDef); setCompletedTricks(init.completed); setTrickComplete(init.trickComplete); setHistory([]); setManualMoves([]); setCompletedTrickList([]); setPlayIdx(0); setFlashWinner(null) },[hands,effTrump,effDeclarer,current?.playLeader,current?.dealer])

	// Capture initial trump distribution for advice heuristics
	useEffect(()=>{ if(!hands || !effTrump || !effDeclarer) { initialTrumpRef.current=null; return } try {
		const partner = partnerOf(effDeclarer)
		const declCount = hands[effDeclarer].filter(c=> c.suit===effTrump).length
		const dummyCount = hands[partner].filter(c=> c.suit===effTrump).length
		const defCount = ['N','E','S','W'].filter(s=> s!==effDeclarer && s!==partner).reduce((acc,s)=> acc + hands[s].filter(c=> c.suit===effTrump).length,0)
		initialTrumpRef.current={decl:declCount,dummy:dummyCount,def: defCount,total: declCount+dummyCount+defCount}
	} catch { initialTrumpRef.current=null }
	},[hands,effTrump,effDeclarer])
	// Planning approximations + snapshot analysis
	useEffect(()=>{ if(!hands || !effDeclarer){ setActualWinners(null); setActualLosers(null); setPreAnalysis(null); setPlanSubmitted(false); setPlanEvaluated(false); setPlanWinners(''); setPlanLosers(''); setPlanningOpen(true); return } try { const p=partnerOf(effDeclarer); const seats=[effDeclarer,p]; const suitList=['Spades','Hearts','Diamonds','Clubs']; const hi=['A','K','Q','J','10','9','8','7','6','5','4','3','2']; const gather=s=> seats.flatMap(seat=> hands[seat].filter(c=> c.suit===s)).sort((a,b)=> hi.indexOf(a.rank)-hi.indexOf(b.rank)); let winners=0,losers=0; const perSuit={}; for(const suit of suitList){ const cards=gather(suit); if(!cards.length){ perSuit[suit]={winners:0,losers:0,length:0}; continue } let w=0; if(cards.find(c=> c.rank==='A')) w++; if(cards.length>=2 && cards.find(c=> c.rank==='K')) w++; if(cards.length>=3 && cards.find(c=> c.rank==='Q') && (cards.find(c=> c.rank==='A')||cards.find(c=> c.rank==='K'))) w++; const top3=cards.slice(0,3); const honors=top3.filter(c=> ['A','K','Q'].includes(c.rank)).length; const l = Math.min(top3.length, 3-honors); winners+=w; losers+=l; perSuit[suit]={winners:w,losers:l,length:cards.length}; }
		setActualWinners(winners); setActualLosers(losers);
		// HCP + shapes
		const hcpMap={'A':4,'K':3,'Q':2,'J':1}; const countHcp=hand=> hand.reduce((s,c)=> s+(hcpMap[c.rank]||0),0);
		const declHand=hands[effDeclarer]; const dummyHand=hands[p]; const hcpDecl=countHcp(declHand); const hcpDummy=countHcp(dummyHand); const partnershipHcp=hcpDecl+hcpDummy;
		const shapeOf=(hand)=>{ const counts=suitList.map(s=> hand.filter(c=> c.suit===s).length); return counts.join('-') };
		const shapeDecl=shapeOf(declHand); const shapeDummy=shapeOf(dummyHand);
		const trumpSuit=effTrump || 'NT'; const trumpLens = trumpSuit==='NT'? {decl:0,dummy:0,total:0} : {decl: declHand.filter(c=> c.suit===effTrump).length, dummy: dummyHand.filter(c=> c.suit===effTrump).length}; trumpLens.total=trumpLens.decl+trumpLens.dummy;
		// Longest side suits (exclude trump if any)
		const sideLengths=suitList.filter(s=> s!==effTrump).map(s=> ({s,length: perSuit[s].length})); const maxLen=Math.max(...sideLengths.map(x=> x.length),0); const longestSides=sideLengths.filter(x=> x.length===maxLen && maxLen>0).map(x=> x.s[0]);
		// Sure winner suits list
		const sureWinnerSuits=suitList.filter(s=> perSuit[s].winners>0).map(s=> `${perSuit[s].winners}${suitSymbol(s)}`);
		// Problem suits = losers > winners
		const problemSuits=suitList.filter(s=> perSuit[s].losers>perSuit[s].winners).map(s=> `${s[0]}(${perSuit[s].losers})`);
		// Entry estimate: count A/K outside trump
		const entryCount = seats.reduce((acc,seat)=> acc + hands[seat].filter(c=> (c.rank==='A'||c.rank==='K') && c.suit!==effTrump).length,0);
		setPreAnalysis({ partnershipHcp, hcpDecl, hcpDummy, shapeDecl, shapeDummy, trumpSuit, trumpLens, longestSides, sureWinnerSuits, problemSuits, entryCount, perSuit });
	} catch { setActualWinners(null); setActualLosers(null); setPreAnalysis(null) } },[hands,effDeclarer,effTrump])

	// Advice phrase banks & rotation
	const phraseMemoryRef=useRef({})
	const pickVariant=(category, arr)=>{ if(!arr.length) return ''; const mem=phraseMemoryRef.current; const last=mem[category] ?? -1; const idx=(last+1)%arr.length; mem[category]=idx; return arr[idx] }
	const whyPhrases={
		ruffGood:['Nice ruff — free extra trick!','Great ruff — you turned a loser into a winner.','Sweet ruff — that builds extra tricks.'],
		drawGood:['Good — pulling their trumps protects your winners.','Nice – stripping out their trumps first.','Solid: clearing trumps keeps you safe.'],
		drawNeutral:['They have almost no trumps left; side suits coming up soon.','Nearly done with trumps — you can switch soon.','Trumps are nearly gone; think about building others.'],
		prematureSide:['You started another suit before finishing their trumps.','Side suit too early — clear their trumps first.','Risky: you let their trumps stay while you change suits.'],
		wastedDiscard:['You just tossed a card; could a ruff or trump play be better?','That discard didn’t help; maybe ruff or draw trumps.','Throwing a random card — look for a ruff or plan move.'],
		genericNeutral:['Fine — nothing big gained or lost.','Okay — perfectly safe play.','Neutral — you haven’t helped or hurt your plan.']
	}
	const nextPhrases={
		continueDraw:['Keep counting trumps; finish the job.','Continue: one more trump round.','Stay on trumps until they’re gone.'],
		buildLong:['Time to work on a long suit or ruff losers.','Shift to growing side-suit tricks.','Start building extra tricks from length.'],
		needDrawFirst:['Clear their trumps before switching (unless you need fast ruffs).','Finish pulling trumps then build winners.','Try removing their trumps first.'],
		refocusCount:['Refocus: how many sure tricks vs target?','Pause: count sure tricks you actually have.','Re-count winners vs what you need.'],
		decideNext:['Decide: another trump or start a side suit.','Choose: draw one more or begin building.','Pick your lane: trumps or side suit now.'],
		entryPlan:['Think about entries to reach new winners.','Map entries so you can enjoy established tricks.','Plan entries before building more tricks.']
	}
	// Heuristic evaluation with categories -> phrase selection
	const evaluateDeclarerPlay = useCallback((params)=>{ const { seat, suit, rank, preRemaining, postState, effTrump, trickBefore } = params; if(!effTrump) return {quality:'neutral', why:'No-trump: build long suits and keep entries.', next:'Set up long suits and keep your entries.'}; if(!effDeclarer) return {quality:'neutral', why:'Declarer not set yet.', next:'Once you know declarer, think about trumps.'}; const partner = partnerOf(effDeclarer); const remainingAfter=postState.remaining; const declTrumpsAfter=remainingAfter[effDeclarer].filter(c=> c.suit===effTrump).length; const dummyTrumpsAfter=remainingAfter[partner].filter(c=> c.suit===effTrump).length; const defendersSeats=['N','E','S','W'].filter(s=> s!==effDeclarer && s!==partner); const defendersTrumpsAfter=defendersSeats.reduce((n,s)=> n+remainingAfter[s].filter(c=> c.suit===effTrump).length,0); const leadSuit=trickBefore.length>0 && trickBefore.length<4? trickBefore[0].card.suit:null; const followedLead=leadSuit? suit===leadSuit:null; const wasRuff=leadSuit && suit===effTrump && leadSuit!==effTrump && !preRemaining[seat].some(c=> c.suit===leadSuit); let quality='neutral', whyCat='genericNeutral', nextCat='decideNext'; const totalOur=declTrumpsAfter+dummyTrumpsAfter; if(wasRuff){ quality='good'; whyCat='ruffGood'; nextCat=defendersTrumpsAfter>0? 'continueDraw':'buildLong' } else if(suit===effTrump){ if(defendersTrumpsAfter>0){ quality='good'; whyCat='drawGood'; nextCat='continueDraw' } else { quality='neutral'; whyCat='drawNeutral'; nextCat='buildLong' } } else if(effTrump && defendersTrumpsAfter>0 && totalOur>defendersTrumpsAfter && !leadSuit){ quality='bad'; whyCat='prematureSide'; nextCat='needDrawFirst' } else if(!followedLead && leadSuit && suit!==effTrump){ quality='bad'; whyCat='wastedDiscard'; nextCat='refocusCount' } else { quality='neutral'; whyCat='genericNeutral'; nextCat=defendersTrumpsAfter>0? 'decideNext':'entryPlan' }
	const why=pickVariant(whyCat, whyPhrases[whyCat]); const next=pickVariant(nextCat, nextPhrases[nextCat]); let principle=''; if(suit===effTrump) principle=`Trumps left: us ${declTrumpsAfter+dummyTrumpsAfter} / them ${defendersTrumpsAfter}`; else if(wasRuff) principle='Short-hand ruff = extra trick.'; else if(defendersTrumpsAfter>0) principle=`Opp trumps left: ${defendersTrumpsAfter}`; return {quality, why, next, seat, card:`${rank}${suit[0]}`, principle} },[effDeclarer,whyPhrases,nextPhrases])

	const onPlayCard=useCallback((seat,cardId)=>{ if(usingManual && history.length===0 && !planSubmitted){ setAdviceEntries(list=> [...list,{ id: Date.now()+Math.random().toString(36).slice(2,7), quality:'neutral', why:'First, fill in your plan (sure winners + likely losers).', next:'Planning helps you decide whether to draw trumps now.', seat, card:'', principle:'Plan first.' }]); return } if(!usingManual||!turnSeat) return; const preRemaining=remaining; const trickBefore=trick; const engine={ remaining, trick, turnSeat, tricksDecl, tricksDef, trump: effTrump, declarer: effDeclarer, completed: completedTricks, trickComplete }; const r=playCardManual(engine,seat,cardId); if(!r.ok) return; const next=r.state; setRemaining(next.remaining); setTrick(next.trick); setTurnSeat(next.turnSeat); setTricksDecl(next.tricksDecl); setTricksDef(next.tricksDef); setCompletedTricks(next.completed); setTrickComplete(next.trickComplete||false); const [_,suit,rank]=cardId.split('-'); setHistory(h=>[...h,{seat,cardId,suit,rank}]); setManualMoves(m=>[...m,{seat,suit,rank}]); setPlayIdx(k=>k+1); if(effDeclarer && (seat===effDeclarer || partnerOf(effDeclarer)===seat)){ try { const evalRes=evaluateDeclarerPlay({ seat, suit, rank, preRemaining, postState: next, effTrump, trickBefore }); setAdviceEntries(list=> [...list,{ id: Date.now()+Math.random().toString(36).slice(2,7), ...evalRes }].slice(-70)) } catch{} } if(r.winner){ if(pauseRef.current) setFlashWinner(r.winner); else setFlashWinner(null); setCompletedTrickList(lst=>[...lst,{no: lst.length+1, winner: r.winner, cards: next.trick }]) } if(hideDefenders && isDefender(seat,effDeclarer)){ setLastAutoSeat(seat); setTimeout(()=> setLastAutoSeat(null),800) } },[usingManual,history.length,planSubmitted,turnSeat,remaining,trick,tricksDecl,tricksDef,effTrump,effDeclarer,completedTricks,trickComplete,hideDefenders,evaluateDeclarerPlay])

	// Simple auto-play for hidden defenders
	const rankOrder=['2','3','4','5','6','7','8','9','10','J','Q','K','A']; const rankWeight=r=> rankOrder.indexOf(r)
	const selectDefenderCard=useCallback((seat)=>{ const hand=remaining?.[seat]; if(!hand?.length) return null; const cur=trick; const leadSuit=cur.length>0 && cur.length<4? cur[0].card.suit:null; let playable=hand; if(leadSuit){ const follow=hand.filter(c=> c.suit===leadSuit); if(follow.length) playable=follow } if(aiDifficulty==='Basic'){ const low=playable.slice().sort((a,b)=> rankWeight(a.rank)-rankWeight(b.rank))[0]; return {card:low, reason: leadSuit? 'Lowest follow':'Lowest lead'} } if(!leadSuit){ const groups={}; hand.forEach(c=>{ (groups[c.suit] ||= []).push(c) }); let entries=Object.entries(groups).sort((a,b)=> b[1].length - a[1].length); if(effTrump){ const non=entries.filter(e=> e[0]!==effTrump); if(non.length) entries=[...non, ...entries.filter(e=> e[0]===effTrump)] } const low=entries[0][1].slice().sort((a,b)=> rankWeight(a.rank)-rankWeight(b.rank)); return {card: low[0], reason: `Lead ${entries[0][0][0]} low`} } if(leadSuit){ const partner=partnerOf(seat); const currentWinner=evaluateTrick(cur,effTrump); const asc=playable.slice().sort((a,b)=> rankWeight(a.rank)-rankWeight(b.rank)); if(currentWinner===partner){ let reason='Partner winning'; if(signalMode==='LowEnc') reason+=' (low=enc)'; return {card: asc[0], reason} } for(const c of asc){ const w=evaluateTrick([...cur,{seat,card:c}], effTrump); if(w===seat) return {card:c, reason:'Win cheaply'} } return {card: asc[0], reason:'Cannot win'} } return {card: playable[0], reason:'Random'} },[remaining,trick,effTrump,aiDifficulty,signalMode])

	const autoPlayRef=useRef(false)
	useEffect(()=>{ if(!usingManual||!hideDefenders||!turnSeat||!isDefender(turnSeat,effDeclarer)||autoPlayRef.current) return; autoPlayRef.current=true; const timer=setTimeout(()=>{ const sel=selectDefenderCard(turnSeat); if(sel?.card){ onPlayCard(turnSeat, sel.card.id); setLastAutoPlay({seat:turnSeat, cardId: sel.card.id, reason: sel.reason, ts: Date.now()}); setAiLogs(l=> [...l,{id: Date.now()+Math.random().toString(36).slice(2,6), seat: turnSeat, text: `${turnSeat} ${sel.card.rank}${sel.card.suit[0]} – ${sel.reason}` }].slice(-40)) } autoPlayRef.current=false }, fastAutoDef?120:420); return ()=> { clearTimeout(timer); autoPlayRef.current=false } },[usingManual,hideDefenders,turnSeat,effDeclarer,fastAutoDef,selectDefenderCard,onPlayCard])

	const result=useMemo(()=>{ if(!effContract||!effDeclarer) return null; return computeDuplicateScore(effContract, effDeclarer, isSeatVul(effDeclarer, current?.vul), tricksDecl) },[effContract,effDeclarer,tricksDecl,current?.vul])

	const onFile=e=>{ const f=e.target.files?.[0]; if(!f) return; setSelectedName(f.name); const r=new FileReader(); r.onload=()=>{ try{ const boards=parsePbn(String(r.result)); setDeals(boards); setIndex(0) }catch(err){ console.error(err)} }; r.readAsText(f) }

	const rebuildFromHistory=useCallback((to)=>{ if(!hands) return; const leader=effDeclarer? rightOf(effDeclarer): current?.dealer || 'N'; let st=createInitialManualState(hands,current?.playLeader||leader, effTrump, effDeclarer); for(const mv of history.slice(0,to)){ const r=playCardManual(st,mv.seat,mv.cardId); if(!r.ok) break; st=r.state } setRemaining(st.remaining); setTrick(st.trick); setTurnSeat(st.turnSeat); setTricksDecl(st.tricksDecl); setTricksDef(st.tricksDef); setCompletedTricks(st.completed); setTrickComplete(st.trickComplete); setPlayIdx(to); playIdxRef.current=to },[history,hands,effDeclarer,effTrump,current?.playLeader,current?.dealer])
	const onPrevStep=()=> rebuildFromHistory(Math.max(0, playIdxRef.current-1))
	const onNextStep=()=> rebuildFromHistory(Math.min(history.length, playIdxRef.current+1))
	const prev=()=> setIndex(i=> Math.max(0,i-1))
	const next=()=> setIndex(i=> Math.min(deals.length-1,i+1))
	const reset=()=> { setDeals([]); setIndex(0); setSelectedName('') }

	return (
		<div className='min-h-screen bg-gray-100 flex'>
			{showAuctionModal && <div className='fixed inset-0 z-50 flex items-center justify-center'>
				<div className='absolute inset-0 bg-black/30 backdrop-blur-sm' />
				<div className='relative bg-white rounded-xl shadow-lg w-full max-w-md p-5 space-y-4'>
					<h2 className='text-lg font-semibold text-indigo-700'>No Auction Found</h2>
					<p className='text-sm text-gray-700'>This PBN has no auction lines. Please set the contract manually in the sidebar (Declarer, Level, Strain, Doubles) before you begin planning.</p>
					<button onClick={()=> setShowAuctionModal(false)} className='px-3 py-1.5 rounded bg-indigo-600 text-white text-sm'>Got it</button>
				</div>
			</div>}
			{/* Sidebar */}
			<div className='w-72 p-3 border-r bg-gray-50 flex flex-col gap-3 text-[11px]'>
				<div className='flex items-center justify-between'>
					<Link to='/' className='text-sky-600 hover:underline text-[12px]'>← Home</Link>
					<Link to='/player/help' className='text-sky-600 hover:underline text-[12px]'>Help</Link>
					<button onClick={reset} className='px-2 py-0.5 rounded border bg-white'>Start over</button>
				</div>
				<div>
					<input ref={fileRef} type='file' accept='.pbn,text/plain' onChange={onFile} className='hidden' />
					<button onClick={()=> fileRef.current?.click()} className='w-full px-2 py-1 rounded bg-sky-600 text-white text-[12px]'>Choose PBN…</button>
					<div className='mt-1 text-gray-600 truncate'>{selectedName || 'No file chosen'}</div>
					<div className='text-gray-700 mt-0.5'>{deals.length? `Board ${current?.board || index+1} — ${index+1}/${deals.length}`:'No file loaded'}</div>
					{effContract? <div className='text-gray-700'>Contract: <span className='font-semibold'>{effContract}{effDeclarer? ` (${effDeclarer})`:''}</span></div>: <div className='text-gray-500'>No bidding found</div>}
					<div className='flex gap-1 mt-1'>
						<button disabled={!deals.length} onClick={prev} className='flex-1 px-2 py-0.5 rounded border disabled:opacity-40'>Prev</button>
						<button disabled={!deals.length} onClick={next} className='flex-1 px-2 py-0.5 rounded border disabled:opacity-40'>Next</button>
					</div>
				</div>
				<div className='space-y-1 border-t pt-2'>
					<label className='flex items-center gap-1'><input type='checkbox' checked={hideDefenders} onChange={e=> setHideDefenders(e.target.checked)} /> <span>Hide defenders</span></label>
					{hideDefenders && <div className='ml-4 flex flex-col gap-1'>
						<label className='flex items-center gap-1'><input type='checkbox' checked={fastAutoDef} onChange={e=> setFastAutoDef(e.target.checked)} /> <span>Fast auto-play</span></label>
						<label className='flex items-center gap-1'><span>AI</span><select value={aiDifficulty} onChange={e=> setAiDifficulty(e.target.value)} className='border rounded px-1 py-0.5'><option>Basic</option><option>Intermediate</option><option>Advanced</option></select></label>
						<label className='flex items-center gap-1'><span>Signals</span><select value={signalMode} onChange={e=> setSignalMode(e.target.value)} className='border rounded px-1 py-0.5'><option value='Standard'>Standard</option><option value='LowEnc'>LowEnc</option></select></label>
						<label className='flex items-center gap-1'><input type='checkbox' checked={showAiLog} onChange={e=> setShowAiLog(e.target.checked)} /> <span>Show AI log</span></label>
					</div>}
					<label className='flex items-center gap-1'><input type='checkbox' checked={pauseAtTrickEnd} onChange={e=> { setPauseAtTrickEnd(e.target.checked); pauseRef.current=e.target.checked }} /> <span>Pause at trick end</span></label>
					<label className='flex items-center gap-1'><input type='checkbox' checked={showAdvice} onChange={e=> setShowAdvice(e.target.checked)} /> <span>Show advice panel</span></label>
					<label className='flex items-center gap-1'><input type='checkbox' checked={showCompletedTricks} onChange={e=> setShowCompletedTricks(e.target.checked)} /> <span>Show completed tricks</span></label>
				</div>
				{!current?.contract && <div className='space-y-1 border-t pt-2'>
					<div className='font-semibold'>Set contract</div>
					<label className='flex items-center justify-between gap-1'><span>Declarer</span><select className='border rounded px-1 py-0.5' value={manualDeclarer} onChange={e=> setManualDeclarer(e.target.value)}><option value=''>—</option><option value='N'>N</option><option value='E'>E</option><option value='S'>S</option><option value='W'>W</option></select></label>
					<label className='flex items-center justify-between gap-1'><span>Level</span><select className='border rounded px-1 py-0.5' value={manualLevel} onChange={e=> setManualLevel(e.target.value)}><option value=''>—</option>{['1','2','3','4','5','6','7'].map(l=> <option key={l}>{l}</option>)}</select></label>
					<label className='flex items-center justify-between gap-1'><span>Strain</span><select className='border rounded px-1 py-0.5' value={manualStrain} onChange={e=> setManualStrain(e.target.value)}><option value=''>—</option><option value='C'>C</option><option value='D'>D</option><option value='H'>H</option><option value='S'>S</option><option value='NT'>NT</option></select></label>
					<label className='flex items-center justify-between gap-1'><span>Dbl</span><select className='border rounded px-1 py-0.5' value={manualDbl} onChange={e=> setManualDbl(e.target.value)}><option value=''>—</option><option value='X'>X</option><option value='XX'>XX</option></select></label>
				</div>}
				<ScorePanel tricksDecl={tricksDecl} tricksDef={tricksDef} needed={neededToSet(effContract)} contract={effContract} declarer={effDeclarer} result={result} />
				<div className='flex flex-wrap gap-1 text-[11px]'>
					<button onClick={()=> rebuildFromHistory(0)} disabled={!history.length} className='px-2 py-0.5 border rounded disabled:opacity-40'>⏮</button>
					<button onClick={onPrevStep} disabled={playIdxRef.current<=0} className='px-2 py-0.5 border rounded disabled:opacity-40'>◀</button>
					<button onClick={onNextStep} disabled={playIdxRef.current>=history.length} className='px-2 py-0.5 border rounded disabled:opacity-40'>▶</button>
					<button onClick={()=> rebuildFromHistory(history.length)} disabled={playIdxRef.current>=history.length} className='px-2 py-0.5 border rounded disabled:opacity-40'>⏭</button>
				</div>
				{showAiLog && hideDefenders && <div className='flex-1 overflow-auto rounded border bg-white p-1 text-[10px]'>
					<div className='font-semibold mb-1'>AI Log</div>
					<div className='space-y-0.5'>
						{aiLogs.slice().reverse().map(l=> <div key={l.id} className='truncate'><span className='font-mono text-[9px] text-gray-500 mr-1'>{l.seat}</span>{l.text}</div>)}
					</div>
				</div>}
				{showCompletedTricks && <div className='rounded border bg-white p-1 text-[10px] max-h-60 overflow-auto'>
					<CompletedTricks tricks={completedTrickList} />
				</div>}
			</div>
			{/* Main content */}
			<div className='flex-1 p-4 flex flex-col gap-4'>
				{!current && deals.length===0 && <PreUpload onChooseFile={()=> fileRef.current?.click()} />}
				{current && hands && (
					<div className='flex flex-col gap-6 items-center'>
						{/* Planning Panel */}
						{effDeclarer && history.length===0 && planningOpen && <div className='w-full max-w-xl rounded-lg border bg-white/70 backdrop-blur p-4 text-[12px] shadow-sm'>
							<div className='flex items-center justify-between mb-2'><h3 className='font-semibold text-indigo-700'>Pre-Play Planning</h3>{planSubmitted && <span className='text-[10px] text-emerald-600 font-medium'>Submitted</span>}</div>
							{(current?.theme || current?.system || (current?.notes||[]).length>0) && <div className='mb-3 text-[11px] space-y-1'>
								{current?.theme && <div><span className='font-semibold text-indigo-600'>Theme:</span> {current.theme}</div>}
								{current?.system && <div><span className='font-semibold text-indigo-600'>System:</span> {current.system}</div>}
								{(current?.notes||[]).length>0 && <div className='border rounded bg-white/60 px-2 py-1'><span className='font-semibold text-indigo-600'>Notes:</span> {(current.notes).slice(0,3).map((n,i)=> <span key={i} className='ml-1 after:content-["·"] last:after:content-[""]'>{n}</span>)}</div>}
							</div>}
							<p className='mb-2 text-gray-700'>Estimate your sure winners and likely losers in the combined Declarer + Dummy hands (before any development). This frames your line of play.</p>
							<div className='grid grid-cols-2 gap-3 mb-3'>
								<label className='flex flex-col gap-1'>
									<span className='text-[11px] font-medium'>Sure Winners</span>
									<select disabled={planSubmitted} value={planWinners} onChange={e=> setPlanWinners(e.target.value)} className='border rounded px-1 py-0.5'>
										<option value=''>—</option>{Array.from({length:14},(_,i)=> i).map(n=> <option key={n} value={n}>{n}</option>)}
									</select>
								</label>
								<label className='flex flex-col gap-1'>
									<span className='text-[11px] font-medium'>Likely Losers</span>
									<select disabled={planSubmitted} value={planLosers} onChange={e=> setPlanLosers(e.target.value)} className='border rounded px-1 py-0.5'>
										<option value=''>—</option>{Array.from({length:14},(_,i)=> i).map(n=> <option key={n} value={n}>{n}</option>)}
									</select>
								</label>
							</div>
							<div className='flex gap-2'>
								<button disabled={planSubmitted || planWinners==='' || planLosers===''} onClick={()=>{ setPlanSubmitted(true); // evaluate plan
									const w=parseInt(planWinners,10), l=parseInt(planLosers,10); if(actualWinners!=null && actualLosers!=null){ const wDiff=w-actualWinners; const lDiff=l-actualLosers; let quality='neutral'; let whyCat='planNeutral'; if(Math.abs(wDiff)<=1 && Math.abs(lDiff)<=1){ quality='good'; whyCat='planGood' } else if(Math.abs(wDiff)<=2 && Math.abs(lDiff)<=2){ quality='neutral'; whyCat='planNeutral' } else { quality='bad'; whyCat='planBad' } const planBanks={ planGood:['Great — your numbers are almost spot on.','Nice! You read the hand really well.','Awesome — very close to the reference count.'], planNeutral:['Pretty good first guess; you can tweak later.','Not bad; small adjustments later.','Decent start — refine after a trick or two.'], planBad:['Numbers look off; re-count your top cards and losers.','Try again: re-check each suit for winners/losers.','Off target — slow down and re-count carefully.'] }; const why=pickVariant(whyCat, planBanks[whyCat]); const next=pickVariant('planNext',['Turn losers into winners (ruff, finesse, discard).','Figure how to fix losers while keeping entries.','Plan how each loser might disappear.']); const principle=`Reference: winners ${actualWinners} / losers ${actualLosers}`; setAdviceEntries(list=> [...list,{ id: Date.now()+Math.random().toString(36).slice(2,7), quality, why, next, seat: effDeclarer, card:'', principle }]); setPlanEvaluated(true) } }} className='px-2 py-1 text-[11px] rounded bg-indigo-600 disabled:opacity-40 text-white'>Submit Plan</button>
								<button onClick={()=>{ // skip / start immediately
									if(!planSubmitted){ setPlanSubmitted(true); setAdviceEntries(list=> [...list,{ id: Date.now()+Math.random().toString(36).slice(2,7), quality:'neutral', why:'You skipped detailed planning. Try still counting winners/losers as you play.', next:'Track remaining trumps & spot ways to turn losers into winners.', seat: effDeclarer, card:'', principle:'Started without plan' }]) }
									setPlanningOpen(false)
								}} className='px-2 py-1 text-[11px] rounded border bg-white'>Start Play</button>
								{planSubmitted && <button onClick={()=>{ setPlanSubmitted(false); setPlanEvaluated(false); setPlanWinners(''); setPlanLosers(''); }} className='px-2 py-1 text-[11px] rounded border'>Adjust</button>}
							</div>
							{actualWinners!=null && planSubmitted && <div className='mt-2 text-[11px] text-gray-600'>Reference count: <span className='font-semibold'>{actualWinners}</span> winners / <span className='font-semibold'>{actualLosers}</span> losers</div>}
							{preAnalysis && !planSubmitted && <div className='mt-4 text-[11px] bg-indigo-50/60 border border-indigo-200 rounded p-2 space-y-1'>
								<div className='font-semibold text-indigo-700 text-[11px]'>Partnership Snapshot</div>
								<div>HCP: {preAnalysis.hcpDecl}+{preAnalysis.hcpDummy} = <span className='font-semibold'>{preAnalysis.partnershipHcp}</span></div>
								<div>Shapes: Declarer {preAnalysis.shapeDecl} / Dummy {preAnalysis.shapeDummy}</div>
								<div>{preAnalysis.trumpSuit==='NT'? 'No trumps (NT)' : `Trump ${suitSymbol(preAnalysis.trumpSuit)} fit: ${preAnalysis.trumpLens.decl}+${preAnalysis.trumpLens.dummy} = ${preAnalysis.trumpLens.total}`}</div>
								{preAnalysis.longestSides.length>0 && <div>Longest side suit(s): {preAnalysis.longestSides.join(', ')}</div>}
								{preAnalysis.sureWinnerSuits.length>0 && <div>Sure winner suits: {preAnalysis.sureWinnerSuits.join(' ')} </div>}
								{preAnalysis.problemSuits.length>0 && <div>Problem suits: {preAnalysis.problemSuits.join(', ')}</div>}
								<div>Entry hints (A/K outside trump): {preAnalysis.entryCount}</div>
								<details className='pt-1'>
									<summary className='cursor-pointer text-indigo-700'>Suit detail</summary>
									<div className='grid grid-cols-4 gap-1 mt-1'>
										{['Spades','Hearts','Diamonds','Clubs'].map(s=> <div key={s} className='text-[10px] bg-white/70 border rounded p-1 flex flex-col items-center'><span className={`${s==='Hearts'||s==='Diamonds'?'text-red-600':'text-gray-700'} font-semibold`}>{suitSymbol(s)}</span><span className='opacity-70'>L{preAnalysis.perSuit[s].losers} W{preAnalysis.perSuit[s].winners}</span><span className='opacity-60'>{preAnalysis.perSuit[s].length} cards</span></div>)}
									</div>
								</details>
							</div>}
						</div>}
						{/* Cross layout with advice panel to left of North */}
						<div className='flex items-start gap-6'>
							{showAdvice && <div className='pt-1'><AdvicePanel entries={adviceEntries} /></div>}
								<div className={`grid grid-cols-3 grid-rows-3 relative ${showAdvice? 'gap-3 -ml-2':'gap-4'}`}>
								<div className='col-start-2 row-start-1 flex justify-center'>
									<SeatPanel id='N' compact remaining={remaining} turnSeat={turnSeat} trick={trick} onPlay={onPlayCard} visible={!hideDefenders || effDeclarer==='N' || partnerOf(effDeclarer)==='N'} dealer={current?.dealer} vul={current?.vul} declarer={effDeclarer} showHCP={hideDefenders && (effDeclarer==='N'|| partnerOf(effDeclarer)==='N')} lastAutoSeat={lastAutoSeat} />
								</div>
									{/* Contract badge to right of North (col 3, row 1) */}
									{effContract && <div className='col-start-3 row-start-1 flex justify-start items-start'>
										<ContractBadge contract={effContract} declarer={effDeclarer} />
									</div>}
								<div className='col-start-1 row-start-2 flex justify-center items-center'>
									<SeatPanel id='W' remaining={remaining} turnSeat={turnSeat} trick={trick} onPlay={onPlayCard} visible={!hideDefenders || effDeclarer==='W' || partnerOf(effDeclarer)==='W'} dealer={current?.dealer} vul={current?.vul} declarer={effDeclarer} showHCP={hideDefenders && (effDeclarer==='W'|| partnerOf(effDeclarer)==='W')} lastAutoSeat={lastAutoSeat} />
								</div>
								<div className='col-start-3 row-start-2 flex justify-center items-center'>
									<SeatPanel id='E' remaining={remaining} turnSeat={turnSeat} trick={trick} onPlay={onPlayCard} visible={!hideDefenders || effDeclarer==='E' || partnerOf(effDeclarer)==='E'} dealer={current?.dealer} vul={current?.vul} declarer={effDeclarer} showHCP={hideDefenders && (effDeclarer==='E'|| partnerOf(effDeclarer)==='E')} lastAutoSeat={lastAutoSeat} />
								</div>
								<div className='col-start-2 row-start-3 flex justify-center'>
									<SeatPanel id='S' compact remaining={remaining} turnSeat={turnSeat} trick={trick} onPlay={onPlayCard} visible={!hideDefenders || effDeclarer==='S' || partnerOf(effDeclarer)==='S'} dealer={current?.dealer} vul={current?.vul} declarer={effDeclarer} showHCP={hideDefenders && (effDeclarer==='S'|| partnerOf(effDeclarer)==='S')} lastAutoSeat={lastAutoSeat} />
								</div>
								<div className='col-start-2 row-start-2 flex items-center justify-center'>
									<CrossTrick trick={trick} winner={flashWinner} turnSeat={turnSeat} lastAutoPlay={lastAutoPlay} />
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

// Contract badge component
function ContractBadge({ contract, declarer }){
	if(!contract) return null
	// parse contract like 4S, 3NT, 2HX, 5DXX
	const m=contract.match(/^(\d)([CDHSN]{1,2})(X{0,2})$/i)
	if(!m) return <div className='rounded-lg border bg-white px-3 py-2 text-sm font-semibold'>{contract}</div>
	const level=m[1]; let strain=m[2].toUpperCase(); const dbl=m[3];
	const suitMap={ C:'♣', D:'♦', H:'♥', S:'♠', NT:'NT', N:'NT' };
	if(strain==='N') strain='NT'
	const sym=suitMap[strain]||strain; const isRed = strain==='H'||strain==='D'
	const colorClass=isRed? 'text-rose-600':'text-gray-800'
	const bgGrad=isRed? 'from-rose-50 to-amber-50':'from-emerald-50 to-sky-50'
	return <div className={`relative rounded-xl border-2 border-indigo-300 bg-gradient-to-br ${bgGrad} shadow px-4 py-3 flex flex-col items-center min-w-[90px]`}>
		<div className='text-[10px] tracking-wide text-indigo-600 font-semibold mb-0.5'>CONTRACT</div>
		<div className={`text-3xl font-bold leading-none ${colorClass}`}>{level}{sym}{dbl && <span className='text-indigo-700 text-2xl ml-0.5'>{dbl}</span>}</div>
		{declarer && <div className='mt-1 text-[11px] font-medium text-indigo-700'>Decl: {declarer}</div>}
	</div>
}

