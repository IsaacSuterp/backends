/*
  Warnings:

  - Added the required column `cep` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerCPF` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `neighborhood` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shippingCost` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `street` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerCPF" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "shippingCost" REAL NOT NULL,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("createdAt", "customerEmail", "customerName", "id", "totalAmount") SELECT "createdAt", "customerEmail", "customerName", "id", "totalAmount" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
