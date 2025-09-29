// Lightweight in-app ACOL auction advisor (JS port)
// Generates deterministic auction advice for a single deal object used by PDF export.
// Public: buildAcolAdvice(deal)
// deal: { number, dealer, vul, hands: {N:[],E:[],S:[],W:[]}, calls? }

function computeDealHash(hands){
  try {
    const seats = ['N','E','S','W'];
    const parts = seats.map(seat => {
      const arr = (hands[seat]||[]).map(c=> c.suit? (c.suit[0].toUpperCase()+normalizeRank(c.rank)) : c ).map(String);
      // Support two card shapes: objects {suit,rank} or strings 'SA'
      const cards = arr.map(card => {
        if(card.length === 2) return card; // 'SA'
        // fallback attempt parse like 'S:A'
        return card.replace(/[^SHDCATKQJ0-9]/g,'').slice(0,2);
      });
      const norm = cards.sort().join('');
      return seat+':'+norm;
    }).join('|');
    return hashString(parts);
  } catch { return 'hash-fallback'; }
}

function normalizeRank(r){ if(r==='10') return 'T'; return String(r).toUpperCase(); }
function hashString(str){ let h=0; for(let i=0;i<str.length;i++){ h=(h*131 + str.charCodeAt(i))>>>0; } return 'h'+h.toString(16); }

function hcp(cards){
  return cards.reduce((t,c)=>{ const rank = extractRank(c); return t + (rank==='A'?4: rank==='K'?3: rank==='Q'?2: rank==='J'?1:0); },0);
}
function extractRank(card){ if(typeof card==='string'){ return card.slice(-1); } return normalizeRank(card.rank); }
function suitLengths(cards){
  const lens = {S:0,H:0,D:0,C:0};
  cards.forEach(c=> { const s = typeof c==='string'? c[0]: (c.suit && c.suit[0])||''; if(lens[s]!==undefined) lens[s]++; });
  return lens;
}
function mergeLengths(l){ return { ...l }; }
function hasFiveCardMajor(lengths){ if(lengths.S>=5 && lengths.S>=lengths.H) return 'S'; if(lengths.H>=5) return 'H'; return null; }
function isBalanced(lengths){ const arr = Object.values(lengths).sort((a,b)=>a-b).join('-'); return ['2-3-3-5','2-3-4-4','3-3-3-4'].includes(arr) || ['4333','4432','5332'].includes('SHDC'.split('').map(k=> lengths[k]).join('')); }

function lcg(seed){ let s = seed>>>0; return ()=> { s = (s*1664525 + 1013904223)>>>0; return s/0xFFFFFFFF; }; }
function seedFrom(hash){ let h=0; for(const ch of hash) h=(h*131 + ch.charCodeAt(0))>>>0; return h; }
function partnerOf(seat){ return seat==='N'?'S': seat==='S'?'N': seat==='E'?'W':'E'; }

function chooseOpening(fiveMajor, hcpVal, lens){
  if(fiveMajor && hcpVal>=12) return '1'+(fiveMajor==='S'?'S':'H');
  const balanced = isBalanced(lens);
  if(balanced && hcpVal>=12 && hcpVal<=14 && !fiveMajor) return '1NT';
  if(lens.D>=3 && lens.D>=lens.C) return '1D';
  return '1C';
}

function buildMainline(deal, HCP, lengths, opening){
  const opener = deal.dealer;
  const partner = partnerOf(opener);
  const partnerHcp = HCP[partner];
  const partnerLengths = lengths[partner];
  const hasFit = /1[SH]/.test(opening) && partnerLengths[ opening.endsWith('S')?'S':'H'] >= 3;
  const seq = [ opening, 'P' ];
  if(/1[SH]/.test(opening)){
    if(partnerHcp <=5){ seq.push('P'); }
    else if(partnerHcp<=9 && !hasFit){ seq.push('1NT'); }
    else if(partnerHcp<=8 && hasFit){ seq.push('2'+opening[1]); }
    else if(partnerHcp<=11 && hasFit){ seq.push('3'+opening[1]); }
    else if(partnerHcp>=12 && hasFit){ seq.push('4'+opening[1]); }
    else { seq.push('1NT'); }
  } else if(opening==='1NT') {
    if(partnerHcp<8) seq.push('P'); else if(partnerHcp<=9) seq.push('2NT'); else seq.push('3NT');
  } else { // minor opening
    if(partnerHcp<6) seq.push('P'); else seq.push('1NT');
  }
  seq.push('P');
  const openerHcp = HCP[opener];
  const last = seq[seq.length-2];
  if(/1[SH]/.test(opening) && last==='1NT'){
    if(openerHcp>=18) seq.push('4'+opening[1]); else seq.push('2'+opening[1]);
  } else seq.push('P');
  // Ensure final three passes only if needed later (render layer will compress)
  // Guarantee at least final pass closure
  if(seq[seq.length-1] !== 'P') seq.push('P');
  if(seq.filter(c=> c!=='P').length>0){
    // add remaining passes to make contract closed (3 passes after last call)
    let trailing = 0; for(let i=seq.length-1;i>=0 && seq[i]==='P'; i--) trailing++;
    while(trailing < 3){ seq.push('P'); trailing++; }
  }
  const bullets = buildBullets(opening, opener, partner, HCP, lengths, seq);
  return { label: 'Mainline ACOL', seq, prob: 0, bullets };
}

