// Verification only, never imported by the browser. All human moves, all CPU
// ties, all mini-boards. Memoization preserves exact labelled positions.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { FULL, bits, triangle, miniBoards, analyzeStrategy, isAllowedMove } from '../dist/strategy.js';
const seen = new Set();
const stats = { uniquePositions: 0, humanPositions: 0, cpuPositions: 0, humanBranches: 0, cpuBranches: 0, humanLosingBranches: 0, cpuLosingBranches: 0, miniBoardsChecked: 0, tiedCpuPositions: 0, memoHits: 0 };
const start = performance.now();
function visit(human, cpu, turn, path) {
  const key = human + cpu * 32768; // parity determines turn
  if (seen.has(key)) { stats.memoHits++; return; }
  seen.add(key); stats.uniquePositions++;
  assert(!triangle(human) && !triangle(cpu));
  assert.notEqual(human | cpu, FULL, 'Triangle-free full K6 cannot exist');
  if (turn === 'human') {
    stats.humanPositions++;
    for (const edge of bits(FULL ^ (human | cpu))) {
      stats.humanBranches++;
      const next = human | (1 << edge);
      if (triangle(next)) { stats.humanLosingBranches++; continue; }
      visit(next, cpu, 'cpu', [...path, edge]);
    }
  } else {
    stats.cpuPositions++;
    const boards = miniBoards(human, cpu);
    const candidates = new Set();
    if (!boards.length) { stats.cpuLosingBranches++; assert.fail(`CPU forced loss: ${JSON.stringify(path)}`); }
    for (const board of boards) {
      stats.miniBoardsChecked++;
      const analysis = analyzeStrategy(human, cpu, { boardVertices: board.vertices });
      assert(analysis.candidates.length > 0);
      for (const edge of analysis.candidates) candidates.add(edge);
    }
    if (candidates.size > 1) stats.tiedCpuPositions++;
    for (const edge of candidates) {
      stats.cpuBranches++;
      assert(isAllowedMove(cpu, human | cpu, edge), `Unsafe CPU move: ${path},${edge}`);
      visit(human, cpu | (1 << edge), 'human', [...path, edge]);
    }
  }
}
visit(0, 0, 'human', []);
const result = { passed:true, ...stats, seconds:Number(((performance.now()-start)/1000).toFixed(3)), scope:'All 15 human openings; all human moves; all Rule 3 ties; all inclusion-minimal mini-boards; exact labelled-position memoization; terminal losses counted as branches.' };
writeFileSync(new URL('./exhaustive-result.json', import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
