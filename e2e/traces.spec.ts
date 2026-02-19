import { test, expect } from '@playwright/test';
import fs from 'fs';

test('trace visualization flow', async ({ page }) => {
    test.setTimeout(120000);

    // Capture browser console logs
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

    try {
        const email = `test-${Date.now()}@example.com`;
        const password = 'password123';

        console.log('Navigating to /login');
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: /TANAUTH/i })).toBeVisible();

        // Switch to Sign Up mode
        console.log('Switching to Sign Up');
        const signUpToggle = page.getByRole('button', { name: /^Sign Up$/ }).first();
        const signUpIntro = page.getByText('Create a new account to get started');
        await expect(signUpToggle).toBeVisible();
        for (let attempt = 1; attempt <= 5; attempt++) {
            await signUpToggle.click();
            try {
                await expect(signUpIntro).toBeVisible({ timeout: 1500 });
                break;
            } catch (error) {
                if (attempt === 5) throw error;
            }
        }

        // Fill registration form
        console.log('Filling registration form');
        const nameInput = page.getByLabel('Name').first();
        const emailInput = page.getByLabel('Email').first();
        const passwordInput = page.getByLabel('Password').first();
        await expect(nameInput).toBeVisible({ timeout: 15000 });
        await nameInput.fill('E2E Test User');
        await emailInput.fill(email);
        await passwordInput.fill(password);

        // Submit
        console.log('Submitting registration');
        // Submit button changes text to "Create Account"
        await page.click('button:has-text("Create Account")');

        // Wait for redirect to dashboard
        console.log('Waiting for dashboard');
        await page.waitForURL('/dashboard');
        console.log('Redirected to dashboard');

        // 2. Navigate to Jobs page
        console.log('Navigating to /jobs');
        await page.goto('/jobs');
        await expect(page.getByRole('heading', { name: /Job Queue/i })).toBeVisible();

        // 3. Create a new Job
        console.log('Creating job');
        const prompt = 'Test prompt for trace visualization';
        await page.getByRole('button', { name: /AI Agent/i }).click();
        await page.getByRole('textbox', { name: /Prompt/i }).fill(prompt);

        console.log('Clicking Start');
        await page.getByRole('button', { name: /Start AI Agent/i }).click();

        // 4. Wait for job
        console.log('Waiting for job to appear');
        await expect(page.getByText(prompt)).toBeVisible();

        // 5. Wait for job to finish
        console.log('Waiting for job completion');
        const jobCard = page.locator('div.rounded-xl.border', { hasText: prompt }).first();
        await expect(jobCard).toBeVisible();
        await expect(jobCard).not.toContainText('Pending', { timeout: 30000 });
        await expect(jobCard).not.toContainText('Running', { timeout: 30000 });

        console.log('Job finished. Navigating to /traces');
        // 6. Navigate to Traces
        await page.goto('/traces');

        // 7. Verify Trace Visualization
        console.log('Verifying traces on /traces page');

        // Wait for content (TracesPage renders TraceTerminal)
        await expect(page.getByText('Recent Traces')).toBeVisible();

        const traceSidebar = page.locator('aside').filter({ hasText: 'Recent Traces' }).first();
        await expect(traceSidebar.getByText('No traces yet')).not.toBeVisible({ timeout: 30000 });

        // Wait for at least one sidebar trace item (inside trace sidebar, not nav menu)
        const traceItem = traceSidebar.locator('button').first();
        await expect(traceItem).toBeVisible({ timeout: 30000 });
        console.log('Found trace item in sidebar');

        await traceItem.click();
        console.log('Clicked trace item');

        // 8. Verify Nested Spans
        console.log('Checking nested spans');
        await expect(page.getByText(/Agent Run|Tool Call|Model Response|Reasoning|Agent Delegation/i).first()).toBeVisible();

        console.log('Success! Trace verified.');
    } catch (error) {
        console.error('Test failed with error:', error);
        // Dump HTML on error too
        if (!page.isClosed()) {
            const bodyHtml = await page.evaluate(() => document.body.innerHTML);
            fs.writeFileSync('debug_dump.html', bodyHtml);
        }
        throw error;
    }
});
