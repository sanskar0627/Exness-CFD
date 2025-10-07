import { useNavigate } from "react-router-dom";
import { submitsignin } from "../api/trade";
import { useEffect, useState } from "react";

export default function Signin() {
  const [error, setError] = useState("");
  const [submitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, [navigate]);

  const handlesubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitted(true);
    setIsLoading(true);
    e.preventDefault();
    const formdata = new FormData(e.currentTarget);
    const email = formdata.get("mail");
    const pass = formdata.get("pass");

    if (!email || !pass) {
      setIsLoading(false);
      setIsSubmitted(false);
      return;
    }

    try {
      const data = await submitsignin(email as string, pass as string);

      if (data.token) {
        // Store both token and user info
        localStorage.setItem("token", data.token);
        if (data.user?.id) {
          localStorage.setItem("userID", data.user.id);
        }
        navigate("/trading");
        setIsSubmitted(false);
        setIsLoading(false);
      } else {
        setIsSubmitted(false);
        setIsLoading(false);
        setError(data.message || "Login failed");
      }
    } catch (error) {
      setIsSubmitted(false);
      setIsLoading(false);
      setError("An error occurred during login");
    }
  };

  const handleclick = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userID");
    navigate("/signup");
  };

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-neutral-950 font-mono">
      {/* Background Effects */}
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

      <div className="relative z-10 w-full min-h-screen flex justify-center items-center p-4">
        <div className="relative w-full max-w-md">
          <div className="relative bg-neutral-900/80 backdrop-blur-xl border border-neutral-600 shadow-2xl overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-neutral-500 flex items-center justify-center mx-auto mb-4">
                <span className="text-neutral-50 text-2xl font-bold">→</span>
              </div>
              <h1 className="text-3xl font-bold text-neutral-50 mb-2">
                Welcome Back
              </h1>
              <p className="text-neutral-300">Sign in to continue trading</p>
            </div>

            <div className="px-8 pb-8 space-y-6">
              <form onSubmit={handlesubmit}>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <span className="text-neutral-400 group-focus-within:text-neutral-50 transition-colors duration-300">
                    @
                  </span>
                </div>
                <input
                  type="email"
                  name="mail"
                  placeholder="Email"
                  className="w-full pl-10 pr-4 py-3 bg-neutral-950/50 border border-neutral-600 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-500 focus:bg-neutral-800/50 transition-all duration-300"
                />
              </div>

                <div className="relative group">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <span className="text-neutral-400 group-focus-within:text-neutral-50 transition-colors duration-300">
                      🔒
                    </span>
                  </div>
                  <input
                    type="password"
                    name="pass"
                    placeholder="Enter Password"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/50 border border-neutral-600 text-neutral-50 placeholder-neutral-400 focus:outline-none focus:border-neutral-500 focus:bg-neutral-800/50 transition-all duration-300"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitted}
                  className="w-full py-3 bg-neutral-50 text-neutral-950 font-semibold hover:bg-neutral-200 transform transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-5 w-5 border-b-2 border-neutral-950 mr-2"></div>
                      Signing In...
                    </div>
                  ) : (
                    <>
                      <span className="mr-2">→</span>
                      Sign In
                    </>
                  )}
                </button>
              </form>
              <div className="text-center">
                <p className="text-neutral-400 text-sm">
                  Don't have an account?{" "}
                  <button
                    onClick={handleclick}
                    className="text-neutral-50 hover:text-neutral-300 font-medium transition-colors duration-300"
                  >
                    Sign Up
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
