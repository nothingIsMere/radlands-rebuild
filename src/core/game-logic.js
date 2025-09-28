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

export function calculateEventSlotPlacement(eventQueue, desiredSlot) {
  // Check if desired slot is available
  if (!eventQueue[desiredSlot]) {
    return {
      canPlace: true,
      slot: desiredSlot,
    };
  }

  // Desired slot occupied, find next available
  for (let i = desiredSlot + 1; i < 3; i++) {
    if (!eventQueue[i]) {
      return {
        canPlace: true,
        slot: i,
      };
    }
  }

  // No slots available
  return {
    canPlace: false,
    reason: "Event queue is full",
  };
}

export function shouldEventResolveImmediately(
  queueNumber,
  isFirstEventOfTurn,
  hasZetoKahn
) {
  // Instant events (queue 0) always resolve immediately
  if (queueNumber === 0) {
    return true;
  }

  // Zeto Kahn makes first event of turn instant
  if (isFirstEventOfTurn && hasZetoKahn) {
    return true;
  }

  return false;
}

export function shouldTriggerObelisk(deckSize, exhaustionCount, players) {
  // Deck must be empty (we're checking at the moment of exhaustion)
  if (deckSize !== 0) {
    return { trigger: false };
  }

  // This should be the FIRST exhaustion (count = 0 since we check before incrementing)
  if (exhaustionCount !== 0) {
    return { trigger: false };
  }

  // Check for Obelisk owner
  for (const playerId of ["left", "right"]) {
    const player = players[playerId];
    for (let col = 0; col < 3; col++) {
      const camp = player.columns[col].getCard(0);
      if (camp && camp.name.toLowerCase() === "obelisk" && !camp.isDestroyed) {
        return {
          trigger: true,
          winner: playerId,
          reason: "obelisk",
        };
      }
    }
  }

  return { trigger: false };
}

export function calculateExhaustionResult(
  deckSize,
  discardSize,
  exhaustionCount
) {
  if (deckSize > 0) {
    return { exhausted: false };
  }

  // Deck is empty - this is an exhaustion event
  // Check exhaustion count BEFORE incrementing it
  if (exhaustionCount >= 1) {
    // Already had one exhaustion, this is the second
    return {
      exhausted: true,
      gameEnds: true,
      result: "draw",
      reason: "deck_exhausted_twice",
    };
  }

  // This is the FIRST exhaustion
  // Check if we can reshuffle
  if (discardSize > 0) {
    return {
      exhausted: true,
      gameEnds: false,
      shouldReshuffle: true,
      isFirstExhaustion: true,
    };
  }

  // No cards to reshuffle even on first exhaustion
  return {
    exhausted: true,
    gameEnds: true,
    result: "draw",
    reason: "no_cards_available",
  };
}

export function calculateRaidPlacement(eventQueue, raidersState) {
  // Raiders can't be placed if already in queue or used
  if (raidersState !== "available") {
    return {
      canPlace: false,
      reason: `Raiders ${
        raidersState === "in_queue" ? "already in queue" : "already used"
      }`,
    };
  }

  // Raiders wants slot 2 (index 1)
  const desiredSlot = 1;

  // Find first available slot at or after desired position
  for (let i = desiredSlot; i < 3; i++) {
    if (!eventQueue[i]) {
      return {
        canPlace: true,
        slot: i,
      };
    }
  }

  return {
    canPlace: false,
    reason: "Event queue is full",
  };
}

export function shouldRaidersResolve(eventQueue, raidersState) {
  if (raidersState !== "in_queue") {
    return { shouldResolve: false };
  }

  // Check if Raiders is in slot 1 (index 0)
  return {
    shouldResolve: eventQueue[0]?.isRaiders === true,
    isInQueue: true,
  };
}

export function canJunkCard(player, cardIndex, currentPhase) {
  // Basic validation
  if (currentPhase !== "actions") {
    return { valid: false, reason: "Can only junk during actions phase" };
  }

  if (!player.hand[cardIndex]) {
    return { valid: false, reason: "Card not found" };
  }

  return { valid: true };
}
