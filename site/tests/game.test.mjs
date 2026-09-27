import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../dist/game.js';
import { edgeIndex, triangle } from '../dist/strategy.js';
function setup(){
  let next=0;const pending=new Map();const delays=[];
  const game=new Game({schedule:(fn,delay)=>{delays.push(delay);pending.set(++next,fn);return next;},cancel:id=>pending.delete(id),random:()=>0});
  const tick=()=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn();};
  return {game,pending,tick,delays};
}
test('human starts; CPU waits 800 ms and blocks input while thinking',()=>{
  const {game,pending,tick,delays}=setup();assert.equal(game.turn,'human');
  assert(game.play(0));assert.equal(game.turn,'cpu');assert.equal(pending.size,1);
  assert.equal(game.play(1),false);assert.equal(game.human,1);assert.deepEqual(delays,[800]);
  tick();assert.equal(game.turn,'human');assert.equal(game.play(0),false);
  assert.equal(game.play(-1),false);assert.equal(game.play(15),false);assert.equal(game.play('2'),false);
});
test('reset and swap cancel pending moves; stale callbacks cannot alter a new game',()=>{
  const {game,pending,tick}=setup();game.play(0);const old=pending.values().next().value;
  game.reset(true);assert.equal(game.human,0);assert.equal(game.cpu,0);assert.equal(game.turn,'cpu');
  old();assert.equal(game.cpu,0);assert.equal(pending.size,1);
  tick();assert.equal(game.turn,'human');assert.equal(game.cpu,1);
  game.reset(false);assert.equal(game.turn,'human');assert.equal(game.cpu,0);assert.equal(pending.size,0);
});
test('human triangle ends play immediately and preserves its three highlighted edges',()=>{
  const {game,pending}=setup();game.human=(1<<edgeIndex(0,1))|(1<<edgeIndex(0,2));
  assert(game.play(edgeIndex(1,2)));assert.equal(game.loser,'human');assert.equal(game.turn,'over');
  assert.equal(game.losingTriangle,game.human);assert.equal(pending.size,0);assert.equal(game.play(4),false);
});
test('forced CPU loss is applied to board and goes through normal outcome handling',()=>{
  const {game,tick}=setup();game.cpu=[1,2,3,4,5].reduce((m,v)=>m|(1<<edgeIndex(0,v)),0);
  game.turn='cpu';game.queueCpu();tick();assert.equal(game.loser,'cpu');
  assert.equal(game.turn,'over');assert.equal(game.losingTriangle,triangle(game.cpu));assert.equal(game.snapshot().moves,6);
});
test('default browser timers are invoked without binding them to the Game instance',()=>{
  const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
  let fired=false,canceled=false;
  globalThis.setTimeout=function(fn,delay){assert.equal(this,undefined);assert.equal(delay,800);fired=true;return 123;};
  globalThis.clearTimeout=function(id){assert.equal(this,undefined);assert.equal(id,123);canceled=true;};
  try {const game=new Game();game.play(0);assert(fired);game.reset();assert(canceled);}
  finally {globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
});
