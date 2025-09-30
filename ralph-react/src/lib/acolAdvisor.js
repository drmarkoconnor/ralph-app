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
  // Opening requirements (simplified ACOL flavour):
  // <12 HCP: consider preempt if 7+ card suit and 5-10 HCP else PASS
  if(hcpVal < 12){
    const order = ['S','H','D','C'];
    let best=null, bestLen=0; order.forEach(s=> { if(lens[s] > bestLen){ bestLen=lens[s]; best=s; }});
    if(bestLen>=7 && hcpVal<=10){
      const level = (best==='S'||best==='H') ? (bestLen>=8?4:3) : 3;
      return level + best; // e.g. 3H / 4S / 3D / 3C
    }
    return 'PASS';
  }
  // 12-14 balanced w/out 5-card major -> 1NT
  const balanced = isBalanced(lens);
  if(balanced && !fiveMajor && hcpVal>=12 && hcpVal<=14) return '1NT';
  // 5+ major -> 1M
  if(fiveMajor && hcpVal>=12) return '1'+(fiveMajor==='S'?'S':'H');
  // Longest minor (prefer 1D if 4+ and >= clubs)
  if(lens.D >= 4 && lens.D >= lens.C) return '1D';
  return '1C';
}

function buildMainline(deal, HCP, lengths, opening){
  const opener = deal.dealer;
  const partner = partnerOf(opener);
  const partnerHcp = HCP[partner];
  const partnerLengths = lengths[partner];
  const seq = [ opening ];

  // PASS out
  if(opening === 'PASS'){
    while(seq.length < 4) seq.push('P');
    return finalizeAuctionLine(seq, opening, opener, partner, HCP, lengths);
  }

  // Preempt opening (3/4-level) -> assume silence unless partner has game values + support
  if(/^[34][SHDC]$/.test(opening)){
    // LHO pass
    seq.push('P');
    // Partner evaluate
    const suit = opening.slice(-1);
    const supportLen = partnerLengths[suit];
    if(HCP[partner] >= 13 && supportLen >= 3){
      if(suit==='S' || suit==='H') seq.push('4'+suit); else seq.push('5'+suit);
    } else seq.push('P');
    // RHO pass
    seq.push('P');
    return finalizeAuctionLine(seq, opening, opener, partner, HCP, lengths);
  }

  // 1-level opening logic
  const hasMajorFit = /1[SH]/.test(opening) && partnerLengths[ opening.endsWith('S') ? 'S':'H'] >= 3;
  if(/1[SH]/.test(opening)){
    if(partnerHcp <=5) seq.push('P');
    else if(partnerHcp <=9 && !hasMajorFit) seq.push('1NT');
    else if(partnerHcp <=8 && hasMajorFit) seq.push('2'+opening[1]);
    else if(partnerHcp <=11 && hasMajorFit) seq.push('3'+opening[1]);
    else if(partnerHcp >=12 && hasMajorFit) seq.push('4'+opening[1]);
    else seq.push('1NT');
  } else if(opening === '1NT') {
    if(partnerHcp < 8) seq.push('P'); else if(partnerHcp <=9) seq.push('2NT'); else seq.push('3NT');
  } else { // minor opening
    if(partnerHcp <6) seq.push('P'); else seq.push('1NT');
  }

  // Opener rebid / pass
  const openerHcp = HCP[opener];
  const responderCall = seq[1];
  if(/1[SH]/.test(opening) && responderCall === '1NT'){
    if(openerHcp >= 18) seq.push(openerHcp>=19 ? '4'+opening[1] : '3'+opening[1]);
    else seq.push('2'+opening[1]);
  } else {
    seq.push('P');
  }
  return finalizeAuctionLine(seq, opening, opener, partner, HCP, lengths);
}

function buildAlternatives(mainline, deal, HCP, lengths, rng){
  const opening = mainline.seq[0];
  const alts = [];
  if(opening === 'PASS') return alts; // no alternatives for passed out
  if(/1[SH]/.test(opening)){
    alts.push({ label: 'Conservative partscore', seq:[opening,'P','2'+opening[1],'P','P','P','P','P'], prob:0, bullets:[ 'Responder gives simple raise.', 'Keeps game ambitions low.', 'Safe educational baseline.' ] });
    alts.push({ label: 'Jump to game', seq:[opening,'P','4'+opening[1],'P','P','P','P','P'], prob:0, bullets:[ 'Straight to game.', 'Can miss slam exploration.', 'Relies on opener strength.' ] });
  } else if(opening==='1NT') {
    alts.push({ label: 'Invite only', seq:['1NT','P','2NT','P','P','P','P','P'], prob:0, bullets:[ 'Responder invites with 8-9.', 'Decline keeps partscore.', 'Upgrade with good intermediates.' ] });
    alts.push({ label: 'Direct 3NT', seq:['1NT','P','3NT','P','P','P','P','P'], prob:0, bullets:[ 'Goes straight to game.', 'May overreach opposite minimum.', 'Style choice vulnerable to lead.' ] });
  } else if(/^[34][SHDC]$/.test(opening)) {
    alts.push({ label: 'Higher preempt', seq:[opening,'P','P','P','P','P','P','P'], prob:0, bullets:[ 'Stays put; no game try.', 'Forces defender guesses.', 'Low info to opponents.' ] });
  } else { // minor opening
    alts.push({ label: '1NT response', seq:[opening,'P','1NT','P','P','P','P','P'], prob:0, bullets:[ 'Standard balanced response.', 'Keeps auction low.', 'Search for major later.' ] });
    alts.push({ label: 'Pass response', seq:[opening,'P','P','P','P','P','P','P'], prob:0, bullets:[ 'Responder too weak to act.', 'Invites lead-direction issue.', 'Educational example.' ] });
  }
  return alts.slice(0,2);
}

