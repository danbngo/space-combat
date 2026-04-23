// Station System
class StationSystem {
    static repairShip(gameState, ship) {
        if (gameState.credits < CONSTANTS.REPAIR_COST) {
            alert('Not enough credits to repair ship.');
            return false;
        }

        if (ship.hull >= ship.maxHull) {
            alert('Ship hull is already at maximum.');
            return false;
        }

        gameState.credits -= CONSTANTS.REPAIR_COST;
        ship.rechargeHull(CONSTANTS.REPAIR_AMOUNT);
        return true;
    }

    static buyNewShip(gameState, shipStats, cost) {
        if (gameState.playerShips.length >= CONSTANTS.PLAYER_STARTING_SHIPS) {
            alert('Fleet is at maximum capacity.');
            return false;
        }

        if (gameState.credits < cost) {
            alert('Not enough credits to buy a new ship.');
            return false;
        }

        gameState.credits -= cost;
        const newShip = new Ship(0, 0, true, 0, shipStats);
        gameState.playerShips.push(newShip);
        gameState.selectedShip = newShip;
        return true;
    }

    static sellShip(gameState, ship) {
        if (gameState.playerShips.length <= 1) {
            alert('You must keep at least one ship in your fleet.');
            return false;
        }

        const tradeValue = this.calculateShipSaleValue(ship);
        const shipIndex = gameState.playerShips.indexOf(ship);

        if (shipIndex === -1) {
            alert('Ship not found.');
            return false;
        }

        gameState.playerShips.splice(shipIndex, 1);
        gameState.credits += tradeValue;
        gameState.selectedShip = gameState.playerShips[0] || null;
        return true;
    }

    static tradeInShip(gameState, ship, newShipStats, newCost) {
        const tradeValue = this.calculateShipSaleValue(ship);
        const effectiveCost = Math.max(0, newCost - tradeValue);

        if (gameState.credits < effectiveCost) {
            alert('You do not have enough credits to complete the trade.');
            return false;
        }

        const shipIndex = gameState.playerShips.indexOf(ship);
        if (shipIndex === -1) {
            alert('Ship not found.');
            return false;
        }

        gameState.playerShips.splice(shipIndex, 1);
        gameState.credits += tradeValue;
        gameState.credits -= newCost;

        const newShip = new Ship(0, 0, true, 0, newShipStats);
        gameState.playerShips.push(newShip);
        gameState.selectedShip = newShip;
        return true;
    }

    static calculateShipSaleValue(ship) {
        const baseValue = Math.floor(CONSTANTS.NEW_SHIP_BASE_COST * 0.5);
        const hullBonus = Math.round((ship.hull / ship.maxHull) * 50);
        const shieldBonus = Math.round((ship.shields / ship.maxShields) * 30);
        const weaponBonus = ship.laserDamage * 2;
        const engineBonus = ship.engine * 3;
        return Math.max(10, baseValue + hullBonus + shieldBonus + weaponBonus + engineBonus);
    }

    static rechargeShields(ships) {
        ships.forEach(ship => {
            ship.rechargeShields(ship.maxShields * 0.5);
        });
    }

    static visitStation(gameState) {
        this.rechargeShields(gameState.playerShips);
        return true;
    }
}
