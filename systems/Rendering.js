// Rendering System
class RenderingSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }
    
    clear() {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawCombatArena(centerX, centerY, radius) {
        // Draw boundary circle
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw center point
        this.ctx.fillStyle = '#666666';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw grid/pattern in arena
        this.drawArenaGrid(centerX, centerY, radius);
    }
    
    drawArenaGrid(centerX, centerY, radius) {
        this.ctx.strokeStyle = '#1a3a1a';
        this.ctx.lineWidth = 0.5;
        const gap = CONSTANTS.ARENA_GRID_GAP;
        
        for (let x = centerX - radius; x <= centerX + radius; x += gap) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, centerY - radius);
            this.ctx.lineTo(x, centerY + radius);
            this.ctx.stroke();
        }
        
        for (let y = centerY - radius; y <= centerY + radius; y += gap) {
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - radius, y);
            this.ctx.lineTo(centerX + radius, y);
            this.ctx.stroke();
        }
    }
    
    drawShip(ship, isSelected = false, centerX = this.centerX, centerY = this.centerY) {
        const x = ship.x;
        const y = ship.y;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(ship.rotation);
        
        // Ship body (triangle)
        this.ctx.fillStyle = ship.isPlayer ? '#00ffff' : '#ff3333';
        this.ctx.beginPath();
        this.ctx.moveTo(CONSTANTS.SHIP_SIZE, 0);
        this.ctx.lineTo(-CONSTANTS.SHIP_SIZE, -CONSTANTS.SHIP_SIZE);
        this.ctx.lineTo(-CONSTANTS.SHIP_SIZE / 2, 0);
        this.ctx.lineTo(-CONSTANTS.SHIP_SIZE, CONSTANTS.SHIP_SIZE);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Selection highlight
        if (isSelected) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        
        // Shield indicator
        if (ship.shields > 0) {
            const shieldAlpha = ship.shields / ship.maxShields;
            this.ctx.strokeStyle = `rgba(0, 200, 255, ${shieldAlpha * 0.8})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, CONSTANTS.SHIP_SIZE * 1.5, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Hull damage indicator
        if (ship.hull < ship.maxHull / 2) {
            this.ctx.fillStyle = '#ff6600';
            this.ctx.fillRect(-CONSTANTS.SHIP_SIZE * 1.2, CONSTANTS.SHIP_SIZE * 1.3, 
                              CONSTANTS.SHIP_SIZE * 2.4 * (ship.hull / ship.maxHull), 5);
            this.ctx.strokeStyle = '#ff6600';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(-CONSTANTS.SHIP_SIZE * 1.2, CONSTANTS.SHIP_SIZE * 1.3, 
                                CONSTANTS.SHIP_SIZE * 2.4, 5);
        }
        
        this.ctx.restore();
    }
    
    drawShootingCone(ship, centerX = this.centerX, centerY = this.centerY) {
        this.ctx.save();
        this.ctx.translate(ship.x, ship.y);
        this.ctx.rotate(ship.rotation);
        
        // Left shooting triangle
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(CONSTANTS.COMBAT_ARENA_RADIUS * 1.5, -CONSTANTS.COMBAT_ARENA_RADIUS * 0.8);
        this.ctx.lineTo(CONSTANTS.COMBAT_ARENA_RADIUS * 1.5, CONSTANTS.COMBAT_ARENA_RADIUS * 0.8);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawLaser(from, to, color = '#ffff00') {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = CONSTANTS.LASER_SIZE;
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
        
        // Glow effect
        this.ctx.strokeStyle = color + '80';
        this.ctx.lineWidth = CONSTANTS.LASER_SIZE * 3;
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
    }
    
    drawExplosion(x, y, size = 10) {
        this.ctx.fillStyle = '#ff6600';
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        this.ctx.stroke();
    }
    
    drawStats(text, x, y, color = '#00ffff') {
        this.ctx.fillStyle = color;
        this.ctx.font = '12px Courier New';
        this.ctx.fillText(text, x, y);
    }
    
    drawDamageNumber(x, y, damage, isHealed = false) {
        this.ctx.fillStyle = isHealed ? '#00ffff' : '#ff6600';
        this.ctx.font = 'bold 14px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillText(damage, x, y);
        this.ctx.textAlign = 'left';
    }
}

// Create global rendering instance
let renderingSystem = null;

function initRendering() {
    renderingSystem = new RenderingSystem('combatCanvas');
}
