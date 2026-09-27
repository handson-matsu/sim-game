import { Game } from './game.js';
import { EDGES, edgeIndex, size } from './strategy.js';
const $ = id => document.getElementById(id);
const svg = $('board');
const NS = 'http://www.w3.org/2000/svg';
const points = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [300 + 232 * Math.cos(a), 270 + 232 * Math.sin(a)]; });
let selected = null;
let notice = '';
const lines = [], hits = [], nodes = [];
function element(tag, attrs, parent = svg) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  parent.append(el);
  return el;
}
const geometry = ([a,b]) => ({ x1: points[a][0], y1: points[a][1], x2: points[b][0], y2: points[b][1] });
EDGES.forEach(pair => lines.push(element('line', { ...geometry(pair), class: 'edge' })));
EDGES.forEach((pair, i) => {
  const hit = element('line', { ...geometry(pair), class: 'edge-hit', role: 'button', tabindex: '0', 'aria-label': `頂点${pair[0]+1}と${pair[1]+1}の辺を選ぶ` });
  hit.addEventListener('click', () => play(i));
  hit.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(i); } });
  hit.addEventListener('pointerenter', () => { if (game.turn === 'human' && !((game.human | game.cpu) & (1<<i))) lines[i].classList.add('preview'); });
  hit.addEventListener('pointerleave', () => lines[i].classList.remove('preview'));
  hits.push(hit);
});
points.forEach(([cx, cy], i) => {
  const group = element('g', { class: 'node', role: 'button', tabindex: '0', 'aria-label': `頂点${i+1}を選ぶ`, 'aria-pressed': 'false' });
  element('circle', { cx, cy, r: 39, class: 'node-hit' }, group);
  element('circle', { cx, cy, r: 22 }, group);
  element('text', { x: cx, y: cy }, group).textContent = i+1;
  group.addEventListener('click', () => selectNode(i));
  group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNode(i); } });
  nodes.push(group);
});
function play(i) {
  if (game.play(i)) { selected = null; notice = ''; render(game); }
}
function selectNode(i) {
  if (game.turn !== 'human') return;
  notice = '';
  if (selected === i) selected = null;
  else if (selected === null) selected = i;
  else {
    const edge = edgeIndex(selected, i);
    if ((game.human | game.cpu) & (1 << edge)) { notice = 'その辺は使用済みです。別の頂点を選んでください'; selected = i; }
    else play(edge);
  }
  render(game);
}
function render(g) {
  const occupied = g.human | g.cpu;
  if (g.turn !== 'human') selected = null;
  EDGES.forEach((_, i) => {
    const bit = 1 << i;
    lines[i].setAttribute('class', `edge${g.human & bit ? ' human' : g.cpu & bit ? ' cpu' : ''}${g.losingTriangle & bit ? ' losing' : ''}`);
    const disabled = g.turn !== 'human' || !!(occupied & bit);
    hits[i].setAttribute('aria-disabled', String(disabled));
    hits[i].setAttribute('tabindex', disabled ? '-1' : '0');
    hits[i].style.pointerEvents = disabled ? 'none' : 'stroke';
  });
  nodes.forEach((node,i) => {
    node.classList.toggle('selected', i === selected);
    node.setAttribute('aria-pressed', String(i === selected));
    node.setAttribute('aria-disabled', String(g.turn !== 'human'));
    node.setAttribute('tabindex', g.turn === 'human' ? '0' : '-1');
  });
  $('status').dataset.turn = g.turn;
  $('status').textContent = g.loser === 'human' ? '三角形ができました。あなたの負けです。' : g.loser === 'cpu' ? 'コンピューターが三角形を作りました。あなたの勝ちです。' : g.turn === 'human' ? 'あなたの番' : 'コンピューターの番';
  $('hint').textContent = g.loser ? '太くなった3本の辺が、同じ色の三角形です' : g.turn === 'cpu' ? '次の一手を考えています…' : notice || (selected !== null ? `頂点${selected+1}からつなぐ頂点を選んでください` : 'グレーの辺を1本選んでください');
  $('human-score').textContent = size[g.human];
  $('cpu-score').textContent = size[g.cpu];
  $('move-count').innerHTML = `${String(size[occupied]).padStart(2,'0')} <span>/ 15 本</span>`;
  $('last-move').textContent = g.lastEdge === null ? 'まだ線は引かれていません' : `${g.lastPlayer === 'human' ? 'あなた' : 'CPU'}：${EDGES[g.lastEdge].map(v=>v+1).join(' — ')}`;
  $('first').setAttribute('aria-pressed', String(!g.cpuStarts));
  $('second').setAttribute('aria-pressed', String(g.cpuStarts));
  $('human-order').textContent = g.cpuStarts ? '後手' : '先手';
  $('cpu-order').textContent = g.cpuStarts ? '先手' : '後手';
  $('mode-note').textContent = g.cpuStarts ? 'CPUは先手です。同じ戦略を実験的に使いますが、先手での必勝は保証されません。' : 'CPUは後手です。論文が必勝を保証する戦略で対戦します。';
}
const game = new Game({ onChange: render });
function reset(cpuStarts = game.cpuStarts) { selected = null; notice = ''; game.reset(cpuStarts); }
$('reset').addEventListener('click', () => reset());
$('swap').addEventListener('click', () => reset(!game.cpuStarts));
$('first').addEventListener('click', () => reset(false));
$('second').addEventListener('click', () => reset(true));
// Optional WebMCP: shares the exact visible game actions and state.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const register = tool => {
    try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(console.warn); }
    catch (error) { console.warn(error); }
  };
  register({ name:'read_sim_game', description:'Read the current Sim board. Edge indices are 0–14 in lexicographic vertex order.', inputSchema:{type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true}, execute:()=>game.snapshot() });
  register({ name:'play_sim_edge', description:'Claim an unused edge for the human. CPU responds after 800 ms.', inputSchema:{type:'object',properties:{edge:{type:'integer',minimum:0,maximum:14}},required:['edge'],additionalProperties:false}, annotations:{readOnlyHint:false}, execute:input=> { if (!input || !game.play(input.edge)) throw new Error('Edge unavailable or not your turn'); selected=null; notice=''; render(game); return game.snapshot(); } });
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}

// Record one visit per page load without waiting for the response or retrying.
try {
  fetch('https://script.google.com/macros/s/AKfycbxssCIHsD-N97SHxNC_GN0ihYeC0qy-lb-EY0KmSs6Gnztaph1sITMerLVEnNWOGkYc/exec?app=sim-game', {
    method: 'GET',
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
} catch {
  // Access logging must never interrupt the game.
}
