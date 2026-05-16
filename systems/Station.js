// Station System
class StationSystem {

    static buyNewShip(gameState, shipStats, cost) {
        const aliveCount = gameState.playerShips.filter(s => s.alive).length;
        if (aliveCount >= maxFleetSize(gameState)) {
            alert('Fleet is at maximum capacity (alive ships).');
            return false;
        }

        if (gameState.credits < cost) {
            alert('Not enough credits to buy a new ship.');
            return false;
        }

        gameState.credits -= cost;
        const newShip = new Ship(0, 0, true, 0, shipStats);
        newShip._buyPrice = cost;
        gameState.playerShips.push(newShip);
        gameState.selectedShip = newShip;
        return true;
    }

    static junkShip(gameState, ship) {
        const aliveCount = gameState.playerShips.filter(s => s.alive).length;
        if (ship.alive && aliveCount <= 1) {
            alert('Cannot junk your last active ship.');
            return false;
        }
        const idx = gameState.playerShips.indexOf(ship);
        if (idx === -1) return false;
        gameState.playerShips.splice(idx, 1);
        gameState.selectedShip = gameState.playerShips.find(s => s.alive) || gameState.playerShips[0] || null;
        return true;
    }

    static resurrectShip(gameState, ship) {
        const cost = CONSTANTS.RESURRECT_COST;
        if (gameState.credits < cost) {
            alert('Not enough credits.');
            return false;
        }
        if (ship.alive) return false;
        gameState.credits -= cost;
        ship.alive = true;
        ship.hull = Math.max(1, Math.round(ship.maxHull * 0.25));
        ship.shields = 0;
        return true;
    }

    static upgradeShipLevel(gameState, ship) {
        if ((ship.level || 1) >= 5) return false;
        const level = ship.level || 1;
        const cost = CONSTANTS.SHIP_LEVEL_COSTS[level - 1];
        if (gameState.credits < cost) {
            alert('Not enough credits.');
            return false;
        }
        gameState.credits -= cost;
        ship.upgradeLevel();
        return true;
    }

    static installModule(gameState, ship, moduleDef, quality = 1.0, adjustedCost = null) {
        const cost = adjustedCost !== null ? adjustedCost : moduleDef.cost;
        if (gameState.credits < cost) return false;
        if (ship.modules.length >= ship.moduleSlots) return false;
        if (ship.modules.some(m => m.id === moduleDef.id)) return false;
        if (moduleDef.exclusiveGroup) {
            const conflict = ship.modules.some(m => {
                const def = CONSTANTS.MODULES.find(md => md.id === m.id);
                return def && def.exclusiveGroup === moduleDef.exclusiveGroup;
            });
            if (conflict) return false;
        }
        gameState.credits -= cost;
        ship.installModule(moduleDef, quality);
        return true;
    }

    static visitStation(gameState) {
        return true;
    }
}
