// Flexible column system that doesn't care about card types
export class Column {
  constructor(index) {
    this.index = index;
    this.slots = [null, null, null]; // 0=back, 1=middle, 2=front
  }

  getCard(position) {
    return this.slots[position];
  }

  setCard(position, card) {
    this.slots[position] = card;
    if (card) {
      card.position = position;
      card.columnIndex = this.index;
    }
  }

  moveCard(fromPos, toPos) {
    const movingCard = this.slots[fromPos];
    const targetCard = this.slots[toPos];

    if (!movingCard) return false;

    // Handle Juggernaut's special movement rules
    if (movingCard.name === "Juggernaut") {
      return this.moveJuggernaut(fromPos, toPos);
    }

    // Normal swap
    this.slots[fromPos] = targetCard;
    this.slots[toPos] = movingCard;

    if (targetCard) targetCard.position = fromPos;
    if (movingCard) movingCard.position = toPos;

    return true;
  }

  moveJuggernaut(fromPos, toPos) {
    const juggernaut = this.slots[fromPos];
    const displaced = this.slots[toPos];

    // Simple swap - Juggernaut goes to new position, displaced card (if any) goes to old position
    this.slots[toPos] = juggernaut;
    this.slots[fromPos] = displaced; // This might be null, which is fine

    // Update position properties
    juggernaut.position = toPos;
    if (displaced) {
      displaced.position = fromPos;
      console.log(
        `${displaced.name} displaced from position ${toPos} to position ${fromPos}`
      );
    }

    // Increment Juggernaut's move counter
    juggernaut.moveCount = (juggernaut.moveCount || 0) + 1;
    console.log(`Juggernaut move count: ${juggernaut.moveCount}`);

    // Check for third move effect
    if (juggernaut.moveCount === 3) {
      juggernaut.moveCount = 0;
      return { triggerEffect: true };
    }

    return true;
  }

  canPlaceCard(position, card) {
    // Simply check if position is empty
    return this.slots[position] === null;
  }

  isProtected(position) {
    // Check if card at position is protected
    if (position === 0) {
      // Camps are protected if there's anyone in front
      return this.slots[1] !== null || this.slots[2] !== null;
    } else {
      // People are protected if there's someone in front
      return position === 1 && this.slots[2] !== null;
    }
  }

  getUnprotectedTargets() {
    const targets = [];

    // Check each position from front to back
    for (let i = 2; i >= 0; i--) {
      const card = this.slots[i];
      if (card && !card.isDestroyed) {
        if (!this.isProtected(i)) {
          targets.push({ card, position: i });
        }
      }
    }

    return targets;
  }
}
