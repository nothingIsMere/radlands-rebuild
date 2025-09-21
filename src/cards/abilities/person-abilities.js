import { CONSTANTS } from "../../core/constants.js";

// person-abilities.js

export const personAbilities = {
  zetokahn: {
    drawdiscard: {
      cost: 1,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Draw 3 cards
        const cardsDrawn = [];
        for (let i = 0; i < 3 && state.deck.length > 0; i++) {
          const card = state.deck.shift();
          player.hand.push(card);
          cardsDrawn.push(card);
        }

        console.log(`Zeto Kahn: Drew ${cardsDrawn.length} cards`);

        if (cardsDrawn.length === 0) {
          console.log("Zeto Kahn: Deck was empty, no cards drawn");
          return false;
        }

        // Always set up discard selection
        state.pending = {
          type: "zeto_discard_selection",
          source: context.source,
          sourcePlayerId: context.playerId,
          mustDiscard: 3,
          context,
          parachuteBaseDamage: context.parachuteBaseDamage, // Preserve if from Parachute Base
        };

        console.log("Zeto Kahn: Select 3 cards to discard (not Water Silo)");
        return true;
      },
    },
  },
  doomsayer: {
    conditionaldamage: {
      cost: 1,
      handler: (state, context) => {
        // Check if opponent has any events in their queue
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];

        let hasEvents = false;
        for (let i = 0; i < 3; i++) {
          if (opponent.eventQueue[i]) {
            hasEvents = true;
            break;
          }
        }

        if (!hasEvents) {
          console.log(
            "Doomsayer: Opponent has no events in queue, cannot damage"
          );
          return false;
        }

        // Set up damage targeting
        state.pending = {
          type: "damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log("Doomsayer: Opponent has events - select target to damage");
        return true;
      },
    },
  },
  veravosh: {
    injure: {
      cost: 1,
      handler: (state, context) => {
        // Find valid injure targets (unprotected enemy people)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              // Check if protected
              if (!opponent.columns[col].isProtected(pos)) {
                validTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Vera Vosh: No unprotected enemy people to injure");
          return false;
        }

        state.pending = {
          type: "injure",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
        };

        console.log(
          `Vera Vosh: Select unprotected enemy person to injure (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },
  argoyesky: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        state.pending = {
          type: "damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log("Argo Yesky: Select target to damage");
        return true;
      },
    },
  },
  karliblaze: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        state.pending = {
          type: "damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log("Karli Blaze: Select target to damage");
        return true;
      },
    },
  },
  magnuskarv: {
    damagecolumn: {
      cost: 2,
      handler: (state, context) => {
        // Find opponent's columns with at least one card
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validColumns = [];

        for (let col = 0; col < 3; col++) {
          let hasCards = false;
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
              hasCards = true;
              break;
            }
          }
          if (hasCards) {
            validColumns.push(col);
          }
        }

        if (validColumns.length === 0) {
          console.log("Magnus Karv: No columns with cards to damage");
          return false;
        }

        // Set up column selection
        state.pending = {
          type: "magnus_select_column",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          targetPlayerId: opponentId,
          validColumns: validColumns,
          context,
        };

        console.log(
          `Magnus Karv: Select opponent's column to damage all cards (${validColumns.length} columns available)`
        );
        return true;
      },
    },
  },
  rescueteam: {
    returnperson: {
      cost: 0,
      handler: (state, context) => {
        // Find all your people (including punks and Rescue Team itself)
        const player = state.players[context.playerId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              validTargets.push({
                playerId: context.playerId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Rescue Team: No people to return");
          return false;
        }

        // Set up selection
        state.pending = {
          type: "rescue_team_select",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Rescue Team: Select person to return to hand (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  vanguard: {
    damageandcounter: {
      cost: 1,
      handler: (state, context) => {
        // Find valid damage targets (unprotected enemy cards)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const damageTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
              // Check if unprotected
              if (!opponent.columns[col].isProtected(pos)) {
                damageTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (damageTargets.length === 0) {
          console.log("Vanguard: No valid targets to damage");
          return false;
        }

        // Set up damage targeting
        state.pending = {
          type: "vanguard_damage",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          validTargets: damageTargets,
          context,
        };

        console.log(
          `Vanguard: Select target to damage (${damageTargets.length} targets)`
        );
        return true;
      },
    },
  },

  mutant: {
    damagerestore: {
      cost: 0,
      handler: (state, context) => {
        // Find valid damage targets (unprotected enemy cards)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const damageTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = state.players[opponentId].columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
              // Check if unprotected
              if (!state.players[opponentId].columns[col].isProtected(pos)) {
                damageTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        // Find valid restore targets (own damaged cards)
        const restoreTargets = [];
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card =
              state.players[context.playerId].columns[col].getCard(pos);
            if (card && card.isDamaged && !card.isDestroyed) {
              restoreTargets.push({
                playerId: context.playerId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        // Must have at least one valid target (either damage or restore)
        if (damageTargets.length === 0 && restoreTargets.length === 0) {
          console.log("Mutant: No valid targets for damage or restore");
          return false;
        }

        // Set up selection state for choosing damage and/or restore
        state.pending = {
          type: "mutant_choose_mode",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          sourceColumn: context.columnIndex,
          sourcePosition: context.position,
          damageTargets,
          restoreTargets,
          context,
        };

        console.log(
          `Mutant: Choose mode - Damage (${damageTargets.length} targets), Restore (${restoreTargets.length} targets), or both`
        );
        return true;
      },
    },
  },

  scientist: {
    discardchoose: {
      cost: 1,
      handler: (state, context) => {
        // Check if deck has cards
        if (state.deck.length === 0) {
          console.log("Scientist: Deck is empty");
          return false;
        }

        // Discard up to 3 cards
        const cardsToDiscard = Math.min(3, state.deck.length);
        const discardedCards = [];

        for (let i = 0; i < cardsToDiscard; i++) {
          const card = state.deck.shift();
          discardedCards.push(card);
          state.discard.push(card);
        }

        console.log(`Scientist: Discarded ${cardsToDiscard} cards from deck`);

        // Filter cards with junk effects
        const cardsWithJunk = discardedCards.filter((card) => card.junkEffect);

        if (cardsWithJunk.length === 0) {
          console.log("Scientist: No junk effects available");
          return true;
        }

        // Set up selection state
        state.pending = {
          type: "scientist_select_junk",
          source: context.source,
          sourceCard: context.source, // Add this explicit reference
          sourcePlayerId: context.playerId,
          discardedCards: cardsWithJunk,
          context,
        };

        console.log(
          `${
            context.fromMimic ? "Mimic (as Scientist)" : "Scientist"
          }: Choose junk effect to use (${cardsWithJunk.length} options)`
        );
        return true;
      },
    },
  },
  cultleader: {
    destroyowndamage: {
      cost: 0,
      handler: (state, context) => {
        // Find all of player's own people
        const player = state.players[context.playerId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              validTargets.push({
                playerId: context.playerId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Cult Leader: No people to destroy");
          return false;
        }

        // DON'T mark as not ready here - let handleUseAbility do it

        // Set up selection for which of your own people to destroy
        state.pending = {
          type: "cultleader_select_destroy",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
        };

        console.log(
          `Cult Leader: Select one of your people to destroy (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  rabblerouser: {
    gainpunk: {
      cost: 1,
      handler: (state, context) => {
        // Check if deck has cards
        if (state.deck.length === 0) {
          console.log("Rabble Rouser: Cannot gain punk - deck is empty");
          return false;
        }

        // Set up punk placement
        state.pending = {
          type: "place_punk",
          source: context.source,
          sourcePlayerId: context.playerId,
        };

        console.log("Rabble Rouser: Select where to place the punk");
        return true;
      },
    },

    punkdamage: {
      cost: 1,
      handler: (state, context) => {
        // Check if player has any punks BEFORE marking as not ready
        const player = state.players[context.playerId];
        let hasPunk = false;

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.isPunk) {
              hasPunk = true;
              break;
            }
          }
          if (hasPunk) break;
        }

        if (!hasPunk) {
          console.log(
            "Rabble Rouser: You need a punk in play to use this ability"
          );
          return false;
        }

        // Set up damage targeting
        state.pending = {
          type: "damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log("Rabble Rouser: Select target to damage (you have a punk)");
        return true;
      },
    },
  },

  pyromaniac: {
    damagecamp: {
      cost: 1,
      handler: (state, context) => {
        // Find enemy camps (unprotected normally, or all during High Ground)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          // Camps are always at position 0
          const camp = opponent.columns[col].getCard(0);
          if (camp && camp.type === "camp" && !camp.isDestroyed) {
            // Check if High Ground is active
            if (state.turnEvents?.highGroundActive) {
              // During High Ground, ALL enemy camps can be targeted
              validTargets.push({
                playerId: opponentId,
                columnIndex: col,
                position: 0,
                card: camp,
              });
            } else {
              // Normal rules - check if unprotected (no cards in front)
              const hasProtection =
                opponent.columns[col].getCard(1) ||
                opponent.columns[col].getCard(2);

              if (!hasProtection) {
                validTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: 0,
                  card: camp,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Pyromaniac: No valid enemy camps to damage");
          return false;
        }

        // Set up targeting for camp damage
        state.pending = {
          type: "pyromaniac_damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
        };

        const targetDesc = state.turnEvents?.highGroundActive
          ? "any enemy camp (High Ground active!)"
          : "an unprotected enemy camp";

        console.log(
          `Pyromaniac: Select ${targetDesc} to damage (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  molgurstang: {
    destroycamp: {
      cost: 1,
      handler: (state, context) => {
        // Find ALL enemy camps (ignores protection)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          // Camps are always at position 0
          const camp = opponent.columns[col].getCard(0);
          if (camp && camp.type === "camp" && !camp.isDestroyed) {
            // Molgur can target ANY camp, protected or not
            validTargets.push({
              playerId: opponentId,
              columnIndex: col,
              position: 0,
              card: camp,
            });
          }
        }

        if (validTargets.length === 0) {
          console.log("Molgur Stang: No enemy camps to destroy");
          return false;
        }

        // PRESERVE the shouldStayReady value if it exists
        const preservedShouldStayReady = state.pending?.shouldStayReady;

        // Set up targeting for camp destruction
        state.pending = {
          type: "molgur_destroy_camp",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          sourceColumn: context.columnIndex,
          sourcePosition: context.position,
          shouldStayReady: preservedShouldStayReady, // PRESERVE THIS VALUE
          context,
          validTargets: validTargets,
        };

        console.log(
          `Molgur Stang: Select any enemy camp to destroy (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  sniper: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        // Find ALL enemy cards (ignores protection, includes camps)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
              // Sniper can target ANYTHING, protected or not
              validTargets.push({
                playerId: opponentId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Sniper: No targets available");
          return false;
        }

        // Set up targeting with special flag for ignoring protection
        state.pending = {
          type: "sniper_damage",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
          allowProtected: true, // Key flag for ignoring protection
        };

        console.log(
          `Sniper: Select any enemy card to damage (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  assassin: {
    destroy: {
      handler: (state, context) => {
        console.log("Assassin ability: Destroy unprotected enemy person");

        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              // Check if High Ground is active
              if (state.turnEvents?.highGroundActive) {
                // During High Ground, ALL enemy people can be targeted
                validTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              } else {
                // Normal rules - check protection
                if (!opponent.columns[col].isProtected(pos)) {
                  validTargets.push({
                    playerId: opponentId,
                    columnIndex: col,
                    position: pos,
                    card,
                  });
                }
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("No valid targets for Assassin");
          return false;
        }

        state.pending = {
          type: "assassin_destroy",
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
        };

        console.log(
          `Assassin: Select enemy person to destroy (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },

  exterminator: {
    destroyalldamaged: {
      cost: 1,
      handler: (state, context) => {
        // Find all damaged enemy PEOPLE (camps are not enemies)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const targets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            // Only target people, not camps
            if (
              card &&
              card.type === "person" &&
              card.isDamaged &&
              !card.isDestroyed
            ) {
              targets.push({
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (targets.length === 0) {
          console.log("Exterminator: No damaged enemy people to destroy");
          return false;
        }

        console.log(
          `Exterminator: Destroying ${targets.length} damaged enemy people`
        );

        // Destroy all damaged enemy people immediately
        targets.forEach((target) => {
          const card = opponent.columns[target.columnIndex].getCard(
            target.position
          );
          if (card && !card.isDestroyed) {
            card.isDestroyed = true;

            // Handle person destruction
            if (card.isPunk) {
              state.deck.unshift({
                id: `returned_punk_${Date.now()}`,
                name: "Unknown Card",
                type: "person",
                cost: 0,
                isFaceDown: true,
              });
            } else {
              state.discard.push(card);
            }

            // Remove from column
            opponent.columns[target.columnIndex].setCard(target.position, null);

            // Move card in front back if needed
            if (target.position < 2) {
              const cardInFront = opponent.columns[target.columnIndex].getCard(
                target.position + 1
              );
              if (cardInFront) {
                opponent.columns[target.columnIndex].setCard(
                  target.position,
                  cardInFront
                );
                opponent.columns[target.columnIndex].setCard(
                  target.position + 1,
                  null
                );
              }
            }

            console.log(`Exterminator destroyed ${card.name}`);
          }
        });

        // Don't handle Parachute damage here - let Parachute Base do it
        return true;
      },
    },
  },

  gunner: {
    injureall: {
      cost: 2,
      handler: (state, context) => {
        // Find all unprotected enemy people
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const targets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              // Check if protected
              if (!opponent.columns[col].isProtected(pos)) {
                targets.push({
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (targets.length === 0) {
          console.log("Gunner: No unprotected enemy people to injure");
          return false;
        }

        console.log(
          `Gunner: Injuring ${targets.length} unprotected enemy people`
        );

        // Apply damage to all targets immediately
        targets.forEach((target) => {
          const card = opponent.columns[target.columnIndex].getCard(
            target.position
          );
          if (card && !card.isDestroyed) {
            if (card.isDamaged || card.isPunk) {
              // Destroy it
              card.isDestroyed = true;
              // Handle destruction based on type
              if (card.isPunk) {
                state.deck.unshift({
                  id: `returned_punk_${Date.now()}`,
                  name: "Unknown Card",
                  type: "person",
                  cost: 0,
                  isFaceDown: true,
                });
              } else {
                state.discard.push(card);
              }

              // Remove from column and shift cards
              opponent.columns[target.columnIndex].setCard(
                target.position,
                null
              );

              // Move card in front back if needed
              if (target.position < 2) {
                const cardInFront = opponent.columns[
                  target.columnIndex
                ].getCard(target.position + 1);
                if (cardInFront) {
                  opponent.columns[target.columnIndex].setCard(
                    target.position,
                    cardInFront
                  );
                  opponent.columns[target.columnIndex].setCard(
                    target.position + 1,
                    null
                  );
                }
              }

              console.log(`Gunner destroyed ${card.name}`);
            } else {
              // Damage it
              card.isDamaged = true;
              card.isReady = false;
              console.log(`Gunner injured ${card.name}`);
            }
          }
        });

        // Don't handle Parachute damage here - let Parachute Base do it
        return true;
      },
    },
  },

  woundedsoldier: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log("Wounded Soldier: Select target to damage");
        return true;
      },
    },
  },

  damage: {
    cost: 2,
    handler: (state, context) => {
      state.pending = {
        type: "looter_damage",
        source: context.source,
        sourcePlayerId: context.playerId,
        context,
      };
      console.log("Looter: Select target to damage");
      return true;
    },
  },

  looter: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        console.log("=== Looter ability handler called ===");
        console.log("Source card:", context.source.name);
        console.log("From Mimic?", context.fromMimic);
        console.log("Setting pending type to: looter_damage");

        state.pending = {
          type: "looter_damage",
          source: context.source,
          sourcePlayerId: context.playerId, // This is the player using the ability
          context,
          copiedFrom: context.copiedFrom, // Will be 'Looter' if from Mimic
        };
        console.log(
          `${
            context.fromMimic ? "Mimic (as Looter)" : "Looter"
          }: Select target to damage`
        );
        return true;
      },
    },
  },

  repairbot: {
    restore: {
      cost: 2,
      handler: (state, context) => {
        // Find damaged cards - ONLY CHECK OWN CARDS
        const validTargets = [];
        const player = state.players[context.playerId];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.isDamaged && !card.isDestroyed) {
              validTargets.push({
                playerId: context.playerId, // Always own player
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Repair Bot: No damaged cards to restore");
          return false;
        }

        state.pending = {
          type: "restore",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets, // Already filtered to own cards only
        };

        console.log(
          `Repair Bot: Select one of your damaged cards to restore (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  // Simple water gain - no targeting needed
  muse: {
    extra_water: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        player.water += 1;
        console.log("Muse: Gained 1 extra water");
        return true;
      },
    },
  },

  mimic: {
    copyability: {
      cost: 0, // Initial cost, will be replaced by target ability cost
      handler: (state, context) => {
        const playerId = context.playerId;
        const validTargets = [];

        // Check if there's an active Argo giving everyone damage ability
        let hasActiveArgo = false;
        for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
          for (let pos = 0; pos <= 2; pos++) {
            const card = state.players[playerId].columns[col].getCard(pos);
            if (
              card &&
              card.name === "Argo Yesky" &&
              !card.isDamaged &&
              !card.isDestroyed
            ) {
              hasActiveArgo = true;
              break;
            }
          }
          if (hasActiveArgo) break;
        }

        // Add own ready people (not including Mimic itself)
        const player = state.players[playerId];
        for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
          for (let pos = 0; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (
              card &&
              card.type === "person" &&
              card.isReady &&
              !card.isDamaged &&
              !card.isDestroyed &&
              card.id !== context.source.id // Can't copy self
            ) {
              // Check if card has abilities OR gets Argo's ability
              const hasAbilities =
                card.abilities?.length > 0 ||
                (hasActiveArgo && (card.isPunk || card.type === "person"));

              if (hasAbilities) {
                validTargets.push({
                  card,
                  playerId,
                  columnIndex: col,
                  position: pos,
                  type: "ally",
                  hasArgoBonus: hasActiveArgo && !card.abilities?.length, // Track if ONLY has Argo ability
                });
              }
            }
          }
        }

        // Add opponent's undamaged people (ready or not)
        const opponentId = playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];

        // Check if opponent has active Argo
        let opponentHasActiveArgo = false;
        for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
          for (let pos = 0; pos <= 2; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (
              card &&
              card.name === "Argo Yesky" &&
              !card.isDamaged &&
              !card.isDestroyed
            ) {
              opponentHasActiveArgo = true;
              break;
            }
          }
          if (opponentHasActiveArgo) break;
        }

        for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
          for (let pos = 0; pos <= 2; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (
              card &&
              card.type === "person" &&
              !card.isDamaged &&
              !card.isDestroyed
            ) {
              // Check if card has abilities OR gets Argo's ability
              const hasAbilities =
                card.abilities?.length > 0 ||
                (opponentHasActiveArgo &&
                  (card.isPunk || card.type === "person"));

              if (hasAbilities) {
                validTargets.push({
                  card,
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  type: "enemy",
                  hasArgoBonus:
                    opponentHasActiveArgo && !card.abilities?.length,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("No valid targets for Mimic");
          return false;
        }

        // Set up selection state
        state.pending = {
          type: "mimic_select_target",
          source: context.source,
          sourcePlayerId: playerId,
          sourceContext: context,
          validTargets: validTargets.map((t) => ({
            cardId: t.card.id,
            playerId: t.playerId,
            columnIndex: t.columnIndex,
            position: t.position,
            hasArgoBonus: t.hasArgoBonus,
          })),
          parachuteBaseDamage: context.parachuteBaseDamage,
        };

        console.log(
          `Mimic: Select a target to copy (${validTargets.length} valid targets)`
        );
        return true;
      },
    },
  },

  vigilante: {
    injure: {
      cost: 1,
      handler: (state, context) => {
        // Find valid targets - unprotected enemy people (or all during High Ground)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              // Check if High Ground is active
              if (state.turnEvents?.highGroundActive) {
                // During High Ground, ALL enemy people can be targeted
                validTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              } else if (!opponent.columns[col].isProtected(pos)) {
                // Normal rules - only unprotected
                validTargets.push({
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Vigilante: No valid enemy people to injure");
          return false;
        }

        state.pending = {
          type: "injure",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
        };

        const targetDesc = state.turnEvents?.highGroundActive
          ? "any enemy person (High Ground active!)"
          : "an unprotected enemy person";

        console.log(
          `Vigilante: Select ${targetDesc} to injure (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },
};
