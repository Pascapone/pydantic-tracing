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

        console.log('Checking for Sign Up buttons');
        const count = await page.getByRole('button', { name: /Sign Up/i }).count();
        console.log(`Found ${count} Sign Up buttons`);

        if (count === 0) {
            console.log('No Sign Up buttons found! Dumping body HTML to file...');
            const bodyHtml = await page.evaluate(() => document.body.innerHTML);
            fs.writeFileSync('debug_dump.html', bodyHtml);
            console.log('Dumped to debug_dump.html');
        }

        // Switch to Sign Up mode
        console.log('Switching to Sign Up');
        const nameInput = page.locator('input#name, input[placeholder="Your name"]').first();
        for (let attempt = 1; attempt <= 3; attempt++) {
            const signUpButton = page.getByRole('button', { name: /^Sign Up$/ }).first();
            await expect(signUpButton).toBeVisible();
            await signUpButton.click();
            console.log(`Clicked Sign Up toggle (attempt ${attempt})`);

            if (await nameInput.isVisible()) {
                break;
            }

            const footerSignUpButton = page.getByRole('button', { name: /^Sign up$/ }).first();
            if (await footerSignUpButton.isVisible()) {
                await footerSignUpButton.click();
                console.log(`Clicked footer Sign up fallback (attempt ${attempt})`);
            }

            if (await nameInput.isVisible()) {
                break;
            }

            if (attempt < 3) {
                console.log(`Sign up form still not visible; reloading /login (attempt ${attempt})`);
                await page.goto('/login');
                await expect(page.getByRole('heading', { name: /TANAUTH/i })).toBeVisible();
            }
        }

        // Fill registration form
        console.log('Filling registration form');
        await expect(nameInput).toBeVisible({ timeout: 15000 });
        await nameInput.fill('E2E Test User');
        await page.fill('#email', email);
        await page.fill('#password', password);

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
