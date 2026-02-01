// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./global.css";
import App from "./App.jsx";

// --- ADD THIS BLOCK: Assign unique ID to each browser instance ---
if (!localStorage.getItem("user_id")) {
  localStorage.setItem("user_id", crypto.randomUUID());
}
// -----------------------------------------------------------------

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

