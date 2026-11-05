import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(
      `<html><body style="margin:0;background:#13110c"><img width="${size}" height="${size}" src="data:image/svg+xml,${encodeURIComponent(svg)}"></body></html>`,
    )
    await page
      .locator('img')
      .screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname })
  }
} finally {
  await browser.close()
}
