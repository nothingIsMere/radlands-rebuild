// target-validator.js
export class TargetValidator {
  static canTarget(
    state,
    targetPlayer,
    targetColumn,
    targetPosition,
    options = {}
  ) {
    const {
      allowOwn = false,
      allowProtected = false,
      requirePerson = false,
      requireCamp = false,
      requireDamaged = false,
      requireUndamaged = false,
    } = options;

    const card = state.getCard(targetPlayer, targetColumn, targetPosition);
    if (!card || card.isDestroyed) return false;

    if (requirePerson && card.type !== "person") return false;
    if (requireCamp && card.type !== "camp") return false;

    if (requireDamaged && !card.isDamaged) return false;
    if (requireUndamaged && card.isDamaged) return false;

    if (!allowProtected) {
      if (state.turnEvents?.highGroundActive) {
        const opponentId = state.currentPlayer === "left" ? "right" : "left";
        if (targetPlayer === opponentId) return true;
      }
      const column = state.players[targetPlayer].columns[targetColumn];
      if (column.isProtected(targetPosition)) return false;
    }

    return true;
  }

  static findValidTargets(state, sourcePlayerId, options = {}) {
    const targets = [];
    const players = options.allowOwn
      ? [sourcePlayerId]
      : [sourcePlayerId === "left" ? "right" : "left"];

    for (const playerId of players) {
      for (let col = 0; col < 3; col++) {
        for (let pos = 0; pos < 3; pos++) {
          if (this.canTarget(state, playerId, col, pos, options)) {
            targets.push({
              playerId,
              columnIndex: col,
              position: pos,
              card: state.getCard(playerId, col, pos),
            });
          }
        }
      }
    }
    return targets;
  }
}
