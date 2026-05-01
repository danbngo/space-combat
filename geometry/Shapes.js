// Geometry primitives — point-containment, clamping, bounds, area.
// Used by DustCloud (Oval), and available for future use.

class Circle {
    constructor(x, y, radius) {
        this.x = x; this.y = y;
        this.radius = radius;
    }

    containsPoint(px, py) {
        const dx = px - this.x, dy = py - this.y;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    overlapsCircle(other) {
        const dx = this.x - other.x, dy = this.y - other.y;
        const minDist = this.radius + other.radius;
        return dx * dx + dy * dy <= minDist * minDist;
    }

    bounds() {
        return {
            minX: this.x - this.radius, maxX: this.x + this.radius,
            minY: this.y - this.radius, maxY: this.y + this.radius,
        };
    }

    area() { return Math.PI * this.radius * this.radius; }
}

// Rotated ellipse.  rx = semi-major axis, ry = semi-minor axis, angle = CCW from +X (radians).
class Oval {
    constructor(x, y, rx, ry, angle = 0) {
        this.x = x; this.y = y;
        this.rx = rx; this.ry = ry;
        this.angle = angle;
    }

    // Transform a world point into the oval's local axis-aligned frame.
    _toLocal(px, py) {
        const cos = Math.cos(-this.angle), sin = Math.sin(-this.angle);
        const dx = px - this.x, dy = py - this.y;
        return { lx: cos * dx - sin * dy, ly: sin * dx + cos * dy };
    }

    // Transform a local point back to world space.
    _toWorld(lx, ly) {
        const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
        return { x: this.x + lx * cos - ly * sin, y: this.y + lx * sin + ly * cos };
    }

    containsPoint(px, py) {
        const { lx, ly } = this._toLocal(px, py);
        return (lx / this.rx) ** 2 + (ly / this.ry) ** 2 <= 1;
    }

    // Returns the nearest world-space point that lies inside (or on) the oval boundary.
    clampPoint(px, py) {
        const { lx, ly } = this._toLocal(px, py);
        const nx = lx / this.rx, ny = ly / this.ry;
        let clampedLX, clampedLY;
        if (nx * nx + ny * ny <= 1) {
            clampedLX = lx; clampedLY = ly;
        } else {
            const t = Math.atan2(ny, nx);
            clampedLX = this.rx * Math.cos(t);
            clampedLY = this.ry * Math.sin(t);
        }
        return this._toWorld(clampedLX, clampedLY);
    }

    // Tight AABB that fully encloses the rotated ellipse.
    bounds() {
        const c = Math.abs(Math.cos(this.angle)), s = Math.abs(Math.sin(this.angle));
        const hw = this.rx * c + this.ry * s;
        const hh = this.rx * s + this.ry * c;
        return { minX: this.x - hw, maxX: this.x + hw, minY: this.y - hh, maxY: this.y + hh };
    }

    area() { return Math.PI * this.rx * this.ry; }

    // Conservative bounding radius — safe for fast overlap pre-checks.
    boundingRadius() { return Math.max(this.rx, this.ry); }
}

// Axis-aligned rectangle.
class Rect {
    constructor(x, y, width, height) {
        this.x = x; this.y = y;
        this.width = width; this.height = height;
    }

    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width &&
               py >= this.y && py <= this.y + this.height;
    }

    overlapsRect(other) {
        return !(other.x > this.x + this.width  || other.x + other.width  < this.x ||
                 other.y > this.y + this.height || other.y + other.height < this.y);
    }

    bounds() {
        return { minX: this.x, maxX: this.x + this.width, minY: this.y, maxY: this.y + this.height };
    }

    area() { return this.width * this.height; }
}
