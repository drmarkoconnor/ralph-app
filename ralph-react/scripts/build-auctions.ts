#!/usr/bin/env node
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { parsePbn } from './pbn-parse.js';
import { buildAdvice } from './acol-advisor.js';
import { join } from 'path';

const PBN_DIR = './pbn';
const OUT_DIR = './out/advice';

function main(){
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch {}
  const files = readdirSync(PBN_DIR).filter(f=> f.toLowerCase().endsWith('.pbn'));
  if(!files.length){
    console.error('No PBN files found in /pbn');
    process.exit(1);
  }
  for(const f of files){
    const txt = readFileSync(join(PBN_DIR,f), 'utf8');
    const boards = parsePbn(txt);
    for(const b of boards){
      const advice = buildAdvice(b);
      const outPath = join(OUT_DIR, `${advice.dealHash || 'board-'+advice.board}.json`);
      writeFileSync(outPath, JSON.stringify(advice, null, 2),'utf8');
      console.log('Wrote', outPath);
    }
  }
}

main();
