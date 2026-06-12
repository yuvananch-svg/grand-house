import { expect, test, type Page } from "@playwright/test";

type OutboxRow = {
  id: string;
  type: string;
  status: string;
  last_error?: string;
};

type LocalStateSummary = {
  sales: { id: string; status: string; sale_type: string; payment_method: string; total_amount: number; void_reason?: string }[];
  wastage: { id: string; qty: number; total_cost_value: number }[];
  finishedLots: { lot_id: string; product_id: string; qty_remaining: number }[];
  errorLog: { message: string }[];
};

const dbName = "grands-house-local-first";
const stateKey = "grands-house-local-state-v1";

async function loginAsStaff(page: Page) {
  await page.goto("/");
  await page.getByLabel("User ID").fill("kaset01");
  await page.getByLabel("Password").fill("staff1234");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page.getByRole("button", { name: "ขายหน้าร้าน" })).toBeVisible();
}

async function deleteDatabase(page: Page, name: string) {
  await page.evaluate(async (databaseName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  }, name);
}

async function readOutbox(page: Page): Promise<OutboxRow[]> {
  return page.evaluate(async (databaseName) => {
    return new Promise<OutboxRow[]>((resolve) => {
      const request = indexedDB.open(databaseName);
      request.onerror = () => resolve([]);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("outbox")) {
          db.close();
          resolve([]);
          return;
        }
        const transaction = db.transaction("outbox", "readonly");
        const getAll = transaction.objectStore("outbox").getAll();
        getAll.onsuccess = () => {
          db.close();
          resolve(getAll.result as OutboxRow[]);
        };
        getAll.onerror = () => {
          db.close();
          resolve([]);
        };
      };
      request.onupgradeneeded = () => {
        request.transaction?.abort();
        resolve([]);
      };
    });
  }, dbName);
}

async function readState(page: Page): Promise<LocalStateSummary> {
  return page.evaluate((key) => {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      sales: parsed.sales || [],
      wastage: parsed.wastage || [],
      finishedLots: parsed.finishedLots || [],
      errorLog: parsed.errorLog || []
    };
  }, stateKey);
}

async function expectOutboxCount(page: Page, count: number) {
  await expect.poll(async () => (await readOutbox(page)).filter((row) => row.status !== "dead").length).toBe(count);
  await expect(page.locator(".net.pending")).toContainText(String(count));
}

async function finishOneSale(page: Page) {
  await page.locator(".product-card").first().click();
  await expect(page.getByText("รวม")).toBeVisible();
  await page.getByRole("button", { name: "จบการขาย" }).click();
}

async function reconnectAndWaitForEmptyOutbox(context: import("@playwright/test").BrowserContext, page: Page) {
  await context.setOffline(false);
  await expect(page.locator(".net.online")).toContainText("ออนไลน์");
  await expect(page.locator(".net.pending")).toContainText("0", { timeout: 20_000 });
  await expect.poll(async () => (await readOutbox(page)).filter((row) => row.status !== "dead").length).toBe(0);
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await deleteDatabase(page, dbName);
});

test("C1 offline sale queues locally and syncs after reconnect", async ({ context, page }) => {
  await loginAsStaff(page);

  await context.setOffline(true);
  await expect(page.locator(".net.offline")).toContainText("ออฟไลน์");

  await finishOneSale(page);

  await expect(page.getByText("บันทึกลงเครื่องแล้ว รอส่ง")).toBeVisible();
  await expectOutboxCount(page, 1);

  await reconnectAndWaitForEmptyOutbox(context, page);
});

test("C2 multiple offline sales preserve order and all sync after reconnect", async ({ context, page }) => {
  await loginAsStaff(page);
  const before = await readState(page);

  await context.setOffline(true);
  await finishOneSale(page);
  await finishOneSale(page);

  await expectOutboxCount(page, 2);

  await reconnectAndWaitForEmptyOutbox(context, page);
  await expect.poll(async () => (await readState(page)).sales.length).toBe(before.sales.length + 2);
});

test("C3 queued offline sale is visible locally but does not create a server sale before sync", async ({ context, page }) => {
  await loginAsStaff(page);
  const before = await readState(page);

  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await page.getByRole("button", { name: "บิลย้อนหลัง" }).click();
  await expect(page.getByText("รอ sync")).toBeVisible();
  await expect.poll(async () => (await readState(page)).sales.length).toBe(before.sales.length);

  await reconnectAndWaitForEmptyOutbox(context, page);
  await expect.poll(async () => (await readState(page)).sales.length).toBe(before.sales.length + 1);
});

