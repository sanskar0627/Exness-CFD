import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyEmailCode, resendVerificationCode } from "../api/trade";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const email = localStorage.getItem("pendingEmail") || "";

  useEffect(() => {
    if (!email) {
      navigate("/signin");
      return;
    }
    inputsRef.current[0]?.focus();
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitCode = async (code: string) => {
    setLoading(true);
    setError("");
    const data = await verifyEmailCode(email, code);
    setLoading(false);
    if (data.message && !data.error) {
      localStorage.removeItem("pendingEmail");
      navigate("/trading");
    } else {
      setError(data.error || "Verification failed");
      setDigits(["", "", "", ""]);
      inputsRef.current[0]?.focus();
    }
  };

  const handleChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    setError("");
    if (v && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
    const code = next.join("");
    if (code.length === 4 && next.every((d) => d !== "")) {
      submitCode(code);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setDigits(pasted.split(""));
      submitCode(pasted);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setInfo("");
    const data = await resendVerificationCode(email);
    setResending(false);
    if (data.message && !data.error) {
      setInfo("New code sent. Check your inbox (and spam folder).");
      setCooldown(30);
    } else {
      setError(data.error || "Failed to resend code");
    }
  };

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-neutral-950 font-mono">
      <div className="fixed inset-0 bg-neutral-950">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-neutral-500/10 via-neutral-600/5 to-transparent blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(115,115,115,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(115,115,115,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      <div className="relative z-10 w-full min-h-screen flex justify-center items-center p-4">
        <div className="relative w-full max-w-md">
          <div className="relative bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 shadow-2xl overflow-hidden rounded-lg">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4 rounded-lg">
                <span className="text-green-400 text-2xl">✉</span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-50 mb-2">
                Verify your email
              </h1>
              <p className="text-neutral-400 text-sm">
                We sent a 4-digit code to
              </p>
              <p className="text-neutral-50 text-sm font-medium mt-1">{email}</p>
            </div>

            <div className="px-8 pb-8 space-y-6">
              <div className="flex justify-center gap-3" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    disabled={loading}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-14 h-16 text-center text-2xl font-bold bg-neutral-800/60 border border-neutral-600 rounded-md text-neutral-50 focus:border-green-500/60 focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {loading && (
                <p className="text-center text-sm text-neutral-400">Verifying...</p>
              )}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm text-center">
                  {error}
                </div>
              )}
              {info && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-md text-green-400 text-sm text-center">
                  {info}
                </div>
              )}

              <div className="text-center space-y-3">
                <button
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="text-sm text-neutral-300 hover:text-neutral-50 transition-colors disabled:opacity-50"
                >
                  {resending
                    ? "Sending..."
                    : cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : "Resend code"}
                </button>
                <p className="text-neutral-500 text-xs">
                  Wrong account?{" "}
                  <button
                    onClick={() => {
                      localStorage.removeItem("token");
                      localStorage.removeItem("userID");
                      localStorage.removeItem("pendingEmail");
                      navigate("/signup");
                    }}
                    className="text-neutral-300 hover:text-neutral-50 transition-colors"
                  >
                    Start over
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
