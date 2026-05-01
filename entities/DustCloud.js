// type: 'dust' | 'ice' | 'plasma'
class DustCloud {
    constructor(x, y, rx, ry, angle, type = 'dust') {
        this.x = x; this.y = y;
        this.rx = rx; this.ry = ry;
        this.angle = angle;
        this.type = type;
        this._oval = new Oval(x, y, rx, ry, angle);
    }

    containsPoint(px, py) {
        return this._oval.containsPoint(px, py);
    }

    // Approximate overlap test using bounding circles — good enough for spawn placement.
    overlaps(other) {
        const dx = this.x - other.x, dy = this.y - other.y;
        const distSq = dx * dx + dy * dy;
        const minDist = (this._oval.boundingRadius() + other._oval.boundingRadius()) * 0.65;
        return distSq < minDist * minDist;
    }
}
