import { GameState } from "./core/game-state.js";
import { GameUI } from "./ui/game-ui.js";
import { CommandSystem } from "./core/command-system.js";
import "./styles/main.css";

// Initialize game
const gameState = new GameState();
const commandSystem = new CommandSystem(gameState);
const ui = new GameUI(commandSystem);

// Make available globally for debugging
window.game = {
  state: gameState,
  commands: commandSystem,
  ui: ui,
};

// Start the game
ui.init();
