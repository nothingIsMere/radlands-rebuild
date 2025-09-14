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
};
