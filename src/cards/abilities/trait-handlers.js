// trait-handlers.js
export const cardTraits = {
  repairbot: {
    onEntry: (state, context) => {
      // Check if there are any damaged cards to restore - ONLY CHECK OWN CARDS
      const validTargets = [];
      const player = state.players[context.playerId];

      // Only check the player's own cards
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
        console.log("Repair Bot trait: No damaged cards to restore");
        return false;
      }

      // Set up restore targeting
      state.pending = {
        type: "repair_bot_entry_restore",
        source: context.card,
        sourcePlayerId: context.playerId,
        validTargets: validTargets, // Already filtered to own cards only
      };

      console.log(
        `Repair Bot trait: Choose one of your damaged cards to restore (${validTargets.length} available)`
      );
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
