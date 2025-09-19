/*
 * IMPORTANT: All camp abilities must be compatible with Vera Vosh's trait
 * Vera's trait: "The first time you use a card's ability each turn, that card stays ready."
 * This is handled in handleUseCampAbility() in command-system.js
 * The ready state tracking is automatic - no special handling needed in individual camp handlers
 */

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

        // NOTE: Vera Vosh trait handling for camps
        // The camp's ready state is handled in handleUseCampAbility
        // which will check for Vera's trait when marking camps not ready

        return true;
      },
    },
  },

  // In camp-abilities.js
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

        // Set up selection state
        state.pending = {
          type: "parachute_select_person",
          source: context.source,
          sourcePlayerId: context.playerId,
          campIndex: context.columnIndex,
          validPeople: validPeople.map((c) => c.id),
        };

        console.log("Parachute Base: Select person from hand to paradrop");
        return true;
      },
    },
  },

  // In command-system, add handlers for each step:
  // Step 1: Select person from hand
  // Step 2: Select where to play them
  // Step 3: Automatically trigger their ability
  // Step 4: Automatically damage them
};
