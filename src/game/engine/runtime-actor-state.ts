/**
 * Shared, observable state machine for the player/primary actor in a Phaser
 * runtime.  Scenes keep their own mechanics, but expose the same meaningful
 * animation and feedback lifecycle to QA and future publish gates.
 */
export const RUNTIME_ACTOR_STATES = [
  "intro",
  "idle",
  "move",
  "jump",
  "dash",
  "action",
  "hit",
  "victory",
  "defeat",
] as const;

export type RuntimeActorState = (typeof RUNTIME_ACTOR_STATES)[number];

export type RuntimeActorStateSnapshot = {
  state: RuntimeActorState;
  transitions: number;
};

/**
 * A short-lived hit/action state cannot be overwritten by an ordinary movement
 * update. Terminal states are sticky so the finish feedback stays observable.
 */
export class RuntimeActorStateMachine {
  private state: RuntimeActorState;
  private heldUntil = 0;
  private transitions = 0;

  constructor(initial: RuntimeActorState = "intro") {
    this.state = initial;
  }

  set(next: RuntimeActorState, now: number, holdMs = 0): boolean {
    const terminal = this.state === "victory" || this.state === "defeat";
    if (terminal || (now < this.heldUntil && next !== this.state)) return false;
    if (this.state === next) return false;
    this.state = next;
    this.heldUntil = Math.max(this.heldUntil, now + Math.max(0, holdMs));
    this.transitions += 1;
    return true;
  }

  snapshot(): RuntimeActorStateSnapshot {
    return { state: this.state, transitions: this.transitions };
  }
}
