// card-data.js
// card-data.js
export const CARD_DESCRIPTIONS = {
  people: {
    Looter: {
      abilities: ["Damage. If this hits a camp, draw 1 card (2💧)"],
      trait: null,
      junk: "Water",
      hasImage: true,
    },
    "Wounded Soldier": {
      abilities: ["Damage (1💧)"],
      trait: "When this card enters play, draw 1 card, then damage this card",
      junk: "Injure",
      hasImage: true,
    },
    "Cult Leader": {
      abilities: ["Destroy one of your people. Then,Damage. (0💧)"],
      trait: null,
      junk: "Card",
      hasImage: true,
    },
    "Repair Bot": {
      abilities: ["Restore (2💧)"],
      trait: "When this card enters play, restore",
      junk: "Injure",
      hasImage: true,
    },
    Gunner: {
      abilities: ["Injure all unprotected enemies (2💧)"],
      trait: null,
      junk: "Restore",
      hasImage: true,
    },
    Assassin: {
      abilities: ["Destroy an unprotected person (2💧)"],
      trait: null,
      junk: "Raid",
      hasImage: true,
    },
    Scientist: {
      abilities: [
        "Discard top 3 cards of deck. You may use the junk effect of one of them (1💧)",
      ],
      trait: null,
      junk: "Raid",
      hasImage: true,
    },
    Mutant: {
      abilities: ["Damage and/or Restore, then damage this card (0💧)"],
      trait: null,
      junk: "Injure",
      hasImage: true,
    },
    Vigilante: {
      abilities: ["Injure (1💧)"],
      trait: null,
      junk: "Raid",
      hasImage: true,
    },
    "Rescue Team": {
      abilities: [
        "Return one of your people to your hand (0💧). (This card may be used to return itself to hand)",
      ],
      trait: "This card enters play ready",
      junk: "Injure",
      hasImage: true,
    },
    Muse: {
      abilities: ["Gain 1 extra water (0💧)"],
      trait: null,
      junk: "Injure",
      hasImage: true,
    },
    Mimic: {
      abilities: [
        "Use the ability of one of your ready people, or any undamaged enemy, paying the cost of that ability",
      ],
      trait: null,
      junk: "Injure",
      hasImage: true,
    },
    Exterminator: {
      abilities: ["Destroy all damaged enemies (1💧)"],
      trait: null,
      junk: "Card",
      hasImage: true,
    },
    Scout: {
      abilities: ["Raid (1💧)"],
      trait: null,
      junk: "Water",
      hasImage: true,
    },
    Pyromaniac: {
      abilities: ["Damage an unprotected camp (1💧)"],
      trait: null,
      junk: "Injure",
      hasImage: true,
    },
    Holdout: {
      abilities: ["Damage (1💧)"],
      trait:
        "If you have a destroyed camp, you can play this card in that column for 0 water",
      junk: "Raid",
      hasImage: true,
    },
    Doomsayer: {
      abilities: ["If opponent has an event in play, Damage (1💧)"],
      trait:
        "When this card enters play, you may move all opponent's events back 1 queue",
      junk: "Card",
      hasImage: true,
    },
    "Rabble Rouser": {
      abilities: ["Gain punk (1💧)", "If you have a Punk, Damage (1💧)"],
      trait: null,
      junk: "Raid",
      hasImage: true,
    },
    Vanguard: {
      abilities: ["Damage. Then, opponent does damage back to you.(1💧)"],
      trait: "When this card enters play, gain a Punk",
      junk: "Raid",
      hasImage: true,
    },
    Sniper: {
      abilities: ["Damage any card (2💧)"],
      trait: null,
      junk: "Restore",
      hasImage: true,
    },
    "Magnus Karv": {
      abilities: ["Damage all cards in one opponent column (2💧)"],
      trait: null,
      junk: "Punk",
      hasImage: true,
    },
    "Zeto Kahn": {
      abilities: ["Draw 3 cards, then discard 3 cards (not Water Silo) (1💧)"],
      trait: "The first event you play each turn goes resolves immediately",
      junk: "Punk",
      hasImage: true,
    },
    "Vera Vosh": {
      abilities: ["Damage (1💧)"],
      trait:
        "The first time you use a card's ability each turn, that card stays ready",
      junk: "Punk",
      hasImage: true,
    },
    "Karli Blaze": {
      abilities: ["Damage (1💧)"],
      trait: "All your people (including this card) enter play ready",
      junk: "Punk",
      hasImage: true,
    },
    "Molgur Stang": {
      abilities: ["Destroy any camp (1💧)"],
      trait: null,
      junk: "Punk",
      hasImage: true,
    },
    "Argo Yesky": {
      abilities: ["Damage (1💧)"],
      trait:
        "All your people gain this card's ability. When this enters play, gain a Punk",
      junk: "Punk",
      hasImage: true,
    },
  },

  camps: {
    Railgun: {
      abilities: ["Damage (2💧)"],
      trait: null,
      hasImage: true,
    },
    "Atomic Garden": {
      abilities: ["Restore a damaged person. They become ready (2💧)"],
      trait: null,
      hasImage: true,
    },
    Cannon: {
      abilities: ["If this card is undamaged, Damage (2💧)"],
      trait: "This card starts the game damaged",
      hasImage: true,
    },
    Pillbox: {
      abilities: [
        "Damage. This ability costs 1 less for each destroyed camp you have. (3💧)",
      ],
      trait: null,
      hasImage: true,
    },
    "Scud Launcher": {
      abilities: ["Damage one of opponent's cards of their choice (1💧)"],
      trait: null,
      hasImage: true,
    },
    "Victory Totem": {
      abilities: ["Damage (2💧)", "Raid (2💧)"],
      trait: null,
      hasImage: true,
    },
    Catapult: {
      abilities: ["Damage any card, then destroy one of your people (2💧)"],
      trait: null,
      hasImage: true,
    },
    "Nest of Spies": {
      abilities: [
        "If you have put 2 or more people into play this turn, Damage (1💧)",
      ],
      trait: null,
      hasImage: true,
    },
    "Command Post": {
      abilities: ["Damage. Costs 1 less per Punk (minimum 0) (3💧)"],
      trait: null,
      hasImage: true,
    },
    Obelisk: {
      abilities: [],
      trait: "When the last card is drawn from deck, you win",
      hasImage: true,
    },
    "Mercenary Camp": {
      abilities: ["Damage any camp if you have 4 or more people (2💧)"],
      trait: null,
      hasImage: true,
    },
    Reactor: {
      abilities: ["Destroy this card and all people (2💧)"],
      trait: null,
      hasImage: true,
    },
    "The Octagon": {
      abilities: [
        "Destroy one of your people. If you do, opponent destroys one of theirs (1💧)",
      ],
      trait: null,
      hasImage: true,
    },
    Juggernaut: {
      abilities: [
        "Move this card forward one space (people go behind). On its third move, return to its starting position. Then the opponent destroys one of their camps. (1💧)",
      ],
      trait: null,
      hasImage: true,
    },
    "Scavenger Camp": {
      abilities: [
        "Discard a card (not Water Silo), then gain a Punk or extra water (0💧)",
      ],
      trait: null,
      hasImage: true,
    },
    Outpost: {
      abilities: ["Raid (2💧)", "Restore (2💧)"],
      trait: null,
      hasImage: true,
    },
    "Transplant Lab": {
      abilities: [
        "If you have put 2 or more people into play this turn, Restore (1💧)",
      ],
      trait: null,
      hasImage: true,
    },
    Resonator: {
      abilities: [
        "Deal 1 damage. Must be the only ability you use this turn (1💧)",
      ],
      trait: null,
      hasImage: true,
    },
    Bonfire: {
      abilities: ["Damage this card, then restore any number of cards (0💧)"],
      trait: "This card cannot be restored.",
      hasImage: true,
    },
    Cache: {
      abilities: ["Raid and gain a Punk (2💧)"],
      trait: null,
      hasImage: true,
    },
    Watchtower: {
      abilities: ["If any event resolved this turn, Damage (1💧)"],
      trait: null,
      hasImage: true,
    },
    "Construction Yard": {
      abilities: [
        "Move any person to any place (on the same side).  (1💧)",
        "Raid (2💧)",
      ],
      trait: null,
      hasImage: true,
    },
    "Adrenaline Lab": {
      abilities: [
        "Use the ability of any one of your damaged people (you must still pay). Then destroy it. (0💧)",
      ],
      trait: null,
      hasImage: true,
    },
    Mulcher: {
      abilities: ["Destroy one of your people, then draw 1 card (0💧)"],
      trait: null,
      hasImage: true,
    },
    "Blood Bank": {
      abilities: ["Destroy one of your people, then gain extra water (0💧)"],
      trait: null,
      hasImage: true,
    },
    Arcade: {
      abilities: ["If you have 0-1 people, gain a Punk (1💧)"],
      trait: null,
      hasImage: true,
    },
    "Training Camp": {
      abilities: ["If you have 2 people in this column, Damage (2💧)"],
      trait: null,
      hasImage: true,
    },
    "Supply Depot": {
      abilities: ["Draw 2 cards, then discard one of them (2💧)"],
      trait: null,
      hasImage: true,
    },
    "Omen Clock": {
      abilities: ["Advance any event by 1 queue position (1💧)"],
      trait: null,
      hasImage: true,
    },
    Warehouse: {
      abilities: ["If opponent has an unprotected camp, Restore (1💧)"],
      trait: null,
      hasImage: true,
    },
    Garage: {
      abilities: ["Raid (1💧)"],
      trait: null,
      hasImage: true,
    },
    Oasis: {
      abilities: [],
      trait:
        "If this column has no people, people cost 1 less to play in this column",
      hasImage: true,
    },
    "Parachute Base": {
      abilities: [
        "Play a person and use their ability (you must pay for both). Then damage them. (0💧)",
      ],
      trait: null,
      hasImage: true,
    },
    "Labor Camp": {
      abilities: ["Destroy one of your people, then Restore (0💧)"],
      trait: null,
      hasImage: true,
    },
  },

  events: {
    Interrogate: {
      effect: "Draw 4 cards, then discard 3 of these cards",
      junk: "Water",
    },
    Truce: {
      effect: "Return all people to their owners' hands (Punks are people)",
      junk: "Injure",
    },
    Uprising: {
      effect: "Gain 3 Punks (to a max of 6 people)",
      junk: "Injure",
    },
    Radiation: {
      effect: "Injure all people (including your own)",
      junk: "Raid",
    },
    Famine: {
      effect:
        "Each player destroys all but one of their people (you choose first)",
      junk: "Injure",
    },
    Napalm: {
      effect: "Destroy all enemies in one column",
      junk: "Restore",
    },
    Strafe: {
      effect: "Injure all unprotected enemies",
      junk: "Card",
    },
    Bombardment: {
      effect:
        "Damage all opponent's camps, then draw 1 card per destroyed camp they have",
      junk: "Restore",
    },
    "High Ground": {
      effect:
        "Rearrange your people. This turn, all opponent's cards are unprotected",
      junk: "Water",
    },
    Banish: {
      effect: "Destroy any enemy",
      junk: "Raid",
    },
  },

  junkEffects: {
    water: "Water",
    injure: "Injure",
    restore: "Restore",
    raid: "Raid",
    card: "Card",
    punk: "Punk",
  },
};
