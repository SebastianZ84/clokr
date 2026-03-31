import { test, expect } from "@playwright/test";
import { loginAsAdmin, screenshotPage } from "./helpers";

test.describe("Admin Settings — Complete Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("navigate all admin tabs", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    const tabs = [
      "Mitarbeiter",
      "Urlaub",
      "Sonderurlaub",
      "Betriebsurlaub",
      "Monatsabschluss",
      "System",
    ];
    for (const tab of tabs) {
      const link = page
        .getByRole("link", { name: tab })
        .or(page.locator(".admin-tab").filter({ hasText: tab }))
        .first();
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(300);
    }
    await screenshotPage(page, "flow-admin-tabs");
  });

  test("admin vacation — open/close accordion sections", async ({ page }) => {
    await page.goto("/admin/vacation");
    await page.waitForLoadState("networkidle");

    // Find accordion headers
    const headers = page.locator(".section-group-header, details > summary");
    const count = await headers.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      await headers.nth(i).click();
      await page.waitForTimeout(200);
    }
    await screenshotPage(page, "flow-admin-vacation-accordions");
  });

  test("admin system — security section visible", async ({ page }) => {
    await page.goto("/admin/system");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Sicherheit").first()).toBeVisible();
    await expect(page.getByText("Session-Management").first()).toBeVisible();
    await expect(page.getByText("Passwort-Richtlinie").first()).toBeVisible();

    await screenshotPage(page, "flow-admin-system-security");
  });

  test("admin system — toggle 2FA", async ({ page }) => {
    await page.goto("/admin/system");
    await page.waitForLoadState("networkidle");

    // Find 2FA checkbox
    const twoFaSwitch = page.locator(".switch input[type='checkbox']").first();
    await expect(twoFaSwitch).toBeVisible();
    await twoFaSwitch.click();
    await page.waitForTimeout(500);

    // Toggle back
    await twoFaSwitch.click();
    await page.waitForTimeout(500);
  });

  test("admin system — API keys section", async ({ page }) => {
    await page.goto("/admin/system");
    await page.waitForLoadState("networkidle");

    // Scroll to API keys
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const apiSection = page.getByText("API Keys").first();
    await expect(apiSection).toBeVisible();
    await screenshotPage(page, "flow-admin-api-keys");
  });

  test("admin special-leave — view rules table", async ({ page }) => {
    await page.goto("/admin/special-leave");
    await page.waitForLoadState("networkidle");

    // Should have statutory rules
    await expect(page.getByText("Eigene Hochzeit").first()).toBeVisible();
    await expect(page.getByText("Gesetzlich").first()).toBeVisible();

    await screenshotPage(page, "flow-admin-special-leave");
  });

  test("admin special-leave — open create modal", async ({ page }) => {
    await page.goto("/admin/special-leave");
    await page.waitForLoadState("networkidle");

    await page.getByText("Neue Regel").click();
    await page.waitForTimeout(300);

    const modal = page.locator(".modal, [role='dialog']").first();
    await expect(modal).toBeVisible();
    await expect(modal.getByText("Anlass")).toBeVisible();

    await screenshotPage(page, "flow-admin-special-leave-create");

    // Close modal
    await page.locator(".modal-close, .modal-backdrop").first().click();
  });

  test("admin employees — view employee list", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    // Should see employee table
    await expect(page.locator("table, .data-table").first()).toBeVisible();
    await screenshotPage(page, "flow-admin-employees-list");
  });

  // E2E-04: Create new employee via UI form and assert appears in table
  test("admin employees — create new employee", async ({ page }) => {
    await page.goto("/admin/employees");
    await page.waitForLoadState("networkidle");

    // Click create button
    await page.getByText(/Mitarbeiter anlegen/i).first().click();
    await page.waitForTimeout(300);

    // Assert modal opens
    const modal = page.locator(".modal").first();
    await expect(modal).toBeVisible();

    // Fill in unique test data using form IDs from the page source
    const uniqueSuffix = Date.now();
    await modal.locator("#c-firstname").fill("E2E");
    await modal.locator("#c-lastname").fill("Testmitarbeiter");
    await modal.locator("#c-email").fill(`e2e-${uniqueSuffix}@test.de`);
    await modal.locator("#c-empno").fill(`E2E-${uniqueSuffix}`);
    // Hire date defaults to today - no need to change it

    // Enable direct password to avoid invitation email dependency
    const usePasswordCheckbox = modal.locator("input[type='checkbox']").first();
    await expect(usePasswordCheckbox).toBeVisible();
    await usePasswordCheckbox.check();
    await page.waitForTimeout(200);
    const passwordInput = modal.locator("#c-password");
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill("Test1234!Pass");

    await modal.getByRole("button", { name: /anlegen|erstellen|Mitarbeiter anlegen/i }).first().click();
    await page.waitForLoadState("networkidle");

    // Assert employee appears in table
    await expect(page.getByText("E2E Testmitarbeiter").first()).toBeVisible({ timeout: 5_000 });

    await screenshotPage(page, "flow-admin-employee-created");
  });

  // E2E-05: Monatsabschluss - seed time entry for a past month, click close, assert locked
  test("admin monatsabschluss — seed closeable month, click close, and assert locked", async ({
    page,
  }) => {
    // Step 1: Get employee list - find max@clokr.de or use first employee
    const empRes = await page.request.get("/api/v1/employees");
    expect(empRes.ok()).toBeTruthy();
    const employees = await empRes.json();
    const targetEmployee =
      employees.find((e: { user?: { email?: string } }) => e.user?.email === "max@clokr.de") ||
      employees[0];
    expect(targetEmployee).toBeTruthy();

    // Step 2: Find the first open/actionable month in 2025 or 2026
    // Try 2025 first (likely to have open months since test data starts then)
    const currentYear = new Date().getFullYear();
    let targetYear = currentYear - 1; // Try prior year first
    let targetMonth: number | null = null;
    let targetMonthDate: string | null = null;

    for (const year of [targetYear, currentYear]) {
      const yearRes = await page.request.get(`/api/v1/overtime/close-month/year-status?year=${year}`);
      if (!yearRes.ok()) continue;
      const yearData = await yearRes.json();
      const months: Array<{ month: number; status: string }> = yearData.months ?? [];
      // Find first open/partial/ready month (not future, not closed)
      const openMonth = months.find(
        (m) => m.status === "open" || m.status === "partial" || m.status === "ready",
      );
      if (openMonth) {
        targetYear = year;
        targetMonth = openMonth.month;
        // Pick the 15th of that month as the time entry date
        const paddedMonth = String(openMonth.month).padStart(2, "0");
        targetMonthDate = `${year}-${paddedMonth}-15`;
        break;
      }
    }

    // If no open month found in prior year or current year, use Jan of prior year and seed it
    if (targetMonth === null) {
      targetYear = currentYear - 1;
      targetMonth = 1;
      targetMonthDate = `${targetYear}-01-15`;
    }

    // Step 3: Seed a time entry for the target month to make it closeable
    // A 409 means the entry already exists for that day, which is fine - employee already has data
    const seedRes = await page.request.post("/api/v1/time-entries", {
      data: {
        employeeId: targetEmployee.id,
        date: targetMonthDate,
        startTime: `${targetMonthDate}T08:00:00.000Z`,
        endTime: `${targetMonthDate}T16:30:00.000Z`,
      },
    });
    // 201 Created or 409 Conflict (entry already exists) are both acceptable
    expect(seedRes.status() === 201 || seedRes.status() === 409).toBeTruthy();

    // Step 4: Navigate to Monatsabschluss and verify the year
    await page.goto("/admin/monatsabschluss");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Monatsabschluss/).first()).toBeVisible();
    await expect(page.getByText(/Januar|Februar|März/).first()).toBeVisible();

    // Navigate year if needed (default is current year, navigate back for prior year data)
    const currentYearOnPage = new Date().getFullYear();
    if (targetYear < currentYearOnPage) {
      const yearsToGoBack = currentYearOnPage - targetYear;
      for (let i = 0; i < yearsToGoBack; i++) {
        const prevYearBtn = page.getByRole("button", { name: /‹|prev|<|vorheriges Jahr/i }).first();
        await prevYearBtn.click();
        await page.waitForLoadState("networkidle");
      }
    }

    // Step 5: Find the close button (only visible for firstActionableMonth)
    // The button text is "Abschliessen" and appears in the month's row
    const closeBtn = page.getByRole("button", { name: /Abschliessen/i }).first();
    await expect(closeBtn).toBeVisible({ timeout: 10_000 });

    // Step 6: Click the close button
    await closeBtn.click();
    await page.waitForLoadState("networkidle");

    // Step 7: Assert UI reflects closed status
    await expect(page.getByText(/abgeschlossen/i).first()).toBeVisible({ timeout: 10_000 });

    // Step 8: Verify via API that the month is actually closed
    const verifyRes = await page.request.get(
      `/api/v1/overtime/close-month/year-status?year=${targetYear}`,
    );
    expect(verifyRes.ok()).toBeTruthy();
    const verifyData = await verifyRes.json();
    const months: Array<{ month: number; status: string }> = verifyData.months ?? [];
    const closedMonth = months.find((m) => m.month === targetMonth);
    expect(closedMonth?.status).toBe("closed");

    await screenshotPage(page, "flow-admin-monatsabschluss-closed");
  });

  // UI-05: Password policy save and verify persistence
  test("admin system — save password policy and verify persistence", async ({ page }) => {
    await page.goto("/admin/system");
    await page.waitForLoadState("networkidle");

    // Scroll to the Passwort-Richtlinie section
    await page.getByText("Passwort-Richtlinie").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Find the min-length input via its ID
    const minLengthInput = page.locator("#pw-min-length");
    await expect(minLengthInput).toBeVisible();

    // Read current value and change it
    const currentValue = await minLengthInput.inputValue();
    const currentNum = parseInt(currentValue, 10);
    // Toggle between 12 and 14 to ensure a change
    const newValue = currentNum === 12 ? 14 : 12;

    await minLengthInput.fill(String(newValue));
    await page.waitForTimeout(200);

    // Click the save button in the password policy section
    // The button is inside .settings-actions after the toggle rows
    const saveBtn = page
      .locator(".sys-section")
      .filter({ hasText: "Passwort-Richtlinie" })
      .getByRole("button", { name: /Speichern/i })
      .first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await page.waitForLoadState("networkidle");

    // Wait for saved confirmation
    await expect(page.getByText(/Gespeichert/i).first()).toBeVisible({ timeout: 5_000 });

    // Reload the page to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Scroll back to the section
    await page.getByText("Passwort-Richtlinie").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Assert the saved value persists
    const persistedInput = page.locator("#pw-min-length");
    await expect(persistedInput).toBeVisible();
    const persistedValue = await persistedInput.inputValue();
    expect(parseInt(persistedValue, 10)).toBe(newValue);

    // Restore original value
    await persistedInput.fill(currentValue);
    await page.waitForTimeout(200);
    await page
      .locator(".sys-section")
      .filter({ hasText: "Passwort-Richtlinie" })
      .getByRole("button", { name: /Speichern/i })
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    await screenshotPage(page, "flow-admin-password-policy-saved");
  });

  test("admin monatsabschluss — view months", async ({ page }) => {
    await page.goto("/admin/monatsabschluss");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Monatsabschluss/).first()).toBeVisible();
    // Should show month rows
    await expect(page.getByText(/Januar|Februar|März/).first()).toBeVisible();
    await screenshotPage(page, "flow-admin-monatsabschluss");
  });
});
