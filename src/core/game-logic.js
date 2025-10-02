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

export function calculateNextPlayer(currentPlayer) {
  return currentPlayer === "left" ? "right" : "left";
}

export function calculatePhaseTransition(currentPhase, hasEventsPending) {
  switch (currentPhase) {
    case "actions":
      return { nextPhase: "events", automatic: true };
    case "events":
      if (hasEventsPending) {
        return { nextPhase: "events", automatic: false };
      }
      return { nextPhase: "replenish", automatic: true };
    case "replenish":
      return { nextPhase: "actions", automatic: true };
    default:
      return { nextPhase: currentPhase, automatic: false };
  }
}

export function calculateReplenishWater(turnNumber) {
  // In the actual game, water might vary by turn
  // For now, always give 3 water (you can adjust this)
  return 3;
}

export function shouldCardBeReady(card) {
  if (!card || card.isDestroyed) {
    return false;
  }

  // Camps are always ready unless they used an ability
  if (card.type === "camp") {
    return true;
  }

  // People are ready only if not damaged
  if (card.type === "person") {
    return !card.isDamaged;
  }

  return false;
}

export function canUseCampAbility(camp, player, abilityCost, turnState) {
  if (!camp || camp.type !== "camp") {
    return { valid: false, reason: "Not a camp" };
  }

  if (!camp.isReady) {
    return { valid: false, reason: "Camp already used this turn" };
  }

  if (camp.isDestroyed) {
    return { valid: false, reason: "Destroyed camps cannot use abilities" };
  }

  if (player.water < abilityCost) {
    return { valid: false, reason: "Not enough water" };
  }

  // Special check for Resonator
  if (camp.name === "Resonator" && turnState.abilityUsedThisTurn) {
    return {
      valid: false,
      reason: "Resonator must be the only ability used this turn",
    };
  }

  // Check if Resonator was already used
  if (turnState.resonatorUsedThisTurn) {
    return { valid: false, reason: "Cannot use abilities after Resonator" };
  }

  return { valid: true };
}

export function calculateCampDrawCards(camps) {
  // Calculate total cards to draw based on undestroyed camps
  let totalDraw = 0;

  for (const camp of camps) {
    if (camp && !camp.isDestroyed) {
      totalDraw += camp.campDraw || 0;
    }
  }

  return totalDraw;
}

export function findAvailableWaterSilo(player) {
  if (player.waterSilo === "available") {
    return {
      available: true,
      cost: 1,
      location: "tableau",
    };
  }

  if (player.waterSilo === "in_hand") {
    return {
      available: true,
      cost: 0,
      location: "hand",
    };
  }

  return { available: false };
}

export function checkForSpecialTraits(player, traitName) {
  // Check all cards in player's tableau for a specific trait
  for (let col = 0; col < 3; col++) {
    for (let pos = 0; pos < 3; pos++) {
      const card = player.columns[col].getCard(pos);
      if (card && !card.isDamaged && !card.isDestroyed) {
        switch (traitName) {
          case "vera_vosh":
            if (card.name === "Vera Vosh") return card;
            break;
          case "karli_blaze":
            if (card.name === "Karli Blaze") return card;
            break;
          case "argo_yesky":
            if (card.name === "Argo Yesky") return card;
            break;
          case "zeto_kahn":
            if (card.name === "Zeto Kahn") return card;
            break;
        }
      }
    }
  }
  return null;
}

export function countPlayerPeople(player, includeDestroyed = false) {
  let count = 0;

  for (let col = 0; col < 3; col++) {
    for (let pos = 1; pos <= 2; pos++) {
      // Only positions 1 and 2 for people
      const card = player.columns[col].getCard(pos);
      if (card && card.type === "person") {
        if (!includeDestroyed && !card.isDestroyed) {
          count++;
        } else if (includeDestroyed) {
          count++;
        }
      }
    }
  }

  return count;
}

export function countDestroyedCamps(player) {
  let count = 0;

  for (let col = 0; col < 3; col++) {
    const camp = player.columns[col].getCard(0);
    if (camp && camp.isDestroyed) {
      count++;
    }
  }

  return count;
}

export function isGameEndingState(leftPlayer, rightPlayer) {
  // Check if either player has 3 destroyed camps
  const leftDestroyed = countDestroyedCamps(leftPlayer);
  const rightDestroyed = countDestroyedCamps(rightPlayer);

  if (leftDestroyed >= 3) {
    return { gameEnds: true, winner: "right", reason: "camps_destroyed" };
  }

  if (rightDestroyed >= 3) {
    return { gameEnds: true, winner: "left", reason: "camps_destroyed" };
  }

  return { gameEnds: false };
}

