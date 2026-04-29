// Asteroid entity
class Asteroid {
    constructor(x, y, radius, vx = 0, vy = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = vx;
        this.vy = vy;
        this.rotation = randomFloat(0, Math.PI * 2);
        this.rotVel = randomFloat(-1.5, 1.5);
        this._buildVertices();
        this._activeCollisions = new Set();
    }

    _buildVertices() {
        const sides = randomInt(5, 10);
        const r = this.radius;

        const baseAngles = [];
        for (let i = 0; i < sides; i++) {
            baseAngles.push((i / sides) * Math.PI * 2 + randomFloat(-0.18, 0.18));
        }
        baseAngles.sort((a, b) => a - b);

        const baseVerts = baseAngles.map(a => [
            Math.cos(a) * r * randomFloat(0.72, 1.0),
            Math.sin(a) * r * randomFloat(0.72, 1.0)
        ]);

        const notchCount = randomInt(1, Math.min(5, Math.floor(sides / 2)));
        const notchEdges = new Set();
        while (notchEdges.size < notchCount) {
            notchEdges.add(randomInt(0, sides - 1));
        }

        const verts = [];
        for (let i = 0; i < baseVerts.length; i++) {
            verts.push(baseVerts[i]);
            if (notchEdges.has(i)) {
                const j = (i + 1) % baseVerts.length;
                const mx = (baseVerts[i][0] + baseVerts[j][0]) / 2;
                const my = (baseVerts[i][1] + baseVerts[j][1]) / 2;
                const mDist = Math.sqrt(mx * mx + my * my);
                if (mDist > 0.1) {
                    const notchR = r * randomFloat(0.25, 0.5);
                    verts.push([mx / mDist * notchR, my / mDist * notchR]);
                }
            }
        }
        this.vertices = verts;
    }

    get isMoving() {
        return this.vx * this.vx + this.vy * this.vy > 4;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.rotation += this.rotVel * dt;
        const drag = Math.pow(CONSTANTS.ASTEROID_DRAG, dt);
        this.vx *= drag;
        this.vy *= drag;
    }
}
