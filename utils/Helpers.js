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
    return `Hull: ${ship.hull}/${ship.maxHull} | Shields: ${ship.shields}/${ship.maxShields} | Laser: ${ship.laserDamage} | Radar: ${ship.radar} | Engine: ${ship.engine}`;
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

// Trace a ship polygon path onto ctx. Call fill() or stroke() after.
function drawShipShape(ctx, verts, scale) {
    ctx.beginPath();
    ctx.moveTo(verts[0][0] * scale, verts[0][1] * scale);
    for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i][0] * scale, verts[i][1] * scale);
    }
    ctx.closePath();
}

function toRoman(n) {
    const nums = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
    return nums[n] || String(n);
}

function assignFleetNames(ships) {
    const counts = {};
    ships.forEach(ship => {
        const type = ship.shipType || 'Ship';
        counts[type] = (counts[type] || 0) + 1;
        ship.name = `${type} ${toRoman(counts[type])}`;
    });
}

// Returns the nearest point inside (or on the boundary of) the ship's movement oval
function clampToMovementOval(ship, tx, ty) {
    const dx = tx - ship.x, dy = ty - ship.y;
    const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    const ellipseCx = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_OFFSET;
    const major = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MAJOR;
    const minor = ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MINOR;

    const ex = localX - ellipseCx;
    const ey = localY;
    const nx = ex / major, ny = ey / minor;

    let clampedLocalX, clampedLocalY;
    if (nx * nx + ny * ny <= 1) {
        clampedLocalX = localX;
        clampedLocalY = localY;
    } else {
        const t = Math.atan2(ny, nx);
        clampedLocalX = ellipseCx + major * Math.cos(t);
        clampedLocalY = minor * Math.sin(t);
    }

    return {
        x: ship.x + clampedLocalX * cos - clampedLocalY * sin,
        y: ship.y + clampedLocalX * sin + clampedLocalY * cos
    };
}

// Returns true if world point (tx, ty) is inside the ship's movement oval
function isWithinMovementOval(ship, tx, ty) {
    const dx = tx - ship.x, dy = ty - ship.y;
    const cos = Math.cos(ship.rotation), sin = Math.sin(ship.rotation);
    // Rotate to ship local space (forward = +X)
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    // Check inside shifted ellipse
    const cx = localX - ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_OFFSET;
    const nx = cx / (ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MAJOR);
    const ny = localY / (ship.engine * CONSTANTS.COMBAT_MOVE_OVAL_MINOR);
    return nx * nx + ny * ny <= 1;
}

// Returns true if target is within the forward cone of the tractor beam emitter.
function isInTractorBeamCone(puller, target) {
    const angleToTarget = Math.atan2(target.y - puller.y, target.x - puller.x);
    const localAngle = normalizeAngle(angleToTarget - puller.rotation);
    return Math.abs(localAngle) <= CONSTANTS.TRACTOR_BEAM_HALF_ANGLE;
}

// Returns true if target is within the port or starboard firing triangle of shooter.
// Triangles are centered at ±90° (perpendicular) from the ship's facing direction.
function isInFiringZone(shooter, target) {
    const angleToTarget = Math.atan2(target.y - shooter.y, target.x - shooter.x);
    const localAngle = normalizeAngle(angleToTarget - shooter.rotation);
    const portDiff  = Math.abs(normalizeAngle(localAngle + Math.PI / 2));
    const stbdDiff  = Math.abs(normalizeAngle(localAngle - Math.PI / 2));
    return Math.min(portDiff, stbdDiff) <= CONSTANTS.SHOOTING_ZONE_HALF_ANGLE;
}

function getRouteKey(id1, id2) {
    return Math.min(id1, id2) + '-' + Math.max(id1, id2);
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
