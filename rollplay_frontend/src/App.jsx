import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { GameProvider } from "./GameContext";

/* Pages */
import Splash from "./pages/Splash";
import ChooseGame from "./pages/ChooseGame";
import Countdown from "./pages/Countdown";
import Results from "./pages/Results";
import Cards from "./pages/Cards";
import Randomizer from "./pages/Randomizer";

/* Session pages */
import HostSession from "./pages/HostSession";
import JoinSession from "./pages/JoinSession";
import Lobby from "./pages/Lobby";

/* game pages */
import DiceDuel from "./pages/DiceDuel";
import QuickDraw from "./pages/QuickDraw";
// import DiceDuel from "./pages/DiceDuel";
// import DiceDuel from "./pages/DiceDuel";


export default function App() {
  const [token, setToken] = useState("eyJhbGciOiJIUzI1NiIsImtpZCI6IkNyMDh3UUZuczlZSmN6VW8iLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3FvcWl0aGJwdmh2cmxscmNwcmpoLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3ZjE3ZGUxZC1mNmM2LTRiMTUtYWQyNC03YmQ0MjIyYTRiNDgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY0MzEzMTA5LCJpYXQiOjE3NjQzMDk1MDksImVtYWlsIjoibGxzQGV4YW1wbGUuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbCI6Imxsc0BleGFtcGxlLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInN1YiI6IjdmMTdkZTFkLWY2YzYtNGIxNS1hZDI0LTdiZDQyMjJhNGI0OCJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzY0MzA5NTA5fV0sInNlc3Npb25faWQiOiI1NWE2NmMxMC1mZjJmLTQzNjMtYjFhMy01Zjk5MThjMGI2YmIiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.haAV_yYZ-7OcC4q7iCy-3OTHbMbtoqSa-wse_XqoWSY");
  const [user, setUser] = useState(null);

  // this is saket
  // useEffect(() => {
  //   const { data: authListener } = supabase.auth.onAuthStateChange(
  //     async (_event, session) => {
  //       if (session?.access_token) {
  //         setToken(session.access_token);
  //         setUser(session.user);
  //       } else {
  //         setToken(null);
  //         setUser(null);
  //       }
  //     }
  //   );

  //   // Load initial session on page refresh
  //   supabase.auth.getSession().then(({ data }) => {
  //     if (data.session) {
  //       setToken(data.session.access_token);
  //       setUser(data.session.user);
  //     }
  //   });

  //   return () => {
  //     authListener.subscription.unsubscribe();
  //   };
  // }, []);
  // this is saket

  return (
    <GameProvider>
      <Router>
        <AdminNav />

        <Routes>
          <Route path="/" element={<Splash />} />

          {/* FIXED — pass token */}

          <Route path="/choose-game" element={<ChooseGame />} />
          <Route path="/countdown" element={<Countdown />} />
          <Route path="/randomizer" element={<Randomizer />} />
          <Route path="/results" element={<Results />} />

          {/* Auth-required pages */}
          <Route path="/cards" element={<Cards token={token} />} />
          <Route path="/host-session" element={<HostSession token={token} />} />
          <Route path="/join-session" element={<JoinSession token={token} />} />
          <Route path="/lobby" element={<Lobby token={token} />} />

          {/* game pages */}
          <Route path="/dice-duel" element={<DiceDuel />} />
          <Route path="/quick-draw" element={<QuickDraw />} />
          {/* <Route path="/dice-duel" element={<DiceDuel />} /> */}
          {/* <Route path="/dice-duel" element={<DiceDuel />} /> */}
          
        </Routes>
      </Router>
    </GameProvider>
  );
}

/* ADMIN NAV */
function AdminNav() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        background: "#222",
        padding: "10px 20px",
        borderBottomLeftRadius: "12px",
        zIndex: 999,
        color: "white",
      }}
    >
      <strong>Admin Nav:</strong>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
        <Link to="/">Splash</Link>
        {/* <Link to="/home">Home</Link> */}
        <Link to="/choose-game">Choose Game</Link>
        <Link to="/countdown">Countdown</Link>
        <Link to="/randomizer">Randomizer</Link>
        <Link to="/results">Results</Link>
        <Link to="/cards">Cards</Link>
        <Link to="/host-session">Host Session</Link>
        <Link to="/join-session">Join Session</Link>
        <Link to="/lobby">Lobby</Link>
      </div>
    </div>
  );
}
