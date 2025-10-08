/*
 * IMPORTANT: All camp abilities must be compatible with Vera Vosh's trait
 * Vera's trait: "The first time you use a card's ability each turn, that card stays ready."
 * This is handled in handleUseCampAbility() in command-system.js
 * The ready state tracking is automatic - no special handling needed in individual camp handlers
 */

import { TargetValidator } from "../../core/target-validator.js";

export const campAbilities = {
  adrenalinelab: {
    usedamagedability: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Find all damaged people with abilities
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (
              card &&
              card.type === "person" &&
              card.isDamaged &&
              !card.isDestroyed &&
              card.abilities?.length > 0
            ) {
              // Check if any ability is affordable
              const affordableAbilities = card.abilities.filter(
                (ability) => player.water >= ability.cost
              );

              if (affordableAbilities.length > 0) {
                validTargets.push({
                  playerId: context.playerId,
                  card,
                  columnIndex: col,
                  position: pos,
                  abilities: affordableAbilities,
                });
              }
            }
          }
        }

        // Check for Argo's granted ability on damaged people/punks
        // Move the checkForActiveArgo logic directly here
        let hasActiveArgo = false;
        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
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

        if (hasActiveArgo && player.water >= 1) {
          // Add damaged people/punks that only have Argo's ability
          for (let col = 0; col < 3; col++) {
            for (let pos = 1; pos <= 2; pos++) {
              const card = player.columns[col].getCard(pos);
              if (
                card &&
                card.type === "person" &&
                card.isDamaged &&
                !card.isDestroyed &&
                (!card.abilities || card.abilities.length === 0)
              ) {
                // This person only has Argo's granted ability
                validTargets.push({
                  playerId: context.playerId,
                  card,
                  columnIndex: col,
                  position: pos,
                  abilities: [{ effect: "damage", cost: 1 }],
                  isArgoGranted: true,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log(
            "Adrenaline Lab: No damaged people with affordable abilities"
          );
          return false;
        }

        // Set up selection
        state.pending = {
          type: "adrenalinelab_select_person",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Adrenaline Lab: Select a damaged person to use their ability (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  obelisk: {
    // No abilities - just has a trait that affects win conditions
  },

  resonator: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        // Check if any ability has been used this turn
        if (state.turnEvents.abilityUsedThisTurn) {
          console.log(
            "Resonator: Cannot use - another ability was already used this turn"
          );
          return false;
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Resonator: No valid targets to damage");
          return false;
        }

        // Set up damage targeting with a special flag
        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          isResonator: true, // Flag to prevent other abilities this turn
          context,
        };

        console.log(
          `Resonator: Select target to damage (no other abilities can be used this turn)`
        );
        return true;
      },
    },
  },

  constructionyard: {
    moveperson: {
      cost: 1,
      handler: (state, context) => {
        // Find ALL people (both players)
        const people = [];

        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];
          for (let col = 0; col < 3; col++) {
            for (let pos = 1; pos <= 2; pos++) {
              const card = player.columns[col].getCard(pos);
              if (card && card.type === "person" && !card.isDestroyed) {
                people.push({
                  card,
                  playerId,
                  columnIndex: col,
                  position: pos,
                });
              }
            }
          }
        }

        if (people.length === 0) {
          console.log("Construction Yard: No people to move");
          return false;
        }

        state.pending = {
          type: "constructionyard_select_person",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          availablePeople: people,
          validTargets: people, // ADD THIS - UI needs validTargets to show borders
          context,
        };

        console.log(
          `Construction Yard: Select any person to move (${people.length} available)`
        );
        return true;
      },
    },

    raid: {
      cost: 2,
      handler: (state, context) => {
        // This uses the same raid logic as other camps like Garage and Victory Totem
        const player = state.players[context.playerId];

        if (player.raiders === "available") {
          const desiredSlot = 1;

          let targetSlot = -1;
          if (!player.eventQueue[desiredSlot]) {
            targetSlot = desiredSlot;
          } else {
            for (let i = desiredSlot + 1; i < 3; i++) {
              if (!player.eventQueue[i]) {
                targetSlot = i;
                break;
              }
            }
          }

          if (targetSlot === -1) {
            console.log(
              "Construction Yard: Cannot place Raiders - event queue is full"
            );
            return false;
          }

          player.eventQueue[targetSlot] = {
            id: `${context.playerId}_raiders`,
            name: "Raiders",
            isRaiders: true,
            queueNumber: 2,
          };
          player.raiders = "in_queue";
          console.log(
            `Construction Yard: Raiders placed in event queue at slot ${
              targetSlot + 1
            }`
          );
          return true;
        } else if (player.raiders === "in_queue") {
          let raidersIndex = -1;
          for (let i = 0; i < 3; i++) {
            if (player.eventQueue[i]?.isRaiders) {
              raidersIndex = i;
              break;
            }
          }

          if (raidersIndex === 0) {
            console.log(
              "Construction Yard: Advancing Raiders off slot 1 - resolving effect!"
            );
            player.eventQueue[0] = null;
            player.raiders = "available";

            const opponentId = context.playerId === "left" ? "right" : "left";
            state.pending = {
              type: "raiders_select_camp",
              sourcePlayerId: context.playerId,
              targetPlayerId: opponentId,
            };

            console.log(
              `Raiders: ${opponentId} player must choose a camp to damage`
            );
            return true;
          } else if (raidersIndex > 0) {
            const newIndex = raidersIndex - 1;
            if (!player.eventQueue[newIndex]) {
              player.eventQueue[newIndex] = player.eventQueue[raidersIndex];
              player.eventQueue[raidersIndex] = null;
              console.log(
                `Construction Yard: Advanced Raiders from slot ${
                  raidersIndex + 1
                } to slot ${newIndex + 1}`
              );
              return true;
            } else {
              console.log(
                `Construction Yard: Cannot advance Raiders - slot ${
                  newIndex + 1
                } is occupied`
              );
              return false;
            }
          }
        } else {
          console.log("Construction Yard: Raiders already used this game");
          return false;
        }
      },
    },
  },

  watchtower: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        console.log(
          "DEBUG Watchtower - turnEvents:",
          JSON.stringify(state.turnEvents, null, 2)
        );
        // Check if any event resolved this turn (including Raiders and instant events)
        if (!state.turnEvents.eventResolvedThisTurn) {
          console.log(
            "Watchtower: No events have resolved this turn - cannot use ability"
          );
          return false;
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Watchtower: No valid targets to damage");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Watchtower: Event resolved this turn - select target to damage (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  bonfire: {
    damagerestoremany: {
      cost: 0,
      handler: (state, context) => {
        const bonfire = state.getCard(context.playerId, context.columnIndex, 0);

        // Damage Bonfire itself
        if (bonfire.isDamaged) {
          bonfire.isDestroyed = true;
          console.log("Bonfire destroyed itself!");
        } else {
          bonfire.isDamaged = true;
          console.log("Bonfire damaged itself");
        }

        // Find all damaged cards to restore (excluding Bonfire itself)
        const validTargets = [];
        const player = state.players[context.playerId];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.isDamaged && !card.isDestroyed) {
              // THIS IS THE KEY CHECK - exclude Bonfire by its ID
              if (card.id !== bonfire.id) {
                validTargets.push({
                  playerId: context.playerId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log(
            "Bonfire: No damaged cards to restore (Bonfire cannot restore itself)"
          );
          // Ability still completes even with no restoration targets
          return true;
        }

        // Set up multiple restoration selection
        state.pending = {
          type: "bonfire_restore_multiple",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          restoredCards: [], // Track what's been restored
          context,
        };

        console.log(
          `Bonfire: Select cards to restore (${validTargets.length} available) or finish`
        );
        return true;
      },
    },
  },

  cache: {
    raidpunk: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Before setting up punk placement:
        if (state.deck.length === 0) {
          // Try reshuffling
          const result = state.drawCardWithReshuffle(false);
          if (result.gameEnded) {
            // Handle game end
            return true;
          }
          if (!result.card) {
            console.log("Cannot gain punk - no cards available");
            return false; // or handle appropriately
          }
          // Put it back for the actual punk placement
          state.deck.unshift(result.card);
        }

        // Check if Raiders is available or can be advanced
        if (player.raiders !== "available" && player.raiders !== "in_queue") {
          console.log("Cache: Raiders already used this game");
          return false;
        }

        // Let player choose which effect to do first
        state.pending = {
          type: "cache_choose_order",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          context,
        };

        console.log(
          "Cache: Choose which effect to do first - Raid or Gain Punk"
        );
        return true;
      },
    },
  },

  theoctagon: {
    destroy: {
      cost: 1,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Find your own people
        const validPeople = [];
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              validPeople.push({
                playerId: context.playerId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        // The Octagon is optional - you can choose not to destroy
        state.pending = {
          type: "octagon_choose_destroy",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validPeople,
          context,
        };

        if (validPeople.length === 0) {
          console.log("The Octagon: No people to destroy (ability ends)");
          // Mark ability complete even with no targets
          return true;
        }

        console.log(
          `The Octagon: Choose one of your people to destroy, or cancel (${validPeople.length} available)`
        );
        return true;
      },
    },
  },

  cannon: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        const cannon = state.getCard(context.playerId, context.columnIndex, 0);

        // Cannon can only use its ability if undamaged
        if (cannon.isDamaged) {
          console.log("Cannon: Can only use ability when undamaged");
          return false;
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Cannon: No valid targets to damage");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Cannon: Select target to damage (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  scavengercamp: {
    discardchoose: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Check if player has cards to discard (excluding Water Silo)
        const discardableCards = player.hand.filter(
          (card) => !card.isWaterSilo && card.name !== "Water Silo"
        );

        if (discardableCards.length === 0) {
          console.log(
            "Scavenger Camp: No cards to discard (cannot discard Water Silo)"
          );
          return false;
        }

        // Set up discard selection
        state.pending = {
          type: "scavengercamp_select_discard",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          discardableCards: discardableCards,
          context,
        };

        console.log(
          `Scavenger Camp: Select a card to discard (${discardableCards.length} available)`
        );
        return true;
      },
    },
  },

  omenclock: {
    advance: {
      cost: 1,
      handler: (state, context) => {
        // Find all events in both players' queues that can be advanced
        const validTargets = [];

        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];

          // Check each event slot
          for (let i = 0; i < 3; i++) {
            if (player.eventQueue[i]) {
              // Check if there's an empty slot in front (lower index)
              if (i > 0 && !player.eventQueue[i - 1]) {
                validTargets.push({
                  playerId: playerId,
                  slotIndex: i,
                  event: player.eventQueue[i],
                  canAdvanceTo: i - 1,
                });
              } else if (i === 0) {
                // Slot 1 (index 0) can always "advance" off the queue to resolve
                validTargets.push({
                  playerId: playerId,
                  slotIndex: 0,
                  event: player.eventQueue[0],
                  willResolve: true,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Omen Clock: No events can be advanced");
          return false;
        }

        state.pending = {
          type: "omenclock_select_event",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Omen Clock: Select an event to advance (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  transplantlab: {
    restore: {
      cost: 1,
      handler: (state, context) => {
        // Check if player has played 2+ people this turn
        if (state.turnEvents.peoplePlayedThisTurn < 2) {
          console.log(
            `Transplant Lab: Need to have played 2+ people this turn (played ${state.turnEvents.peoplePlayedThisTurn})`
          );
          return false;
        }

        // Find damaged cards to restore (your own), excluding Transplant Lab itself
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true,
            excludeSource: {
              playerId: context.playerId,
              columnIndex: context.columnIndex,
              position: 0,
            },
          }
        );

        if (validTargets.length === 0) {
          console.log(
            "Transplant Lab: No damaged cards to restore (excluding self)"
          );
          return false;
        }

        state.pending = {
          type: "restore",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Transplant Lab: Select damaged card to restore (${validTargets.length} available, ${state.turnEvents.peoplePlayedThisTurn} people played)`
        );
        return true;
      },
    },
  },

  nestofspies: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        // Check if player has played 2+ people this turn
        if (state.turnEvents.peoplePlayedThisTurn < 2) {
          console.log(
            `Nest of Spies: Need to have played 2+ people this turn (played ${state.turnEvents.peoplePlayedThisTurn})`
          );
          return false;
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Nest of Spies: No valid targets to damage");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Nest of Spies: Select target to damage (${state.turnEvents.peoplePlayedThisTurn} people played this turn)`
        );
        return true;
      },
    },
  },

  catapult: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Check if player has at least one person
        let hasPerson = false;
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              hasPerson = true;
              break;
            }
          }
          if (hasPerson) break;
        }

        if (!hasPerson) {
          console.log("Catapult: Need at least one person to use this ability");
          return false;
        }

        // Find ALL enemy cards (ignoring protection)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: true, // Catapult ignores protection!
          }
        );

        if (validTargets.length === 0) {
          console.log("Catapult: No targets to damage");
          return false;
        }

        state.pending = {
          type: "catapult_damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          allowProtected: true,
          context,
        };

        console.log(
          `Catapult: Select ANY enemy card to damage (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  warehouse: {
    restore: {
      cost: 1,
      handler: (state, context) => {
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];

        // Check if opponent has any unprotected camps
        let hasUnprotectedCamp = false;
        for (let col = 0; col < 3; col++) {
          const camp = opponent.columns[col].getCard(0);
          if (camp && !camp.isDestroyed) {
            if (!opponent.columns[col].isProtected(0)) {
              hasUnprotectedCamp = true;
              break;
            }
          }
        }

        if (!hasUnprotectedCamp) {
          console.log(
            "Warehouse: Opponent has no unprotected camps - cannot use ability"
          );
          return false;
        }

        // Find damaged cards to restore (your own), excluding Warehouse itself
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true,
            excludeSource: {
              playerId: context.playerId,
              columnIndex: context.columnIndex,
              position: 0,
            },
          }
        );

        if (validTargets.length === 0) {
          console.log(
            "Warehouse: No damaged cards to restore (excluding self)"
          );
          return false;
        }

        state.pending = {
          type: "restore",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Warehouse: Select damaged card to restore (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  scudlauncher: {
    damage: {
      cost: 1,
      handler: (state, context) => {
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];

        // Find all opponent's cards (camps and people)
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && !card.isDestroyed) {
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
          console.log("Scud Launcher: Opponent has no cards to damage");
          return false;
        }

        // Set up opponent's choice
        state.pending = {
          type: "scudlauncher_select_target",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          targetPlayerId: opponentId, // The opponent who chooses
          validTargets: validTargets,
          context,
        };

        console.log(
          `Scud Launcher: ${opponentId} player must choose one of their cards to damage`
        );
        return true;
      },
    },
  },
  trainingcamp: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        const campColumn = context.columnIndex;

        // Count people in THIS column only
        let peopleInColumn = 0;
        for (let pos = 1; pos <= 2; pos++) {
          const card = player.columns[campColumn].getCard(pos);
          if (card && card.type === "person" && !card.isDestroyed) {
            peopleInColumn++;
          }
        }

        if (peopleInColumn < 2) {
          console.log(
            `Training Camp: Need 2 people in this column (have ${peopleInColumn})`
          );
          return false;
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Training Camp: No valid targets to damage");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Training Camp: Select target to damage (2 people in column confirmed)`
        );
        return true;
      },
    },
  },
  pillbox: {
    damage: {
      cost: 3,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Count destroyed camps
        let destroyedCampCount = 0;
        for (let col = 0; col < 3; col++) {
          const camp = player.columns[col].getCard(0);
          if (camp && camp.isDestroyed) {
            destroyedCampCount++;
          }
        }

        // Calculate actual cost (can go to 0)
        const actualCost = Math.max(0, 3 - destroyedCampCount);

        // Check if player can afford actual cost
        if (player.water < actualCost) {
          console.log(
            `Pillbox: Need ${actualCost} water (base 3 - ${destroyedCampCount} destroyed camps)`
          );
          return false;
        }

        // PAY the actual cost (not refund - we never paid anything yet!)
        player.water -= actualCost;
        console.log(
          `Pillbox: Paid ${actualCost} water (base 3 - ${destroyedCampCount} destroyed camp discount)`
        );

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          player.water += actualCost; // Refund since we can't use ability
          console.log("Pillbox: No valid targets to damage, refunded water");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(`Pillbox: Select target to damage`);
        return true;
      },
    },
  },
  supplydepot: {
    drawdiscard: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Draw 2 cards (or as many as possible)
        const drawnCards = [];
        for (let i = 0; i < 2; i++) {
          const result = state.drawCardWithReshuffle(true, context.playerId);

          if (result.gameEnded) {
            return true;
          }

          if (result.card) {
            drawnCards.push(result.card);
            console.log(`Supply Depot: Drew ${result.card.name}`);
          } else {
            // No more cards available even after reshuffle attempt
            break;
          }
        }

        if (drawnCards.length === 0) {
          console.log("Supply Depot: No cards drawn");
          return false;
        }

        if (drawnCards.length === 1) {
          // Only drew 1 card, no need to discard
          console.log("Supply Depot: Only 1 card drawn, keeping it");
          return true;
        }

        // Set up discard selection
        state.pending = {
          type: "supplydepot_select_discard",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          drawnCards: drawnCards,
          context,
        };

        console.log("Supply Depot: Select 1 of the 2 drawn cards to discard");
        return true;
      },
    },
  },

  laborcamp: {
    destroyrestore: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Find your own people to destroy
        const validPeople = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              validPeople.push({
                playerId: context.playerId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validPeople.length === 0) {
          console.log("Labor Camp: No people to destroy");
          return false;
        }

        // Check if there are any damaged cards to restore (excluding Labor Camp itself)
        const validRestoreTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true,
            excludeSource: {
              playerId: context.playerId,
              columnIndex: context.columnIndex,
              position: 0,
            },
          }
        );

        if (validRestoreTargets.length === 0) {
          console.log(
            "Labor Camp: No damaged cards to restore (excluding self)"
          );
          return false;
        }

        // Set up selection state - first select person to destroy
        state.pending = {
          type: "laborcamp_select_destroy",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validPeople,
          validRestoreTargets: validRestoreTargets, // Store for later
          context,
        };

        console.log(
          `Labor Camp: Select one of your people to destroy (${validPeople.length} available)`
        );
        return true;
      },
    },
  },

  bloodbank: {
    destroywater: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Find your own people to destroy
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
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
          console.log("Blood Bank: No people to destroy");
          return false;
        }

        // Set up selection state
        state.pending = {
          type: "bloodbank_select_destroy",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          shouldStayReady: context.shouldStayReady || false,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Blood Bank: Select one of your people to destroy for water (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  mulcher: {
    destroydraw: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Find your own people to destroy
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
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
          console.log("Mulcher: No people to destroy");
          return false;
        }

        // Check if deck has cards to draw
        if (state.deck.length === 0) {
          console.log(
            "Mulcher: Warning - deck is empty, but can still destroy"
          );
          // Still allow the ability - destroying might be strategic even without draw
        }

        // Set up selection state
        state.pending = {
          type: "mulcher_select_destroy",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          shouldStayReady: context.shouldStayReady || false,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Mulcher: Select one of your people to destroy (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  arcade: {
    gainpunk: {
      cost: 1,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        let peopleCount = 0;

        // Count all people (including punks)
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              peopleCount++;
            }
          }
        }

        if (peopleCount > 1) {
          console.log(
            `Arcade: Can only use with 0 or 1 person (have ${peopleCount})`
          );
          return false;
        }

        // Before setting up punk placement:
        if (state.deck.length === 0) {
          // Try reshuffling
          const result = state.drawCardWithReshuffle(false);
          if (result.gameEnded) {
            // Handle game end
            return true;
          }
          if (!result.card) {
            console.log("Cannot gain punk - no cards available");
            return false; // or handle appropriately
          }
          // Put it back for the actual punk placement
          state.deck.unshift(result.card);
        }

        // Set up punk placement
        state.pending = {
          type: "place_punk",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
        };

        console.log(
          `Arcade: Select where to place punk (you have ${peopleCount} person)`
        );
        return true;
      },
    },
  },

  mercenarycamp: {
    damagecamp: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        let peopleCount = 0;

        // Count your people
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              peopleCount++;
            }
          }
        }

        if (peopleCount < 4) {
          console.log(`Mercenary Camp: Need 4+ people (have ${peopleCount})`);
          return false;
        }

        // Find ALL enemy camps (ignoring protection)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            requireCamp: true,
            allowProtected: true, // Ignores protection!
          }
        );

        if (validTargets.length === 0) {
          console.log("Mercenary Camp: No enemy camps to damage");
          return false;
        }

        state.pending = {
          type: "mercenary_camp_damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          allowProtected: true, // Important flag for damage resolution
          context,
        };

        console.log(
          `Mercenary Camp: Select ANY enemy camp to damage (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  atomicgarden: {
    restoreready: {
      cost: 2,
      handler: (state, context) => {
        // Find damaged PEOPLE only (not camps)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requirePerson: true, // Only people, not camps
            requireDamaged: true,
            allowProtected: true,
          }
        );

        if (validTargets.length === 0) {
          console.log("Atomic Garden: No damaged people to restore");
          return false;
        }

        state.pending = {
          type: "atomic_garden_restore", // Special type to handle the ready state
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Atomic Garden: Select damaged person to restore and ready (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  commandpost: {
    damage: {
      cost: 3,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Count punks
        let punkCount = 0;
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.isPunk && !card.isDestroyed) {
              punkCount++;
            }
          }
        }

        // Calculate actual cost
        const actualCost = Math.max(0, 3 - punkCount);

        // PAY the actual cost (not refund - we didn't pay anything yet!)
        if (player.water < actualCost) {
          console.log(
            `Command Post: Need ${actualCost} water (base 3 - ${punkCount} punks)`
          );
          return false;
        }

        player.water -= actualCost; // PAY the cost
        console.log(
          `Command Post: Paid ${actualCost} water (base 3 - ${punkCount} punk(s))`
        );

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          { allowProtected: false }
        );

        if (validTargets.length === 0) {
          player.water += actualCost; // Refund if no targets
          console.log("Command Post: No valid targets to damage");
          return false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Command Post: Select target to damage (paid ${actualCost} water)`
        );
        return true;
      },
    },
  },

  reactor: {
    destroyall: {
      cost: 2,
      handler: (state, context) => {
        console.log("Reactor: Destroying self and all people!");

        // First, destroy Reactor itself
        const reactor = state.getCard(context.playerId, context.columnIndex, 0);
        if (reactor) {
          reactor.isDestroyed = true;
          console.log("Reactor destroyed itself");
        }

        // Now destroy ALL people (both players)
        let destroyedCount = 0;
        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];

          // Process from front to back to handle removal properly
          for (let col = 0; col < 3; col++) {
            for (let pos = 2; pos >= 1; pos--) {
              const card = player.columns[col].getCard(pos);
              if (card && card.type === "person" && !card.isDestroyed) {
                card.isDestroyed = true;

                // Handle punk vs normal person
                if (card.isPunk) {
                  const returnCard = {
                    id: card.id,
                    name: card.originalName || card.name,
                    type: card.originalCard?.type || card.type,
                    cost: card.originalCard?.cost || card.cost,
                    abilities: card.originalCard?.abilities || card.abilities,
                    junkEffect:
                      card.originalCard?.junkEffect || card.junkEffect,
                  };
                  state.deck.unshift(returnCard);
                  console.log("Reactor destroyed punk (returned to deck)");
                } else {
                  state.discard.push(card);
                  console.log(`Reactor destroyed ${card.name}`);
                }

                // Remove from column
                player.columns[col].setCard(pos, null);

                // Move card in front back if needed
                if (pos === 1) {
                  const cardInFront = player.columns[col].getCard(2);
                  if (cardInFront) {
                    player.columns[col].setCard(1, cardInFront);
                    player.columns[col].setCard(2, null);
                  }
                }

                destroyedCount++;
              }
            }
          }
        }

        console.log(`Reactor: Destroyed itself and ${destroyedCount} people`);

        // Check for game end - count destroyed camps for the Reactor's owner
        let destroyedCamps = 0;
        const player = state.players[context.playerId];
        for (let col = 0; col < 3; col++) {
          const camp = player.columns[col].getCard(0);
          if (camp?.type === "camp" && camp.isDestroyed) {
            destroyedCamps++;
          }
        }

        if (destroyedCamps >= 3) {
          state.phase = "game_over";
          state.winner = context.playerId === "left" ? "right" : "left";
          state.winReason = "camps_destroyed";
          console.log(`${state.winner} wins - Reactor caused self-defeat!`);
        }

        return true;
      },
    },
  },

  outpost: {
    raid: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Same raid logic as Garage and Victory Totem
        if (player.raiders === "available") {
          const desiredSlot = 1; // Raiders goes to slot 2 (index 1)

          // Find first available slot at or behind desired position
          let targetSlot = -1;
          if (!player.eventQueue[desiredSlot]) {
            targetSlot = desiredSlot;
          } else {
            for (let i = desiredSlot + 1; i < 3; i++) {
              if (!player.eventQueue[i]) {
                targetSlot = i;
                break;
              }
            }
          }

          if (targetSlot === -1) {
            console.log("Outpost: Cannot place Raiders - event queue is full");
            return false;
          }

          player.eventQueue[targetSlot] = {
            id: `${context.playerId}_raiders`,
            name: "Raiders",
            isRaiders: true,
            queueNumber: 2,
          };
          player.raiders = "in_queue";
          console.log(
            `Outpost: Raiders placed in event queue at slot ${targetSlot + 1}`
          );
          return true;
        } else if (player.raiders === "in_queue") {
          // Find and advance/resolve Raiders
          let raidersIndex = -1;
          for (let i = 0; i < 3; i++) {
            if (player.eventQueue[i]?.isRaiders) {
              raidersIndex = i;
              break;
            }
          }

          if (raidersIndex === 0) {
            // Resolve Raiders
            console.log(
              "Outpost: Advancing Raiders off slot 1 - resolving effect!"
            );
            player.eventQueue[0] = null;
            player.raiders = "available";

            const opponentId = context.playerId === "left" ? "right" : "left";
            state.pending = {
              type: "raiders_select_camp",
              sourcePlayerId: context.playerId,
              targetPlayerId: opponentId,
            };

            console.log(
              `Raiders: ${opponentId} player must choose a camp to damage`
            );
            return true;
          } else if (raidersIndex > 0) {
            const newIndex = raidersIndex - 1;
            if (!player.eventQueue[newIndex]) {
              player.eventQueue[newIndex] = player.eventQueue[raidersIndex];
              player.eventQueue[raidersIndex] = null;
              console.log(
                `Outpost: Advanced Raiders from slot ${
                  raidersIndex + 1
                } to slot ${newIndex + 1}`
              );
              return true;
            } else {
              console.log(
                `Outpost: Cannot advance Raiders - slot ${
                  newIndex + 1
                } is occupied`
              );
              return false;
            }
          }
        } else {
          console.log("Outpost: Raiders already used this game");
          return false;
        }
      },
    },

    restore: {
      cost: 2,
      handler: (state, context) => {
        // Find damaged cards (your own), excluding Outpost itself
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true,
            excludeSource: {
              playerId: context.playerId,
              columnIndex: context.columnIndex,
              position: 0,
            },
          }
        );

        if (validTargets.length === 0) {
          console.log("Outpost: No damaged cards to restore (excluding self)");
          return false;
        }

        state.pending = {
          type: "restore",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Outpost: Select damaged card to restore (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  victorytotem: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false,
          }
        );

        if (validTargets.length === 0) {
          console.log("Victory Totem: No valid targets to damage");
          return false;
        }

        // Set up damage targeting
        state.pending = {
          type: "damage",
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Victory Totem: Select target to damage (${validTargets.length} available)`
        );
        return true;
      },
    },

    raid: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // EXACT SAME LOGIC AS GARAGE
        if (player.raiders === "available") {
          const desiredSlot = 1; // Raiders goes to slot 2 (index 1)

          // Find first available slot at or behind desired position
          let targetSlot = -1;
          if (!player.eventQueue[desiredSlot]) {
            targetSlot = desiredSlot;
          } else {
            for (let i = desiredSlot + 1; i < 3; i++) {
              if (!player.eventQueue[i]) {
                targetSlot = i;
                break;
              }
            }
          }

          if (targetSlot === -1) {
            console.log(
              "Victory Totem: Cannot place Raiders - event queue is full"
            );
            return false;
          }

          player.eventQueue[targetSlot] = {
            id: `${context.playerId}_raiders`,
            name: "Raiders",
            isRaiders: true,
            queueNumber: 2,
          };
          player.raiders = "in_queue";
          console.log(
            `Victory Totem: Raiders placed in event queue at slot ${
              targetSlot + 1
            }`
          );
          return true;
        } else if (player.raiders === "in_queue") {
          // Find and advance Raiders
          let raidersIndex = -1;
          for (let i = 0; i < 3; i++) {
            if (player.eventQueue[i]?.isRaiders) {
              raidersIndex = i;
              break;
            }
          }

          if (raidersIndex === 0) {
            // Raiders in slot 1 - resolve it
            console.log(
              "Victory Totem: Advancing Raiders off slot 1 - resolving effect!"
            );

            player.eventQueue[0] = null;
            player.raiders = "available";

            const opponentId = context.playerId === "left" ? "right" : "left";
            state.pending = {
              type: "raiders_select_camp",
              sourcePlayerId: context.playerId,
              targetPlayerId: opponentId,
            };

            console.log(
              `Raiders: ${opponentId} player must choose a camp to damage`
            );
            return true;
          } else if (raidersIndex > 0) {
            const newIndex = raidersIndex - 1;
            if (!player.eventQueue[newIndex]) {
              player.eventQueue[newIndex] = player.eventQueue[raidersIndex];
              player.eventQueue[raidersIndex] = null;
              console.log(
                `Victory Totem: Advanced Raiders from slot ${
                  raidersIndex + 1
                } to slot ${newIndex + 1}`
              );
              return true;
            } else {
              console.log(
                `Victory Totem: Cannot advance Raiders - slot ${
                  newIndex + 1
                } is occupied`
              );
              return false;
            }
          }
        } else {
          console.log("Victory Totem: Raiders already used this game");
          return false;
        }
      },
    },
  },

  juggernaut: {
    move: {
      cost: 1,
      handler: (state, context) => {
        const { playerId, columnIndex, position } = context;
        const column = state.players[playerId].columns[columnIndex];

        console.log(`Juggernaut starting at position ${position}`);

        // Calculate next position (0->1, 1->2, 2->0)
        const nextPosition = (position + 1) % 3;

        // Log the state before move
        console.log("Column before move:");
        for (let i = 0; i < 3; i++) {
          const card = column.getCard(i);
          console.log(`  Position ${i}: ${card ? card.name : "empty"}`);
        }

        // Move Juggernaut
        const result = column.moveCard(position, nextPosition);

        // Log the state after move
        console.log("Column after move:");
        for (let i = 0; i < 3; i++) {
          const card = column.getCard(i);
          console.log(`  Position ${i}: ${card ? card.name : "empty"}`);
        }

        if (result?.triggerEffect) {
          console.log("Juggernaut third move! Opponent must destroy a camp.");
          if (result?.triggerEffect) {
            console.log("Juggernaut third move! Opponent must destroy a camp.");

            // Set up opponent camp selection
            const opponentId = playerId === "left" ? "right" : "left";
            state.pending = {
              type: "juggernaut_select_camp",
              sourcePlayerId: playerId,
              targetPlayerId: opponentId,
              sourceCard: context.campCard || context.source,
              shouldStayReady: context.veraDecision || false,
            };

            console.log(
              `Juggernaut: ${opponentId} must choose one of their camps to destroy`
            );
          }

          return true;
        }

        console.log(`Juggernaut should now be at position ${nextPosition}`);

        return true;
      },
    },
  },

  parachutebase: {
    paradrop: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        const validPeople = player.hand.filter(
          (card) => card.type === "person"
        );

        if (validPeople.length === 0) {
          console.log("No person cards in hand for Parachute Base");
          return false;
        }

        // Set up selection state with camp reference from context
        state.pending = {
          type: "parachute_select_person",
          source: context.source,
          sourceCard: context.campCard || context.source, // Get from context
          shouldStayReady: context.veraDecision || false, // Get from context
          sourcePlayerId: context.playerId,
          campIndex: context.columnIndex,
          validPeople: validPeople.map((c) => c.id),
        };

        console.log("Parachute Base: Select person from hand to paradrop");
        console.log("Camp reference preserved:", !!state.pending.sourceCard);
        console.log("Vera decision preserved:", state.pending.shouldStayReady);
        return true;
      },
    },
  },

  railgun: {
    damage: {
      cost: 2,
      handler: (state, context) => {
        // Find valid damage targets (unprotected enemy cards)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowProtected: false, // Standard damage respects protection
          }
        );

        if (validTargets.length === 0) {
          console.log("Railgun: No valid targets to damage");
          return false;
        }

        // Set up damage targeting
        state.pending = {
          type: "damage", // Uses existing damage handler
          source: context.source,
          sourceCard: context.campCard || context.source,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          context,
        };

        console.log(
          `Railgun: Select target to damage (${validTargets.length} available)`
        );
        return true;
      },
    },
  },

  garage: {
    raid: {
      cost: 1,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        if (player.raiders === "available") {
          // Raiders has queue number 2, so tries for slot 2 (index 1)
          const desiredSlot = 1;

          // Find first available slot at or behind desired position
          let targetSlot = -1;
          if (!player.eventQueue[desiredSlot]) {
            targetSlot = desiredSlot;
          } else {
            // Check slots behind (higher indices)
            for (let i = desiredSlot + 1; i < 3; i++) {
              if (!player.eventQueue[i]) {
                targetSlot = i;
                break;
              }
            }
          }

          if (targetSlot === -1) {
            console.log("Garage: Cannot place Raiders - event queue is full");
            return false;
          }

          // Place Raiders in the target slot
          player.eventQueue[targetSlot] = {
            id: `${context.playerId}_raiders`,
            name: "Raiders",
            isRaiders: true,
            queueNumber: 2,
          };
          player.raiders = "in_queue";
          console.log(
            `Garage: Raiders placed in event queue at slot ${targetSlot + 1}`
          );
          return true;
        } else if (player.raiders === "in_queue") {
          // Find where Raiders currently is
          let raidersIndex = -1;
          for (let i = 0; i < 3; i++) {
            if (player.eventQueue[i]?.isRaiders) {
              raidersIndex = i;
              break;
            }
          }

          if (raidersIndex === 0) {
            // Raiders in slot 1 - resolve it immediately!
            console.log(
              "Garage: Advancing Raiders off slot 1 - resolving effect!"
            );

            // Remove from queue
            player.eventQueue[0] = null;

            // Return to available
            player.raiders = "available";

            // Set up opponent camp selection
            const opponentId = context.playerId === "left" ? "right" : "left";
            state.pending = {
              type: "raiders_select_camp",
              sourcePlayerId: context.playerId,
              targetPlayerId: opponentId,
            };

            console.log(
              `Raiders: ${opponentId} player must choose a camp to damage`
            );
            return true;
          } else if (raidersIndex > 0) {
            // Try to advance
            const newIndex = raidersIndex - 1;
            if (!player.eventQueue[newIndex]) {
              player.eventQueue[newIndex] = player.eventQueue[raidersIndex];
              player.eventQueue[raidersIndex] = null;
              console.log(
                `Garage: Advanced Raiders from slot ${
                  raidersIndex + 1
                } to slot ${newIndex + 1}`
              );
              return true;
            } else {
              console.log(
                `Garage: Cannot advance Raiders - slot ${
                  newIndex + 1
                } is occupied`
              );
              return false;
            }
          }
        } else {
          console.log("Garage: Raiders already used this game");
          return false;
        }
      },
    },
  },
};
