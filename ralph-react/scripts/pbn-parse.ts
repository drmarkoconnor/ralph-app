// Minimal PBN parser focusing on tags needed for auction advice.
// Deterministic, no external deps. Assumes UTF-8 input.

export interface PbnBoardRaw {
  board?: string;
  dealer?: 'N'|'E'|'S'|'W';
  vul?: string;
  deal?: string; // e.g. N:AKQJ7.AQ2.K.5432 6.KJ763.8652.K96 ...
  auction?: string[];
  auctionDealer?: 'N'|'E'|'S'|'W';
  system?: string;
  interf?: string;
  ddpar?: string;
  scoring?: string;
  dealHash?: string;
}

export interface ParsedBoard {
  board: number;
  dealer: 'N'|'E'|'S'|'W';
  vul: 'None'|'NS'|'EW'|'Both';
  hands: Record<'N'|'E'|'S'|'W', string[]>; // array of card strings like 'SA', 'D5'
  system: string;
  interf: string;
  auction: string[];
  auctionDealer: 'N'|'E'|'S'|'W';
  dealHash: string; // fallback board number if absent
  ddpar?: string;
  scoring?: string;
}

const suitOrder: Record<string,string> = { 'S':'Spades','H':'Hearts','D':'Diamonds','C':'Clubs' }

export function parsePbn(text: string): ParsedBoard[] {
  const lines = text.split(/\r?\n/);
  const boards: PbnBoardRaw[] = [];
  let cur: PbnBoardRaw | null = null;
  const tagLine = /^\[(\w+)\s+"(.*)"\]\s*$/;
  const push = () => { if(cur) boards.push(cur); cur=null; };
  for(const raw of lines){
    const line = raw.trim();
    if(!line) continue;
    const m = line.match(tagLine);
    if(m){
      const tag = m[1]; const val = m[2];
      if(tag === 'Board'){ if(cur) push(); cur = { board: val, auction: [] }; }
      else if(!cur) cur = { board: val, auction: [] };
      if(!cur) continue;
      switch(tag){
        case 'Dealer': cur.dealer = val as any; break;
        case 'Vulnerable': cur.vul = val; break;
        case 'Deal': cur.deal = val; break;
        case 'Auction': cur.auctionDealer = val as any; cur.auction = []; break;
        case 'Contract': break; // ignore here
        case 'Declarer': break; // ignore
        case 'System': cur.system = val; break;
        case 'Interf': cur.interf = val; break;
        case 'DDPar': cur.ddpar = val; break;
        case 'Scoring': cur.scoring = val; break;
        case 'DealHash': cur.dealHash = val; break;
        default: break;
      }
      continue;
    }
    // Non-tag content: auction continuation lines if we are in auction mode (no explicit mode flag; detect by cur.auctionDealer presence and tokens not containing ':')
    if(cur && cur.auctionDealer && /^[^:]+$/.test(line)){
      cur.auction!.push(...line.split(/\s+/).filter(Boolean));
    }
  }
  push();
  return boards.filter(b=> b.deal).map(toParsedBoard).filter(Boolean) as ParsedBoard[];
}

function toParsedBoard(raw: PbnBoardRaw): ParsedBoard | null {
  if(!raw.deal) return null;
  const dealer = (raw.dealer||'N') as 'N'|'E'|'S'|'W';
  const vul = normalizeVul(raw.vul||'None');
  const system = raw.system || 'ACOL';
  const interf = raw.interf || 'No Interference';
  const auctionDealer = (raw.auctionDealer||dealer) as 'N'|'E'|'S'|'W';
  const boardNum = parseInt(raw.board||'0',10) || 0;
  const dealHash = raw.dealHash || `board-${boardNum}`;
  const hands = parseDeal(raw.deal);
  return { board: boardNum, dealer, vul, hands, system, interf, auction: raw.auction||[], auctionDealer, dealHash, ddpar: raw.ddpar, scoring: raw.scoring };
}

function normalizeVul(v: string): ParsedBoard['vul'] {
  switch(v){
    case 'None': return 'None';
    case 'NS': case 'N-S': return 'NS';
    case 'EW': case 'E-W': return 'EW';
    case 'All': case 'Both': return 'Both';
    default: return 'None';
  }
}

// Deal format: Dealer:Hand Hand Hand Hand OR sometimes just Dealer:... tokens
function parseDeal(deal: string): Record<'N'|'E'|'S'|'W', string[]> {
  // Example: N:AKQJ7.AQ2.K.5432 6.KJ763.8652.K96 T8543.85.J9.AQT8 92.T94.AQT743.J7
  const parts = deal.trim().split(/\s+/);
  const first = parts[0];
  const colonIdx = first.indexOf(':');
  let dealer = 'N';
  let handTokens: string[] = [];
  if(colonIdx !== -1){
    dealer = first.substring(0, colonIdx);
    handTokens = [ first.substring(colonIdx+1), ...parts.slice(1) ];
  } else {
    handTokens = parts;
  }
  // We expect 4 hand tokens separated by spaces
  if(handTokens.length !== 4) throw new Error('Unsupported deal token count');
  // Order from dealer clockwise
  const order: ('N'|'E'|'S'|'W')[] = dealerOrderFrom(dealer as any);
  const hands: Record<'N'|'E'|'S'|'W', string[]> = { N:[],E:[],S:[],W:[] };
  handTokens.forEach((tok,i)=>{ hands[order[i]] = expandHand(tok); });
  return hands;
}

function dealerOrderFrom(start: 'N'|'E'|'S'|'W'): ('N'|'E'|'S'|'W')[] {
  const seats: ('N'|'E'|'S'|'W')[] = ['N','E','S','W'];
  const idx = seats.indexOf(start); return [0,1,2,3].map(k=> seats[(idx+k)%4]);
}

function expandHand(pattern: string): string[] {
  // Pattern like AKQJ7.AQ2.K.5432 — suits in order S H D C
  const [sp,he,di,cl] = pattern.split('.');
  const make = (suitChar: string, cards: string) => cards.split('').map(r=> suitChar + r);
  return [...make('S', sp||''), ...make('H', he||''), ...make('D', di||''), ...make('C', cl||'')];
}

export function hcp(cards: string[]): number {
  const map: Record<string,number> = { A:4,K:3,Q:2,J:1 };
  return cards.reduce((t,c)=> t + (map[c[1]]||0),0);
}

export function suitLengths(cards: string[]): Record<'S'|'H'|'D'|'C', number> {
  return { S:countSuit(cards,'S'), H:countSuit(cards,'H'), D:countSuit(cards,'D'), C:countSuit(cards,'C') };
}
function countSuit(cards: string[], s: string){ return cards.filter(c=> c[0]===s).length; }

export function isBalanced(lengths: Record<'S'|'H'|'D'|'C',number>): boolean {
  const arr = Object.values(lengths).sort((a,b)=> a-b); // ascending
  const shape = arr.join('-');
  return ['3-3-3-4','2-3-4-4','2-3-3-5'].includes(shape) || ['4333','4432','5332'].includes(lengths.S+''+lengths.H+''+lengths.D+''+lengths.C);
}

export function hasFiveCardMajor(lengths: Record<'S'|'H'|'D'|'C',number>): 'S'|'H'|null {
  if(lengths.S>=5 && lengths.S>=lengths.H) return 'S';
  if(lengths.H>=5) return 'H';
  return null;
}
