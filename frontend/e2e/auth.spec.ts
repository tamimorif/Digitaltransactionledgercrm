import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests login, logout, and authentication flows
 */

test.describe('Authentication', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display login page', async ({ page }) => {
        // Check that login form is visible
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
        // Click sign in without filling form
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should show validation errors
        await expect(page.getByText(/email is required/i)).toBeVisible();
        await expect(page.getByText(/password is required/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        // Fill with invalid credentials
        await page.getByLabel(/email/i).fill('invalid@example.com');
        await page.getByLabel(/password/i).fill('wrongpassword');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should show error message
        await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 5000 });
    });

    test('should login successfully with valid credentials', async ({ page }) => {
        // Fill with valid credentials (adjust based on test account)
        await page.getByLabel(/email/i).fill('test@example.com');
        await page.getByLabel(/password/i).fill('testpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should redirect to dashboard
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

        // Dashboard elements should be visible
        await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    test('should logout successfully', async ({ page }) => {
        // First login
        await page.getByLabel(/email/i).fill('test@example.com');
        await page.getByLabel(/password/i).fill('testpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for dashboard
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });

        // Click logout (may be in dropdown menu)
        await page.getByRole('button', { name: /account|profile|user/i }).click();
        await page.getByRole('menuitem', { name: /logout|sign out/i }).click();

        // Should redirect to login
        await expect(page).toHaveURL(/.*login|\/$/);
    });
});

test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto('/dashboard');

        // Should redirect to login
        await expect(page).toHaveURL(/.*login|\//);
    });

    test('should redirect unauthenticated users from transactions', async ({ page }) => {
        await page.goto('/transactions');

        // Should redirect to login
        await expect(page).toHaveURL(/.*login|\//);
    });
});
