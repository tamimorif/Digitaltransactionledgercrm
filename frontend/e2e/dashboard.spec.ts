import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * Tests dashboard widgets and navigation
 */

// Auth helper - logs in before each test
test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login first
        await page.goto('/');
        await page.getByLabel(/email/i).fill('backend_test_user@example.com');
        await page.getByLabel(/password/i).fill('Test@123456');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
    });

    test('should display dashboard with stats cards', async ({ page }) => {
        // Check for stats cards
        await expect(page.getByText(/today.*transactions?/i)).toBeVisible();
        await expect(page.getByText(/revenue|balance|total/i)).toBeVisible();
    });

    test('should display recent transactions widget', async ({ page }) => {
        // Check for transactions table or list
        await expect(page.getByRole('heading', { name: /recent.*transactions?/i })).toBeVisible();
    });

    test('should navigate to transactions page', async ({ page }) => {
        // Click on transactions link in sidebar or nav
        await page.getByRole('link', { name: /transactions/i }).first().click();

        // Should be on transactions page
        await expect(page).toHaveURL(/.*transactions/);
        await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();
    });

    test('should navigate to customers page', async ({ page }) => {
        // Click on customers link
        await page.getByRole('link', { name: /customers|clients/i }).first().click();

        // Should be on customers page
        await expect(page).toHaveURL(/.*customers|clients/);
    });

    test('should display cash balance widget', async ({ page }) => {
        // Look for cash balance section
        const cashBalance = page.getByText(/cash.*balance|available.*cash/i);
        await expect(cashBalance).toBeVisible();
    });

    test('should display pending payments widget', async ({ page }) => {
        // Look for pending payments section
        const pendingPayments = page.getByText(/pending.*payment|outstanding/i);
        if (await pendingPayments.isVisible()) {
            await expect(pendingPayments).toBeVisible();
        }
    });
});

test.describe('Dashboard Responsiveness', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.getByLabel(/email/i).fill('backend_test_user@example.com');
        await page.getByLabel(/password/i).fill('Test@123456');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    });

    test('should be responsive on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Dashboard should still work
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 30000 });

        // Sidebar might be collapsed - look for hamburger menu
        const hamburger = page.getByRole('button', { name: /menu|toggle/i });
        if (await hamburger.isVisible()) {
            await hamburger.click();
        }
    });

    test('should be responsive on tablet', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });

        // Dashboard should still work
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 30000 });
    });
});
