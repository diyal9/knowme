import { expect, test, type Page } from '@playwright/test'

async function openWorkspace(page: Page) {
  await page.goto('http://127.0.0.1:4173/workspace/')
  await page.locator('#km-fab-root').evaluate((el) => { (el as HTMLElement).style.display = 'none' }).catch(() => {})
}

test('workspace rail switches workbench and assistant', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByRole('button', { name: '伙伴' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '工作台' }).click({ force: true })
  await expect(page.getByRole('button', { name: '工作台' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('tab', { name: '专家协作' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('taskhome-surface')).toBeVisible()
})

test('assistant session tabs can be created', async ({ page }) => {
  await openWorkspace(page)
  const sessions = page.getByRole('tablist', { name: '智能伙伴主题' })
  await expect(sessions).toBeVisible()
  await page.locator('#agentInput').fill('保留当前草稿')
  await page.getByRole('button', { name: '新主题' }).click()
  await expect(sessions.getByRole('tab')).toHaveCount(2)
  await expect(page.locator('#agentInput')).toHaveText('')
  await sessions.getByRole('tab').first().click()
  await expect(page.locator('#agentInput')).toHaveText('保留当前草稿')
})

test('assistant send smoke', async ({ page }) => {
  await openWorkspace(page)
  await page.locator('#agentInput').fill('帮我列一下今天的待办')
  await expect(page.locator('#agentInput')).toHaveText('帮我列一下今天的待办')
  await page.getByRole('button', { name: '发送' }).click({ force: true })
})

test('assistant empty composer is reachable', async ({ page }) => {
  await openWorkspace(page)
  await expect(page.getByTestId('assistant-empty-home')).toBeVisible()
  await expect(page.getByTestId('assistant-empty-composer')).toBeVisible()
  await expect(page.locator('#agentInput')).toBeVisible()
})

test('workbench shelf grid and task home', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: '工作台' }).click({ force: true })
  await expect(page.getByTestId('taskhome-surface')).toBeVisible()
  await expect(page.getByRole('heading', { name: '专家任务' })).toBeVisible()
  await page.getByRole('tab', { name: '工作流' }).click({ force: true })
  await expect(page.getByTestId('shelf-surface')).toBeVisible()
})

test('settings embeds in workspace chrome', async ({ page }) => {
  await openWorkspace(page)
  await page.locator('#btnSettings').click({ force: true })
  await expect(page.getByTestId('settings-surface')).toBeVisible()
})

test('settings actions surface feedback outside save-footer tabs', async ({ page }) => {
  await openWorkspace(page)
  await page.locator('#btnSettings').click({ force: true })
  await page.getByRole('tab', { name: '记忆与隐私' }).click()
  await page.getByRole('button', { name: '清除全部记忆' }).click()
  await expect(page.locator('.settings-floating-toast')).toContainText('清除失败')
})

test('studio enter and leave from workflow manage', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: '工作台' }).click({ force: true })
  await page.getByRole('tab', { name: '工作流' }).click({ force: true })
  await page.locator('#wbShelfManage').click({ force: true })
  await expect(page.getByTestId('manage-workflows')).toBeVisible()
  await page.getByTestId('studio-create-workflow').click({ force: true })
  await expect(page.locator('#appShell')).toHaveClass(/wb-studio-active/)
  await expect(page.getByTestId('studio-leave')).toBeVisible()
  await page.getByTestId('studio-leave').click({ force: true })
  const confirm = page.getByTestId('confirm-modal')
  if (await confirm.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '离开' }).click({ force: true })
  }
  await expect(page.locator('#appShell')).not.toHaveClass(/wb-studio-active/)
})

test('pipeline compose submit is reachable', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: '工作台' }).click({ force: true })
  await page.getByRole('tab', { name: '管线服务' }).click({ force: true })
  await expect(page.getByTestId('manage-surface')).toBeVisible()
  await expect(page.getByTestId('daemon-compose-submit')).toBeAttached()
})

test('empty expert shelf routes to expert management', async ({ page }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: '工作台' }).click({ force: true })
  await page.getByRole('button', { name: '管理常用专家' }).click()
  await expect(page.getByTestId('capability-hub-surface')).toBeVisible()
})