test("C4 day close blocks while offline outbox still has pending rows", async ({ context, page }) => {
  await loginAsStaff(page);
  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await page.getByRole("button", { name: "ปิดยอด" }).click();
  await expect(page.getByText("ยังปิดร้านไม่ได้")).toBeVisible();
  await expect(page.getByText("ยังมีรายการรอส่ง 1 รายการ")).toBeVisible();

  await reconnectAndWaitForEmptyOutbox(context, page);
});

test("C5 offline wastage queues locally and syncs after reconnect", async ({ context, page }) => {
  await loginAsStaff(page);
  const before = await readState(page);

  await context.setOffline(true);
  await page.getByRole("button", { name: "ตัดของเสีย" }).click();
  await page.locator(".product-card").first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "ยืนยันตัดของเสีย" }).click();

  await expect(page.getByText("บันทึกของเสียลงเครื่องแล้ว รอส่ง")).toBeVisible();
  await expectOutboxCount(page, 1);

  await reconnectAndWaitForEmptyOutbox(context, page);
  await expect.poll(async () => (await readState(page)).wastage.length).toBe(before.wastage.length + 1);
});

test("C6 day close blocker disappears after background sync on reconnect", async ({ context, page }) => {
  await loginAsStaff(page);
  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await page.getByRole("button", { name: "ปิดยอด" }).click();
  await expect(page.getByText("ยังปิดร้านไม่ได้")).toBeVisible();

  await reconnectAndWaitForEmptyOutbox(context, page);
  await expect(page.getByText("ยังปิดร้านไม่ได้")).toHaveCount(0);
});

test("C7 queued sale survives navigation until it is synced", async ({ context, page }) => {
  await loginAsStaff(page);
  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await page.getByRole("button", { name: "ของเสีย", exact: true }).click();
  await page.getByRole("button", { name: "บิลย้อนหลัง" }).click();

  await expect(page.getByText("รอ sync")).toBeVisible();
  await expectOutboxCount(page, 1);

  await reconnectAndWaitForEmptyOutbox(context, page);
});

test("C8 rejected queued sale becomes a dead outbox row instead of retrying forever", async ({ context, page }) => {
  await loginAsStaff(page);
  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await page.evaluate(async (databaseName) => {
    const request = indexedDB.open(databaseName);
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
    const db = request.result;
    const transaction = db.transaction("outbox", "readwrite");
    const store = transaction.objectStore("outbox");
    const getAll = store.getAll();
    await new Promise<void>((resolve, reject) => {
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => resolve();
    });
    const [row] = getAll.result as { id: string; payload: { sales: { total_amount: number }[] } }[];
    row.payload.sales[0].total_amount += 1;
    store.put(row);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
  }, dbName);

  await context.setOffline(false);
  await expect(page.locator(".net.pending")).toContainText("0", { timeout: 20_000 });
  await expect.poll(async () => (await readOutbox(page)).filter((row) => row.status === "dead").length).toBe(1);
  await page.getByRole("button", { name: "บิลย้อนหลัง" }).click();
  await expect(page.getByText("ส่งไม่ผ่านถาวร")).toBeVisible();
  await expect(page.getByText(/TOTAL_MISMATCH/)).toBeVisible();
  await expect.poll(async () => (await readState(page)).errorLog.filter((row) => row.message.includes("DEAD_OUTBOX")).length).toBe(1);
});

test("C9 offline cash sale cannot finish when cash received is below total", async ({ context, page }) => {
  await loginAsStaff(page);
  await context.setOffline(true);

  await page.locator(".product-card").first().click();
  await page.getByRole("button", { name: "เงินสด" }).click();
  await expect(page.getByRole("button", { name: "จบการขาย" })).toBeDisabled();
  await expectOutboxCount(page, 0);
});

test("C10 synced offline sale decrements finished stock exactly once", async ({ context, page }) => {
  await loginAsStaff(page);
  const before = await readState(page);
  const targetLot = before.finishedLots.find((lot) => lot.product_id === "PRD-KAPRAO");
  expect(targetLot).toBeTruthy();

  await context.setOffline(true);
  await finishOneSale(page);
  await expectOutboxCount(page, 1);

  await reconnectAndWaitForEmptyOutbox(context, page);

  await expect.poll(async () => (await readState(page)).sales.length).toBe(before.sales.length + 1);
  await expect.poll(async () => {
    const after = await readState(page);
    return after.finishedLots.find((lot) => lot.lot_id === targetLot?.lot_id)?.qty_remaining;
  }).toBe(Number(targetLot?.qty_remaining) - 1);
});
