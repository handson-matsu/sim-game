import test from 'node:test';
import assert from 'node:assert/strict';
import { EDGES, FULL, size, edgeIndex, triangle, isAllowedMove, isAllowedSet, allowedMoves, maximumAllowedSets, miniBoards, analyzeStrategy, chooseMove } from '../dist/strategy.js';
const mask = pairs => pairs.reduce((m,[a,b]) => m | 1 << edgeIndex(a,b),0);
// Independent adjacency-based oracle: no runtime triangle table or subset logic.
function oracleTriangle(m) {
  const adjacent = Array.from({length:6},()=>Array(6).fill(false));
  EDGES.forEach(([a,b],i)=>{ if(m & (1<<i)) adjacent[a][b]=adjacent[b][a]=true; });
  for(let a=0;a<6;a++) for(let b=a+1;b<6;b++) for(let c=b+1;c<6;c++)
    if(adjacent[a][b] && adjacent[b][c] && adjacent[a][c]) return true;
  return false;
}
function oracleSets(owned, occupied, board) {
  const indices = EDGES.map((_,i)=>i).filter(i=>!(occupied&(1<<i)) && (board&(1<<i)));
  const allowed=[];
  function recurse(i,set) {
    if(i===indices.length) { if(!oracleTriangle(owned|set)) allowed.push(set); return; }
    recurse(i+1,set); recurse(i+1,set|(1<<indices[i]));
  }
  recurse(0,0);
  const max = Math.max(...allowed.map(m=>EDGES.filter((_,i)=>m&(1<<i)).length));
  return allowed.filter(m=>EDGES.filter((_,i)=>m&(1<<i)).length===max).sort((a,b)=>a-b);
}
let seed=12345;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const positions=[];
for(let n=0;n<120;n++){
  let human=0,cpu=0;
  for(let i=0;i<15;i++){
    const x=random();
    if(x<.3 && !oracleTriangle(human|(1<<i))) human|=1<<i;
    else if(x<.6 && !oracleTriangle(cpu|(1<<i))) cpu|=1<<i;
  }
  positions.push([human,cpu]);
}
test('all 32,768 triangle masks match independent adjacency oracle',()=>{
  for(let m=0;m<=FULL;m++) assert.equal(!!triangle(m),oracleTriangle(m));
});
test('allowed moves reject occupied and triangle-closing edges',()=>{
  const own=mask([[0,1],[0,2]]), occupied=own|mask([[4,5]]);
  assert.equal(isAllowedMove(own,occupied,edgeIndex(1,2)),false);
  assert.equal(isAllowedMove(own,occupied,edgeIndex(4,5)),false);
  assert.equal(isAllowedMove(own,occupied,edgeIndex(0,1)),false);
  assert.equal(isAllowedMove(own,occupied,edgeIndex(2,3)),true);
  for(const [h,c] of positions) for(let i=0;i<15;i++) assert.equal(isAllowedMove(c,h|c,i), !( (h|c)&(1<<i)) && !oracleTriangle(c|(1<<i)));
});
test('allowed set tests the entire union; individually safe edges can be unsafe together',()=>{
  const own=mask([[0,1]]), a=mask([[0,2]]),b=mask([[1,2]]);
  assert(isAllowedSet(own,own,a));assert(isAllowedSet(own,own,b));
  assert.equal(isAllowedSet(own,own,a|b),false);
  assert.equal(isAllowedSet(0,0,mask([[0,1],[1,2],[0,2]])),false);
  assert(isAllowedSet(own,own,0));
});
test('maximum means maximum cardinality, excludes smaller inclusion-maximal star',()=>{
  const star=mask([[0,1],[0,2],[0,3],[0,4],[0,5]]);
  assert(!triangle(star));
  for(let i=0;i<15;i++) if(!(star&(1<<i))) assert(triangle(star|(1<<i)));
  const result=maximumAllowedSets(0,0);
  assert.equal(result.maximum,9);assert.equal(result.sets.length,10);
  assert(!result.sets.includes(star));assert(result.sets.every(m=>size[m]===9));
});
test('maximum allowed sets equal independent brute-force oracle on 120 positions',()=>{
  for(const [h,c] of positions){
    assert.deepEqual(maximumAllowedSets(c,h|c).sets.sort((a,b)=>a-b),oracleSets(c,h|c,FULL));
    assert.deepEqual(maximumAllowedSets(h,h|c).sets.sort((a,b)=>a-b),oracleSets(h,h|c,FULL));
  }
});
test('mini-boards contain all colored edges, a safe CPU move, and no qualifying proper subset',()=>{
  for(const [h,c] of [[0,0],[1,0],...positions]) {
    const boards=miniBoards(h,c), occupied=h|c;
    const valid=[];
    for(let v=0;v<64;v++) {
      const edges=EDGES.reduce((m,[a,b],i)=>((v&(1<<a))&&(v&(1<<b)))?m|(1<<i):m,0);
      if ((edges&occupied)!==occupied) continue;
      if(!EDGES.some((_,i)=>(edges&(1<<i)) && !(occupied&(1<<i)) && !oracleTriangle(c|(1<<i)))) continue;
      valid.push({vertices:v,edges});
    }
    const expected=valid.filter(b=>!valid.some(k=>k.vertices!==b.vertices && (k.vertices&b.vertices)===k.vertices));
    assert.deepEqual(boards,expected);
  }
  assert.equal(miniBoards(1,0).length,4); // either of four unused vertices completes K3
});
test('Rules 1 → 2 → 3 are hierarchical, including actual filtering at both tie-breaks',()=>{
  let rule2Filters=0,rule3Filters=0,conflicts=0,ties=0;
  for(const [h,c] of positions){
    if(!allowedMoves(c,h|c)) continue;
    const a=analyzeStrategy(h,c), board=a.board.edges;
    const cpuSets=oracleSets(c,h|c,board), humanSets=oracleSets(h,h|c,board);
    const count=(sets,i)=>sets.filter(m=>m&(1<<i)).length;
    const r1=EDGES.map((_,i)=>i).filter(i=>(board&(1<<i)) && !((h|c)&(1<<i)) && !oracleTriangle(c|(1<<i)));
    const maxCpu=Math.max(...r1.map(i=>count(cpuSets,i)));
    const r2=r1.filter(i=>count(cpuSets,i)===maxCpu);
    const maxHuman=Math.max(...r2.map(i=>count(humanSets,i)));
    const r3=r2.filter(i=>count(humanSets,i)===maxHuman);
    assert.deepEqual(a.rule1,r1);assert.deepEqual(a.rule2,r2);assert.deepEqual(a.candidates,r3);
    rule2Filters+=r1.length>r2.length;rule3Filters+=r2.length>r3.length;
    conflicts+=r1.some(i=>!r2.includes(i)&&count(humanSets,i)>maxHuman);
    if(r3.length>1) {
      ties++;
      for(let i=0;i<r3.length;i++) {
        const chosen=chooseMove(h,c,{},()=> (i+.5)/r3.length);
        assert.equal(chosen,r3[i]);assert(isAllowedMove(c,h|c,chosen));
      }
    }
  }
  assert(rule2Filters>0 && rule3Filters>0 && conflicts>0 && ties>0);
});
test('first-player experiment is explicitly distinguished; opening spans all 15 edges',()=>{
  assert.equal(analyzeStrategy(0,0,{cpuStarts:true}).mode,'experimental-first');
  assert.equal(analyzeStrategy(1,0).mode,'paper-second');
  assert.equal(analyzeStrategy(0,1,{cpuStarts:true}).reason,'strategy');
  for(let i=0;i<15;i++) assert.equal(chooseMove(0,0,{cpuStarts:true},()=> (i+.5)/15),i);
});
test('no allowed move chooses an unused edge and really forms a losing triangle',()=>{
  const cpu=mask([[0,1],[0,2],[0,3],[0,4],[0,5]]);
  const a=analyzeStrategy(0,cpu);
  assert.equal(a.reason,'forced-loss');assert.equal(a.candidates.length,10);
  for(const edge of a.candidates) assert(triangle(cpu|(1<<edge)));
});
