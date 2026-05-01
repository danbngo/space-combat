// Ship Class
class Ship {
    constructor(x, y, isPlayer = false, angle = 0, stats = null) {
        this.x = x;
        this.y = y;
        this.rotation = angle;
        this.isPlayer = isPlayer;

        if (stats) {
            this.maxHull = stats.hull;
            this.hull = stats.hull;
            this.maxShields = stats.shields;
            this.shields = stats.shields;
            this.laserDamage = stats.laser;
            this.radar = stats.radar;
            this.engine = stats.engine;
            this.shipType = stats.type || 'Unknown';
            this.name = stats.type || 'Unknown';
        } else {
            const availableTypes = CONSTANTS.SHIP_TYPES.filter(t => !t.internal);
            const typeData = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            this.shipType = typeData.type;
            this.name = typeData.type;

            this.maxHull = Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.HULL_MIN, CONSTANTS.SHIP_STATS.HULL_MAX) * typeData.hullMult));
            this.hull = this.maxHull;
            this.maxShields = Math.max(0, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.SHIELDS_MIN, CONSTANTS.SHIP_STATS.SHIELDS_MAX) * typeData.shieldMult));
            this.shields = this.maxShields;
            this.laserDamage = Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.LASER_MIN, CONSTANTS.SHIP_STATS.LASER_MAX) * typeData.laserMult));
            this.radar = Math.max(1, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.RADAR_MIN, CONSTANTS.SHIP_STATS.RADAR_MAX) * typeData.radarMult));
            this.engine = Math.max(5, Math.round(generateRandomStats(CONSTANTS.SHIP_STATS.ENGINE_MIN, CONSTANTS.SHIP_STATS.ENGINE_MAX) * typeData.engineMult));
        }
        
        // Combat state
        this.actionsRemaining = 2;
        this.alive = true;
        this.inCombat = false;

        // Modules: builtinModules come with the ship type (no slot cost), modules are purchased
        this.modules = [];
        this.moduleSlots = CONSTANTS.MODULE_SLOTS;
        this.builtinModules = [];

        // Special moves — derived from built-in modules, extended by purchased modules
        this.specialMoves = [];
        this.specialMoveCooldowns = {}; // moveId → rounds remaining until usable
        const _typeData = CONSTANTS.SHIP_TYPES.find(t => t.type === this.shipType);
        if (_typeData && _typeData.builtinModules) {
            _typeData.builtinModules.forEach(modId => {
                this.builtinModules.push(modId);
                const modDef = CONSTANTS.MODULES.find(m => m.id === modId);
                if (modDef && modDef.effect && modDef.effect.type === 'special_move') {
                    if (!this.specialMoves.includes(modDef.effect.move)) {
                        this.specialMoves.push(modDef.effect.move);
                    }
                }
            });
        }
        
        // Cloak state
        this.cloaked = false;
        this.cloakTurnsRemaining = 0;

        // Cloud status effects (set each frame by Combat.updateStatusFlags)
        this.isDusty      = false;
        this.isFrozen     = false;
        this.isOverheated = false;

        // Animations
        this.targetX = x;
        this.targetY = y;
        this.targetRotation = angle;
        this.isMoving = false;
        this.isShooting = false;
        this.shootingTarget = null;
    }

    decloak() {
        this.cloaked = false;
        this.cloakTurnsRemaining = 0;
    }
    
    takeDamage(damage) {
        if (this.isFrozen && damage > 0) damage = Math.ceil(damage * CONSTANTS.FROZEN_DAMAGE_MULT);
        if (damage > 0) this.decloak();
        const absorbedByShields = Math.min(damage, this.shields);
        const remainingDamage = damage - absorbedByShields;

        this.shields -= absorbedByShields;
        this.hull -= remainingDamage;

        if (this.hull <= 0) {
            this.hull = 0;
            this.alive = false;
        }

        return { shieldAbsorb: absorbedByShields, hullDmg: remainingDamage };
    }

    triggerHitFlash(hullDmg, shieldAbsorb) {
        if (hullDmg > 0) {
            this._hullFlashStart = Date.now();
            // Store pre-damage fill pct so bar flashes the width that was filled before the hit
            this._hullFlashPct = Math.min(1, (this.hull + hullDmg) / this.maxHull);
        }
        if (shieldAbsorb > 0) {
            this._shieldFlashUntil = Date.now() + 180;
            this._shieldBarFlashStart = Date.now();
            this._shieldFlashPct = Math.min(1, (this.shields + shieldAbsorb) / this.maxShields);
        }
    }
    
    rechargeShields(amount) {
        this.shields = Math.min(this.shields + amount, this.maxShields);
    }
    
    rechargeHull(amount) {
        this.hull = Math.min(this.hull + amount, this.maxHull);
    }

    installModule(moduleDef, quality = 1.0) {
        this.modules.push({ id: moduleDef.id, quality });
        const e = moduleDef.effect;
        const amt = e.amount !== undefined ? Math.max(1, Math.round(e.amount * quality)) : 0;
        if (e.stat === 'maxHull') {
            this.maxHull += amt;
            this.hull = Math.min(this.hull + amt, this.maxHull);
        } else if (e.stat === 'maxShields') {
            this.maxShields += amt;
            this.shields = Math.min(this.shields + amt, this.maxShields);
        } else if (e.stat === 'radar') {
            this.radar = Math.max(1, this.radar + amt);
        } else if (e.stat === 'engine') {
            this.engine += amt;
        // 'bonus_action' has no immediate stat change
        } else if (e.type === 'special_move') {
            if (!this.specialMoves.includes(e.move)) this.specialMoves.push(e.move);
        }
    }

    canMove() {
        return this.actionsRemaining > 0 && this.alive;
    }

    canAct() {
        return this.actionsRemaining > 0 && this.alive;
    }
    
    getAccuracy() {
        // Radar determines accuracy, affects how likely shots hit
        return this.radar;
    }
    
    getMaxMoveDistance() {
        return this.engine;
    }
    
    moveToward(targetX, targetY, distance) {
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        const moveDistance = Math.min(distance, this.getMaxMoveDistance());
        
        this.targetX = this.x + Math.cos(angle) * moveDistance;
        this.targetY = this.y + Math.sin(angle) * moveDistance;
        this.targetRotation = angle;
        
        this.isMoving = true;
    }

    rotateTo(angle) {
        this.targetRotation = angle;
    }

    resetTurn() {
        this.actionsRemaining = 2;
    }

    shootAt(targetShip, maxRange) {
        this.isShooting = true;
        this.shootingTarget = targetShip;

        let hitChance = 1;
        if (maxRange !== undefined && maxRange > 0) {
            const dist = distance(this.x, this.y, targetShip.x, targetShip.y);
            hitChance = 1 - (Math.min(1, dist / maxRange) * 0.5);
        }

        const isHit = Math.random() < hitChance;
        let damage = 0;

        if (isHit) {
            damage = this.laserDamage + randomInt(-3, 3);
            damage = Math.max(1, damage);
        }

        return { hit: isHit, damage, shooter: this, target: targetShip };
    }

    skipTurn() {
        this.actionsRemaining = Math.max(0, this.actionsRemaining - 1);
        const base = Math.floor(this.engine / 2);
        this.rechargeShields(this.isOverheated ? base * CONSTANTS.OVERHEATED_SHIELD_MULT : base);
    }

    clone() {
        const s = Object.create(Ship.prototype);
        Object.assign(s, this);
        return s;
    }

    getStatus() {
        return { alive: this.alive, hull: this.hull, shields: this.shields, actionsRemaining: this.actionsRemaining };
    }
}
