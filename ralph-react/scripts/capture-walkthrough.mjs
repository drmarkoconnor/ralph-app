import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const baseUrl = process.env.RALPH_CAPTURE_URL || 'http://127.0.0.1:5173'
const outputDir = new URL('../public/walkthrough/', import.meta.url)

mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
	localStorage.setItem('ralphWalkthroughDismissed', '1')
	sessionStorage.clear()
})

async function installFocusStyle() {
	await page.addStyleTag({
		content: `
			[data-walkthrough-focus] {
				outline: 4px solid rgba(14, 165, 233, 0.92) !important;
				outline-offset: 3px !important;
				box-shadow: 0 0 0 8px rgba(14, 165, 233, 0.2) !important;
			}
		`,
	})
}

async function clearFocus() {
	await page.locator('[data-walkthrough-focus]').evaluateAll((nodes) => {
		for (const node of nodes) node.removeAttribute('data-walkthrough-focus')
	})
}

async function focus(locator) {
	await clearFocus()
	await locator.first().evaluate((node) => {
		node.setAttribute('data-walkthrough-focus', '1')
		node.scrollIntoView({ block: 'center', inline: 'nearest' })
	})
	await page.waitForTimeout(250)
}

async function snap(filename) {
	await page.screenshot({ path: new URL(filename, outputDir).pathname, fullPage: false })
}

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await installFocusStyle()
await focus(page.getByRole('link', { name: 'PBN Generator' }))
await snap('01-home.png')

await page.goto(`${baseUrl}/generator-v2`, { waitUntil: 'networkidle' })
await installFocusStyle()
await focus(page.getByRole('heading', { name: 'Teaching Brief' }))
await snap('02-generator-entry.png')

await page.getByLabel('Topic').selectOption('stayman')
await focus(page.getByLabel('Topic'))
await snap('03-teaching-topic.png')

await page.getByRole('spinbutton', { name: 'Boards' }).fill('6')
await page.getByRole('spinbutton', { name: 'Start' }).fill('1')
await focus(page.getByRole('spinbutton', { name: 'Boards' }))
await snap('04-board-settings.png')

await page.getByRole('button', { name: 'Suggest' }).click()
await focus(page.getByRole('button', { name: 'Suggest' }))
await snap('05-auction-options.png')

await focus(page.getByRole('button', { name: 'Generate Set' }))
await page.getByRole('button', { name: 'Generate Set' }).click()
await page.waitForSelector('article')
await focus(page.getByRole('heading', { name: 'Generated Boards' }))
await snap('06-generate-set.png')

await page.locator('article').first().scrollIntoViewIfNeeded()
await focus(page.getByRole('heading', { name: /^Board 1$/ }))
await snap('07-board-review.png')

const useButton = page.getByRole('button', { name: 'Use' }).first()
if (await useButton.count()) await useButton.click()
await focus(page.getByText('Suggested Auction').first())
await snap('08-suggested-auction.png')

const teacherNotes = page.locator('article textarea').nth(1)
await teacherNotes.fill('Discuss the 1NT response structure, the agreed convention, and the planning point before the opening lead.')
await focus(teacherNotes)
await snap('09-teacher-notes.png')

await focus(page.getByRole('button', { name: 'Export PBN' }))
await snap('10-export-options.png')

await focus(page.getByRole('button', { name: 'Play Kept' }))
await snap('11-open-player.png')

await page.getByRole('button', { name: 'Play Kept' }).click()
await page.waitForURL('**/player')
await page.waitForSelector('text=Bridge Hand Player')
await installFocusStyle()
await focus(page.getByRole('button', { name: 'Fullscreen' }))
await snap('12-player-display.png')

await browser.close()
