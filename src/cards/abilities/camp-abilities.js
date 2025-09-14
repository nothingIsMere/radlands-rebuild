export const campAbilities = {
  juggernaut: {
    ability: (state, context) => {
      const { playerId, columnIndex } = context;
      const column = state.players[playerId].columns[columnIndex];

      // Find Juggernaut's current position
      let juggernautPos = -1;
      for (let i = 0; i < 3; i++) {
        const card = column.getCard(i);
        if (card?.name === "Juggernaut") {
          juggernautPos = i;
          break;
        }
      }

      if (juggernautPos === -1) {
        console.log("Juggernaut not found!");
        return;
      }

      // Calculate next position
      const nextPos = (juggernautPos + 1) % 3;

      // Execute movement
      const result = column.moveCard(juggernautPos, nextPos);

      // Check for third move effect
      if (result?.triggerEffect) {
        console.log("Juggernaut completed third move!");

        // Opponent must destroy one of their camps
        const opponentId = playerId === "left" ? "right" : "left";
        state.pending = {
          type: "destroy_own_camp",
          source: context.source,
          targetPlayer: opponentId,
        };
      }

      console.log(
        `Juggernaut moved from position ${juggernautPos} to ${nextPos}`
      );
    },
  },

  railgun: {
    ability: (state, context) => {
      state.pending = {
        type: "damage",
        source: context.source,
        context,
      };
      console.log("Railgun: Select target to damage");
    },
  },

  // Add all your other camp abilities here
};
