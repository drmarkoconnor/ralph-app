import { ParsedBoard, hcp, suitLengths, hasFiveCardMajor, isBalanced } from './pbn-parse.js'

export interface AuctionLine { label: string; seq: string[]; prob: number; bullets: string[] }
export interface Advice {
  dealHash: string;
  board: number;
  meta: { dealer: 'N'|'E'|'S'|'W'; vul: 'None'|'NS'|'EW'|'Both'; system: string };
  auctions: AuctionLine[];
  recommendation_index: number;
  final_contract: { by: 'N'|'E'|'S'|'W'; level: number; strain: '♠'|'♥'|'♦'|'♣'|'NT' };
  teacher_focus: string[];
}

// Deterministic RNG (LCG) for any random-like ordering (seeded by dealHash)
function lcg(seed: number){ let s = seed>>>0; return ()=> { s = (s*1664525 + 1013904223)>>>0; return s/0xFFFFFFFF } }
function seedFrom(hash: string){ let h=0; for(const ch of hash) h=(h*131 + ch.charCodeAt(0))>>>0; return h; }

export function buildAdvice(board: ParsedBoard): Advice {
  const N = board.hands.N, E = board.hands.E, S = board.hands.S, W = board.hands.W;
  const HCP = { N: hcp(N), E: hcp(E), S: hcp(S), W: hcp(W) };
  const lengths = { N: suitLengths(N), E: suitLengths(E), S: suitLengths(S), W: suitLengths(W) };
  const opener = board.dealer; // always dealer for v1
  const openHcp = HCP[opener];
  const openLengths = lengths[opener];
  const fiveMajor = hasFiveCardMajor(openLengths);
  const openChoice = chooseOpening(fiveMajor, openHcp, openLengths);

  // Build mainline auction (only NS assumed active unless dealer is E/W)
  const sequences: AuctionLine[] = [];
  const rng = lcg(seedFrom(board.dealHash));

  const mainline = buildMainline(board, HCP, lengths, openChoice);
  sequences.push(mainline);

  // Alternatives
  const alts = buildAlternatives(board, HCP, lengths, mainline, rng);
  sequences.push(...alts);

  // Probability assignment deterministic
  assignProbabilities(sequences);

  // Final contract from mainline (last non-pass before trailing passes)
  const finalCall = [...mainline.seq].reverse().find(c=> c !== 'P');
  const fcParsed = parseContract(finalCall||'P');
  const final_contract = fcParsed || { by: opener, level: 1, strain: 'NT' } as Advice['final_contract'];

  const advice: Advice = {
    dealHash: board.dealHash,
    board: board.board,
    meta: { dealer: board.dealer, vul: board.vul, system: board.system },
    auctions: sequences,
    recommendation_index: 0,
    final_contract,
    teacher_focus: buildTeacherFocus(mainline, HCP, lengths, board)
  };
  return advice;
}

function chooseOpening(fiveMajor: 'S'|'H'|null, hcpVal: number, lens: Record<'S'|'H'|'D'|'C',number>): string {
  if(fiveMajor && hcpVal>=12) return '1'+(fiveMajor==='S'?'♠':'♥');
  const balanced = isBalanced(lens);
  if(balanced && hcpVal>=12 && hcpVal<=14 && !fiveMajor) return '1NT';
  // longest minor
  if(lens.D>=3 && lens.D>=lens.C) return '1♦';
  return '1♣';
}

function buildMainline(board: ParsedBoard, HCP: Record<string,number>, lengths: any, opening: string): AuctionLine {
  const opener = board.dealer;
  const partner = partnerOf(opener);
  const partnerHcp = HCP[partner];
  const partnerLengths = lengths[partner];
  const hasFit = /1[♠♥]/.test(opening) && partnerLengths[ opening.endsWith('♠')?'S':'H'] >= 3;
  const seq: string[] = [ opening ];
  // Passes by opponents (no interference v1)
  seq.push('P');
  if(/1[♠♥]/.test(opening)){
    // Major opening
    if(partnerHcp <=5){ seq.push('P'); } else if(partnerHcp<=9 && !hasFit){ seq.push('1NT'); }
    else if(partnerHcp<=8 && hasFit){ seq.push('2'+opening[1]); }
    else if(partnerHcp<=11 && hasFit){ seq.push('3'+opening[1]); }
    else if(partnerHcp>=12 && hasFit){ seq.push('4'+opening[1]); }
    else { seq.push('1NT'); }
  } else if(opening==='1NT') {
    // Balanced 12-14
    if(partnerHcp<8) seq.push('P'); else if(partnerHcp>=8 && partnerHcp<=9) seq.push('2NT'); else if(partnerHcp>=10) seq.push('3NT');
  } else {
    // Minor opening simplified: partner responds 1NT with 6-9, raises minor rarely else pass
    if(partnerHcp<6) seq.push('P'); else seq.push('1NT');
  }
  seq.push('P'); // responder action processed, other opp passes
  // Opener rebid (only for 1M-1NT mainline escalate to game if strong)
  const openerHcp = HCP[opener];
  const last = seq[seq.length-2];
  if(/1[♠♥]/.test(opening) && last==='1NT'){
    if(openerHcp>=18) seq.push('4'+opening[1]);
    else seq.push('2'+opening[1]);
  } else {
    // no further action
    seq.push('P');
  }
  // Close out with Passes to make 8 calls total
  while(seq.length<8) seq.push('P');

  const bullets = buildBullets(opening, opener, partner, HCP, lengths, seq);
  return { label: 'Mainline ACOL', seq, prob: 0, bullets };
}

