-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "capacity" REAL,
    "category" TEXT NOT NULL DEFAULT 'TANK',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tank" ("capacity", "createdAt", "id", "name", "type", "updatedAt", "userId") SELECT "capacity", "createdAt", "id", "name", "type", "updatedAt", "userId" FROM "Tank";
DROP TABLE "Tank";
ALTER TABLE "new_Tank" RENAME TO "Tank";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
