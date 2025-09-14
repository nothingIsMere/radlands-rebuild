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

    // Special case: wrapping from position 2 back to position 0
    if (fromPos === 2 && toPos === 0) {
      // Everyone shifts forward to make room
      const cardAt0 = this.slots[0];
      const cardAt1 = this.slots[1];

      // Move everyone forward
      this.slots[0] = juggernaut;
      this.slots[1] = cardAt0;
      this.slots[2] = cardAt1;

      // Update positions
      juggernaut.position = 0;
      if (cardAt0) {
        cardAt0.position = 1;
        console.log(
          `${cardAt0.name} pushed forward from position 0 to position 1`
        );
      }
      if (cardAt1) {
        cardAt1.position = 2;
        console.log(
          `${cardAt1.name} pushed forward from position 1 to position 2`
        );
      }
    } else {
      // Normal forward movement (0→1 or 1→2)
      // Find the nearest card in front of Juggernaut
      let nearestCard = null;
      let nearestPos = -1;

      // Check positions in front of Juggernaut
      for (let pos = fromPos + 1; pos <= 2; pos++) {
        if (this.slots[pos]) {
          nearestCard = this.slots[pos];
          nearestPos = pos;
          break; // Found the nearest one
        }
      }

      // Clear the original positions
      this.slots[fromPos] = null;
      if (nearestPos !== -1) {
        this.slots[nearestPos] = null;
      }

      // Place Juggernaut in new position
      this.slots[toPos] = juggernaut;
      juggernaut.position = toPos;

      // Place the nearest card (if any) where Juggernaut came from
      if (nearestCard) {
        this.slots[fromPos] = nearestCard;
        nearestCard.position = fromPos;
        console.log(
          `${nearestCard.name} moved from position ${nearestPos} to position ${fromPos}`
        );
      }
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
