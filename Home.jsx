import { supabase } from "../supabase";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  //
  // 🔵 QUICK SIGN-UP (creates the admin account ONCE)
  //
  async function quickSignup() {
    console.log("Creating admin test account...");

    const { data, error } = await supabase.auth.signUp({
      email: "test@rollpay.com",
      password: "test1234",
    });

    if (error) {
      console.error("Signup failed:", error.message);
      alert("Signup failed: " + error.message);
    } else {
      console.log("Created account:", data);
      alert("Admin account created! Now press Quick Login.");
    }
  }

  //
  // 🔵 QUICK LOGIN (logs in AFTER the account exists)
  //
  async function quickLogin() {
    console.log("Attempting quick login...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: "test@rollpay.com",
      password: "test1234",
    });

    if (error) {
      console.error("Login failed:", error.message);
      alert("Login failed: " + error.message);
      return;
    }

    console.log("Logged in as:", data.user.email);
    alert("Logged in as: " + data.user.email);

    navigate("/home");
  }

  return (
    <div style={{ paddingTop: 80 }}>
      <h1>Welcome to Rollpay</h1>

      <button onClick={quickSignup}>Quick Signup (first time only)</button>
      <br /><br />

      <button onClick={quickLogin}>Quick Login</button>

      <br /><br />
      <a href="/join">Join</a>
      <br />
      <a href="/host">Host</a>
    </div>
  );
}
