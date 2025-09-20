// event-abilities.js
export const eventAbilities = {
  napalm: {
    cost: 2,
    queueNumber: 1, // Goes to queue slot 1
    junkEffect: "restore",
    effect: {
      handler: (state, context) => {
        console.log("Napalm event resolving!");

        // Find which enemy columns have at least one person
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        const validColumns = [];

        for (let col = 0; col < 3; col++) {
          let hasPeople = false;
          for (let pos = 0; pos < 3; pos++) {
            const card = opponent.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              hasPeople = true;
              break;
            }
          }
          if (hasPeople) {
            validColumns.push(col);
          }
        }

        if (validColumns.length === 0) {
          console.log("Napalm: No enemy columns with people");
          // Still discard the event
          if (context.eventCard) {
            state.discard.push(context.eventCard);
          }
          return true;
        }

        // Set up column selection
        state.pending = {
          type: "napalm_select_column",
          source: context.eventCard,
          sourcePlayerId: context.playerId,
          targetPlayerId: opponentId,
          validColumns: validColumns,
          eventCard: context.eventCard,
        };

        console.log(
          `Napalm: Select enemy column to destroy (${validColumns.length} columns have people)`
        );
        return true;
      },
    },
  },
  strafe: {
    cost: 2,
    queueNumber: 0, // Instant event!
    junkEffect: "card",
    effect: {
      handler: (state, context) => {
        console.log(
          "Strafe event resolving - injuring all unprotected enemies!"
        );

        // Determine opponent
        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];

        let injuredCount = 0;
        let destroyedCount = 0;

        // Process each column
        for (let col = 0; col < 3; col++) {
          // Process from front to back to avoid movement issues
          for (let pos = 2; pos >= 0; pos--) {
            const card = opponent.columns[col].getCard(pos);

            // Only affect unprotected people
            if (card && card.type === "person" && !card.isDestroyed) {
              // Check if protected
              if (!opponent.columns[col].isProtected(pos)) {
                // Apply injury
                if (card.isDamaged || card.isPunk) {
                  // Destroy it
                  card.isDestroyed = true;

                  if (card.isPunk) {
                    const returnCard = {
                      id: card.id,
                      name: card.originalName || "Unknown Card",
                      type: "person",
                      cost: card.cost || 0,
                      abilities: card.abilities || [],
                      junkEffect: card.junkEffect,
                    };
                    state.deck.unshift(returnCard);
                    console.log(`Strafe destroyed punk`);
                  } else {
                    state.discard.push(card);
                    console.log(`Strafe destroyed ${card.name}`);
                  }

                  // Remove from column
                  opponent.columns[col].setCard(pos, null);

                  // Move card in front back
                  if (pos < 2) {
                    const cardInFront = opponent.columns[col].getCard(pos + 1);
                    if (cardInFront) {
                      opponent.columns[col].setCard(pos, cardInFront);
                      opponent.columns[col].setCard(pos + 1, null);
                    }
                  }

                  destroyedCount++;
                } else {
                  // Just damage it
                  card.isDamaged = true;
                  card.isReady = false;
                  console.log(`Strafe injured ${card.name}`);
                  injuredCount++;
                }
              } else {
                console.log(`${card.name} is protected, Strafe can't hit it`);
              }
            }
          }
        }

        console.log(
          `Strafe complete: ${injuredCount} injured, ${destroyedCount} destroyed`
        );

        // Discard the event (instant events should discard themselves)
        if (context.eventCard) {
          state.discard.push(context.eventCard);
        }

        return true;
      },
    },
  },
  radiation: {
    cost: 2,
    queueNumber: 1,
    junkEffect: "raid",
    effect: {
      handler: (state, context) => {
        console.log("Radiation event resolving - injuring ALL people!");

        let destroyedCount = 0;
        let injuredCount = 0;

        // Process both players
        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];

          // Process each column
          for (let col = 0; col < 3; col++) {
            // CRITICAL: Process from front to back (position 2, then 1, then 0)
            // This way, when we destroy a card and others slide back, we've already
            // processed the cards that would slide
            for (let pos = 2; pos >= 0; pos--) {
              const card = player.columns[col].getCard(pos);

              // Only affect people (including punks), not camps
              if (card && card.type === "person" && !card.isDestroyed) {
                if (card.isDamaged || card.isPunk) {
                  // Destroy it
                  card.isDestroyed = true;

                  // Handle punk vs normal person
                  if (card.isPunk) {
                    const returnCard = {
                      id: card.id,
                      name: card.originalName || "Unknown Card",
                      type: "person",
                      cost: card.cost || 0,
                      abilities: card.abilities || [],
                      junkEffect: card.junkEffect,
                    };
                    state.deck.unshift(returnCard);
                    console.log(`Radiation destroyed punk`);
                  } else {
                    state.discard.push(card);
                    console.log(`Radiation destroyed ${card.name}`);
                  }

                  // Remove from column
                  player.columns[col].setCard(pos, null);

                  // Move card in front back (if we're at pos 0 or 1)
                  if (pos < 2) {
                    const cardInFront = player.columns[col].getCard(pos + 1);
                    if (cardInFront) {
                      player.columns[col].setCard(pos, cardInFront);
                      player.columns[col].setCard(pos + 1, null);
                    }
                  }

                  destroyedCount++;
                } else {
                  // Just damage it
                  card.isDamaged = true;
                  card.isReady = false;
                  console.log(`Radiation injured ${card.name}`);
                  injuredCount++;
                }
              }
            }
          }
        }

        console.log(
          `Radiation complete: ${injuredCount} injured, ${destroyedCount} destroyed`
        );

        // Discard the event
        if (context.eventCard) {
          state.discard.push(context.eventCard);
        }

        return true;
      },
    },
  },
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
