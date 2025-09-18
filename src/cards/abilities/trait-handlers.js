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
        isEntryTrait: true,
      };

      console.log(
        `Repair Bot trait: Choose one of your damaged cards to restore (${validTargets.length} available)`
      );
      return true;
    },
  },

  rescueteam: {
    onEntry: (state, context) => {
      const card = state.getCard(
        context.playerId,
        context.columnIndex,
        context.position
      );
      if (card) {
        card.isReady = true;
        console.log("Rescue Team: Enters play ready");
      }
      return true;
    },
  },

  vanguard: {
    onEntry: (state, context) => {
      if (state.deck.length === 0) {
        console.log("Vanguard: Cannot gain punk on entry - deck is empty");
        return false;
      }

      // Check if this is from Parachute Base
      const parachuteBaseContext = state.pending?.parachuteBaseContext;

      // Set up punk placement
      state.pending = {
        type: "place_punk",
        source: context.card,
        sourcePlayerId: context.playerId,
        fromVanguardEntry: true,
        parachuteBaseContext: parachuteBaseContext, // Pass along if it exists
      };

      console.log("Vanguard entry: Place a punk");
      return true;
    },
  },

  woundedsoldier: {
    onEntry: (state, context) => {
      const player = state.players[context.playerId];

      // Draw a card
      if (state.deck.length > 0) {
        const drawnCard = state.deck.shift();
        player.hand.push(drawnCard);
        console.log(`Wounded Soldier: Drew ${drawnCard.name}`);
      } else {
        console.log("Wounded Soldier: Deck empty, cannot draw");
      }

      // Damage self
      const card = state.players[context.playerId].columns[
        context.columnIndex
      ].getCard(context.position);

      if (card) {
        card.isDamaged = true;
        card.isReady = false;
        console.log("Wounded Soldier: Damaged self on entry");
      }

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