export function calculateCardDestruction(card) {
  if (!card) {
    return { shouldDestroy: false };
  }

  // Determine what happens when card is destroyed
  if (card.isPunk) {
    return {
      shouldDestroy: true,
      destination: "deck",
      returnCard: {
        id: card.id,
        name: card.originalName || card.name,
        type: card.originalCard?.type || card.type,
        cost: card.originalCard?.cost || card.cost,
        abilities: card.originalCard?.abilities || card.abilities,
        junkEffect: card.originalCard?.junkEffect || card.junkEffect,
      },
    };
  }

  // Normal cards go to discard
  return {
    shouldDestroy: true,
    destination: "discard",
    returnCard: card,
  };
}

export function calculateColumnShift(column, removedPosition) {
  // When a card is removed, what moves where?
  const moves = [];

  // Only shift if not the last position
  if (removedPosition < 2) {
    const cardInFront = column.getCard(removedPosition + 1);
    if (cardInFront) {
      moves.push({
        from: removedPosition + 1,
        to: removedPosition,
        card: cardInFront,
      });
    }
  }

  return moves;
}

export function canPlaceInSlot(column, position, cardType) {
  // Check if a card can be placed in a specific slot
  if (position === 0 && cardType !== "camp") {
    return { valid: false, reason: "Only camps in position 0" };
  }

  if (position > 0 && cardType === "camp") {
    // Exception: Juggernaut can go anywhere
    return { valid: true };
  }

  const existingCard = column.getCard(position);
  if (
    existingCard &&
    existingCard.type === "camp" &&
    existingCard.name !== "Juggernaut"
  ) {
    return { valid: false, reason: "Cannot replace a camp" };
  }

  return { valid: true };
}

export function findEmptySlots(player) {
  const emptySlots = [];

  for (let col = 0; col < 3; col++) {
    for (let pos = 0; pos < 3; pos++) {
      if (!player.columns[col].getCard(pos)) {
        emptySlots.push({
          columnIndex: col,
          position: pos,
          canPlacePerson: pos > 0,
        });
      }
    }
  }

  return emptySlots;
}

export function createPunkFromCard(card, hasKarliBlaze = false) {
  if (!card) {
    return null;
  }

  return {
    ...card,
    isPunk: true,
    isFaceDown: true,
    isReady: hasKarliBlaze, // Karli makes punks enter ready
    isDamaged: false,
    originalName: card.name,
    originalCard: { ...card },
    name: "Punk",
    abilities: [],
  };
}

export function revealPunk(punk) {
  if (!punk || !punk.isPunk) {
    return null;
  }

  return {
    id: punk.id,
    name: punk.originalName || punk.name,
    type: punk.originalCard?.type || "person",
    cost: punk.originalCard?.cost || punk.cost,
    abilities: punk.originalCard?.abilities || punk.abilities,
    junkEffect: punk.originalCard?.junkEffect || punk.junkEffect,
  };
}

export function canPlacePunk(column, position) {
  // Punks can't go in camp slot
  if (position === 0) {
    return { valid: false, reason: "Cannot place punk in camp slot" };
  }

  const existingCard = column.getCard(position);

  // Can't place on a camp (including Juggernaut)
  if (existingCard && existingCard.type === "camp") {
    return { valid: false, reason: "Cannot place punk on camp" };
  }

  return { valid: true };
}

export function calculatePunkPlacementCost(sourceType) {
  // Different sources have different costs for placing punks
  switch (sourceType) {
    case "junk": // Junk effect = free
      return 0;
    case "ability": // Ability-based = cost is in the ability
      return null; // Let ability handle it
    case "event": // Event-based = free
      return 0;
    default:
      return 0;
  }
}

export function calculateWaterChange(action, baseAmount = 0) {
  // Calculate water gained/lost for different actions
  switch (action) {
    case "draw_card":
      return -2; // Drawing costs 2 water
    case "water_silo_take":
      return -1; // Taking silo costs 1
    case "water_silo_junk":
      return 1; // Junking silo gives 1
    case "junk_water":
      return 1; // Water junk effect gives 1
    case "extra_water":
      return 1; // Muse ability gives 1
    default:
      return baseAmount;
  }
}

export function canAffordAction(player, cost) {
  return player.water >= cost;
}

export function calculateTotalWaterIncome(player) {
  // Calculate water income during replenish phase
  let total = 3; // Base income

  // Could add modifiers here for special camps or effects
  // For example, if there were a "Water Plant" camp that gives +1 water

  return total;
}

