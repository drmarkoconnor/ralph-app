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
    // Header
    doc.setFontSize(11)
    doc.setFont('helvetica','bold')
    const titleParts = [ 'Board', dealObj.number ?? '' ]
    doc.text(titleParts.join(' '), leftX, topY + 4)
    doc.setFontSize(8)
    doc.setFont('helvetica','normal')
    const info = `Dealer: ${dealObj.dealer || '?'}   Vul: ${dealObj.vul || 'None'}`
    doc.text(info, leftX + colW * 0.55, topY + 4)

    // Compass layout center of block
    const centerX = leftX + colW * 0.55
    const centerY = topY + 30
    const seatDx = 42
    const seatDy = 27
    const suitLine = 4.3
    const fontRanks = 9
    const seatFont = 9.5
    const mono = 'courier'

    const seatData = {
      N: dealObj.hands?.N || [],
      E: dealObj.hands?.E || [],
      S: dealObj.hands?.S || [],
      W: dealObj.hands?.W || [],
    }

    const seatPos = { N:[centerX, centerY - seatDy], S:[centerX, centerY + seatDy], W:[centerX - seatDx, centerY], E:[centerX + seatDx, centerY] }
    const drawSeat = (seat) => {
      const [x,y] = seatPos[seat]
      doc.setFontSize(seatFont)
      doc.setFont('helvetica','bold')
      doc.text(seat, x, y - 2, { align: 'center' })
      doc.setFontSize(fontRanks)
      doc.setFont(mono,'normal')
      suitOrderDisplay.forEach((suit,i)=>{
        const lineY = y + i * suitLine
        drawSuitIcon(doc, suit, x - 20, lineY - 3.2, 3.2)
        doc.text(rankString(seatData[seat], suit) || '—', x - 14, lineY, { align: 'left' })
      })
      doc.setFont('helvetica','normal')
    }
    ;['N','W','E','S'].forEach(drawSeat)

    // Auction formatting into 4 columns (if full)
    if (mode === 'full' && Array.isArray(dealObj.calls) && dealObj.calls.length) {
      doc.setFontSize(7)
      doc.setFont('helvetica','bold')
      doc.text('Auction', leftX, centerY + seatDy + 10)
      doc.setFont('helvetica','normal')
      const cols = ['N','E','S','W']
      const colWidth = 18
      cols.forEach((c,i)=> doc.text(c, leftX + i*colWidth, centerY + seatDy + 14))
      let row = 0
      dealObj.calls.forEach((call, idx)=>{
        const col = idx % 4
        const r = Math.floor(idx / 4)
        if (r !== row) row = r
        doc.text(String(call), leftX + col*colWidth, centerY + seatDy + 18 + r*4)
      })
    }

    // Notes block
    if ((mode === 'full' || autoNotes) && dealObj.notes && dealObj.notes.length) {
      doc.setFontSize(7)
      doc.setFont('helvetica','bold')
      doc.text('Notes', leftX + colW, topY + 10)
      doc.setFont('helvetica','normal')
      const maxLines = mode === 'full' ? 10 : 4
      const lines = dealObj.notes.slice(0, maxLines).map(n=> (n||'').trim()).filter(Boolean)
      lines.forEach((ln,i)=>{ doc.text(`• ${ln}`.slice(0,90), leftX + colW, topY + 14 + i*4, { maxWidth: pageW - (leftX+colW) - 4 }) })
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
