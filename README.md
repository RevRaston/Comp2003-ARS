Rollpay — COMP2003 Group Project

A multiplayer “play-to-split-payments” web platform where players join a session, play a quick mini-game, and automatically split a bill based on ranking.

Built with:

React (Vite) — frontend UI

Express.js (Node) — backend API

Supabase — authentication, sessions, realtime lobby, database

Postgres (RLS) — secure card + session storage
Features
✔ Authentication

Powered by Supabase Auth (email + password sign-in).

✔ Session Hosting

Hosts create a session with a unique 6-character code.

✔ Lobby System

Players join using the session code and appear in lobby in real time.

✔ Randomizer Game

A placeholder game shuffles players, assigns ranking, and calculates split.

✔ Card Storage

Users can store card placeholders (non-real cards for development only).
