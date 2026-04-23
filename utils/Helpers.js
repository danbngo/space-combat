// Helper Functions

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function randomBool(probability = 0.5) {
    return Math.random() < probability;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

function rotatePoint(x, y, angle, centerX, centerY) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = x - centerX;
    const dy = y - centerY;
    return {
        x: centerX + dx * cos - dy * sin,
        y: centerY + dx * sin + dy * cos
    };
}

function getRandomSystemName() {
    const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];
    const suffixes = ['Centauri', 'Major', 'Minor', 'Nebula', 'Prime', 'Sector', 'Station', 'Nova'];
    const numbers = randomInt(1, 999);
    return `${prefixes[randomInt(0, prefixes.length - 1)]} ${suffixes[randomInt(0, suffixes.length - 1)]} ${numbers}`;
}

function generateRandomStats(min, max) {
    return randomInt(min, max);
}

// Calculate minimum distance from a point to a line segment
function distancePointToLineSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) {
        // Line segment is actually a point
        return distance(px, py, x1, y1);
    }
    
    // Project point onto line, clamped to segment
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    
    return distance(px, py, projX, projY);
}

function formatStats(ship) {
    return `Hull: ${ship.hull}/${ship.maxHull} | Shields: ${ship.shields}/${ship.maxShields} | Laser: ${ship.laserDamage} | Radar: ${(ship.radar * 100).toFixed(0)}% | Engine: ${ship.engine}`;
}

function getCurrentSystemName() {
    if (window.gameState && window.gameState.currentSystem) {
        return window.gameState.currentSystem.name;
    }
    return 'Unknown';
}

function getDistance(system1, system2) {
    return distance(system1.x, system1.y, system2.x, system2.y);
}

function areShipsInContactTriangle(ship1, ship2) {
    // Check if ship2 is within the shooting triangle in front of ship1
    const angleToShip2 = angle(ship1.x, ship1.y, ship2.x, ship2.y);
    const angleDiff = normalizeAngle(angleToShip2 - ship1.rotation);
    
    return Math.abs(angleDiff) < CONSTANTS.SHOOTING_ANGLE;
}

function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
}

function wrapAngle(angle) {
    return angle % (2 * Math.PI);
}

function isShipInCombatArena(ship, centerX, centerY, radius) {
    const dist = distance(ship.x, ship.y, centerX, centerY);
    return dist <= radius;
}

function removeShipsOutsideArena(ships, centerX, centerY, radius) {
    return ships.filter(ship => isShipInCombatArena(ship, centerX, centerY, radius));
}

// Deep copy function for game state
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => deepCopy(item));
    }
    const copy = {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}
