import { Router } from "express";
import { userService, CreateUserSchema, LoginUserSchema } from "../services/userService.js";
import { usermiddleware } from "../middleware/auth.js";

export const userRouter = Router();

userRouter.post("/signup", async (req, res) => {
  try {
    const parseduserinfo = CreateUserSchema.safeParse(req.body);

    if (!parseduserinfo.success) {
      return res.status(400).json({
        message: "Invalid input data",
        errors: parseduserinfo.error.errors
      });
    }

    const user = await userService.createUser(parseduserinfo.data);
    
    return res.status(201).json({
      message: "User created successfully",
      userId: user.id,
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User already exists with this email') {
      return res.status(409).json({
        message: error.message
      });
    }
    
    console.error('Signup error:', error);
    return res.status(500).json({
      message: "Internal server error during signup"
    });
  }
});

userRouter.post("/signin", async (req, res) => {
  try {
    const parsedData = LoginUserSchema.safeParse(req.body);
    
    if (!parsedData.success) {
      return res.status(400).json({
        message: "Invalid input data",
        errors: parsedData.error.errors
      });
    }

    const loginResult = await userService.loginUser(parsedData.data);
    
    return res.status(200).json({
      message: "Login successful",
      user: loginResult.user,
      token: loginResult.token
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid email or password') {
      return res.status(401).json({
        message: error.message
      });
    }
    
    console.error('Signin error:', error);
    return res.status(500).json({
      message: "Internal server error during signin"
    });
  }
});

userRouter.get("/balance", usermiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    // Use fast cached balance (1ms instead of 50ms)
    const balance = await userService.getUserBalanceFast(userId);
    
    return res.status(200).json({
      usd_balance: balance * 100, // Convert back to cents for compatibility
      balance: balance
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    return res.status(500).json({
      message: "Internal server error while fetching balance"
    });
  }
});

userRouter.get("/orders", usermiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const orders = await userService.getUserOrders(userId);
    
    return res.status(200).json({
      orders
    });
  } catch (error) {
    console.error('Orders fetch error:', error);
    return res.status(500).json({
      message: "Internal server error while fetching orders"
    });
  }
});

userRouter.get("/history", usermiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }
    
    const closedOrders = await userService.getClosedOrders(userId);
    
    return res.status(200).json({
      closedOrders
    });
  } catch (error) {
    console.error('Order history fetch error:', error);
    return res.status(500).json({
      message: "Internal server error while fetching order history"
    });
  }
});