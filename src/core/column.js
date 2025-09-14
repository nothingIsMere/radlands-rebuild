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

    // Juggernaut moves forward, others shift back
    this.slots[toPos] = juggernaut;
    juggernaut.position = toPos;

    if (displaced) {
      // Find the empty slot or push to back
      if (fromPos === 0 && toPos === 1) {
        // Moving from back to middle
        this.slots[0] = displaced;
        displaced.position = 0;
      } else if (fromPos === 1 && toPos === 2) {
        // Moving from middle to front
        this.slots[1] = displaced;
        displaced.position = 1;
      } else if (fromPos === 2 && toPos === 0) {
        // Wrapping from front to back
        // Shift everyone forward
        const middle = this.slots[1];
        if (displaced) {
          this.slots[1] = displaced;
          displaced.position = 1;
        }
        if (middle) {
          this.slots[2] = middle;
          middle.position = 2;
        }
      }
    }

    this.slots[fromPos] = null;

    // Increment Juggernaut's move counter
    juggernaut.moveCount = (juggernaut.moveCount || 0) + 1;

    // Check for third move effect
    if (juggernaut.moveCount === 3) {
      juggernaut.moveCount = 0;
      return { triggerEffect: true };
    }

    return true;
  }

  canPlaceCard(position, card) {
    // Check if position is empty
    if (this.slots[position] !== null) return false;

    // Check column-specific rules
    const hasJuggernaut = this.slots.some((c) => c?.name === "Juggernaut");
    if (hasJuggernaut) {
      // In Juggernaut column, only 2 non-Juggernaut cards allowed
      const nonJuggernautCount = this.slots.filter(
        (c) => c && c.name !== "Juggernaut"
      ).length;
      return nonJuggernautCount < 2;
    }

    // Normal column - camps in position 0, people in 1-2
    if (position === 0) {
      return card.type === "camp";
    } else {
      return card.type === "person";
    }
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
