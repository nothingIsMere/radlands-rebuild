// trait-handlers.js
export const cardTraits = {
  // In trait-handlers.js, add:

  zetokahn: {
    // This is a passive trait that modifies event playing, not an entry effect
    modifiesEventQueue: true,
  },
  doomsayer: {
    onEntry: (state, context) => {
      console.log("Doomsayer enters play - moving opponent's events back!");

      const opponentId = context.playerId === "left" ? "right" : "left";
      const opponent = state.players[opponentId];
      let movedCount = 0;

      // Process from back to front (slot 3 to slot 1) to avoid conflicts
      // Remember: index 2 = slot 3, index 1 = slot 2, index 0 = slot 1
      for (let i = 2; i >= 0; i--) {
        if (opponent.eventQueue[i]) {
          // Try to move back one slot (higher index)
          const targetSlot = i + 1;

          // Check if we can move it back (slot must be empty and in bounds)
          if (targetSlot <= 2 && !opponent.eventQueue[targetSlot]) {
            // Move the event back
            opponent.eventQueue[targetSlot] = opponent.eventQueue[i];
            opponent.eventQueue[i] = null;
            console.log(
              `Moved ${opponent.eventQueue[targetSlot].name} from slot ${
                i + 1
              } to slot ${targetSlot + 1}`
            );
            movedCount++;
          } else {
            console.log(
              `Cannot move ${opponent.eventQueue[i].name} back - slot ${
                targetSlot + 1
              } is occupied or out of bounds`
            );
          }
        }
      }

      if (movedCount > 0) {
        console.log(`Doomsayer: Moved ${movedCount} opponent event(s) back`);
      } else {
        console.log("Doomsayer: No opponent events could be moved back");
      }

      return true;
    },
  },
  argoyesky: {
    onEntry: (state, context) => {
      // First, gain a punk
      if (state.deck.length === 0) {
        console.log("Argo Yesky: Cannot gain punk on entry - deck is empty");
        return false;
      }

      // Set up punk placement
      state.pending = {
        type: "place_punk",
        source: context.card,
        sourcePlayerId: context.playerId,
        fromArgoEntry: true,
      };

      console.log("Argo Yesky entry: Place a punk");
      return true;
    },
  },
  karliblaze: {
    onEntry: (state, context) => {
      const card = state.getCard(
        context.playerId,
        context.columnIndex,
        context.position
      );
      if (card) {
        card.isReady = true;
        console.log("Karli Blaze: Enters play ready");
      }
      return true;
    },
  },
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
        // Check deck exhaustion manually here
        if (state.deck.length === 0) {
          state.deckExhaustedCount = (state.deckExhaustedCount || 0) + 1;
          console.log(`Deck exhausted - count: ${state.deckExhaustedCount}`);

          if (state.deckExhaustedCount === 1) {
            // Check for Obelisk
            for (const playerId of ["left", "right"]) {
              const player = state.players[playerId];
              for (let col = 0; col < 3; col++) {
                const camp = player.columns[col].getCard(0);
                if (
                  camp &&
                  camp.name.toLowerCase() === "obelisk" &&
                  !camp.isDestroyed
                ) {
                  console.log(`${playerId} wins due to Obelisk!`);
                  state.phase = "game_over";
                  state.winner = playerId;
                  return true;
                }
              }
            }
          }
        }
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
