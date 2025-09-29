# Radlands Rebuild - Current Status

## Branch: multiplayer-prep

## Completed:

1. Extracted 25+ pure game logic functions to game-logic.js
2. Created ActionTypes constants in core/action-types.js
3. Updated all UI and command-system to use ActionTypes
4. All game mechanics working correctly

## Next Steps:

1. Create a central action dispatcher that all UI events go through
2. Add action logging for debugging/replay
3. Create state serialization for network transfer
4. Build simple server layer

## Files Modified Recently:

- core/action-types.js (new)
- core/game-logic.js (new, has all pure functions)
- core/command-system.js (refactored to use pure functions)
- ui/ui-renderer.js (updated to use ActionTypes)

## Working Features to Test:

- Card placement and abilities
- Turn management
- Water economy
- Event queue
- Punk mechanics
- All special traits (Vera Vosh, Karli Blaze, etc.)

## Goal:

Enable two players to play over internet, hosted on home laptop
