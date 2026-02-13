// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { GameProvider, useGame } from "./GameContext";
import "./App.css";

/* Pages */
import Splash from "./pages/Splash";
import LevelSelect from "./pages/LevelSelect";
import Countdown from "./pages/Countdown";
import Results from "./pages/Results";
import Cards from "./pages/Cards";
import Randomizer from "./pages/Randomizer";
import RandomWheel from "./pages/RandomWheel";
import Login from "./pages/Login";
import GameRunner from "./pages/GameRunner";
import Profile from "./pages/Profile";

/* Session pages */
import HostSession from "./pages/HostSession";
import JoinSession from "./pages/JoinSession";
import Lobby from "./pages/Lobby";

/* Arena (new shared game stage) */
import Arena from "./pages/Arena";

/* Visual transition */
import PageTransition from "./components/PageTransition";

if (!localStorage.getItem("player_id")) {
  localStorage.setItem("player_id", crypto.randomUUID());
}

/**
 * Inner app that has access to the router (so we can use useLocation).
 * This is wrapped by <GameProvider> and <Router> in the root App component.
 */
function AppInner({ token }) {
  const location = useLocation();

  return (
    <>
      {/* Admin-only debug nav */}
      <AdminNav />

      {/* Beer bubble curtain between route changes */}
      <PageTransition path={location.pathname} />

      <Routes location={location}>
        <Route path="/" element={<Splash />} />

        {/* Main flow */}
        <Route path="/choose-game" element={<LevelSelect />} />
        <Route path="/countdown" element={<Countdown />} />
        <Route path="/results" element={<Results />} />

        {/* Game runner (legacy per-game route) */}
        <Route path="/game/:gameId" element={<GameRunner />} />

        {/* New shared arena */}
        <Route path="/arena" element={<Arena />} />

        {/* Debug / tools */}
        <Route path="/randomizer" element={<Randomizer />} />
        <Route
          path="/random-wheel"
          element={<RandomWheel token={token} />}
        />

        {/* Auth / profile */}
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />

        {/* Session pages */}
        <Route path="/cards" element={<Cards token={token} />} />
        <Route
          path="/host-session"
          element={<HostSession token={token} />}
        />
        <Route
          path="/join-session"
          element={<JoinSession token={token} />}
        />
        <Route path="/lobby" element={<Lobby token={token} />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.access_token) {
          setToken(session.access_token);
          setUser(session.user);

          // store user_id so backend knows who is host/player
          if (session.user?.id) {
            localStorage.setItem("user_id", session.user.id);
          }
        } else {
          setToken(null);
          setUser(null);
          localStorage.removeItem("user_id");
        }
      }
    );

    // Load initial session on refresh
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setToken(data.session.access_token);
        setUser(data.session.user);

        if (data.session.user?.id) {
          localStorage.setItem("user_id", data.session.user.id);
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <GameProvider>
      <Router>
        <AppInner token={token} />
      </Router>
    </GameProvider>
  );
}

/* ADMIN NAV */
function AdminNav() {
  const { profile } = useGame();

  // Only show to admins
  if (!profile?.isAdmin) {
    return null;
  }

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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "8px",
        }}
      >
        <Link to="/">Splash</Link>
        <Link to="/choose-game">Level Select</Link>
        <Link to="/countdown">Countdown</Link>
        <Link to="/randomizer">Randomizer</Link>
        <Link to="/results">Results</Link>
        <Link to="/cards">Cards</Link>
        <Link to="/host-session">Host Session</Link>
        <Link to="/join-session">Join Session</Link>
        <Link to="/lobby">Lobby</Link>
        <Link to="/arena">Arena</Link>
      </div>
    </div>
  );
}
