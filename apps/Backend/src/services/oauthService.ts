import { prisma } from "database";
import { v4 as uuidv4 } from "uuid";
import { StoreData, CreateUser } from "../data/store";
import type { Asset } from "shared";

export interface OAuthProfile {
  provider: "google" | "github";
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Ensure the user is loaded into the in-memory trading store.
 * Called after every successful OAuth resolution so trading endpoints work.
 */
function ensureInMemoryStore(user: {
  userId: string;
  email: string;
  password: string;
  balanceCents: number;
}) {
  if (!StoreData.has(user.userId)) {
    StoreData.set(user.userId, {
      userId: user.userId,
      email: user.email,
      password: user.password || "",
      balance: { usd_balance: user.balanceCents },
      assets: {} as Record<Asset, number>,
    });
    console.log(`[OAuth] Loaded user ${user.userId} into memory store`);
  }
}

export async function findOrCreateOAuthUser(profile: OAuthProfile) {
  console.log(
    `[OAuth] Processing ${profile.provider} login for: ${profile.email}`
  );

  // ──────────────────────────────────────────────────────────────
  // 1. Check if this exact provider+providerId already linked
  // ──────────────────────────────────────────────────────────────
  const existingLink = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: profile.provider,
        providerId: profile.providerId,
      },
    },
    include: { user: true },
  });

  if (existingLink) {
    console.log(
      `[OAuth] Existing ${profile.provider} link found for user: ${existingLink.user.email}`
    );
    ensureInMemoryStore(existingLink.user);
    return existingLink.user;
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Check if the email already belongs to an existing account
  // ──────────────────────────────────────────────────────────────
  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email },
  });

  if (existingUser) {
    // ── 2a. Verified account (email/password OR another OAuth) → auto-link ──
    if (existingUser.emailVerified) {
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.userId,
          provider: profile.provider,
          providerId: profile.providerId,
        },
      });

      // Update avatar if the user doesn't have one yet
      if (!existingUser.avatarUrl && profile.avatarUrl) {
        await prisma.user.update({
          where: { userId: existingUser.userId },
          data: { avatarUrl: profile.avatarUrl },
        });
      }

      console.log(
        `[OAuth] Auto-linked ${profile.provider} to verified account: ${existingUser.email}`
      );
      ensureInMemoryStore(existingUser);
      return existingUser;
    }

    // ── 2b. Unverified email/password account → claim it via OAuth ──
    //    OAuth email is provider-verified, so this is safe.
    const updated = await prisma.user.update({
      where: { userId: existingUser.userId },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiry: null,
        avatarUrl: profile.avatarUrl || existingUser.avatarUrl,
      },
    });

    await prisma.oAuthAccount.create({
      data: {
        userId: existingUser.userId,
        provider: profile.provider,
        providerId: profile.providerId,
      },
    });

    console.log(
      `[OAuth] Claimed unverified account and linked ${profile.provider}: ${updated.email}`
    );
    ensureInMemoryStore(updated);
    return updated;
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Brand-new user → create account + OAuth link
  // ──────────────────────────────────────────────────────────────
  const userId = uuidv4();
  const initialBalance = 500000; // $5000 in cents

  const newUser = await prisma.user.create({
    data: {
      userId,
      email: profile.email,
      password: "", // No password for pure OAuth users
      balanceCents: initialBalance,
      provider: profile.provider,      // legacy field (first provider used)
      providerId: profile.providerId,  // legacy field
      emailVerified: true,
      avatarUrl: profile.avatarUrl,
    },
  });

  await prisma.oAuthAccount.create({
    data: {
      userId,
      provider: profile.provider,
      providerId: profile.providerId,
    },
  });

  // Add to in-memory trading store
  CreateUser(userId, profile.email, "");

  console.log(`[OAuth] Created new ${profile.provider} user: ${newUser.email}`);
  return newUser;
}

/**
 * Check if user is an OAuth user (for signin validation).
 * Returns all linked providers so the error message can list them.
 */
export async function getLinkedProviders(
  email: string
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { oauthAccounts: { select: { provider: true } } },
  });

  if (!user) return [];

  const providers = user.oauthAccounts.map((a) => a.provider);

  // Fallback: if legacy provider field is set but no OAuthAccount rows exist yet
  if (providers.length === 0 && user.provider) {
    return [user.provider];
  }

  return providers;
}
