-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('off', 'pending', 'synced', 'error', 'conflict');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'premium', 'pro');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "googleId" TEXT,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" TIMESTAMP(3),
    "calendarId" TEXT DEFAULT 'primary',
    "calendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calendarSyncDirection" TEXT NOT NULL DEFAULT 'both',
    "defaultReminderMinutes" INTEGER NOT NULL DEFAULT 30,
    "syncToken" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "channelId" TEXT,
    "channelResourceId" TEXT,
    "channelToken" TEXT,
    "channelExpiry" TIMESTAMP(3),
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "tasksCreated" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "calendarSync" BOOLEAN NOT NULL DEFAULT false,
    "calendarEventId" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'off',
    "syncedAt" TIMESTAMP(3),
    "syncHash" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "conflictData" JSONB,
    "recurrence" TEXT,
    "recurrenceStart" TIMESTAMP(3),
    "recurrenceEnded" BOOLEAN NOT NULL DEFAULT false,
    "seriesId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_channelId_key" ON "users"("channelId");

-- CreateIndex
CREATE INDEX "tasks_userId_completed_dueDate_idx" ON "tasks"("userId", "completed", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_userId_createdAt_idx" ON "tasks"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_calendarEventId_idx" ON "tasks"("calendarEventId");

-- CreateIndex
CREATE INDEX "tasks_seriesId_idx" ON "tasks"("seriesId");

-- CreateIndex
CREATE INDEX "tasks_userId_recurrence_recurrenceEnded_idx" ON "tasks"("userId", "recurrence", "recurrenceEnded");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
