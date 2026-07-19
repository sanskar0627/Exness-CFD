import { Router } from "express";
import type { Request, Response } from "express";
import { v5 as uuidv5 } from "uuid"; //Generates same ID for same email
import { CreateUser, findUser, findUSerId, UserBalance } from "../data/store";
import { generateToken } from "../utils/jwt";
import { hashPassword, comparePassword } from "../utils/password";
import { authMiddleware } from "../middleware/auth";
import { authRateLimit, apiRateLimit } from "../middleware/rateLimit";
import type { SignupRequest, SigninRequest } from "../types";
import { signupSchema, signinSchema } from "../types";
import { fromInternalUSD } from "shared";
import { prisma, Prisma } from "database";
import {
  generateVerificationCode,
  sendVerificationEmail,
  isEmailConfigured,
} from "../services/emailService";

const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export const userRouter = Router(); // To organise ROutes

userRouter.post(
  "/signup",
  authRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body as SignupRequest;
      console.log(`[SIGNUP] Attempt for email: ${email}`);

      //validate using zod
      const validate = signupSchema.safeParse({ email, password });
      if (!validate.success) {
        res
          .status(400)
          .json({ error: "Invalid Input", details: validate.error.issues });
        return;
      }
      const exsistingUser = await prisma.user.findUnique({ where: { email } });
      if (exsistingUser) {
        // A registered-but-NEVER-verified email/password account doesn't own
        // the email yet — let the person sign up again: reset the password,
        // issue a fresh code, and resend the verification email.
        const canRetake =
          !exsistingUser.emailVerified && !exsistingUser.provider;

        if (!canRetake) {
          console.log(`[SIGNUP] User already exists: ${email}`);
          res.status(409).json({ error: "User already exists" });
          return;
        }

        console.log(`[SIGNUP] Re-signup for unverified account: ${email}`);
        const retakeHashed = hashPassword(password);
        const retakeCode = generateVerificationCode();
        const retakeExpiry = new Date(Date.now() + 15 * 60 * 1000);
        const retakeEmailEnabled = isEmailConfigured();

        await prisma.user.update({
          where: { email },
          data: {
            password: retakeHashed,
            emailVerified: !retakeEmailEnabled,
            verificationCode: retakeEmailEnabled ? retakeCode : null,
            verificationExpiry: retakeEmailEnabled ? retakeExpiry : null,
          },
        });

        if (retakeEmailEnabled) {
          sendVerificationEmail(email, retakeCode);
        }

        const retakeToken = generateToken(exsistingUser.userId);
        res.status(201).json({
          message: "User created successfully",
          userId: exsistingUser.userId,
          token: retakeToken,
          needsVerification: retakeEmailEnabled,
        });
        return;
      }
      //if its a valid gmail then genarting a vlaid uuid
      const UserId = uuidv5(email, UUID_NAMESPACE);
      console.log(`[SIGNUP] Generated userId: ${UserId} for ${email}`);

      // Hash password before storing
      const hashedPassword = hashPassword(password);

      // Email verification: 4-digit code, 15 minute expiry.
      // If email sending isn't configured, auto-verify so signups still work.
      const emailEnabled = isEmailConfigured();
      const code = generateVerificationCode();
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.create({
        data: {
          userId: UserId,
          email: email,
          password: hashedPassword,
          balanceCents: 500000,
          emailVerified: !emailEnabled,
          verificationCode: emailEnabled ? code : null,
          verificationExpiry: emailEnabled ? expiry : null,
        },
      });
      const newUser = CreateUser(UserId, email, hashedPassword);
      const newToken = generateToken(UserId);

      if (emailEnabled) {
        // Fire-and-forget; failures are logged inside the service
        sendVerificationEmail(email, code);
      }

      res.status(201).json({
        message: "User created successfully",
        userId: newUser.userId,
        token: newToken,
        needsVerification: emailEnabled,
      });
      console.log(`[SIGNUP] User created successfully: ${email}`);
    } catch (err) {
      console.error("[SIGNUP] Error", err);
      res.status(500).json({ error: "Internal server error in signup" });
    }
  }
);

