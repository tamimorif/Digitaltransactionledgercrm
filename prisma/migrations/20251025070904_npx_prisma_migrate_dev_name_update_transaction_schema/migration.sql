/*
  Warnings:

  - You are about to drop the column `amount` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `exchange_rate` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `transactions` table. All the data in the column will be lost.
  - Added the required column `rate_applied` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receive_amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receive_currency` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `send_amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `send_currency` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "send_currency" TEXT NOT NULL,
    "send_amount" REAL NOT NULL,
    "receive_currency" TEXT NOT NULL,
    "receive_amount" REAL NOT NULL,
    "rate_applied" REAL NOT NULL,
    "fee_charged" REAL NOT NULL DEFAULT 0,
    "beneficiary_name" TEXT,
    "beneficiary_details" TEXT,
    "user_notes" TEXT,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "last_edited_at" DATETIME,
    "edit_history" TEXT,
    "transaction_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("client_id", "created_at", "id", "transaction_date", "type", "updated_at") SELECT "client_id", "created_at", "id", "transaction_date", "type", "updated_at" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_client_id_idx" ON "transactions"("client_id");
CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
