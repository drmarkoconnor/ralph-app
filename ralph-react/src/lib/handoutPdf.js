// PDF handout generation extracted from Player.jsx & DragDropCards
// Exports a single async function generateHandoutPDF(deals, options)
// options: { mode: 'basic'|'full', filenameBase, autoNotes }
// Always renders 2 boards per page per latest spec.

export async function generateHandoutPDF(deals, options = {}) {
  const {
    mode = 'basic',
    filenameBase = 'handout',
    autoNotes = false,
  } = options
  if (!Array.isArray(deals) || !deals.length) throw new Error('No deals provided')
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const marginX = 12
  const blocksPerPage = 2 // fixed as requested
  const usableH = pageH - marginX * 2
  const blockH = usableH / blocksPerPage - 4
  let boardOnPage = 0
  const suitOrderDisplay = ['Spades', 'Hearts', 'Diamonds', 'Clubs']
  const rankOrder = { A:14,K:13,Q:12,J:11,T:10,'10':10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2 }
  const sortDisplay = (arr) => [...arr].sort((a,b)=> rankOrder[b.rank]-rankOrder[a.rank])
  const rankString = (cards, suit) => {
    const arr = sortDisplay(cards.filter(c=>c.suit===suit))
    if(!arr.length) return '—'
    return arr.map(c=> c.rank==='10' ? 'T' : c.rank).join('')
  }
  const drawSuitIcon = (docRef,suit,x,y,size=3.6)=>{
    const half=size/2
    if (suit==='Hearts'||suit==='Diamonds') docRef.setFillColor(190,0,0); else docRef.setFillColor(0,0,0)
    if (suit==='Diamonds') { docRef.triangle(x+half,y,x+size,y+half,x+half,y+size,'F'); docRef.triangle(x+half,y,x,y+half,x+half,y+size,'F'); return }
    if (suit==='Clubs'){ const r=half*0.55; docRef.circle(x+half,y+r,r,'F'); docRef.circle(x+r,y+half+r*0.1,r,'F'); docRef.circle(x+size-r,y+half+r*0.1,r,'F'); docRef.rect(x+half-r*0.35,y+half,r*0.7,half+r*0.6,'F'); return }
    if (suit==='Hearts'){ const r=half*0.6; docRef.circle(x+half-r*0.55,y+r,r,'F'); docRef.circle(x+half+r*0.55,y+r,r,'F'); docRef.triangle(x+half,y+size,x+size,y+r+r*0.2,x,y+r+r*0.2,'F'); return }
    if (suit==='Spades'){ const r=half*0.6; docRef.circle(x+half-r*0.55,y+half,r,'F'); docRef.circle(x+half+r*0.55,y+half,r,'F'); docRef.triangle(x+half,y,x+size,y+half+r*0.2,x,y+half+r*0.2,'F'); docRef.rect(x+half-r*0.35,y+half+r*0.4,r*0.7,half+r*0.6,'F') }
  }
  const drawBlock = (dealObj) => {
    const topY = marginX + boardOnPage * (blockH + 6)
    const leftX = marginX
    const colW = (pageW - marginX * 2) / 2
    // Title line
    doc.setFontSize(11)
    const title = `Board ${dealObj.number ?? ''}`.trim()
    doc.text(title, leftX, topY + 4)
    // Dealer/Vul info
    doc.setFontSize(8)
    const info = `Dealer: ${dealObj.dealer || '?'}   Vul: ${dealObj.vul || 'None'}`
    doc.text(info, leftX + colW * 0.55, topY + 4)

    // Hands grid (N at top, E right, S bottom, W left typical diagram). We'll keep simple columns.
    const north = dealObj.hands?.N || []
    const south = dealObj.hands?.S || []
    const east = dealObj.hands?.E || []
    const west = dealObj.hands?.W || []
    doc.setFontSize(9)
    const suitYInc = 4.2
    const northX = leftX + 2
    const northY = topY + 10
    suitOrderDisplay.forEach((suit, i)=>{
      drawSuitIcon(doc, suit, northX, northY + i*suitYInc - 3.2, 3.2)
      doc.text(rankString(north, suit), northX + 6, northY + i*suitYInc)
    })
    const southY = northY + suitYInc * suitOrderDisplay.length + 2
    suitOrderDisplay.forEach((suit,i)=>{
      drawSuitIcon(doc, suit, northX, southY + i*suitYInc - 3.2, 3.2)
      doc.text(rankString(south, suit), northX + 6, southY + i*suitYInc)
    })
    // East / West columns
    const westX = leftX + colW * 0.55
    const westY = northY
    suitOrderDisplay.forEach((suit,i)=>{
      drawSuitIcon(doc, suit, westX, westY + i*suitYInc - 3.2, 3.2)
      doc.text(rankString(west,suit), westX + 6, westY + i*suitYInc)
    })
    const eastY = westY + suitYInc * suitOrderDisplay.length + 2
    suitOrderDisplay.forEach((suit,i)=>{
      drawSuitIcon(doc, suit, westX, eastY + i*suitYInc - 3.2, 3.2)
      doc.text(rankString(east,suit), westX + 6, eastY + i*suitYInc)
    })

    // Auction (if provided)
    if (mode === 'full' && Array.isArray(dealObj.calls)) {
      doc.setFontSize(7)
      const calls = dealObj.calls.join(' ') || ''
      doc.text(`Auction: ${calls}`, leftX + 2, topY + blockH - 18, { maxWidth: pageW - marginX*2 - 4 })
    }

    // Notes
    if ((mode === 'full' || autoNotes) && dealObj.notes) {
      doc.setFontSize(7)
      const notes = (dealObj.notes || '').trim().slice(0, 500)
      doc.text(notes, leftX + 2, topY + blockH - 10, { maxWidth: pageW - marginX*2 - 4 })
    }
  }

  deals.forEach((d,i)=>{
    if (i>0 && i % 2 === 0) { doc.addPage(); boardOnPage = 0 }
    drawBlock(d)
    boardOnPage++
  })

  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'')
  const outName = `${filenameBase || 'handout'}-${dateStr}${mode==='full' ? '-full' : ''}.pdf`
  doc.save(outName)
  return outName
}