//SIGN IN ROutes
userRouter.post("/signin", authRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as SigninRequest;
    const validate = signinSchema.safeParse({ email, password });
    if (!validate.success) {
      res.status(400).json({
        error: "Invalid Input",
        details: validate.error.issues,
      });
      return;
    }
    console.log(`[SIGNIN] Attempt for email: ${email}`);
    const user = await prisma.user.findUnique({
    where: { email }
  });
    //check that the email is valid or not
    if (!user) {
      console.log(`[SIGNIN] User not found: ${email}`);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check if user is an OAuth user (has provider but empty/no password)
    if (user.provider && (!user.password || user.password === "")) {
      console.log(`[SIGNIN] OAuth user attempting password login: ${email}`);
      res.status(401).json({ 
        error: `This account uses ${user.provider} login. Please sign in with ${user.provider}.` 
      });
      return;
    }

    //check the password is same or not using bcrypt
    const isPasswordValid = comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.log(`[SIGNIN] Invalid password for: ${email}`);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = generateToken(user.userId);
    const inMemory = findUSerId(user.userId);
    if (!inMemory) {
    CreateUser(user.userId, user.email, user.password, user.balanceCents);
    console.log(`[SIGNIN] User ${user.userId} loaded into memory from database`);
  }
    res.status(200).json({
      message: "Login successful",
      userId: user.userId,
      token: token,
      needsVerification: !user.emailVerified,
    });
    console.log(`[SIGNIN] Login successful: ${email}`);
  } catch (err) {
    console.error("[SIGNIN] Error", err);
    res.status(500).json({ error: "Internal server error in signin" });
  }
});

// Verify email with the 4-digit code
userRouter.post(
  "/verify-email",
  authRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, code } = req.body as { email?: string; code?: string };
      if (!email || !code || !/^\d{4}$/.test(String(code))) {
        res.status(400).json({ error: "Email and 4-digit code required" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (user.emailVerified) {
        res.status(200).json({ message: "Email already verified" });
        return;
      }
      if (!user.verificationCode || !user.verificationExpiry) {
        res.status(400).json({ error: "No verification pending. Request a new code." });
        return;
      }
      if (user.verificationExpiry < new Date()) {
        res.status(410).json({ error: "Code expired. Request a new code." });
        return;
      }
      if (user.verificationCode !== String(code)) {
        console.log(`[VERIFY] Wrong code attempt for ${email}`);
        res.status(401).json({ error: "Incorrect code" });
        return;
      }

      await prisma.user.update({
        where: { email },
        data: {
          emailVerified: true,
          verificationCode: null,
          verificationExpiry: null,
        },
      });

      console.log(`[VERIFY] Email verified: ${email}`);
      res.status(200).json({ message: "Email verified successfully" });
    } catch (err) {
      console.error("[VERIFY] Error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Resend a fresh verification code
userRouter.post(
  "/resend-code",
  authRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({ error: "Email required" });
        return;
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      if (user.emailVerified) {
        res.status(200).json({ message: "Email already verified" });
        return;
      }

      const code = generateVerificationCode();
      const expiry = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { email },
        data: { verificationCode: code, verificationExpiry: expiry },
      });

      const sent = await sendVerificationEmail(email, code);
      if (!sent) {
        res.status(502).json({ error: "Failed to send email. Try again later." });
        return;
      }
      res.status(200).json({ message: "New code sent" });
    } catch (err) {
      console.error("[RESEND] Error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

userRouter.get(
  "/balance",
  apiRateLimit,
  authMiddleware,
  (req: Request, res: Response): void => {
    try {
      const userId = req.userId;
      if (!userId) {
        ///Doing this for typescript error
        res.status(404).json({ error: "User not found" });
        return;
      }
      console.log(`[BALANCE] Balance check for user: ${userId}`);
      const user = findUSerId(userId);
      if (!user) {
        console.log(`[BALANCE] User not found: ${userId}`);
        res.status(404).json({ error: "User not found" });
        return;
      }
      const balanceusd = fromInternalUSD(user.balance.usd_balance);
      res.status(200).json({
        userId: user.userId,
        email: user.email,
        balance: {
          usd: balanceusd, // $5000
          cents: user.balance.usd_balance, // 500000
        },
        assets: user.assets, // Crypto holdings (for future)
      });
      console.log(`[BALANCE] Balance retrieved for ${userId}: $${balanceusd}`);
    } catch (err) {
      console.error("[BALANCE] Error", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
