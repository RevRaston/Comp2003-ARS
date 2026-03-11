// src/GameList.js

export const GAME_PACKS = [
  {
    id: "bar",
    name: "Bar Games",
    description: "Quick, loud, competitive games for drinks and pub nights.",
  },
  {
    id: "restaurant",
    name: "Restaurant Games",
    description: "Short table-friendly games for meals and casual challenges.",
  },
  {
    id: "board",
    name: "Board Games",
    description: "Slightly longer tactical or movement-based games.",
  },
];

export const GAME_CATALOGUE = [
  {
    id: "sumo",
    name: "Sumo",
    pack: "bar",
    thumb: "/thumbs/sumo.png",
    description: "Push opponents out of the ring before time runs out.",
  },
  {
    id: "darts",
    name: "Darts",
    pack: "bar",
    thumb: "/thumbs/darts.png",
    description: "Aim, fire, and score as highly as possible.",
  },
  {
    id: "guessing_card",
    name: "Guessing Card",
    pack: "restaurant",
    thumb: "/thumbs/guessing_card.png",
    description: "Lock in a card value closest to the final reveal.",
  },
  {
    id: "maze",
    name: "Maze",
    pack: "board",
    thumb: "/thumbs/maze.png",
    description: "Navigate the maze and reach the centre first.",
  },
];

// keep backwards compatibility for older imports
export const GAME_LIST = GAME_CATALOGUE.map((g) => ({
  id: g.id,
  name: g.name,
}));