// game-logic.js
// Pure functions for game logic calculations

export function calculateCardCost(card, columnIndex, player) {
  let cost = card.cost || 0;

  if (!player || !player.columns || !player.columns[columnIndex]) {
    return cost;
  }

  const column = player.columns[columnIndex];
  const camp = column.getCard(0);

  // Holdout discount
  if (card.name === "Holdout" && camp?.isDestroyed) {
    cost = 0;
  }

  // Oasis discount
  if (camp?.name === "Oasis" && !camp.isDestroyed) {
    const peopleCount = [1, 2].filter((pos) => column.getCard(pos)).length;
    if (peopleCount === 0) {
      cost = Math.max(0, cost - 1);
    }
  }

  return cost;
}
