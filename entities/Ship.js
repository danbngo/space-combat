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

            const S = CONSTANTS.SHIP_STATS;
            this.maxHull = Math.max(1, Math.round((S.HULL_MIN + S.HULL_MAX) / 2 * typeData.hullMult));
            this.hull = this.maxHull;
            this.maxShields = Math.max(0, Math.round((S.SHIELDS_MIN + S.SHIELDS_MAX) / 2 * typeData.shieldMult));
            this.shields = this.maxShields;
            this.laserDamage = Math.max(1, Math.round((S.LASER_MIN + S.LASER_MAX) / 2 * typeData.laserMult));
            this.radar = Math.max(1, Math.round((S.RADAR_MIN + S.RADAR_MAX) / 2 * typeData.radarMult));
            this.engine = Math.max(5, Math.round((S.ENGINE_MIN + S.ENGINE_MAX) / 2 * typeData.engineMult));
        }
        
        // Cargo capacity — derived from ship type (carries items into combat)
        const _cargoTypeData = CONSTANTS.SHIP_TYPES.find(t => t.type === this.shipType);
        this.cargoCapacity = _cargoTypeData?.cargoCapacity ?? 1;
        this.inventory = [];

        // Level system — stores base stats so upgrades scale correctly
        this.level = 1;
        this._baseMaxHull = this.maxHull;
        this._baseMaxShields = this.maxShields;
        this._baseLaserDamage = this.laserDamage;
        this._baseRadar = this.radar;
        this._baseEngine = this.engine;

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
        this.sizeMult = _typeData?.sizeMult ?? 1.0;
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

        // Cloud status effect turns — set to 1 each frame while in cloud, decremented each round-end
        // 0-persistence: expires one round after the ship leaves the cloud
        this.dustTurns   = 0;
        this.iceTurns    = 0;
        this.plasmaTurns = 0;

        // Animations
        this.targetX = x;
        this.targetY = y;
        this.targetRotation = angle;
        this.isMoving = false;
        this.isShooting = false;
        this.shootingTarget = null;
    }

    upgradeLevel() {
        if (this.level >= 5) return false;
        this.level++;
        const mults = CONSTANTS.SHIP_LEVEL_MULTS;
        const mult = mults[this.level - 1];
        this.maxHull = Math.max(1, Math.round(this._baseMaxHull * mult));
        this.hull = Math.min(this.hull, this.maxHull);
        this.maxShields = Math.max(0, Math.round(this._baseMaxShields * mult));
        this.shields = Math.min(this.shields, this.maxShields);
        this.laserDamage = Math.max(1, Math.round(this._baseLaserDamage * mult));
        this.radar = Math.max(1, Math.round(this._baseRadar * mult));
        this.engine = Math.max(5, Math.round(this._baseEngine * mult));
        return true;
    }

    decloak() {
        this.cloaked = false;
        this.cloakTurnsRemaining = 0;
    }

    dephase() {
        if ((this.phasedTurns || 0) > 0) {
            this.phasedTurns = 0;
            return true;
        }
        return false;
    }
    
    takeDamage(damage, isLaser = false) {
        if ((this.phasedTurns || 0) > 0) return { shieldAbsorb: 0, hullDmg: 0 };
        if ((this.stasisTurns || 0) > 0) return { shieldAbsorb: 0, hullDmg: 0 };
        if (!isLaser && (this.iceTurns || 0) > 0 && damage > 0) damage = Math.ceil(damage * CONSTANTS.FROZEN_DAMAGE_MULT);
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
        } else if (e.type === 'hull_regen') {
            this.hullRegenPerRound = (this.hullRegenPerRound || 0) + amt;
        } else if (e.type === 'shield_regen') {
            this.shieldRegenPerRound = (this.shieldRegenPerRound || 0) + amt;
        } else if (e.type === 'collision_immune') {
            this.collisionImmune = true;
        } else if (e.type === 'reflect_projectile') {
            this.projectileReflectChance = (this.projectileReflectChance || 0) + 0.20;
        } else if (e.type === 'repulsor') {
            this.hasRepulsor = true;
        } else if (e.type === 'ravager') {
            this.hasRavager = true;
        } else if (e.type === 'scatter') {
            this.hasScatter = true;
        } else if (e.type === 'attractor') {
            this.hasAttractor = true;
        } else if (e.type === 'ion_laser') {
            this.laserDamage += amt;
            this.hasIonLaser = true;
        } else if (e.type === 'cargo_increase') {
            this.cargoCapacity = (this.cargoCapacity || 1) + amt;
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
        if ((this.webTurns || 0) > 0) return Math.max(5, Math.round(this.engine * CONSTANTS.WEB_SPEED_MULT));
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

    shootAt(targetShip, maxRange, alwaysHit = false) {
        this.isShooting = true;
        this.shootingTarget = targetShip;

        const effectiveLaser = (this.superchargedTurns || 0) > 0 ? this.laserDamage * 2 : this.laserDamage;

        let hitChance = 1;
        if (!alwaysHit && maxRange !== undefined && maxRange > 0) {
            const dist = distance(this.x, this.y, targetShip.x, targetShip.y);
            hitChance = 1 - (Math.min(1, dist / maxRange) * 0.5);
        }

        const isHit = alwaysHit || Math.random() < hitChance;
        let damage = 0;

        if (isHit) {
            damage = effectiveLaser + randomInt(-3, 3);
            damage = Math.max(1, damage);
        }

        return { hit: isHit, damage, shooter: this, target: targetShip };
    }

    skipTurn() {
        this.actionsRemaining = Math.max(0, this.actionsRemaining - 1);
        const base = Math.floor(this.engine / 2);
        this.rechargeShields((this.plasmaTurns || 0) > 0 ? base * CONSTANTS.OVERHEATED_SHIELD_MULT : base);
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
