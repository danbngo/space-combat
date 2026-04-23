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
        } else {
            // Generate random stats within ranges
            this.maxHull = generateRandomStats(CONSTANTS.SHIP_STATS.HULL_MIN, CONSTANTS.SHIP_STATS.HULL_MAX);
            this.hull = this.maxHull;
            
            this.maxShields = generateRandomStats(CONSTANTS.SHIP_STATS.SHIELDS_MIN, CONSTANTS.SHIP_STATS.SHIELDS_MAX);
            this.shields = this.maxShields;
            
            this.laserDamage = generateRandomStats(CONSTANTS.SHIP_STATS.LASER_MIN, CONSTANTS.SHIP_STATS.LASER_MAX);
            this.radar = randomFloat(CONSTANTS.SHIP_STATS.RADAR_MIN, CONSTANTS.SHIP_STATS.RADAR_MAX);
            this.engine = generateRandomStats(CONSTANTS.SHIP_STATS.ENGINE_MIN, CONSTANTS.SHIP_STATS.ENGINE_MAX);
        }
        
        // Combat state
        this.hasMovedThisTurn = false;
        this.hasActedThisTurn = false;
        this.alive = true;
        this.inCombat = false;
        
        // Animations
        this.targetX = x;
        this.targetY = y;
        this.targetRotation = angle;
        this.isMoving = false;
        this.isShooting = false;
        this.shootingTarget = null;
    }
    
    takeDamage(damage) {
        const absorbedByShields = Math.min(damage, this.shields);
        const remainingDamage = damage - absorbedByShields;
        
        this.shields -= absorbedByShields;
        this.hull -= remainingDamage;
        
        if (this.hull <= 0) {
            this.hull = 0;
            this.alive = false;
        }
    }
    
    rechargeShields(amount) {
        this.shields = Math.min(this.shields + amount, this.maxShields);
    }
    
    rechargeHull(amount) {
        this.hull = Math.min(this.hull + amount, this.maxHull);
    }
    
    canMove() {
        return !this.hasMovedThisTurn && this.alive;
    }
    
    canAct() {
        return !this.hasActedThisTurn && this.alive;
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
        
        this.hasMovedThisTurn = true;
        this.isMoving = true;
    }
    
    rotateTo(angle) {
        this.targetRotation = angle;
    }
    
    resetTurn() {
        this.hasMovedThisTurn = false;
        this.hasActedThisTurn = false;
    }
    
    shootAt(targetShip) {
        this.isShooting = true;
        this.shootingTarget = targetShip;
        this.hasActedThisTurn = true;
        
        // Calculate accuracy
        const isHit = Math.random() < this.getAccuracy();
        let damage = 0;
        
        if (isHit) {
            // Vary damage slightly
            damage = this.laserDamage + randomInt(-3, 3);
            damage = Math.max(1, damage); // Minimum 1 damage
        }
        
        return {
            hit: isHit,
            damage: damage,
            shooter: this,
            target: targetShip
        };
    }
    
    skipTurn() {
        this.hasActedThisTurn = true;
        const rechargeAmount = CONSTANTS.SHIELD_RECHARGE_PER_SKIP;
        this.rechargeShields(rechargeAmount);
    }
    
    getStatus() {
        return {
            alive: this.alive,
            hull: this.hull,
            shields: this.shields,
            canMove: this.canMove(),
            canAct: this.canAct()
        };
    }
}
