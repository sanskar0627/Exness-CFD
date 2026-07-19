-- Add email verification code fields
ALTER TABLE "users" ADD COLUMN "verificationCode" TEXT;
ALTER TABLE "users" ADD COLUMN "verificationExpiry" TIMESTAMP(3);
