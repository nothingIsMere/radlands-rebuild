// event-abilities.js
export const eventAbilities = {
  banish: {
    cost: 1,
    queueNumber: 1, // Goes in queue slot 1
    junkEffect: "raid",
    effect: {
      handler: (state, context) => {
        console.log("Banish event resolving!");

        // Find ALL enemy PEOPLE (not camps, but ignoring protection)
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validTargets = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            // Only target people (including punks), not camps
            if (card && card.type === "person" && !card.isDestroyed) {
              // Banish ignores protection
              validTargets.push({
                playerId: opponentId,
                columnIndex: col,
                position: pos,
                card,
              });
            }
          }
        }

        if (validTargets.length === 0) {
          console.log("Banish: No enemy people to destroy");
          // Still discard the event
          if (context.eventCard) {
            state.discard.push(context.eventCard);
          }
          return true;
        }

        // Set up targeting
        state.pending = {
          type: "banish_destroy",
          source: context.eventCard,
          sourcePlayerId: context.playerId,
          validTargets: validTargets,
          eventCard: context.eventCard,
        };

        console.log(
          `Banish: Select any enemy person to destroy (${validTargets.length} targets, ignores protection)`
        );
        return true;
      },
    },
  },
  interrogate: {
    cost: 1,
    queueNumber: 0,
    junkEffect: "water",
    effect: {
      handler: (state, context) => {
        console.log("Interrogate handler called!");
        const player = state.players[context.playerId];

        // Draw 4 cards and TRACK THEM
        const cardsDrawn = [];
        for (let i = 0; i < 4 && state.deck.length > 0; i++) {
          const card = state.deck.shift();
          player.hand.push(card);
          cardsDrawn.push(card);
        }

        console.log(
          `Interrogate: Drew ${cardsDrawn.length} cards:`,
          cardsDrawn.map((c) => c.name)
        );

        if (cardsDrawn.length === 0) {
          console.log("Interrogate: No cards to draw from deck");
          return true;
        }

        // Set up selection to KEEP 1 card from those drawn
        state.pending = {
          type: "interrogate_keep",
          sourcePlayerId: context.playerId,
          drawnCards: cardsDrawn, // Store the specific cards drawn
          eventCard: context.eventCard,
        };

        console.log("Interrogate: Choose 1 card to keep from the 4 drawn");

        return true;
      },
    },
  },
};
