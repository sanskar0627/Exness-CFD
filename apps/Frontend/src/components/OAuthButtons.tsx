import { useState } from "react";

const BACKEND_URL =
  import.meta.env.VITE_API_URL?.replace("/api/v2", "") ||
  "http://localhost:5000";

interface OAuthButtonsProps {
  disabled?: boolean;
}

export default function OAuthButtons({ disabled = false }: OAuthButtonsProps) {
  const [isLoading, setIsLoading] = useState<"google" | "github" | null>(null);

  const handleGoogleLogin = () => {
    if (disabled || isLoading) return;
    setIsLoading("google");
    window.location.href = `${BACKEND_URL}/api/v2/auth/google`;
  };

  const handleGithubLogin = () => {
    if (disabled || isLoading) return;
    setIsLoading("github");
    window.location.href = `${BACKEND_URL}/api/v2/auth/github`;
  };

  return (
    <div className="space-y-4">
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-600"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-neutral-900/80 text-neutral-400">
            Or continue with
          </span>
        </div>
      </div>

      {/* OAuth Buttons */}
      <div className="grid grid-cols-2 gap-3">
        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={disabled || isLoading !== null}
          className="flex items-center justify-center px-4 py-3 bg-neutral-950/50 border border-neutral-600 text-neutral-50 hover:bg-neutral-800/50 hover:border-neutral-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading === "google" ? (
            <div className="animate-spin h-5 w-5 border-2 border-neutral-50 border-t-transparent mr-2"></div>
          ) : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span className="font-medium">Google</span>
        </button>

        {/* GitHub Button */}
        <button
          onClick={handleGithubLogin}
          disabled={disabled || isLoading !== null}
          className="flex items-center justify-center px-4 py-3 bg-neutral-950/50 border border-neutral-600 text-neutral-50 hover:bg-neutral-800/50 hover:border-neutral-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading === "github" ? (
            <div className="animate-spin h-5 w-5 border-2 border-neutral-50 border-t-transparent mr-2"></div>
          ) : (
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"
              />
            </svg>
          )}
          <span className="font-medium">GitHub</span>
        </button>
      </div>
    </div>
  );
}
