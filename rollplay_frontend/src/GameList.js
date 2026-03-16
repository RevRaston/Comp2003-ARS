// src/GameList.js

export const GAME_PACKS = [
  {
    id: "bar",
    name: "Bar Games",
    description: "Quick, loud, competitive games for drinks and pub nights.",
    accent: "#f4c431",
  },
  {
    id: "restaurant",
    name: "Restaurant Games",
    description: "Short table-friendly games for meals and casual challenges.",
    accent: "#ff8a5b",
  },
  {
    id: "board",
    name: "Board Games",
    description: "Slightly longer tactical or movement-based games.",
    accent: "#7aa2ff",
  },
];

export const GAME_CATALOGUE = [
  {
    id: "sumo",
    name: "Sumo",
    pack: "bar",
    thumb: "/thumbs/sumo.png",
    description: "Push opponents out of the ring before time runs out.",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Easy",
    duration: "30–60 sec",
    energy: "High",
    typeLabel: "Arcade",
  },
  {
    id: "darts",
    name: "Darts",
    pack: "bar",
    thumb: "/thumbs/darts.png",
    description: "Aim, fire, and score as highly as possible.",
    minPlayers: 2,
    maxPlayers: 6,
    difficulty: "Easy",
    duration: "45–90 sec",
    energy: "Medium",
    typeLabel: "Precision",
  },
  {
    id: "guessing_card",
    name: "Guessing Card",
    pack: "restaurant",
    thumb: "/thumbs/guessing_card.png",
    description: "Lock in a card value closest to the final reveal.",
    minPlayers: 2,
    maxPlayers: 8,
    difficulty: "Medium",
    duration: "1–2 min",
    energy: "Low",
    typeLabel: "Mind Game",
  },
  {
    id: "maze",
    name: "Maze",
    pack: "board",
    thumb: "/thumbs/maze.png",
    description: "Navigate the maze and reach the centre first.",
    minPlayers: 2,
    maxPlayers: 4,
    difficulty: "Medium",
    duration: "1–3 min",
    energy: "Medium",
    typeLabel: "Tactical",
  },
];

// helpers
export const PACK_LOOKUP = Object.fromEntries(
  GAME_PACKS.map((pack) => [pack.id, pack])
);

export const GAME_LIST = GAME_CATALOGUE.map((g) => ({
  id: g.id,
  name: g.name,
}));