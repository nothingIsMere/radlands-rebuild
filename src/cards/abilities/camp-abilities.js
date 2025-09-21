/*
 * IMPORTANT: All camp abilities must be compatible with Vera Vosh's trait
 * Vera's trait: "The first time you use a card's ability each turn, that card stays ready."
 * This is handled in handleUseCampAbility() in command-system.js
 * The ready state tracking is automatic - no special handling needed in individual camp handlers
 */

import { TargetValidator } from "../../core/target-validator.js";

export const campAbilities = {
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
};
