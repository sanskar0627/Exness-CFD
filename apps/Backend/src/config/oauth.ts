// OAuth Configuration for Google and GitHub

export const oauthConfig = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackURL:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:5000/api/v2/auth/google/callback",
  },
  github: {
    clientID: process.env.GITHUB_CLIENT_ID || "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    callbackURL:
      process.env.GITHUB_CALLBACK_URL ||
      "http://localhost:5000/api/v2/auth/github/callback",
  },
  frontendURL: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
};

export function validateOAuthConfig(): {
  google: boolean;
  github: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  const googleConfigured = !!(
    oauthConfig.google.clientID && oauthConfig.google.clientSecret
  );
  const githubConfigured = !!(
    oauthConfig.github.clientID && oauthConfig.github.clientSecret
  );

  if (!googleConfigured) {
    warnings.push(
      "[OAuth] Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required"
    );
  }

  if (!githubConfigured) {
    warnings.push(
      "[OAuth] GitHub OAuth not configured - GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET required"
    );
  }

  return { google: googleConfigured, github: githubConfigured, warnings };
}

export function logOAuthStatus(): void {
  const { google, github, warnings } = validateOAuthConfig();

  console.log("[OAuth] Configuration Status:");
  console.log(`  - Google OAuth: ${google ? "✓ Enabled" : "✗ Disabled"}`);
  console.log(`  - GitHub OAuth: ${github ? "✓ Enabled" : "✗ Disabled"}`);

  warnings.forEach((warning) => console.warn(warning));
}
