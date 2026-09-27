// Runtime strategy: local allowed-set enumeration only. No game-tree search.
export const EDGES = [];
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) EDGES.push([a, b]);
export const FULL = (1 << 15) - 1;
export const edgeIndex = (a, b) => EDGES.findIndex(([u, v]) => u === Math.min(a, b) && v === Math.max(a, b));
export const TRIANGLES = [];
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++)
  TRIANGLES.push((1 << edgeIndex(a, b)) | (1 << edgeIndex(a, c)) | (1 << edgeIndex(b, c)));
export const size = new Uint8Array(1 << 15);
const triangleFree = new Uint8Array(1 << 15);
for (let m = 0; m <= FULL; m++) {
  size[m] = m ? size[m & (m - 1)] + 1 : 0;
  triangleFree[m] = Number(!TRIANGLES.some(t => (m & t) === t));
}
export const bits = mask => EDGES.map((_, i) => i).filter(i => mask & (1 << i));
export const triangle = owned => TRIANGLES.find(t => (owned & t) === t) ?? 0;
export const isAllowedSet = (owned, occupied, set) => !(occupied & set) && !!triangleFree[owned | set];
export const isAllowedMove = (owned, occupied, edge) => Number.isInteger(edge) && edge >= 0 && edge < 15 && isAllowedSet(owned, occupied, 1 << edge);
export function allowedMoves(owned, occupied) {
  let result = 0;
  for (let i = 0; i < 15; i++) if (isAllowedMove(owned, occupied, i)) result |= 1 << i;
  return result;
}
export const BOARDS = Array.from({ length: 64 }, (_, vertices) => ({
  vertices,
  edges: EDGES.reduce((m, [a, b], i) => m | (((vertices >> a) & (vertices >> b) & 1) ? 1 << i : 0), 0),
}));
export function miniBoards(human, cpu) {
  const occupied = human | cpu;
  const allowed = allowedMoves(cpu, occupied);
  const valid = BOARDS.filter(b => (b.edges & occupied) === occupied && (b.edges & allowed));
  return valid.filter(b => !valid.some(k => k.vertices !== b.vertices && (k.vertices & b.vertices) === k.vertices));
}
export function maximumAllowedSets(owned, occupied, board = FULL) {
  // Unsafe single edges can never belong to an allowed set. Enumerate every
  // subset of the remaining edges, testing the UNION, not individual safety.
  const pool = allowedMoves(owned, occupied) & board;
  let maximum = -1;
  let sets = [];
  for (let subset = pool; ; subset = (subset - 1) & pool) {
    if (size[subset] >= maximum && triangleFree[owned | subset]) {
      if (size[subset] > maximum) { maximum = size[subset]; sets = []; }
      sets.push(subset);
    }
    if (!subset) break;
  }
  return { maximum, sets };
}
const frequencies = sets => EDGES.map((_, i) => sets.reduce((n, s) => n + !!(s & (1 << i)), 0));
const retainBest = (candidates, counts) => {
  const best = Math.max(...candidates.map(i => counts[i]));
  return candidates.filter(i => counts[i] === best);
};
export function analyzeStrategy(human, cpu, { cpuStarts = false, boardVertices } = {}) {
  const mode = cpuStarts ? 'experimental-first' : 'paper-second';
  const occupied = human | cpu;
  const uncolored = bits(FULL ^ occupied);
  if (cpuStarts && !occupied) return { mode, reason: 'opening', candidates: uncolored };
  if (!allowedMoves(cpu, occupied)) return { mode, reason: 'forced-loss', candidates: uncolored };
  const boards = miniBoards(human, cpu);
  // Deterministically choose one arbitrary inclusion-minimal board.
  const board = boardVertices === undefined ? boards[0] : boards.find(b => b.vertices === boardVertices);
  if (!board) throw new Error('Invalid mini-board');
  const rule1 = bits(allowedMoves(cpu, occupied) & board.edges);
  const cpuSets = maximumAllowedSets(cpu, occupied, board.edges);
  const cpuCounts = frequencies(cpuSets.sets);
  const rule2 = retainBest(rule1, cpuCounts);
  const humanSets = maximumAllowedSets(human, occupied, board.edges);
  const humanCounts = frequencies(humanSets.sets);
  const candidates = retainBest(rule2, humanCounts);
  return { mode, reason: 'strategy', board, rule1, rule2, candidates, cpuSets, humanSets, cpuCounts, humanCounts };
}
export function chooseMove(human, cpu, options = {}, random = Math.random) {
  const { candidates } = analyzeStrategy(human, cpu, options);
  if (!candidates.length) return null;
  return candidates[Math.floor(random() * candidates.length)];
}
