// person-abilities.js
export const personAbilities = {
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
        // Mark the card as used BEFORE setting up pending
        context.source.isReady = false;

        state.pending = {
          type: "looter_damage",
          source: context.source,
          sourcePlayerId: state.currentPlayer,
          context,
        };
        console.log(`Looter (${state.currentPlayer}): Select target to damage`);
        return true;
      },
    },
  },

  // Simple restore ability
  repairbot: {
    restore: {
      cost: 2,
      handler: (state, context) => {
        state.pending = {
          type: "restore",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
        };
        console.log("Repair Bot: Select damaged card to restore");
        return true;
      },
    },
  },

  // Simple water gain - no targeting needed
  muse: {
    extrawater: {
      cost: 0,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        player.water += 1;
        console.log("Muse: Gained 1 extra water");
        return true;
      },
    },
  },

  // Raid ability - triggers special event
  scout: {
    raid: {
      cost: 1,
      handler: (state, context) => {
        const player = state.players[context.playerId];
        // Handle Raiders card placement
        if (player.raiders === "available") {
          // Place in event queue at position 2
          const slotIndex = 1; // Array index for position 2
          if (!player.eventQueue[slotIndex]) {
            player.eventQueue[slotIndex] = {
              id: `${context.playerId}_raiders`,
              name: "Raiders",
              isRaiders: true,
              queueNumber: 2,
            };
            player.raiders = "in_queue";
            console.log("Scout: Raiders placed in event queue");
          }
        } else if (player.raiders === "in_queue") {
          // Advance raiders
          console.log("Scout: Would advance Raiders (not implemented yet)");
        }
        return true;
      },
    },
  },
};
