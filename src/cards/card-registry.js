import { personAbilities } from "./abilities/person-abilities.js";
import { campAbilities } from "./abilities/camp-abilities.js";
import { cardTraits } from "./abilities/trait-handlers.js";

export class CardRegistry {
  constructor() {
    this.cards = new Map();
    this.abilities = new Map();
    this.traits = new Map();

    this.registerAllCards();
  }

  registerAllCards() {
    // Register person abilities
    Object.entries(personAbilities).forEach(([name, handler]) => {
      this.abilities.set(name.toLowerCase(), handler);
    });

    // Register camp abilities
    Object.entries(campAbilities).forEach(([name, handler]) => {
      this.abilities.set(name.toLowerCase(), handler);
    });

    // Register traits
    Object.entries(cardTraits).forEach(([name, handler]) => {
      this.traits.set(name.toLowerCase(), handler);
    });
  }

  getAbilityHandler(cardName) {
    return this.abilities.get(cardName.toLowerCase().replace(/\s+/g, ""));
  }

  getTraitHandler(cardName) {
    return this.traits.get(cardName.toLowerCase().replace(/\s+/g, ""));
  }

  createCard(definition) {
    return {
      id: this.generateId(),
      ...definition,
      isReady: false,
      isDamaged: false,
    };
  }

  generateId() {
    return `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Make globally available
window.cardRegistry = new CardRegistry();
