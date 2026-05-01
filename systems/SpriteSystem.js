// SpriteSystem — loads image sprites and draws them to canvas with optional tinting.
// Usage:
//   spriteSystem.load('fighter', 'assets/sprites/fighter.png')
//   spriteSystem.draw(ctx, 'fighter', x, y, angleRad, scale, { tint: '#3399ff', tintAlpha: 0.45 })
//
// Falls back gracefully (returns false) when a sprite isn't loaded yet, so vector
// graphics can remain as the fallback in Rendering.js.
class SpriteSystem {
    constructor() {
        this._sprites    = new Map(); // id -> HTMLImageElement
        this._tintCache  = new Map(); // `${id}|${color}|${alpha}` -> OffscreenCanvas
        this._pending    = new Map(); // id -> Promise (in-flight loads)
    }

    // Load a sprite by ID. Returns a Promise that resolves when the image is ready.
    load(id, src) {
        if (this._sprites.has(id)) return Promise.resolve();
        if (this._pending.has(id)) return this._pending.get(id);

        const p = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => { this._sprites.set(id, img); this._pending.delete(id); resolve(); };
            img.onerror = () => { this._pending.delete(id); reject(new Error(`SpriteSystem: failed to load "${src}"`)); };
            img.src = src;
        });

        this._pending.set(id, p);
        return p;
    }

    // Load multiple sprites at once. spriteMap = { id: src, ... }
    // Returns a Promise that resolves when all are loaded.
    loadAll(spriteMap) {
        return Promise.all(Object.entries(spriteMap).map(([id, src]) => this.load(id, src)));
    }

    isLoaded(id) {
        return this._sprites.has(id);
    }

    // Returns the raw HTMLImageElement for a loaded sprite (null if not loaded).
    // Useful for computing draw scale from image.naturalWidth / naturalHeight.
    getImage(id) {
        return this._sprites.get(id) ?? null;
    }

    // Draw a sprite centered at (x, y), rotated by angle (radians, +X = right = 0°).
    // options:
    //   tint      — CSS color string to overlay (e.g. '#ff4444'); null = no tint
    //   tintAlpha — opacity of the tint layer (0–1, default 0.4)
    //   alpha     — overall draw opacity (0–1, default 1).
    //               Pass 1 (default) to inherit the calling context's current globalAlpha
    //               (useful when the caller already applied cloaking/dimming alpha).
    // Returns true if drawn, false if sprite not loaded (caller can fall back to vectors).
    draw(ctx, id, x, y, angle, scale = 1, { tint = null, tintAlpha = 0.4, alpha = 1 } = {}) {
        const img = this._sprites.get(id);
        if (!img) return false;

        const source = tint ? this._getTinted(img, id, tint, tintAlpha) : img;

        ctx.save();
        if (alpha !== 1) ctx.globalAlpha = alpha; // only override when explicitly set; otherwise inherit outer alpha
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (scale !== 1) ctx.scale(scale, scale);
        ctx.drawImage(source, -source.width / 2, -source.height / 2);
        ctx.restore();
        return true;
    }

    // Evict cached tinted versions for a specific sprite (e.g. after palette changes).
    clearTintCache(id = null) {
        if (id === null) {
            this._tintCache.clear();
        } else {
            for (const key of this._tintCache.keys()) {
                if (key.startsWith(id + '|')) this._tintCache.delete(key);
            }
        }
    }

    // Build (or return cached) a tinted offscreen canvas for img.
    // Approach: draw original, then overlay the tint color using source-atop so
    // transparency is preserved and existing sprite colors show through at (1-tintAlpha).
    _getTinted(img, id, color, alpha) {
        const key = `${id}|${color}|${alpha}`;
        if (this._tintCache.has(key)) return this._tintCache.get(key);

        const oc  = document.createElement('canvas');
        oc.width  = img.width;
        oc.height = img.height;
        const oc_ctx = oc.getContext('2d');

        oc_ctx.drawImage(img, 0, 0);

        oc_ctx.globalCompositeOperation = 'source-atop';
        oc_ctx.globalAlpha = alpha;
        oc_ctx.fillStyle   = color;
        oc_ctx.fillRect(0, 0, oc.width, oc.height);

        oc_ctx.globalCompositeOperation = 'source-over';
        oc_ctx.globalAlpha = 1;

        this._tintCache.set(key, oc);
        return oc;
    }
}

const spriteSystem = new SpriteSystem();
