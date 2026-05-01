const CONSTANTS_AI = {
    AI_DECISION_DELAY:     500,   // ms pause before enemy actions resolve (visual feedback)
    AI_RETREAT_HEALTH_RATIO: 0.3, // enemy retreats when fleet health < this fraction of player's
    AI_RETREAT_CHANCE:     0.4,   // probability of retreating when health is low
    AI_MOVE_CHANCE:        0.4,   // probability AI chooses to move instead of attack
    AI_ATTACK_CHANCE:      0.7,   // probability AI attacks vs skips when acting
    AI_MOVE_TOWARD_FACTOR: 6.0,   // engine × factor = px moved toward target per action
    AI_STRAFE_FACTOR:      0.5,   // fraction of max move distance when strafing
    AI_RETREAT_DANGER_RANGE: 2.5, // danger zone = shoot range × this; used for retreat probability
};
