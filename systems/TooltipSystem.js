// TooltipSystem — data-tooltip="..." on any element triggers a floating tooltip.
// Call TooltipSystem.init() once at startup.
class TooltipSystem {
    static init() {
        const el = document.createElement('div');
        el.id = 'gameTooltip';
        el.className = 'game-tooltip';
        document.body.appendChild(el);
        this._el = el;

        document.addEventListener('mouseover', e => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this._el.textContent = target.dataset.tooltip;
                this._el.style.display = 'block';
            } else {
                this._el.style.display = 'none';
            }
        });

        document.addEventListener('mousemove', e => {
            if (this._el.style.display === 'none') return;
            const x = e.clientX + 14;
            const y = e.clientY + 14;
            // Clamp to viewport so tooltip doesn't overflow right/bottom edge
            const w = this._el.offsetWidth;
            const h = this._el.offsetHeight;
            this._el.style.left = Math.min(x, window.innerWidth  - w - 8) + 'px';
            this._el.style.top  = Math.min(y, window.innerHeight - h - 8) + 'px';
        });
    }
}
