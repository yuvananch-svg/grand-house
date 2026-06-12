import { expect, test, type Page } from "@playwright/test";

async function loginAsOwner(page: Page) {
  await page.goto("/");
  await page.getByLabel("User ID").fill("owner");
  await page.getByLabel("Password").fill("owner1234");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("R1 mobile POS uses bottom nav, two-column products, and an expandable cart sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsOwner(page);

  await page.getByRole("button", { name: "ขายหน้าร้าน" }).click();
  await expect(page.getByRole("heading", { name: "ขายหน้าร้าน" })).toBeVisible();

  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".bottom-nav")).toHaveCSS("display", "grid");
  await expect(page.locator(".bottom-nav")).toHaveCSS("position", "fixed");
  await expect(page.locator(".bottom-nav button")).toHaveCount(5);

  await expect.poll(async () => page.locator(".product-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2);
  await expect(page.locator(".cart-panel")).toHaveCSS("position", "fixed");
  await expect(page.locator(".cart-drawer")).toBeHidden();
  await expect(page.locator(".mobile-cart-finish")).toBeDisabled();

  await page.locator(".product-card").first().click();
  await expect(page.locator(".cart-panel")).toHaveClass(/open/);
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await expect(page.locator(".mobile-cart-finish")).toBeEnabled();
  await expect(page.locator(".checkout-box .giant")).toBeEnabled();

  await page.getByRole("button", { name: "เงินสด" }).click();
  const cashTrigger = page.locator(".numpad-trigger").filter({ hasText: "แตะเพื่อกรอกเงินรับ" });
  await expect(cashTrigger).toHaveCSS("min-height", "44px");
  await expect(cashTrigger).toHaveCSS("border-radius", "8px");
  await expect(cashTrigger).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("R2 tablet POS uses icon sidebar, right cart, and three-column products", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await loginAsOwner(page);

  await page.getByRole("button", { name: "ขายหน้าร้าน" }).click();
  await expect(page.getByRole("heading", { name: "ขายหน้าร้าน" })).toBeVisible();

  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await expect(page.locator(".sidebar")).toHaveCSS("position", "sticky");
  await expect(page.locator(".app-shell")).toHaveCSS("grid-template-columns", "72px 696px");
  await expect(page.locator(".nav-list button").first()).toHaveAttribute("title", "ขายหน้าร้าน");
  await expect(page.locator(".nav-list button").first()).toHaveAttribute("aria-label", "ขายหน้าร้าน");
  await expect(page.locator(".nav-list button span").first()).toHaveCSS("font-size", "0px");

  await expect.poll(async () => page.locator(".product-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(page.locator(".cart-panel")).toHaveCSS("position", "sticky");
});

test("R3 mobile tables render as labeled cards without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsOwner(page);

  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const tableWrap = page.locator(".table-wrap.card-on-mobile").first();
  await expect(tableWrap).toBeVisible();
  await expect(tableWrap).toHaveCSS("overflow", "visible");

  await expect(tableWrap.locator("table")).toHaveCSS("display", "block");
  await expect(tableWrap.locator("tbody")).toHaveCSS("display", "grid");
  await expect(tableWrap.locator("tbody tr").first()).toHaveCSS("display", "block");
  await expect(tableWrap.locator("tbody td").first()).toHaveCSS("display", "grid");
  await expect(tableWrap.locator("tbody td").first()).toHaveAttribute("data-label", "เรื่อง");
});

test("R4 mobile More sheet exposes secondary pages and session actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsOwner(page);

  await page.getByRole("button", { name: "เพิ่มเติม" }).click();
  await expect(page.locator(".mobile-menu-sheet")).toBeVisible();
  await expect(page.locator(".mobile-menu-backdrop")).toHaveCSS("display", "flex");
  await expect(page.locator(".mobile-menu-grid button")).toHaveCount(13);
  await expect(page.getByRole("button", { name: "งบการเงิน" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ไทย" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();

  await page.getByRole("button", { name: "งบการเงิน" }).click();
  await expect(page.getByRole("heading", { name: "งบการเงิน", exact: true })).toBeVisible();
  await expect(page.locator(".mobile-menu-sheet")).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
