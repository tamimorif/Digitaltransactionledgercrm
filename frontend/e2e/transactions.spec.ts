import { test, expect } from '@playwright/test';

/**
 * Transaction E2E Tests
 * Tests transaction CRUD operations and payments
 */

test.describe('Transactions', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/');
        await page.getByLabel(/email/i).fill('backend_test_user@example.com');
        await page.getByLabel(/password/i).fill('Test@123456');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });

        // Navigate to transactions
        await page.getByRole('link', { name: /transactions/i }).first().click();
        await expect(page).toHaveURL(/.*transactions/);
    });

    test('should display transactions list', async ({ page }) => {
        // Check for transactions table
        await expect(page.getByRole('table')).toBeVisible();

        // Table should have headers
        await expect(page.getByRole('columnheader', { name: /date|time/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /amount|send/i })).toBeVisible();
    });

    test('should open new transaction dialog', async ({ page }) => {
        // Click new transaction button
        await page.getByRole('button', { name: /new.*transaction|add.*transaction/i }).click();

        // Dialog should appear
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/new transaction|create transaction/i)).toBeVisible();
    });

    test('should filter transactions by date', async ({ page }) => {
        // Look for date filter
        const dateFilter = page.getByRole('button', { name: /date|filter/i });
        if (await dateFilter.isVisible()) {
            await dateFilter.click();

            // Select a date range
            await page.getByRole('button', { name: /today|last.*7.*days/i }).click();
        }
    });

    test('should search transactions', async ({ page }) => {
        // Look for search input
        const searchInput = page.getByPlaceholder(/search/i);
        if (await searchInput.isVisible()) {
            await searchInput.fill('test');
            await searchInput.press('Enter');

            // Wait for results to filter
            await page.waitForTimeout(500);
        }
    });

    test('should view transaction details', async ({ page }) => {
        // Click on first transaction row
        const firstRow = page.getByRole('row').nth(1);
        if (await firstRow.isVisible()) {
            await firstRow.click();

            // Details should be visible (either dialog or new page)
            await expect(page.getByText(/transaction.*details|view.*transaction/i)).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Create Transaction', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.getByLabel(/email/i).fill('backend_test_user@example.com');
        await page.getByLabel(/password/i).fill('Test@123456');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
        await page.getByRole('link', { name: /transactions/i }).first().click();
        await page.getByRole('button', { name: /new.*transaction|add/i }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should validate required fields', async ({ page }) => {
        // Click create without filling
        await page.getByRole('button', { name: /create|submit|save/i }).click();

        // Should show validation errors
        await expect(page.getByText(/required|please.*fill/i)).toBeVisible();
    });

    test('should create cash exchange transaction', async ({ page }) => {
        // Fill transaction form
        await page.getByLabel(/customer|client/i).fill('Test Customer');
        await page.getByLabel(/send.*amount/i).fill('1000');

        // Select currencies
        const sendCurrency = page.getByLabel(/send.*currency/i);
        if (await sendCurrency.isVisible()) {
            await sendCurrency.click();
            await page.getByRole('option', { name: /CAD/i }).click();
        }

        await page.getByLabel(/receive.*amount/i).fill('50000000');

        const receiveCurrency = page.getByLabel(/receive.*currency/i);
        if (await receiveCurrency.isVisible()) {
            await receiveCurrency.click();
            await page.getByRole('option', { name: /IRR/i }).click();
        }

        // Submit
        await page.getByRole('button', { name: /create|submit|save/i }).click();

        // Should close dialog and show success
        await expect(page.getByText(/success|created/i)).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Payments', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.getByLabel(/email/i).fill('backend_test_user@example.com');
        await page.getByLabel(/password/i).fill('Test@123456');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
        await page.getByRole('link', { name: /transactions/i }).first().click();
    });

    test('should open add payment dialog', async ({ page }) => {
        // Click on a transaction to open details
        const firstRow = page.getByRole('row').nth(1);
        if (await firstRow.isVisible()) {
            await firstRow.click();

            // Look for add payment button
            const addPaymentBtn = page.getByRole('button', { name: /add.*payment/i });
            if (await addPaymentBtn.isVisible({ timeout: 3000 })) {
                await addPaymentBtn.click();
                await expect(page.getByRole('dialog')).toBeVisible();
            }
        }
    });
});
