// card-data.js
export const CARD_DESCRIPTIONS = {
  // ABILITY EFFECTS - Human-readable descriptions
  abilities: {
    damage: "Deal 1 damage to an unprotected enemy card",
    restore: "Remove all damage from a damaged card",
    restoreready: "Remove all damage from a damaged person and make them ready",
    raid: "Take 1 water from opponent",
    injure: "Deal 1 damage to an unprotected enemy person",
    gainpunk: "Draw a Punk from the deck and place it",
    destroyall: "Destroy this card and all people in play",
    destroy: "Destroy one of your people, then opponent destroys one of theirs",
    move: "Move this card forward one space",
    discardchoose:
      "Discard a card (not Water Silo), then gain a Punk or extra water",
    usedamagedability:
      "Use the ability of any damaged person (must pay cost), then destroy it",
    destroydraw: "Destroy one of your people, then draw 1 card",
    destroywater: "Destroy one of your people, then gain extra water",
    advance: "Advance any event by 1 queue position",
    drawdiscard: "Draw 2 cards, then discard one of them",
    paradrop:
      "Play a person and use their ability (must pay both costs), then damage them",
    destroyrestore: "Destroy one of your people, then restore a card",
    damagecamp: "Deal 1 damage to any camp if you have 4+ people",
    raidpunk: "Raid and gain a Punk",
    moveperson: "Move any person to any place on your side",
    punkdamage: "If you have a Punk, deal 1 damage",
    damagerestoremany: "Damage this card, then restore any number of cards",
  },

  // JUNK EFFECTS - Human-readable descriptions
  junkEffects: {
    water: "Gain 1 extra water",
    injure: "Deal 1 damage to an unprotected enemy person",
    restore: "Remove all damage from a damaged card",
    raid: "Take 1 water from opponent",
    card: "Draw 1 card from the deck",
    punk: "Draw a Punk from the deck and place it",
    damage: "Deal 1 damage to an unprotected enemy card",
  },

  // PEOPLE CARDS - Traits and special abilities
  people: {
    Looter: {
      trait: null,
      abilityNote: "If this hits a camp, draw 1 card",
    },
    "Wounded Soldier": {
      trait: "When this card enters play, draw 1 card, then damage this card",
    },
    "Cult Leader": {
      trait: null,
      abilityNote: "Can destroy himself with his ability",
    },
    "Repair Bot": {
      trait: "When this card enters play, restore a card",
    },
    Gunner: {
      trait: null,
      abilityNote: "Injures ALL unprotected enemies",
    },
    Assassin: {
      trait: null,
    },
    Scientist: {
      trait: null,
      abilityNote: "Discard top 3 cards of deck. You may use one junk effect",
    },
    Mutant: {
      trait: null,
      abilityNote: "Damage and/or Restore, then damage this card",
    },
    Vigilante: {
      trait: "When this card enters play, injure an enemy person",
    },
    "Rescue Team": {
      trait: "This card enters play ready",
      abilityNote: "Can return itself to hand",
    },
    Muse: {
      trait: null,
    },
    Mimic: {
      trait: null,
      abilityNote:
        "Use any ready person's ability or any undamaged enemy's ability",
    },
    Exterminator: {
      trait: null,
      abilityNote: "Destroys ALL damaged enemies",
    },
    Scout: {
      trait: null,
    },
    Pyromaniac: {
      trait: null,
      abilityNote: "Damages unprotected camps",
    },
    Holdout: {
      trait:
        "If you have a destroyed camp, you can play this card in that column for 0 water",
    },
    Doomsayer: {
      trait:
        "When this card enters play, you may move all opponent's events back 1 queue",
    },
    "Rabble Rouser": {
      trait: null,
    },
    Vanguard: {
      trait: "When this card enters play, gain a Punk",
      abilityNote: "Opponent damages you back immediately during your turn",
    },
    Sniper: {
      trait: null,
      abilityNote: "Can damage ANY card (ignores protection)",
    },
    "Magnus Karv": {
      trait: null,
      abilityNote: "Damages ALL cards in one opponent column",
    },
    "Zeto Kahn": {
      trait: "The first event you play each turn goes to 0 queue",
    },
    "Vera Vosh": {
      trait:
        "The first time you use a card's ability each turn, that card stays ready",
    },
    "Karli Blaze": {
      trait: "All your people (including this card) enter play ready",
    },
    "Molgur Stang": {
      trait: null,
      abilityNote: "Can destroy ANY camp, even if protected",
    },
    "Argo Yesky": {
      trait:
        "All your people gain 'Damage (1💧)' ability. When this enters play, gain a Punk",
    },
  },

  // CAMP CARDS - Traits
  camps: {
    Railgun: { trait: null },
    "Atomic Garden": { trait: null },
    Cannon: { trait: "This card starts the game damaged" },
    Pillbox: { trait: "Ability costs 1 less per destroyed camp you have" },
    "Scud Launcher": {
      trait: "Opponent chooses which of their cards takes damage",
    },
    "Victory Totem": { trait: null },
    Catapult: { trait: "Must destroy one of your people to use" },
    "Nest of Spies": { trait: "Requires 2+ people played this turn" },
    "Command Post": { trait: "Ability costs 1 less per Punk (minimum 0)" },
    Obelisk: { trait: "When the last card is drawn from deck, you win" },
    "Mercenary Camp": { trait: "Requires 4+ people to use" },
    Reactor: { trait: "Destroys this card AND all people in play" },
    "The Octagon": {
      trait:
        "If you destroy one of your people, opponent must destroy one of theirs",
    },
    Juggernaut: {
      trait:
        "Moves forward each use. On 3rd move, return to start and opponent destroys a camp. People behind Juggernaut are protected",
    },
    "Scavenger Camp": {
      trait: "Choose to gain Punk OR extra water after discarding",
    },
    Outpost: { trait: null },
    "Transplant Lab": {
      trait: "Requires 2+ people played this turn. Cannot restore itself",
    },
    Resonator: { trait: "Must be the ONLY ability you use this turn" },
    Bonfire: { trait: "This card cannot be restored" },
    Cache: { trait: "Does both Raid and Gain Punk" },
    Watchtower: {
      trait: "Requires an event resolved this turn (including Raiders)",
    },
    "Construction Yard": {
      trait: "Can move people to any position on your side",
    },
    "Adrenaline Lab": { trait: "Can use damaged people who entered this turn" },
    Mulcher: { trait: "Requires a person to use" },
    "Blood Bank": { trait: "Requires a person to use" },
    Arcade: { trait: "Requires 0 or 1 people (Punks count)" },
    "Training Camp": { trait: "Requires 2 people in this column" },
    "Supply Depot": { trait: "Must discard one of the 2 drawn cards" },
    "Omen Clock": {
      trait:
        "Can advance opponent's events. Can only advance if space available",
    },
    Warehouse: { trait: "Requires opponent to have an unprotected camp" },
    Garage: { trait: null },
    Oasis: {
      trait: "If this column has no people, people cost 1 less to play here",
    },
    "Parachute Base": {
      trait: "Must pay for both playing the person and using their ability",
    },
    "Labor Camp": { trait: "Requires a person to use. Cannot restore itself" },
  },

  // EVENT CARDS
  events: {
    Interrogate: {
      effect: "Draw 4 cards, then discard 3 of them",
      queue: 0,
    },
    Truce: {
      effect:
        "Return all people to their owners' hands (Punks count as people)",
      queue: 0,
    },
    Uprising: {
      effect:
        "Gain 3 Punks (if this would exceed 6 people, you don't gain extras)",
      queue: 2,
    },
    Radiation: {
      effect: "Injure all people in play (including your own)",
      queue: 1,
    },
    Famine: {
      effect:
        "Each player destroys all but one of their people (you choose first)",
      queue: 1,
    },
    Napalm: {
      effect: "Destroy all enemies in one column",
      queue: 1,
    },
    Strafe: {
      effect: "Injure all unprotected enemies",
      queue: 0,
    },
    Bombardment: {
      effect:
        "Damage all opponent's camps, then draw 1 card per destroyed camp they have",
      queue: 3,
    },
    "High Ground": {
      effect:
        "Rearrange your people. This turn, all opponent's cards are unprotected",
      queue: 1,
    },
    Banish: {
      effect: "Destroy any enemy card",
      queue: 1,
    },
  },
};
