import { TargetValidator } from "../../core/target-validator.js";

// event-abilities.js
export const eventAbilities = {
  highground: {
    cost: 0,
    queueNumber: 1,
    junkEffect: "water",
    effect: {
      handler: (state, context) => {
        console.log("High Ground event resolving!");

        const playerId = context.playerId;
        const player = state.players[playerId];

        // Collect all the player's people
        let collectedPeople = [];
        for (let col = 0; col < 3; col++) {
          for (let pos = 1; pos <= 2; pos++) {
            const card = player.columns[col].getCard(pos);
            if (card && card.type === "person" && !card.isDestroyed) {
              collectedPeople.push({
                ...card,
                originalColumn: col,
                originalPosition: pos,
              });
              // Clear the slot
              player.columns[col].setCard(pos, null);
            }
          }
        }

        if (collectedPeople.length === 0) {
          console.log("High Ground: No people to rearrange");
          // Still apply unprotected effect
          state.turnEvents.highGroundActive = true;
          if (context.eventCard) {
            state.discard.push(context.eventCard);
          }
          return true;
        }

        // Set up selection mode
        state.pending = {
          type: "highground_select_person",
          playerId: playerId,
          collectedPeople: collectedPeople,
          eventCard: context.eventCard,
        };

        console.log(
          `High Ground: Select which person to place first (${collectedPeople.length} total)`
        );
        return true;
      },
    },
  },

  bombardment: {
    cost: 4,
    queueNumber: 3,
    junkEffect: "restore",
    effect: {
      handler: (state, context) => {
        console.log("Bombardment event resolving!");

        const opponentId = context.playerId === "left" ? "right" : "left";
        const opponent = state.players[opponentId];
        let destroyedCamps = 0;

        // First, damage all opponent's camps
        for (let col = 0; col < 3; col++) {
          const camp = opponent.columns[col].getCard(0);
          if (camp && camp.type === "camp" && !camp.isDestroyed) {
            if (camp.isDamaged) {
              camp.isDestroyed = true;
              destroyedCamps++;
              console.log(`Bombardment destroyed ${camp.name} camp!`);
            } else {
              camp.isDamaged = true;
              console.log(`Bombardment damaged ${camp.name} camp`);
            }
          } else if (camp && camp.isDestroyed) {
            // Count already destroyed camps for card draw
            destroyedCamps++;
          }
        }

        // Check for game end after damaging/destroying camps
        // Note: We need to use the command system's checkGameEnd
        // This should be called from command-system.js after the event resolves

        // Draw 1 card for each destroyed camp
        const player = state.players[context.playerId];
        console.log(
          `Bombardment: Drawing ${destroyedCamps} cards for destroyed camps`
        );

        for (let i = 0; i < destroyedCamps; i++) {
          const result = state.drawCardWithReshuffle(true, context.playerId);
          if (result.gameEnded) {
            return true;
          }
          if (!result.card) {
            break; // No more cards even after reshuffle
          }
          console.log(`Bombardment: Drew ${result.card.name}`);
        }

        console.log(`Bombardment complete: ${destroyedCamps} camps destroyed`);
        return true;
      },
    },
  },

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

          return true;
        }

        // Before setting up punk placement:
        if (state.deck.length === 0) {
          // Try reshuffling
          const result = state.drawCardWithReshuffle(false);
          if (result.gameEnded) {
            // Handle game end
            return true;
          }
          if (!result.card) {
            console.log("Cannot gain punk - no cards available");
            return false; // or handle appropriately
          }
          // Put it back for the actual punk placement
          state.deck.unshift(result.card);
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
    queueNumber: 1,
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
          return true;
        }

        // Set up column selection - ACTIVE PLAYER selects, not opponent
        state.pending = {
          type: "napalm_select_column",
          source: context.eventCard,
          sourcePlayerId: context.playerId, // The player who played Napalm
          targetPlayerId: context.playerId, // CHANGED: Active player selects, not opponent
          damagePlayerId: opponentId, // Track whose column gets damaged
          validColumns: validColumns,
          eventCard: context.eventCard,
        };

        console.log(
          `Napalm: ${context.playerId} select enemy column to destroy (${validColumns.length} columns have people)`
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

        // Find all unprotected enemy people
        const targets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            requirePerson: true,
            allowProtected: false, // Strafe respects protection
          }
        );

        let injuredCount = 0;
        let destroyedCount = 0;

        // Process targets from back to front to handle removal properly
        // Sort by position descending within each column
        targets.sort((a, b) => {
          if (a.columnIndex === b.columnIndex) {
            return b.position - a.position;
          }
          return a.columnIndex - b.columnIndex;
        });

        // Process each target
        for (const target of targets) {
          const card = target.card;
          const opponent = state.players[target.playerId];
          const column = opponent.columns[target.columnIndex];

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
            column.setCard(target.position, null);

            // Move card in front back
            if (target.position < 2) {
              const cardInFront = column.getCard(target.position + 1);
              if (cardInFront) {
                column.setCard(target.position, cardInFront);
                column.setCard(target.position + 1, null);
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
        }

        console.log(
          `Strafe complete: ${injuredCount} injured, ${destroyedCount} destroyed`
        );

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
        const validTargets = TargetValidator.findValidTargets(
          state,
          context.playerId,
          {
            requirePerson: true,
            allowProtected: true, // Banish ignores protection
          }
        );

        if (validTargets.length === 0) {
          console.log("Banish: No enemy people to destroy");

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

        // Draw 4 cards
        const cardsDrawn = [];
        for (let i = 0; i < 4; i++) {
          const result = state.drawCardWithReshuffle(true, context.playerId);

          if (result.gameEnded) {
            return true;
          }

          if (result.card) {
            cardsDrawn.push(result.card);
          }
        }

        console.log(
          `Interrogate: Drew ${cardsDrawn.length} cards:`,
          cardsDrawn.map((c) => c.name)
        );

        if (cardsDrawn.length === 0) {
          console.log("Interrogate: No cards to draw from deck");
          return true;
        }

        // Set up selection to KEEP 1 card
        state.pending = {
          type: "interrogate_keep",
          sourcePlayerId: context.playerId,
          drawnCards: cardsDrawn,
          eventCard: context.eventCard,
        };

        console.log("Interrogate: Choose 1 card to keep from the 4 drawn");
        return true;
      },
    },
  },
};
