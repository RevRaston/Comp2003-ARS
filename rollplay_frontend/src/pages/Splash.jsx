// src/pages/Splash.jsx
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";

export default function Splash() {
  const navigate = useNavigate();
  const { profile, canHost } = useGame();

  const loggedIn = !!profile;

  function handleHostClick() {
    if (!loggedIn) {
      navigate("/login?mode=host");
      return;
    }

    if (!canHost) {
      navigate("/profile"); // go upgrade
      return;
    }

    navigate("/host-session");
  }

  function handleJoinClick() {
    if (!loggedIn) {
      navigate("/login?mode=player");
      return;
    }
    navigate("/join-session");
  }

  const hostLabel = !loggedIn
    ? "Sign in to Host"
    : canHost
    ? "Host Game"
    : "Upgrade to Host";

  const hostDisabledStyle = !canHost && loggedIn;

  return (
    <div className="splash-page" style={outerStyle}>
      <div style={overlayStyle}>
        <h1 style={titleStyle}>RollPlay</h1>
        <p style={subtitleStyle}>
          Turn splitting the bill into a game.
          <br />
          Pick the rule, play the rounds, let the leaderboard decide who pays.
        </p>

        <div style={buttonRowStyle}>
          <button
            onClick={handleHostClick}
            style={{
              ...btnStyle,
              ...(hostDisabledStyle ? disabledBtn : primaryBtn),
            }}
          >
            {hostLabel}
          </button>

          <button
            onClick={handleJoinClick}
            style={{ ...btnStyle, ...secondaryBtn }}
          >
            Join Game
          </button>
        </div>

        {!canHost && loggedIn && (
          <p style={smallTextStyle}>
            You currently have a <strong>Player</strong> account.
            Tap “Upgrade to Host” to unlock hosting.
          </p>
        )}

        {!loggedIn && (
          <p style={smallTextStyle}>
            Hosting requires an account. Joining friends is always free.
          </p>
        )}
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
  backgroundImage: "url(/beer-bubbles-bg.png)",
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
  minWidth: "180px",
};

const primaryBtn = {
  background: "#ffcc33",
  color: "#222",
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
};

const disabledBtn = {
  background: "#444",
  color: "#aaa",
  cursor: "pointer", // still clickable, just looks disabled-ish
};

const secondaryBtn = {
  background: "#333",
  color: "#fff",
  border: "1px solid #999",
};

const smallTextStyle = {
  fontSize: "14px",
  opacity: 0.9,
  marginTop: "10px",
};
