import './index.css'
import DragDropCards from './DragDropCards'
import { useState } from 'react'
// Lightweight in-page editor wiring per prompt without major visual changes
import { BoardZ } from './schemas/board'
import { exportBoardPBN } from './pbn/export'
import { Link } from 'react-router-dom'

function App() {
	// helpers
	const todayISO = new Date().toISOString().slice(0,10)
	const toPbnDate = (iso) => iso ? iso.replace(/-/g, '.') : ''

	const [meta, setMeta] = useState({
		// core
		event: 'Club Teaching session',
		siteChoice: 'Bristol Bridge Club',
		siteOther: '',
		dateISO: todayISO,
		date: toPbnDate(todayISO),
		// extended
		system: '',
		themeChoice: 'Bidding - Stayman & Transfers',
		themeCustom: '',
		theme: '', // derived
		interf: '',
		lead: '',
		ddpar: '',
		scoring: 'MPs',
		// teacher authored
		notes: [],
		notesDraft: '',
		auctionStart: 'N',
		auctionText: '',
		playscript: '',
	})
	const [exportPreview, setExportPreview] = useState('')
	const onExportTemplate = async () => {
		try {
			// derive theme and site from choices
			const site = meta.siteChoice === 'Other' ? (meta.siteOther || 'Other') : meta.siteChoice
			const theme = meta.themeChoice === 'Custom…' ? (meta.themeCustom || '') : meta.themeChoice
			// Normalize auction
			const auctionTokens = (meta.auctionText||'').trim().split(/\s+/).filter(Boolean)
			const sample = BoardZ.parse({
				event: meta.event,
				site,
				date: meta.date,
				board: 1, dealer: 'N', vul: 'None', dealPrefix: 'N',
				hands: { N:{S:[],H:[],D:[],C:[]}, E:{S:[],H:[],D:[],C:[]}, S:{S:[],H:[],D:[],C:[]}, W:{S:[],H:[],D:[],C:[]} },
				auctionStart: auctionTokens.length ? meta.auctionStart : undefined,
				auction: auctionTokens.length ? auctionTokens : undefined,
				ext: {
					system: meta.system||undefined,
					theme: theme||undefined,
					interf: meta.interf||undefined,
					lead: meta.lead||undefined,
					ddpar: meta.ddpar||undefined,
					scoring: meta.scoring||undefined,
					playscript: meta.playscript||undefined,
				},
				notes: meta.notes && meta.notes.length ? meta.notes : [],
			})
			const txt = await exportBoardPBN(sample)
			setExportPreview(txt)
		} catch (e) {
			setExportPreview(String(e))
		}
	}
	return (
		<div className="min-h-screen bg-primary/10 flex flex-col items-center justify-start py-4">
			<h1 className="text-5xl font-fun text-accent mb-1 drop-shadow-lg text-center">
				Bristol Bridge Club's PBN Generator
			</h1>
			<div
				className="mb-3 text-m italic text-gray-700"
				style={{ fontFamily: 'Apple Chancery, Snell Roundhand, cursive' }}>
				Mr Ralph Power, Educational Director, Bristol Bridge Club
			</div>
			<div className="mb-2 text-sm flex gap-3">
				<Link to="/" className="text-sky-600 hover:underline">
					← Home
				</Link>
				<Link to="/player" className="text-sky-600 hover:underline">
					Go to PBN Player →
				</Link>
			</div>
			{/* Minimal editor header per prompt: small, non-intrusive */}
			<div className="w-full max-w-[1100px] mx-auto px-2 mb-2">
				<div className="rounded-lg border bg-white p-2">
					<div className="text-sm font-semibold text-gray-800 mb-1">Extended PBN v1.0 (metadata)</div>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
						{/* Event */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Event</span>
							<select value={meta.event} onChange={(e)=>setMeta(m=>({...m,event:e.target.value}))} className="border rounded px-2 py-1">
								<option>Club Teaching session</option>
								<option>Club Tournament</option>
								<option>Club Social</option>
							</select>
						</label>
						{/* Location / Site */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Location</span>
							<select value={meta.siteChoice} onChange={(e)=>setMeta(m=>({...m,siteChoice:e.target.value}))} className="border rounded px-2 py-1">
								<option>Bristol Bridge Club</option>
								<option>Home</option>
								<option>3rd Party</option>
								<option>Other</option>
							</select>
						</label>
						{meta.siteChoice === 'Other' && (
							<label className="flex flex-col gap-0.5">
								<span className="text-gray-600">Location (Other)</span>
								<input value={meta.siteOther} onChange={(e)=>setMeta(m=>({...m,siteOther:e.target.value}))} className="border rounded px-2 py-1" />
							</label>
						)}
						{/* Date */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Date</span>
							<input type="date" value={meta.dateISO} onChange={(e)=>{
								const iso = e.target.value
								setMeta(m=>({...m,dateISO:iso,date:toPbnDate(iso)}))
							}} className="border rounded px-2 py-1" />
						</label>
						{/* System */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">System</span>
							<input value={meta.system} onChange={(e)=>setMeta(m=>({...m,system:e.target.value}))} className="border rounded px-2 py-1" placeholder="Acol 12-14 1NT" />
						</label>
						{/* Theme dropdown with custom */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Theme</span>
							<select value={meta.themeChoice} onChange={(e)=>setMeta(m=>({...m,themeChoice:e.target.value}))} className="border rounded px-2 py-1">
								<option>Bidding - Stayman & Transfers</option>
								<option>Bidding - Overcalls</option>
								<option>Bidding - Weak Twos</option>
								<option>Slam Bidding</option>
								<option>Opening Leads</option>
								<option>Defence - Signals</option>
								<option>Declarer - Finesses</option>
								<option>Declarer - Suit Establishment</option>
								<option>Declarer - Counting</option>
								<option>Card Play - Ducking</option>
								<option>Endplays & Squeezes</option>
								<option>Interference - Landy</option>
								<option>Custom…</option>
							</select>
						</label>
						{meta.themeChoice === 'Custom…' && (
							<label className="flex flex-col gap-0.5">
								<span className="text-gray-600">Theme (Custom)</span>
								<input value={meta.themeCustom} onChange={(e)=>setMeta(m=>({...m,themeCustom:e.target.value}))} className="border rounded px-2 py-1" placeholder="e.g. Inverted Minors" />
							</label>
						)}
						{/* Interference/Lead/DDPar/Scoring */}
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Interf</span>
							<input value={meta.interf} onChange={(e)=>setMeta(m=>({...m,interf:e.target.value}))} className="border rounded px-2 py-1" placeholder="Landy 2C" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Lead</span>
							<input value={meta.lead} onChange={(e)=>setMeta(m=>({...m,lead:e.target.value}))} className="border rounded px-2 py-1" placeholder="W:♠4" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">DDPar</span>
							<input value={meta.ddpar} onChange={(e)=>setMeta(m=>({...m,ddpar:e.target.value}))} className="border rounded px-2 py-1" placeholder="3NT=" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Scoring</span>
							<select value={meta.scoring} onChange={(e)=>setMeta(m=>({...m,scoring:e.target.value}))} className="border rounded px-2 py-1">
								<option value="MPs">MPs</option>
								<option value="IMPs">IMPs</option>
							</select>
						</label>
					</div>

					{/* Teacher notes (split into multiple Note tags) */}
					<div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
						<div className="flex flex-col gap-1">
							<span className="text-gray-600">Notes (paste long text, then Split)</span>
							<textarea className="border rounded px-2 py-1 h-20" value={meta.notesDraft} onChange={(e)=>setMeta(m=>({...m,notesDraft:e.target.value}))} placeholder="Paste teaching notes here..." />
							<div className="flex gap-2">
								<button className="px-2 py-1 rounded border" onClick={()=>{
									const raw = (meta.notesDraft||'').trim()
									if (!raw) return
									// split on blank lines first, else by 280 chars
									const blocks = raw.split(/\n\s*\n/).filter(Boolean)
									const chunks = []
									const pushChunk = (s)=>{
										const trimmed = s.trim()
										if (!trimmed) return
										for (let i=0;i<trimmed.length;i+=280) chunks.push(trimmed.slice(i,i+280))
									}
									if (blocks.length > 1) {
										blocks.forEach(pushChunk)
									} else {
										pushChunk(raw)
									}
									setMeta(m=>({...m,notes:chunks.slice(0,10)}))
								}}>Split to Notes</button>
								<button className="px-2 py-1 rounded border" onClick={()=>setMeta(m=>({...m,notes:[],notesDraft:''}))}>Clear</button>
							</div>
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-gray-600">Notes (max 10)</span>
							<div className="flex flex-col gap-1">
								{meta.notes.map((n,idx)=> (
									<div key={idx} className="flex gap-1 items-center">
										<input className="border rounded px-2 py-1 flex-1" value={n} onChange={(e)=>{
											const arr = [...meta.notes]
											arr[idx] = e.target.value
											setMeta(m=>({...m,notes:arr}))
										}} />
										<button className="px-2 py-1 rounded border" onClick={()=>{
											const arr = meta.notes.filter((_,i)=>i!==idx)
											setMeta(m=>({...m,notes:arr}))
										}}>✕</button>
									</div>
								))}
								{meta.notes.length < 10 && (
									<button className="px-2 py-1 rounded border self-start" onClick={()=>setMeta(m=>({...m,notes:[...m.notes,'']}))}>+ Add note</button>
								)}
							</div>
						</div>
					</div>

					{/* Teacher ideal auction and playscript */}
					<div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
						<div className="flex flex-col gap-1">
							<span className="text-gray-600">Ideal Bidding (Auction)</span>
							<div className="flex items-center gap-2">
								<label className="flex items-center gap-1">
									<span className="text-gray-600">Start</span>
									<select value={meta.auctionStart} onChange={(e)=>setMeta(m=>({...m,auctionStart:e.target.value}))} className="border rounded px-2 py-1">
										<option>N</option>
										<option>E</option>
										<option>S</option>
										<option>W</option>
									</select>
								</label>
								<input className="border rounded px-2 py-1 flex-1" placeholder="e.g. 1NT Pass 2C Pass 2D Pass 3NT Pass Pass Pass" value={meta.auctionText} onChange={(e)=>setMeta(m=>({...m,auctionText:e.target.value}))} />
							</div>
							<span className="text-[10px] text-gray-500">Enter space-separated calls; ends with three Passes.</span>
						</div>
						<div className="flex flex-col gap-1">
							<span className="text-gray-600">Ideal Card Play (PlayScript)</span>
							<textarea className="border rounded px-2 py-1 h-20" placeholder={`One play per line, e.g.\nW:♠4\nN:♠A\nE:♠2\nS:♠7`} value={meta.playscript} onChange={(e)=>setMeta(m=>({...m,playscript:e.target.value}))} />
						</div>
					</div>
					<div className="mt-2 flex items-center justify-between">
						<div className="text-[11px] text-gray-600">Use the card picker below to build hands; this metadata will be used by the exporter.</div>
						<button onClick={onExportTemplate} className="px-2 py-1 rounded border text-xs">Preview Template</button>
					</div>
					{exportPreview && (
						<pre className="mt-2 whitespace-pre-wrap text-[10px] leading-tight bg-gray-50 border border-gray-200 rounded p-2 w-full max-h-24 overflow-y-auto">{exportPreview}</pre>
					)}
				</div>
			</div>

			<DragDropCards meta={meta} />
		</div>
	)
}

export default App

