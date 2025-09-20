// event-abilities.js
export const eventAbilities = {
  // In event-abilities.js, add this to the eventAbilities object:

  famine: {
    cost: 1,
    queueNumber: 1, // Goes to queue slot 1
    junkEffect: "injure",
    effect: {
      handler: (state, context) => {
        console.log("Famine event resolving!");

        const activePlayerId = context.playerId;

        // Count people for active player first
        const activePlayer = state.players[activePlayerId];
        let activePeople = [];

        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = activePlayer.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              activePeople.push({
                card,
                playerId: activePlayerId,
                columnIndex: col,
                position: pos,
              });
            }
          }
        }

        if (activePeople.length <= 1) {
          console.log(
            `${activePlayerId} has ${activePeople.length} people, no selection needed`
          );

          // Now check opponent
          const opponentId = activePlayerId === "left" ? "right" : "left";
          const opponent = state.players[opponentId];
          let opponentPeople = [];

          for (let col = 0; col < 3; col++) {
            for (let pos = 1; pos <= 2; pos++) {
              const card = opponent.columns[col].getCard(pos);
              if (card && card.type === "person" && !card.isDestroyed) {
                opponentPeople.push({
                  card,
                  playerId: opponentId,
                  columnIndex: col,
                  position: pos,
                });
              }
            }
          }

          if (opponentPeople.length <= 1) {
            console.log(
              `${opponentId} has ${opponentPeople.length} people, no selection needed`
            );
            // No one needs to select, discard event
            if (context.eventCard) {
              state.discard.push(context.eventCard);
            }
            return true;
          }

          // Only opponent needs to select
          state.pending = {
            type: "famine_select_keep",
            currentSelectingPlayer: opponentId,
            activePlayerId: activePlayerId, // Who played the event
            validTargets: opponentPeople,
            eventCard: context.eventCard,
            activePlayerDone: true, // Active player had nothing to select
          };

          console.log(`Famine: ${opponentId} must select one person to keep`);
          return true;
        }

        // Active player needs to select first
        state.pending = {
          type: "famine_select_keep",
          currentSelectingPlayer: activePlayerId,
          activePlayerId: activePlayerId,
          validTargets: activePeople,
          eventCard: context.eventCard,
          activePlayerDone: false,
        };

        console.log(`Famine: ${activePlayerId} must select one person to keep`);
        return true;
      },
    },
  },

  truce: {
    cost: 2,
    queueNumber: 0, // Instant event - resolves immediately
    junkEffect: "water",
    effect: {
      handler: (state, context) => {
        console.log("Truce event resolving - returning all people to hands!");

        let returnedCount = 0;

        // Process both players
        for (const playerId of ["left", "right"]) {
          const player = state.players[playerId];

          // Process each column from front to back to handle removal properly
          for (let col = 0; col < 3; col++) {
            // Process positions 2, then 1 (front to back)
            for (let pos = 2; pos >= 1; pos--) {
              const card = player.columns[col].getCard(pos);

              if (card && card.type === "person" && !card.isDestroyed) {
                // Handle punks - reveal them when returning to hand
                if (card.isPunk) {
                  const revealedCard = {
                    id: card.id,
                    name: card.originalName || "Unknown Card",
                    type: "person",
                    cost: card.originalCard?.cost || card.cost || 0,
                    abilities:
                      card.originalCard?.abilities || card.abilities || [],
                    junkEffect:
                      card.originalCard?.junkEffect || card.junkEffect,
                  };
                  player.hand.push(revealedCard);
                  console.log(
                    `Truce: Punk revealed as ${revealedCard.name} and returned to ${playerId}'s hand`
                  );
                } else {
                  // Normal person returns as-is
                  const returnCard = {
                    id: card.id,
                    name: card.name,
                    type: card.type,
                    cost: card.cost,
                    abilities: card.abilities,
                    junkEffect: card.junkEffect,
                  };
                  player.hand.push(returnCard);
                  console.log(
                    `Truce: ${card.name} returned to ${playerId}'s hand`
                  );
                }

                // Remove from column
                player.columns[col].setCard(pos, null);
                returnedCount++;
              }
            }
          }
        }

        console.log(
          `Truce complete: ${returnedCount} people returned to hands`
        );

        // Discard the event (instant events should discard themselves)
        if (context.eventCard) {
          state.discard.push(context.eventCard);
        }

        return true;
      },
    },
  },
  uprising: {
    cost: 1,
    queueNumber: 2, // Goes to queue slot 2
    junkEffect: "injure",
    effect: {
      handler: (state, context) => {
        console.log("Uprising event resolving - gaining punks!");

        const player = state.players[context.playerId];

        // Count current people (including punks)
        let currentPeopleCount = 0;
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            // Only slots 1 and 2 hold people
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              currentPeopleCount++;
            }
          }
        }

        console.log(`Current people count: ${currentPeopleCount}`);

        // Calculate how many punks we can actually gain
        const maxPunks = Math.min(3, 6 - currentPeopleCount);

        if (maxPunks === 0) {
          console.log("Uprising: Already at 6 people limit, no punks gained");
          // Still discard the event
          if (context.eventCard) {
            state.discard.push(context.eventCard);
          }
          return true;
        }

        // Check if deck has enough cards
        if (state.deck.length === 0) {
          console.log("Uprising: Deck is empty, no punks can be gained");
          if (context.eventCard) {
            state.discard.push(context.eventCard);
          }
          return true;
        }

        const punksToGain = Math.min(maxPunks, state.deck.length);
        console.log(
          `Uprising: Will gain ${punksToGain} punk${punksToGain > 1 ? "s" : ""}`
        );

        // Set up placement for first punk
        state.pending = {
          type: "uprising_place_punks",
          sourcePlayerId: context.playerId,
          punksRemaining: punksToGain,
          eventCard: context.eventCard,
        };

        console.log(`Uprising: Place punk 1 of ${punksToGain}`);
        return true;
      },
    },
  },
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
