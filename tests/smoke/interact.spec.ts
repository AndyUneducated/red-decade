// A few things a reader does on every visit, on the desktop screen: search, open and close a card, switch theme,
// follow the menu, and land on an address that names nothing. Run against a build, like pages.spec.ts.
import { expect, test, type Page } from '@playwright/test'
import { groupOf, itemOf } from '../../src/nav'
import { page as pageDef } from '../../src/pages'

test.skip(({ isMobile }) => isMobile, 'keyboard and hover paths are desktop paths')

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return errors
}

test('Ctrl K finds a person, Enter opens the card and moves to the URL, Esc closes it', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/timeline')
  await expect(page.locator('main h1').first()).toBeVisible()
  await page.keyboard.press('Control+k')
  const box = page.getByRole('dialog', { name: '搜索' }).locator('input')
  await expect(box).toBeFocused()
  await box.fill('刘少奇')
  await expect(page.locator('.palette li').first()).toContainText('刘少奇')
  await box.press('Enter')
  await expect(page.locator('.palette')).toHaveCount(0)
  await expect(page.locator('.drawer header').first()).toContainText('刘少奇')
  await expect(page).toHaveURL(/sel=person(:|%3A)liu-shaoqi/)
  await page.keyboard.press('Escape')
  await expect(page.locator('.drawer')).toHaveCount(0)
  await expect(page).not.toHaveURL(/sel=/)
  expect(errors).toEqual([])
})

test('a search with no match says so', async ({ page }) => {
  await page.goto('./#/timeline')
  await page.locator('.searchbtn').click()
  await page.getByRole('dialog', { name: '搜索' }).locator('input').fill('完全不存在的词语丙丁')
  await expect(page.locator('.palette')).toContainText('没有匹配结果')
})

test('the close button and the back button both leave the card', async ({ page }) => {
  await page.goto('./#/timeline?sel=person:mao-zedong')
  await expect(page.locator('.drawer header').first()).toContainText('毛泽东')
  await page.locator('.drawer .close').click()
  await expect(page.locator('.drawer')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('.drawer header').first()).toContainText('毛泽东')
})

test('the theme switch flips the page and is remembered', async ({ page }) => {
  await page.goto('./#/timeline')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.locator('.themebtn').click()
  const after = await html.getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after!)
})

test('a detail page for an id that does not exist does not break the page', async ({ page }) => {
  const errors = watchErrors(page)
  for (const hash of ['#/people/no-such-person', '#/orgs/no-such-org', '#/docs/no-such-doc', '#/timeline?sel=event:no-such-event']) {
    await page.goto('./' + hash)
    await expect(page.locator('main h1').first()).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('a person card starts the personal view, which follows to other pages until closed', async ({ page }) => {
  await page.goto('./#/timeline?sel=person:liu-shaoqi')
  await page.locator('.drawer').getByRole('button', { name: '以此人视角看全站' }).click()
  const bar = page.getByRole('region', { name: '个人视角' })
  await expect(bar).toContainText('刘少奇')
  await bar.getByRole('button', { name: pageDef('network').title }).click()
  await expect(page).toHaveURL(/#\/network/)
  await expect(bar).toContainText('刘少奇')
  await bar.getByRole('button', { name: '退出个人视角' }).click()
  await expect(bar).toHaveCount(0)
})

test('the menu opens a page and the window title follows', async ({ page }) => {
  await page.goto('./#/timeline')
  const target = 'figures' as const
  const group = groupOf(target).label
  await page.locator('.navgroup').filter({ hasText: group }).hover()
  await page.getByRole('menu', { name: group }).getByRole('menuitem', { name: itemOf(target).label }).click()
  await expect(page).toHaveURL(new RegExp(`#/${target}`))
  await expect(page.locator('main h1').first()).toContainText(itemOf(target).label)
  await expect(page).toHaveTitle(new RegExp(itemOf(target).label))
})
