import { CONSTANTS } from "../../core/constants.js";

// person-abilities.js

export const personAbilities = {
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

        // Mark Exterminator as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
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

        // Mark Gunner as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
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
        // Mark as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
        }

        state.pending = {
          type: "damage",
          source: context.source,
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

        // Mark card as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
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

  vigilante: {
    injure: {
      cost: 1,
      handler: (state, context) => {
        // Find valid targets - unprotected enemy people only
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
          console.log("Vigilante: No unprotected enemy people to injure");
          return false;
        }

        // Mark card as not ready (unless from Parachute Base)
        if (!context.fromParachuteBase) {
          context.source.isReady = false;
        }

        state.pending = {
          type: "injure",
          source: context.source,
          sourcePlayerId: context.playerId,
          context,
          validTargets: validTargets,
        };

        console.log(
          `Vigilante: Select an unprotected enemy person to injure (${validTargets.length} targets)`
        );
        return true;
      },
    },
  },
};