function buildAlternatives(board: ParsedBoard, HCP: Record<string,number>, lengths: any, main: AuctionLine, rng: ()=>number): AuctionLine[] {
  const opener = board.dealer; const partner = partnerOf(opener);
  const opening = main.seq[0];
  const alts: AuctionLine[] = [];
  if(/1[♠♥]/.test(opening)){
    // Off-book 2-level new suit by partner with too few points
    alts.push({ label: 'Off-book 2♦', seq: [opening,'P','2♦','P','2'+opening[1],'P','P','P'], prob:0, bullets:[ 'Some players bid 2♦ lightly; ACOL expects 9+ HCP at the 2-level.', `Opener returns to ${opening[1]} partscore.`, 'Risks missing game when opener is very strong.' ] });
    alts.push({ label: 'Optimistic raise', seq: [opening,'P','2'+opening[1],'P','4'+opening[1],'P','P','P'], prob:0, bullets:[ 'Thin raise with inadequate support — undisciplined in ACOL.', 'Game succeeds here only because opener is huge.', 'Better evaluation by counting points and fit first.' ] });
  } else {
    // Alternative after 1NT opening: invitational raise vs game direct
    alts.push({ label: 'Conservative sign-off', seq:[opening,'P','P','P','P','P','P','P'], prob:0, bullets:[ 'Responder passes with marginal values.', 'May miss thin game opposite max 1NT.', 'Balance by counting combined HCP.' ] });
    alts.push({ label: 'Over-ambitious 3NT', seq:[opening,'P','3NT','P','P','P','P','P'], prob:0, bullets:[ 'Responder pushes straight to game.', 'Can fail if opener is minimum or suit stoppers lacking.', 'Discipline: evaluate intermediates and shape.' ] });
  }
  return alts.slice(0,2);
}

function assignProbabilities(lines: AuctionLine[]): void {
  if(!lines.length) return; const main = lines[0];
  main.prob = 0.88;
  const remaining = 1 - main.prob; const altShare = remaining / (lines.length-1);
  for(let i=1;i<lines.length;i++) lines[i].prob = parseFloat((altShare).toFixed(2));
  // Normalize minor rounding drift to exactly 1.00 (adjust last alt)
  const sum = lines.reduce((s,l)=> s + l.prob,0);
  const drift = parseFloat((1 - sum).toFixed(2));
  if(drift !== 0 && lines.length>1) lines[lines.length-1].prob = parseFloat((lines[lines.length-1].prob + drift).toFixed(2));
}

function parseContract(call: string): Advice['final_contract'] | null {
  const m = call && call.match(/^(\d)([♠♥♦♣]|NT)$/); if(!m) return null; const level=parseInt(m[1],10); const strainMap: any = { '♠':'♠','♥':'♥','♦':'♦','♣':'♣','NT':'NT' }; return { by: 'N', level, strain: strainMap[m[2]] };
}

function buildBullets(opening: string, opener: string, partner: string, HCP: Record<string,number>, lengths: any, seq: string[]): string[] {
  const major = /1[♠♥]/.test(opening)? opening[1] : null;
  const bullets: string[] = [];
  bullets.push(`Responder ${HCP[partner]} HCP${major? ` with ${major==='♠'? '♠':'♥'} ${lengths[partner][major==='♠'?'S':'H']}`:''} chooses ${seq[2]||'P'}.`);
  bullets.push(`Opener ${HCP[opener]} HCP ${major? 'supports major and sets game':'evaluates distribution'} -> ${finalAction(seq)}.`);
  const losersEst = estimateLosers(HCP[opener], lengths[opener]);
  bullets.push(`Plan: losers ≈${losersEst}; manage entries & potential danger hand.`);
  return bullets.slice(0,3);
}

function finalAction(seq: string[]): string { return [...seq].reverse().find(c=> c!=='P')||'P'; }

function estimateLosers(h:number, lens: any): number { // crude: 24-HCP/3 approx, limited to 3-5 range
  const approx = Math.round((24 - h)/3); return Math.min(6, Math.max(2, approx));
}

function partnerOf(seat: string){ return seat==='N'?'S': seat==='S'?'N': seat==='E'?'W':'E'; }

function buildTeacherFocus(mainline: AuctionLine, HCP: Record<string,number>, lengths:any, board: ParsedBoard): string[] {
  const opener = board.dealer; const partner = partnerOf(opener);
  return [ `Count losers first`, `Identify danger hand`, `Entry management`, `Fit & HCP: ${HCP[opener]} + ${HCP[partner]}` ];
}
