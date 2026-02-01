// src/pages/Splash.jsx
import { Link } from "react-router-dom";

export default function Splash() {
  return (
    <div className="splash-page" style={outerStyle}>
      <div style={overlayStyle}>
        <h1 style={titleStyle}>RollPlay</h1>
        <p style={subtitleStyle}>
          Turn splitting the bill into a game.  
          Pick the rule, play the rounds, let the leaderboard decide who pays.
        </p>

        <div style={buttonRowStyle}>
          {/* HOST */}
          <Link to="/host-session" style={{ textDecoration: "none" }}>
            <button style={{ ...btnStyle, ...primaryBtn }}>
              Host Game
            </button>
          </Link>

          {/* JOIN */}
          <Link to="/join-session" style={{ textDecoration: "none" }}>
            <button style={{ ...btnStyle, ...secondaryBtn }}>
              Join Game
            </button>
          </Link>
        </div>

        <p style={smallTextStyle}>
          Use your existing account. Once everyone’s in the lobby,  
          the host starts the session.
        </p>
      </div>
    </div>
  );
}

/* --- inline styles --- */

const outerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundImage: "url(/beer-bubbles-bg.png)", // keep whatever you had
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const overlayStyle = {
  background: "rgba(0, 0, 0, 0.5)",
  borderRadius: "24px",
  padding: "40px 32px",
  maxWidth: "520px",
  width: "90%",
  textAlign: "center",
  color: "#fff",
};

const titleStyle = {
  fontSize: "52px",
  margin: "0 0 10px",
};

const subtitleStyle = {
  fontSize: "18px",
  margin: "0 0 30px",
  lineHeight: 1.4,
};

const buttonRowStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "16px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const btnStyle = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 26px",
  fontSize: "18px",
  cursor: "pointer",
  fontWeight: 600,
  minWidth: "160px",
};

const primaryBtn = {
  background: "#ffcc33",
  color: "#222",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
};

const secondaryBtn = {
  background: "#333",
  color: "#fff",
  border: "1px solid #999",
};

const smallTextStyle = {
  fontSize: "14px",
  opacity: 0.85,
  marginTop: "6px",
};
