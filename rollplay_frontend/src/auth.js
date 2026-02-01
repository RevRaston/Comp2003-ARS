import { supabase } from "./supabase";

export async function anonSignIn() {
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) throw error;

  // Save the user ID locally
  localStorage.setItem("user_id", data.user.id);

  return data.user;
}
