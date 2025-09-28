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

export function canPlayEvent(player, eventCost, eventQueue) {
  if (player.water < eventCost) {
    return { valid: false, reason: "Not enough water for event" };
  }

  // Check if event queue is full (all 3 slots occupied)
  const fullSlots = eventQueue.filter((e) => e !== null).length;
  if (fullSlots === 3) {
    return { valid: false, reason: "Event queue is full" };
  }

  return { valid: true };
}

export function calculateDamageResult(target, isAlreadyDamaged) {
  if (!target) {
    return { result: "invalid", reason: "No target" };
  }

  // Punks or already damaged cards are destroyed
  if (target.isPunk || isAlreadyDamaged) {
    return { result: "destroy", wasDestroyed: true };
  }

  // First damage just damages the card
  return { result: "damage", wasDestroyed: false };
}

export function calculatePlacementOptions(column, targetPosition, newCard) {
  // Can't place if position is camp slot and card isn't a camp
  if (targetPosition === 0 && newCard.type !== "camp") {
    return { canPlace: false, reason: "Cannot place person in camp slot" };
  }

  const existingCard = column.getCard(targetPosition);

  // Empty slot - easy placement
  if (!existingCard) {
    return {
      canPlace: true,
      action: "place",
      targetPosition,
    };
  }

  // Slot occupied - check if we can push
  // Check for Juggernaut (special camp that can be anywhere)
  let juggernautPos = -1;
  for (let i = 0; i < 3; i++) {
    const card = column.getCard(i);
    if (card?.name === "Juggernaut") {
      juggernautPos = i;
      break;
    }
  }

  if (juggernautPos === -1) {
    // No Juggernaut - normal push rules
    if (targetPosition < 2 && !column.getCard(targetPosition + 1)) {
      return {
        canPlace: true,
        action: "push",
        pushFrom: targetPosition,
        pushTo: targetPosition + 1,
      };
    }
  } else {
    // Juggernaut present - special push rules
    const positions = [0, 1, 2].filter((p) => p !== juggernautPos);
    const otherPosition = positions.find((p) => p !== targetPosition);

    if (otherPosition !== undefined && !column.getCard(otherPosition)) {
      return {
        canPlace: true,
        action: "push",
        pushFrom: targetPosition,
        pushTo: otherPosition,
      };
    }
  }

  return { canPlace: false, reason: "No room to place card" };
}
