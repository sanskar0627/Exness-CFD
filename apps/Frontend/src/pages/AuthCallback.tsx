import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const userId = searchParams.get("userId");
    const error = searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      setStatus("error");

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        no_code: "Authentication was cancelled or failed",
        token_failed: "Failed to verify your account",
        no_email: "Could not retrieve email from provider",
        oauth_failed: "Authentication failed. Please try again.",
      };

      setErrorMessage(errorMessages[error] || "Authentication failed");

      // Redirect to signin after showing error
      setTimeout(() => {
        navigate(`/signin?error=${error}`);
      }, 2000);
      return;
    }

    if (token && userId) {
      setStatus("success");

      // Store authentication data
      localStorage.setItem("token", token);
      localStorage.setItem("userID", userId);

      console.log("OAuth login successful, redirecting to trading...");

      // Redirect to trading page
      setTimeout(() => {
        navigate("/trading");
      }, 1000);
    } else {
      setStatus("error");
      setErrorMessage("Missing authentication data");

      setTimeout(() => {
        navigate("/signin?error=no_token");
      }, 2000);
    }
  }, [searchParams, navigate]);

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-neutral-950 font-mono">
      {/* Background Effects - Same as Signin/Signup */}
      <div className="fixed inset-0 bg-neutral-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-neutral-500/10 via-neutral-600/5 to-transparent blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-bl from-neutral-400/8 via-neutral-500/4 to-transparent blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-tr from-neutral-600/6 via-neutral-400/3 to-transparent blur-3xl"></div>

        {/* Geometric Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 border border-neutral-500/10 backdrop-blur-sm bg-neutral-500/5 animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-28 h-28 border border-neutral-400/10 backdrop-blur-sm bg-neutral-500/5 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-32 left-1/4 w-24 h-24 border border-neutral-600/10 backdrop-blur-sm bg-neutral-500/5 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(115,115,115,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(115,115,115,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full min-h-screen flex justify-center items-center p-4">
        <div className="relative w-full max-w-md">
          <div className="relative bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 shadow-2xl overflow-hidden">
            <div className="p-12 text-center">
              {status === "loading" && (
                <>
                  <div className="w-16 h-16 bg-neutral-500 flex items-center justify-center mx-auto mb-6">
                    <div className="animate-spin h-8 w-8 border-2 border-neutral-950 border-t-transparent"></div>
                  </div>
                  <h1 className="text-2xl font-bold text-neutral-50 mb-2">
                    Completing Sign In
                  </h1>
                  <p className="text-neutral-400">
                    Please wait while we verify your account...
                  </p>
                </>
              )}

              {status === "success" && (
                <>
                  <div className="w-16 h-16 bg-green-500 flex items-center justify-center mx-auto mb-6">
                    <span className="text-neutral-950 text-3xl">✓</span>
                  </div>
                  <h1 className="text-2xl font-bold text-neutral-50 mb-2">
                    Success!
                  </h1>
                  <p className="text-neutral-400">
                    Redirecting you to trading...
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <div className="w-16 h-16 bg-red-500 flex items-center justify-center mx-auto mb-6">
                    <span className="text-neutral-950 text-3xl">✕</span>
                  </div>
                  <h1 className="text-2xl font-bold text-neutral-50 mb-2">
                    Authentication Failed
                  </h1>
                  <p className="text-neutral-400 mb-4">{errorMessage}</p>
                  <p className="text-neutral-500 text-sm">
                    Redirecting to sign in...
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