export function findWaterSources(player) {
  // Find all potential water sources for a player
  const sources = [];

  // Check for water silo
  if (player.waterSilo === "in_hand") {
    sources.push({
      type: "water_silo",
      amount: 1,
      source: "hand",
    });
  }

  // Check hand for junk effects
  player.hand.forEach((card, index) => {
    if (card.junkEffect === "water") {
      sources.push({
        type: "junk",
        amount: 1,
        source: "hand",
        cardIndex: index,
        cardName: card.name,
      });
    }
  });

  // Check for people with extra_water ability
  for (let col = 0; col < 3; col++) {
    for (let pos = 1; pos <= 2; pos++) {
      const card = player.columns[col].getCard(pos);
      if (card && !card.isDestroyed && !card.isDamaged && card.isReady) {
        const waterAbility = card.abilities?.find(
          (a) => a.effect === "extra_water"
        );
        if (waterAbility) {
          sources.push({
            type: "ability",
            amount: 1,
            cost: waterAbility.cost,
            source: "tableau",
            column: col,
            position: pos,
            cardName: card.name,
          });
        }
      }
    }
  }

  return sources;
}

export function findTargetsInColumn(player, columnIndex, targetType = "any") {
  const targets = [];
  const column = player.columns[columnIndex];

  for (let pos = 0; pos < 3; pos++) {
    const card = column.getCard(pos);
    if (card && !card.isDestroyed) {
      if (
        targetType === "any" ||
        (targetType === "person" && card.type === "person") ||
        (targetType === "camp" && card.type === "camp")
      ) {
        targets.push({
          card,
          position: pos,
          isDamaged: card.isDamaged,
        });
      }
    }
  }

  return targets;
}

export function findAllDamagedCards(player) {
  const damaged = [];

  for (let col = 0; col < 3; col++) {
    for (let pos = 0; pos < 3; pos++) {
      const card = player.columns[col].getCard(pos);
      if (card && card.isDamaged && !card.isDestroyed) {
        damaged.push({
          card,
          columnIndex: col,
          position: pos,
        });
      }
    }
  }

  return damaged;
}

export function countValidTargets(
  sourcePlayer,
  opponentPlayer,
  targetRequirements
) {
  let count = 0;
  const {
    requireEnemy = true,
    requireDamaged = false,
    requirePerson = false,
    requireCamp = false,
    allowProtected = false,
  } = targetRequirements;

  const targetPlayer = requireEnemy ? opponentPlayer : sourcePlayer;

  for (let col = 0; col < 3; col++) {
    for (let pos = 0; pos < 3; pos++) {
      const card = targetPlayer.columns[col].getCard(pos);
      if (!card || card.isDestroyed) continue;

      if (requireDamaged && !card.isDamaged) continue;
      if (requirePerson && card.type !== "person") continue;
      if (requireCamp && card.type !== "camp") continue;

      if (!allowProtected) {
        const column = targetPlayer.columns[col];
        if (column.isProtected(pos)) continue;
      }

      count++;
    }
  }

  return count;
}

export function selectBestTarget(targets, priority = "most_health") {
  if (!targets || targets.length === 0) return null;

  switch (priority) {
    case "most_health":
      // Prefer undamaged over damaged
      const undamaged = targets.filter((t) => !t.card.isDamaged);
      return undamaged.length > 0 ? undamaged[0] : targets[0];

    case "most_damaged":
      // Prefer damaged over undamaged
      const damaged = targets.filter((t) => t.card.isDamaged);
      return damaged.length > 0 ? damaged[0] : targets[0];

    case "camps_first":
      // Prefer camps over people
      const camps = targets.filter((t) => t.card.type === "camp");
      return camps.length > 0 ? camps[0] : targets[0];

    case "people_first":
      // Prefer people over camps
      const people = targets.filter((t) => t.card.type === "person");
      return people.length > 0 ? people[0] : targets[0];

    default:
      return targets[0];
  }
}

export function getEntryTraits(card) {
  // Return what entry traits a card has
  const traits = [];

  switch (card.name) {
    case "Repair Bot":
      traits.push({ type: "restore", optional: true });
      break;
    case "Vanguard":
      traits.push({ type: "gain_punk", automatic: true });
      break;
    case "Argo Yesky":
      traits.push({ type: "gain_punk", automatic: true });
      break;
  }

  return traits;
}

export function shouldTriggerEntryTrait(card, gameContext) {
  if (!card || card.isDestroyed || card.isDamaged) {
    return false;
  }

  const traits = getEntryTraits(card);
  return traits.length > 0;
}

export function canResolveEntryTrait(trait, player) {
  switch (trait.type) {
    case "restore":
      // Need damaged cards to restore
      return true; // Let the actual handler check for targets
    case "gain_punk":
      // Need cards in deck
      return true; // Let handler check deck
    default:
      return true;
  }
}
