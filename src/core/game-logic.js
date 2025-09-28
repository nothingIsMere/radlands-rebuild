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

export function canPlayPerson(player, card, cost, targetPosition) {
  // Basic validation
  if (!player || !card) {
    return { valid: false, reason: "Invalid player or card" };
  }

  if (card.type !== "person") {
    return { valid: false, reason: "Card is not a person" };
  }

  if (player.water < cost) {
    return { valid: false, reason: "Not enough water" };
  }

  if (targetPosition === 0) {
    return { valid: false, reason: "Cannot play person in camp slot" };
  }

  return { valid: true };
}

export function canUseAbility(card, player, abilityCost) {
  // Basic checks
  if (!card || !card.isReady) {
    return { valid: false, reason: "Card not ready" };
  }

  if (card.isDestroyed) {
    return { valid: false, reason: "Card is destroyed" };
  }

  // Person-specific checks
  if (card.type === "person" && card.isDamaged) {
    return { valid: false, reason: "Person is damaged" };
  }

  // Cost check
  if (player.water < abilityCost) {
    return { valid: false, reason: "Not enough water" };
  }

  return { valid: true };
}
