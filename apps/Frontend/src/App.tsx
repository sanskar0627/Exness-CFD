import { Route } from "react-router";
import { BrowserRouter, Routes } from "react-router";
import Signin from "./pages/Singin";
import Signup from "./pages/Signup";
import Trading from "./pages/Trading";
import AuthCallback from "./pages/AuthCallback";
import "aos/dist/aos.css";
import ExnessLanding from "./pages/Homepage";

function App() {
  return (
    <div className="min-h-screen bg-[#0c1418] text-white">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ExnessLanding />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
