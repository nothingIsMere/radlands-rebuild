// card-data.js
// card-data.js
export const CARD_DESCRIPTIONS = {
  people: {
    Looter: {
      abilities: ["Damage. If this hits a camp, draw 1 card (2💧)"],
      trait: null,
      junk: "Water",
    },
    "Wounded Soldier": {
      abilities: ["Damage (1💧)"],
      trait: "When this card enters play, draw 1 card, then damage this card",
      junk: "Injure",
    },
    "Cult Leader": {
      abilities: ["Destroy one of your people. Then,Damage. (0💧)"],
      trait: null,
      junk: "Card",
    },
    "Repair Bot": {
      abilities: ["Restore (2💧)"],
      trait: "When this card enters play, restore",
      junk: "Injure",
    },
    Gunner: {
      abilities: ["Injure all unprotected enemies (2💧)"],
      trait: null,
      junk: "Restore",
    },
    Assassin: {
      abilities: ["Destroy an unprotected person (2💧)"],
      trait: null,
      junk: "Raid",
    },
    Scientist: {
      abilities: [
        "Discard top 3 cards of deck. You may use the junk effect of one of them (1💧)",
      ],
      trait: null,
      junk: "Raid",
    },
    Mutant: {
      abilities: ["Damage and/or Restore, then damage this card (0💧)"],
      trait: null,
      junk: "Injure",
    },
    Vigilante: {
      abilities: ["Injure (1💧)"],
      trait: null,
      junk: "Raid",
    },
    "Rescue Team": {
      abilities: [
        "Return one of your people to your hand (0💧). (This card may be used to return itself to hand)",
      ],
      trait: "This card enters play ready",
      junk: "Injure",
    },
    Muse: {
      abilities: ["Gain 1 extra water (0💧)"],
      trait: null,
      junk: "Injure",
    },
    Mimic: {
      abilities: [
        "Use the ability of one of your ready people, or any undamaged enemy, paying the cost of that ability",
      ],
      trait: null,
      junk: "Injure",
    },
    Exterminator: {
      abilities: ["Destroy all damaged enemies (1💧)"],
      trait: null,
      junk: "Card",
    },
    Scout: {
      abilities: ["Raid (1💧)"],
      trait: null,
      junk: "Water",
    },
    Pyromaniac: {
      abilities: ["Damage an unprotected camp (1💧)"],
      trait: null,
      junk: "Injure",
    },
    Holdout: {
      abilities: ["Damage (1💧)"],
      trait:
        "If you have a destroyed camp, you can play this card in that column for 0 water",
      junk: "Raid",
    },
    Doomsayer: {
      abilities: ["If opponent has an event in play, Damage (1💧)"],
      trait:
        "When this card enters play, you may move all opponent's events back 1 queue",
      junk: "Card",
    },
    "Rabble Rouser": {
      abilities: ["Gain punk (1💧)", "If you have a Punk, Damage (1💧)"],
      trait: null,
      junk: "Raid",
    },
    Vanguard: {
      abilities: ["Damage. Then, opponent does damage back to you.(1💧)"],
      trait: "When this card enters play, gain a Punk",
      junk: "Raid",
    },
    Sniper: {
      abilities: ["Damage any card (2💧)"],
      trait: null,
      junk: "Restore",
    },
    "Magnus Karv": {
      abilities: ["Damage all cards in one opponent column (2💧)"],
      trait: null,
      junk: "Punk",
    },
    "Zeto Kahn": {
      abilities: ["Draw 3 cards, then discard 3 cards (not Water Silo) (1💧)"],
      trait: "The first event you play each turn goes resolves immediately",
      junk: "Punk",
    },
    "Vera Vosh": {
      abilities: ["Damage (1💧)"],
      trait:
        "The first time you use a card's ability each turn, that card stays ready",
      junk: "Punk",
    },
    "Karli Blaze": {
      abilities: ["Damage (1💧)"],
      trait: "All your people (including this card) enter play ready",
      junk: "Punk",
    },
    "Molgur Stang": {
      abilities: ["Destroy any camp (1💧)"],
      trait: null,
      junk: "Punk",
    },
    "Argo Yesky": {
      abilities: ["Damage (1💧)"],
      trait:
        "All your people gain this card's ability. When this enters play, gain a Punk",
      junk: "Punk",
    },
  },

  camps: {
    Railgun: {
      abilities: ["Damage (2💧)"],
      trait: null,
    },
    "Atomic Garden": {
      abilities: ["Restore a damaged person. They become ready (2💧)"],
      trait: null,
    },
    Cannon: {
      abilities: ["If this card is undamaged, Damage (2💧)"],
      trait: "This card starts the game damaged",
    },
    Pillbox: {
      abilities: [
        "Damage. This ability costs 1 less for each destroyed camp you have. (3💧)",
      ],
      trait: null,
    },
    "Scud Launcher": {
      abilities: ["Damage one of opponent's cards of their choice (1💧)"],
      trait: null,
    },
    "Victory Totem": {
      abilities: ["Damage (2💧)", "Raid (2💧)"],
      trait: null,
    },
    Catapult: {
      abilities: ["Damage any card, then destroy one of your people (2💧)"],
      trait: null,
    },
    "Nest of Spies": {
      abilities: [
        "If you have put 2 or more people into play this turn, Damage (1💧)",
      ],
      trait: null,
    },
    "Command Post": {
      abilities: ["Damage. Costs 1 less per Punk (minimum 0) (3💧)"],
      trait: null,
    },
    Obelisk: {
      abilities: [],
      trait: "When the last card is drawn from deck, you win",
    },
    "Mercenary Camp": {
      abilities: ["Damage any camp if you have 4 or more people (2💧)"],
      trait: null,
    },
    Reactor: {
      abilities: ["Destroy this card and all people (2💧)"],
      trait: null,
    },
    "The Octagon": {
      abilities: [
        "Destroy one of your people. If you do, opponent destroys one of theirs (1💧)",
      ],
      trait: null,
    },
    Juggernaut: {
      abilities: [
        "Move this card forward one space (people go behind). On its third move, return to its starting position. Then the opponent destroys one of their camps. (1💧)",
      ],
      trait: null,
    },
    "Scavenger Camp": {
      abilities: [
        "Discard a card (not Water Silo), then gain a Punk or extra water (0💧)",
      ],
      trait: null,
    },
    Outpost: {
      abilities: ["Raid (2💧)", "Restore (2💧)"],
      trait: null,
    },
    "Transplant Lab": {
      abilities: [
        "If you have put 2 or more people into play this turn, Restore (1💧)",
      ],
      trait: null,
    },
    Resonator: {
      abilities: [
        "Deal 1 damage. Must be the only ability you use this turn (1💧)",
      ],
      trait: null,
    },
    Bonfire: {
      abilities: ["Damage this card, then restore any number of cards (0💧)"],
      trait: null,
    },
    Cache: {
      abilities: ["Raid and gain a Punk (2💧)"],
      trait: null,
    },
    Watchtower: {
      abilities: ["If any event resolved this turn, Damage (1💧)"],
      trait: null,
    },
    "Construction Yard": {
      abilities: [
        "Move any person to any place (on the same side).  (1💧)",
        "Raid (2💧)",
      ],
      trait: null,
    },
    "Adrenaline Lab": {
      abilities: [
        "Use the ability of any one of your damaged people (you must still pay). Then destroy it. (0💧)",
      ],
      trait: null,
    },
    Mulcher: {
      abilities: ["Destroy one of your people, then draw 1 card (0💧)"],
      trait: null,
    },
    "Blood Bank": {
      abilities: ["Destroy one of your people, then gain extra water (0💧)"],
      trait: null,
    },
    Arcade: {
      abilities: ["If you have 0-1 people, gain a Punk (1💧)"],
      trait: null,
    },
    "Training Camp": {
      abilities: ["If you have 2 people in this column, Damage (2💧)"],
      trait: null,
    },
    "Supply Depot": {
      abilities: ["Draw 2 cards, then discard one of them (2💧)"],
      trait: null,
    },
    "Omen Clock": {
      abilities: ["Advance any event by 1 queue position (1💧)"],
      trait: null,
    },
    Warehouse: {
      abilities: ["If opponent has an unprotected camp, Restore (1💧)"],
      trait: null,
    },
    Garage: {
      abilities: ["Raid (1💧)"],
      trait: null,
    },
    Oasis: {
      abilities: [],
      trait:
        "If this column has no people, people cost 1 less to play in this column",
    },
    "Parachute Base": {
      abilities: [
        "Play a person and use their ability (you must pay for both). Then damage them. (0💧)",
      ],
      trait: null,
    },
    "Labor Camp": {
      abilities: ["Destroy one of your people, then Restore (0💧)"],
      trait: null,
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
