/*
 * IMPORTANT: All camp abilities must be compatible with Vera Vosh's trait
 * Vera's trait: "The first time you use a card's ability each turn, that card stays ready."
 * This is handled in handleUseCampAbility() in command-system.js
 * The ready state tracking is automatic - no special handling needed in individual camp handlers
 */

import { TargetValidator } from "../../core/target-validator.js";

export const campAbilities = {
  // Add to camp-abilities.js, after warehouse:

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
            // Check if this camp is unprotected
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

        // Find damaged cards to restore (your own)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true, // Protection irrelevant for restoration
          }
        );

        if (validTargets.length === 0) {
          console.log("Warehouse: No damaged cards to restore");
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
      cost: 3, // Base cost, will be reduced by destroyed camps
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

        // Refund difference if we already paid full cost
        const refund = 3 - actualCost;
        if (refund > 0) {
          player.water += refund;
          console.log(
            `Pillbox: Cost reduced by ${refund} for ${destroyedCampCount} destroyed camp(s)`
          );
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
          player.water += actualCost; // Full refund since we can't use ability
          console.log("Pillbox: No valid targets to damage");
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
          `Pillbox: Select target to damage (paid ${actualCost} water)`
        );
        return true;
      },
    },
  },
  supplydepot: {
    drawdiscard: {
      cost: 2,
      handler: (state, context) => {
        const player = state.players[context.playerId];

        // Check if deck has at least 1 card (we'll draw what we can)
        if (state.deck.length === 0) {
          console.log("Supply Depot: Cannot use - deck is empty");
          return false;
        }

        // Draw 2 cards (or as many as possible)
        const drawnCards = [];
        for (let i = 0; i < 2; i++) {
          if (state.deck.length > 0) {
            const card = state.deck.shift();
            player.hand.push(card);
            drawnCards.push(card);
            console.log(`Supply Depot: Drew ${card.name}`);
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

        // Set up discard selection - must discard one of the drawn cards
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
        const validRestoreTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.isDamaged && !card.isDestroyed) {
              // Exclude Labor Camp itself from restoration targets
              if (
                !(
                  card.type === "camp" &&
                  card.name === "Labor Camp" &&
                  col === context.columnIndex &&
                  pos === 0
                )
              ) {
                validRestoreTargets.push({
                  playerId: context.playerId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (validRestoreTargets.length === 0) {
          console.log(
            "Labor Camp: No damaged cards to restore (Labor Camp cannot restore itself)"
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

        // Check if deck has cards
        if (state.deck.length === 0) {
          console.log("Arcade: Cannot gain punk - deck is empty");
          return false;
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
      cost: 3, // Base cost, will be reduced by punks
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

        // Calculate actual cost (can go to 0)
        const actualCost = Math.max(0, 3 - punkCount);

        // Check if player can afford actual cost
        if (player.water < actualCost) {
          console.log(
            `Command Post: Need ${actualCost} water (base 3 - ${punkCount} punks)`
          );
          return false;
        }

        // Refund difference if we already paid full cost
        const refund = 3 - actualCost;
        if (refund > 0) {
          player.water += refund;
          console.log(
            `Command Post: Cost reduced by ${refund} for ${punkCount} punk(s)`
          );
        }

        // Find valid damage targets
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          { allowProtected: false }
        );

        if (validTargets.length === 0) {
          player.water += actualCost; // Full refund since we can't use ability
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

        // Check for game end (in case Reactor was the third destroyed camp)
        let destroyedCamps = 0;
        const player = state.players[context.playerId];
        for (let col = 0; col < 3; col++) {
          const camp = player.columns[col].getCard(0);
          if (camp?.isDestroyed) destroyedCamps++;
        }

        if (destroyedCamps === 3) {
          state.phase = "game_over";
          state.winner = context.playerId === "left" ? "right" : "left";
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
        // Find damaged cards (your own)
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            allowOwn: true,
            requireDamaged: true,
            allowProtected: true, // Protection irrelevant for restoration
          }
        );

        if (validTargets.length === 0) {
          console.log("Outpost: No damaged cards to restore");
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
          // TODO: Implement camp destruction choice
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
