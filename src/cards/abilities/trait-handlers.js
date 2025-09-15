// trait-handlers.js
export const cardTraits = {
  repairbot: {
    onEntry: (state, context) => {
      // Repair Bot restores on entry
      state.pending = {
        type: "restore",
        source: context.card,
        sourcePlayerId: context.playerId,
        context,
      };
      console.log("Repair Bot trait: Restore on entry");
      return true;
    },
  },

  woundedsoldier: {
    onEntry: (state, context) => {
      const player = state.players[context.playerId];
      // Draw a card
      if (state.deck.length > 0) {
        player.hand.push(state.deck.shift());
      }
      // Damage self
      const card = state.getCard(
        context.playerId,
        context.columnIndex,
        context.position
      );
      card.isDamaged = true;
      card.isReady = false;
      console.log("Wounded Soldier: Drew card and damaged self");
      return true;
    },
  },

  rescueteam: {
    onEntry: (state, context) => {
      // Enters play ready
      const card = state.getCard(
        context.playerId,
        context.columnIndex,
        context.position
      );
      card.isReady = true;
      console.log("Rescue Team: Enters play ready");
      return true;
    },
  },
};
