import { personAbilities } from "./abilities/person-abilities.js";
import { campAbilities } from "./abilities/camp-abilities.js";
import { cardTraits } from "./abilities/trait-handlers.js";
import { eventAbilities } from "./abilities/event-abilities.js";

export class CardRegistry {
  constructor() {
    this.cards = new Map();
    this.abilities = new Map();
    this.traits = new Map();

    this.registerAllCards();
  }

  registerAllCards() {
    // Store the ability objects directly
    this.campAbilities = campAbilities;
    this.personAbilities = personAbilities;

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

    // Register event abilities
    this.eventAbilities = eventAbilities;

    console.log("Registering event abilities:", Object.keys(eventAbilities));

    Object.entries(eventAbilities).forEach(([name, handler]) => {
      this.abilities.set(`event_${name.toLowerCase()}`, handler);
    });
  }

  getAbilityHandler(cardName) {
    const normalized = cardName.toLowerCase().replace(/\s+/g, "");
    console.log("Looking for ability handler:", normalized);
    return this.abilities.get(normalized);
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

const cardRegistryInstance = new CardRegistry();

// Make available in browser
if (typeof window !== "undefined") {
  window.cardRegistry = cardRegistryInstance;
}

// Export for Node.js
export { cardRegistryInstance as cardRegistry };
