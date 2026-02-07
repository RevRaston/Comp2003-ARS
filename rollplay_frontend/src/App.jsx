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
import TopRace from "./pages/TopRace";
import TipToss from "./pages/TipToss";
// import TipToss from "./pages/TipToss";


export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.access_token) {
          setToken(session.access_token);
          setUser(session.user);
        } else {
          setToken(null);
          setUser(null);
        }
      }
    );

    // Load initial session on page refresh
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setToken(data.session.access_token);
        setUser(data.session.user);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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
          <Route path="/top-race" element={<TopRace />} />
          <Route path="/tip-toss" element={<TipToss />} />
          {/* <Route path="/tip-toss" element={<TipToss />} /> */}
          
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
