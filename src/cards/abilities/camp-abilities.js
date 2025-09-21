/*
 * IMPORTANT: All camp abilities must be compatible with Vera Vosh's trait
 * Vera's trait: "The first time you use a card's ability each turn, that card stays ready."
 * This is handled in handleUseCampAbility() in command-system.js
 * The ready state tracking is automatic - no special handling needed in individual camp handlers
 */

import { TargetValidator } from "../../core/target-validator.js";

export const campAbilities = {
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
