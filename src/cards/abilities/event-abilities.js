// event-abilities.js
export const eventAbilities = {
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
