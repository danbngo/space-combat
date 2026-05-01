const CONSTANTS_DUST = {
    // One cloud variant is chosen per combat (or none)
    CLOUD_SPAWN_CHANCE: 0.5,   // probability that any clouds spawn at all
    CLOUD_TYPES: ['dust', 'ice', 'plasma'],
    CLOUD_MIN_COUNT: 1,
    CLOUD_MAX_COUNT: 5,
    CLOUD_MINOR_MIN: 30,       // semi-minor axis (px) — shorter dimension
    CLOUD_MINOR_MAX: 80,
    CLOUD_ASPECT_MIN: 1.5,     // rx/ry — clouds are wider than tall
    CLOUD_ASPECT_MAX: 4.0,

    // Dust — random laser miss
    DUST_MISS_CHANCE: 0.5,

    // Ice — frozen status
    FROZEN_MOVE_MULT: 0.5,     // engine multiplier for movement range
    FROZEN_DAMAGE_MULT: 0.5,   // incoming damage multiplier (result rounded up)

    // Plasma — overheated status
    OVERHEATED_SHIELD_MULT: 2, // recharge multiplier on skip/wait action
};
