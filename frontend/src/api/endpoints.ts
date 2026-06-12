import type { ApiAction } from "../types";

export const endpoints: Record<string, ApiAction> = {
  login: "login",
  productList: "product.list",
  stockMyBranch: "stock.myBranch",
  saleSyncBatch: "sale.syncBatch",
  saleVoid: "sale.void",
  wastageCreate: "wastage.create",
  rawWastageCreate: "rawWastage.create",
  stockExtendExpiry: "stock.extendExpiry",
  goodsReceive: "goods.receive",
  rawLotPurchase: "rawlot.purchase",
  inventoryList: "inventory.list",
  productionPreview: "production.preview",
  productionRun: "production.run",
  stockAdjustRequest: "stockAdjust.request",
  reconcileGetDaily: "reconcile.getDaily",
  reconcileConfirm: "reconcile.confirm",
  expenseCreate: "expense.create",
  expenseList: "expense.list",
  recipeSave: "recipe.save",
  recipeList: "recipe.list",
  reportSummary: "report.summary",
  reportFinancialStatement: "report.financialStatement",
  auditQuery: "audit.query",
  userManage: "user.manage",
  logClientError: "log.clientError"
};
