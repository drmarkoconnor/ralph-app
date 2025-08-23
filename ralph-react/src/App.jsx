import './index.css'
import DragDropCards from './DragDropCards'
import { useMemo, useState } from 'react'
// Lightweight in-page editor wiring per prompt without major visual changes
import { BoardZ } from './schemas/board'
import { exportBoardPBN } from './pbn/export'
import { Link } from 'react-router-dom'

function App() {
	const [meta, setMeta] = useState({
		event: 'Club Session', site: 'Local', date: new Date().toISOString().slice(0,10).replace(/-/g,'.'),
		system: '', theme: '', interf: '', lead: '', ddpar: '', scoring: 'MPs',
	})
	const [exportPreview, setExportPreview] = useState('')
	const onExportTemplate = async () => {
		try {
			// Minimal sample with empty hands for now; DragDropCards already exports basic PBN
			const sample = BoardZ.parse({
				event: meta.event, site: meta.site, date: meta.date,
				board: 1, dealer: 'N', vul: 'None', dealPrefix: 'N',
				hands: { N:{S:[],H:[],D:[],C:[]}, E:{S:[],H:[],D:[],C:[]}, S:{S:[],H:[],D:[],C:[]}, W:{S:[],H:[],D:[],C:[]} },
				ext: { system: meta.system||undefined, theme: meta.theme||undefined, interf: meta.interf||undefined, lead: meta.lead||undefined, ddpar: meta.ddpar||undefined, scoring: meta.scoring||undefined },
				notes: [],
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
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Event</span>
							<input value={meta.event} onChange={(e)=>setMeta(m=>({...m,event:e.target.value}))} className="border rounded px-2 py-1" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Site</span>
							<input value={meta.site} onChange={(e)=>setMeta(m=>({...m,site:e.target.value}))} className="border rounded px-2 py-1" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Date (YYYY.MM.DD)</span>
							<input value={meta.date} onChange={(e)=>setMeta(m=>({...m,date:e.target.value}))} className="border rounded px-2 py-1" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">System</span>
							<input value={meta.system} onChange={(e)=>setMeta(m=>({...m,system:e.target.value}))} className="border rounded px-2 py-1" placeholder="Acol 12-14 1NT" />
						</label>
						<label className="flex flex-col gap-0.5">
							<span className="text-gray-600">Theme</span>
							<input value={meta.theme} onChange={(e)=>setMeta(m=>({...m,theme:e.target.value}))} className="border rounded px-2 py-1" placeholder="Stayman & transfers" />
						</label>
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

