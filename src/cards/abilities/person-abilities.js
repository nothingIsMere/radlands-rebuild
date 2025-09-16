import { CONSTANTS } from "../../core/constants.js";

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
        console.log("=== Looter ability handler called ===");
        console.log("Source card:", context.source.name);
        console.log("From Mimic?", context.fromMimic);
        console.log("Setting pending type to: looter_damage");
        // Mark the card as used BEFORE setting up pending
        if (!context.fromMimic) {
          context.source.isReady = false;
        }

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
        // Find all damaged cards that can be restored
        const validTargets = [];

        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];
          for (let col = 0; col < 3; col++) {
            for (let pos = 0; pos < 3; pos++) {
              const card = player.columns[col].getCard(pos);
              if (card && card.isDamaged && !card.isDestroyed) {
                validTargets.push({
                  playerId,
                  columnIndex: col,
                  position: pos,
                  card,
                });
              }
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Repair Bot: No damaged cards to restore");
          return false;
        }

        // Mark card as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
        }

        state.pending = {
          type: "restore",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets.map((t) => ({
            playerId: t.playerId,
            columnIndex: t.columnIndex,
            position: t.position,
          })),
        };

        console.log("Repair Bot: Select damaged card to restore");
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
              card.id !== context.source.id && // Can't copy self
              card.abilities?.length > 0
            ) {
              validTargets.push({
                card,
                playerId,
                columnIndex: col,
                position: pos,
                type: "ally",
              });
            }
          }
        }

        // Add opponent's undamaged people (ready or not)
        const opponentId = playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        for (let col = 0; col < CONSTANTS.MAX_COLUMNS; col++) {
          for (let pos = 0; pos <= 2; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (
              card &&
              card.type === "person" &&
              !card.isDamaged &&
              !card.isDestroyed &&
              card.abilities?.length > 0
            ) {
              validTargets.push({
                card,
                playerId: opponentId,
                columnIndex: col,
                position: pos,
                type: "enemy",
              });
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
          })),
          parachuteBaseDamage: context.parachuteBaseDamage, // Preserve if from Parachute Base
        };

        console.log(
          `Mimic: Select a target to copy (${validTargets.length} valid targets)`
        );
        return true;
      },
    },
  },
};