function assignProb(lines){ if(!lines.length) return; const main = lines[0]; main.prob=0.88; const remain=1-main.prob; const altShare = remain/(lines.length-1); for(let i=1;i<lines.length;i++) lines[i].prob = parseFloat(altShare.toFixed(2)); const sum = lines.reduce((s,l)=> s+l.prob,0); const drift = parseFloat((1-sum).toFixed(2)); if(drift!==0 && lines.length>1) lines[lines.length-1].prob = parseFloat((lines[lines.length-1].prob+drift).toFixed(2)); }
function finalAction(seq){ return [...seq].reverse().find(c=> c!=='P')||'P'; }
function estimateLosers(h,lens){ const approx = Math.round((24-h)/3); return Math.min(6, Math.max(2, approx)); }
function buildBullets(opening, opener, partner, HCP, lengths, seq){
  const bullets=[];
  if(opening==='PASS'){
    bullets.push('Passed out deal – no side has opening values.');
    bullets.push(`Highest HCP seat: ${highestSeat(HCP)} (${Math.max(...Object.values(HCP))} HCP).`);
    bullets.push('Use for lead / counting practice.');
    return bullets;
  }
  const major = /1[SH]/.test(opening)? opening[1]: null;
  const partnerSuitLen = major? lengths[partner][major]: null;
  const callsWithSeats = seq.map((c,i)=> ({ call:c, seat: rotationFrom(opener)[i%4] }));
  const responderCallObj = callsWithSeats.find(cs=> cs.seat === partner && cs.call !== 'P');
  const responderAction = responderCallObj ? responderCallObj.call : 'Pass';
  bullets.push(`Opener: ${HCP[opener]} HCP opens ${opening}.`);
  bullets.push(`Responder: ${HCP[partner]} HCP${partnerSuitLen? ` with ${partnerSuitLen} card ${major}`:''} -> ${responderAction}.`);
  if(opening==='1NT') bullets.push('Shows 12-14 balanced, no 5-card major.');
  else if(major) bullets.push(`Major fit ${partnerSuitLen? 'likely/confirmed':'pending'}; watching point range.`);
  else if(/^[34][SHDC]$/.test(opening)) bullets.push('Preempt: length + weak hand to take space.');
  else bullets.push('Minor opening: searching for major fit or NT.');
  const openerLens = lengths[opener];
  const balancedStrong = isBalanced(openerLens) && HCP[opener] >=18 && HCP[opener] <=19;
  if(balancedStrong && opening!=='1NT') bullets.push('Plan: Strong balanced (18-19) – consider NT rebid.');
  else bullets.push(`Plan: about ${estimateLosers(HCP[opener], openerLens)} losers; prioritize entries & danger hand.`);
  if(major && partnerSuitLen) bullets.push(`Combined HCP: ${HCP[opener] + HCP[partner]}`);
  return bullets.slice(0,6);
}
function buildTeacherFocus(mainline, HCP, lengths, deal){
  const opener = deal.dealer; const partner = partnerOf(opener); return [ 'Count losers first', 'Identify danger hand', 'Entry management', `Fit & HCP: ${HCP[opener]} + ${HCP[partner]}` ]; }

// Helper re-added after refactor (was accidentally removed) to normalize sequence termination and build line object
function finalizeAuctionLine(seq, opening, opener, partner, HCP, lengths){
  if(seq[seq.length-1] !== 'P') seq.push('P');
  if(seq.filter(c=> c!=='P').length>0){
    let trailing = 0; for(let i=seq.length-1;i>=0 && seq[i]==='P'; i--) trailing++;
    while(trailing < 3){ seq.push('P'); trailing++; }
  }
  const bullets = buildBullets(opening, opener, partner, HCP, lengths, seq);
  return { label: 'Mainline ACOL', seq, prob: 0, bullets };
}

function highestSeat(HCP){
  return Object.entries(HCP).sort((a,b)=> b[1]-a[1])[0][0];
}

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
  const seatOrder = rotationFrom(opener);
  let callIdx = mainline.seq.findIndex(c=> c===finalCall);
  if(callIdx===-1){ callIdx = mainline.seq.length-1; }
  const declarerSeat = seatOrder[callIdx % 4];
  const parsed = parseContract(finalCall||'');
  const final_contract = parsed ? { ...parsed, by: declarerSeat } : { by: opener, level:1, strain:'NT' };
  return { dealHash: hash, board: deal.number||0, meta: { dealer: opener, vul: deal.vul||'None', system: deal.meta?.system || 'ACOL' }, auctions: lines, recommendation_index: 0, final_contract, teacher_focus: buildTeacherFocus(mainline, HCP, lengths, deal) };
}

function parseContract(call){ const m = call && call.match(/^(\d)([SHDC]|NT)$/); if(!m) return null; return { by: 'N', level: parseInt(m[1],10), strain: m[2] }; }

function rotationFrom(start){ const order = ['N','E','S','W']; const idx = order.indexOf(start); return [0,1,2,3].map(i=> order[(idx+i)%4]); }

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