function buildAlternatives(mainline, deal, HCP, lengths, rng){
  const opening = mainline.seq[0];
  const alts = [];
  if(/1[SH]/.test(opening)){
    alts.push({ label: 'Off-book 2D', seq: [opening,'P','2D','P','2'+opening[1],'P','P','P'], prob:0, bullets:[ 'Some bid 2D lightly (needs 9+ HCP at 2-level).', `Opener returns to ${opening[1]} partscore.`, 'Risk: miss game opposite a strong opener.' ] });
    alts.push({ label: 'Optimistic raise', seq: [opening,'P','2'+opening[1],'P','4'+opening[1],'P','P','P'], prob:0, bullets:[ 'Light raise with insufficient values.', 'Game succeeds only with max opener.', 'Better to evaluate fit + points first.' ] });
  } else {
    alts.push({ label: 'Conservative sign-off', seq:[opening,'P','P','P','P','P','P','P'], prob:0, bullets:[ 'Responder passes marginal values.', 'Could miss thin game opposite max.', 'Weigh intermediates + shape.' ] });
    alts.push({ label: 'Direct 3NT', seq:[opening,'P','3NT','P','P','P','P','P'], prob:0, bullets:[ 'Jumps straight to game.', 'Fails opposite minimum opener.', 'Need reliable stoppers & texture.' ] });
  }
  return alts.slice(0,2);
}

function assignProb(lines){ if(!lines.length) return; const main = lines[0]; main.prob=0.88; const remain=1-main.prob; const altShare = remain/(lines.length-1); for(let i=1;i<lines.length;i++) lines[i].prob = parseFloat(altShare.toFixed(2)); const sum = lines.reduce((s,l)=> s+l.prob,0); const drift = parseFloat((1-sum).toFixed(2)); if(drift!==0 && lines.length>1) lines[lines.length-1].prob = parseFloat((lines[lines.length-1].prob+drift).toFixed(2)); }
function finalAction(seq){ return [...seq].reverse().find(c=> c!=='P')||'P'; }
function estimateLosers(h,lens){ const approx = Math.round((24-h)/3); return Math.min(6, Math.max(2, approx)); }
function buildBullets(opening, opener, partner, HCP, lengths, seq){
  const major = /1[SH]/.test(opening)? opening[1]: null;
  const bullets=[];
  const partnerSuitLen = major? lengths[partner][major]: null;
  const responderAction = seq.find((c,i)=> i>0 && c!=='P');
  bullets.push(`Responder has ${HCP[partner]} HCP${major? ` with ${partnerSuitLen} card ${major}`:''} and bids ${responderAction||'Pass'}.`);
  bullets.push(`Opener ${HCP[opener]} HCP ${major? 'supports the major':'has no major fit'} – auction ends at ${finalAction(seq)}.`);
  bullets.push(`Plan: approx ${estimateLosers(HCP[opener], lengths[opener])} losers; focus on entries & danger hand.`);
  return bullets.slice(0,3);
}
function buildTeacherFocus(mainline, HCP, lengths, deal){
  const opener = deal.dealer; const partner = partnerOf(opener); return [ 'Count losers first', 'Identify danger hand', 'Entry management', `Fit & HCP: ${HCP[opener]} + ${HCP[partner]}` ]; }

export function buildAcolAdvice(deal){
  if(!deal || !deal.hands) return null;
  const dealer = deal.dealer || 'N';
  const hash = deal.dealHash || computeDealHash(deal.hands);
  const seats = ['N','E','S','W'];
  const HCP = {}; const lengths = {};
  seats.forEach(seat => { const cards = deal.hands[seat]||[]; HCP[seat]=hcp(cards); lengths[seat]=suitLengths(cards); });
  const opener = dealer; const fiveMajor = hasFiveCardMajor(lengths[opener]);
  const opening = chooseOpening(fiveMajor, HCP[opener], lengths[opener]);
  const mainline = buildMainline(deal, HCP, lengths, opening);
  const rng = lcg(seedFrom(hash));
  const alts = buildAlternatives(mainline, deal, HCP, lengths, rng);
  const lines = [mainline, ...alts];
  assignProb(lines);
  const finalCall = [...mainline.seq].reverse().find(c=> c!=='P');
  const final_contract = parseContract(finalCall||'P') || { by: opener, level:1, strain:'NT' };
  return { dealHash: hash, board: deal.number||0, meta: { dealer: opener, vul: deal.vul||'None', system: deal.meta?.system || 'ACOL' }, auctions: lines, recommendation_index: 0, final_contract, teacher_focus: buildTeacherFocus(mainline, HCP, lengths, deal) };
}

function parseContract(call){ const m = call && call.match(/^(\d)([SHDC]|NT)$/); if(!m) return null; return { by: 'N', level: parseInt(m[1],10), strain: m[2] }; }

// Simple in-memory cache so multiple exports avoid recompute
const _adviceCache = new Map();
export function getOrBuildAcolAdvice(deal){
  const key = deal.dealHash || computeDealHash(deal.hands);
  if(_adviceCache.has(key)) return _adviceCache.get(key);
  const adv = buildAcolAdvice(deal);
  if(adv) _adviceCache.set(key, adv);
  return adv;
}

export function hasAcolAdvice(deal){
  const key = deal.dealHash || computeDealHash(deal.hands);
  return _adviceCache.has(key) || !!deal.auctionAdvice;
}
