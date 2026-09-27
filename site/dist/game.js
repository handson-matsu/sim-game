import { EDGES, triangle, chooseMove, size, FULL } from './strategy.js';
export class Game {
  constructor({ onChange = () => {}, schedule = (callback, delay) => setTimeout(callback, delay), cancel = id => clearTimeout(id), random = Math.random } = {}) {
    Object.assign(this, { onChange, schedule, cancel, random });
    this.timer = null;
    this.generation = 0;
    this.reset(false);
  }
  reset(cpuStarts = this.cpuStarts) {
    if (this.timer !== null) this.cancel(this.timer);
    this.timer = null;
    this.generation++;
    Object.assign(this, { human: 0, cpu: 0, cpuStarts, turn: cpuStarts ? 'cpu' : 'human', loser: null, losingTriangle: 0, lastEdge: null, lastPlayer: null });
    this.onChange(this);
    if (cpuStarts) this.queueCpu();
  }
  play(edge) {
    if (this.turn !== 'human' || this.loser || !Number.isInteger(edge) || edge < 0 || edge >= EDGES.length || ((this.human | this.cpu) & (1 << edge))) return false;
    this.apply(edge, 'human');
    if (!this.loser) this.queueCpu();
    return true;
  }
  apply(edge, player) {
    this[player] |= 1 << edge;
    this.lastEdge = edge;
    this.lastPlayer = player;
    this.losingTriangle = triangle(this[player]);
    if (this.losingTriangle) { this.loser = player; this.turn = 'over'; }
    else this.turn = player === 'human' ? 'cpu' : 'human';
    this.onChange(this);
  }
  queueCpu() {
    const generation = this.generation;
    this.timer = this.schedule(() => {
      if (generation !== this.generation || this.turn !== 'cpu' || this.loser) return;
      this.timer = null;
      const edge = chooseMove(this.human, this.cpu, { cpuStarts: this.cpuStarts }, this.random);
      if (edge !== null) this.apply(edge, 'cpu');
    }, 800);
  }
  snapshot() {
    return { human: this.human, cpu: this.cpu, turn: this.turn, cpuStarts: this.cpuStarts, loser: this.loser, losingTriangle: this.losingTriangle, moves: size[this.human | this.cpu], available: EDGES.map((_, i) => i).filter(i => ((FULL ^ (this.human | this.cpu)) & (1 << i))) };
  }
}
