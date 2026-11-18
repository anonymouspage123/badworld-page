const DATA = window.TRACKS;
const ORDER = [7, 41, 3, 16, 4];
const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 240;
const HEIGHT = 240;
const MAX_STEP = 40;
const players = [];

function svg(tag, attributes = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

function bounds(clip) {
  const all = [...clip.clean, ...clip.attack, ...clip.gt];
  const forward = all.map(p => p[0]);
  const lateral = all.map(p => p[1]);
  const loX = Math.min(...forward), hiX = Math.max(...forward);
  const loY = Math.min(...lateral), hiY = Math.max(...lateral);
  const pad = Math.max(5, (hiX - loX) * .10);
  return { loX: loX - pad, hiX: hiX + pad, loY: loY - pad, hiY: hiY + pad };
}

function project(point, box) {
  const scale = Math.min(204 / (box.hiX - box.loX), 204 / (box.hiY - box.loY));
  return [
    WIDTH / 2 + (point[1] - (box.loY + box.hiY) / 2) * scale,
    HEIGHT / 2 - (point[0] - (box.loX + box.hiX) / 2) * scale
  ];
}

function polyline(points, box) {
  return points.map((p, index) => {
    const [x, y] = project(p, box);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function polygon(points, box) {
  return points.map(p => project(p, box).map(v => v.toFixed(1)).join(',')).join(' ');
}

function currentPosition(points, step) {
  const a = Math.min(Math.floor(step), MAX_STEP);
  const b = Math.min(a + 1, MAX_STEP);
  const f = step - Math.floor(step);
  return [points[a][0] * (1 - f) + points[b][0] * f,
          points[a][1] * (1 - f) + points[b][1] * f];
}

function drawChart(chart, clip, mode, time) {
  const color = mode === 'clean' ? '#54d7a4' : '#ff737d';
  const points = clip[mode];
  const step = Math.min(MAX_STEP, time * 5);
  const frame = Math.min(MAX_STEP, Math.round(step));
  const box = clip.box;
  chart.replaceChildren();
  chart.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);

  chart.append(svg('path', { d: polyline(clip.gt, box), fill: 'none', stroke: '#b4c9c4', 'stroke-width': 1.6, 'stroke-dasharray': '4 6', opacity: .75 }));
  chart.append(svg('path', { d: polyline(points, box), fill: 'none', stroke: color, 'stroke-width': 3, opacity: .22, 'stroke-linecap': 'round' }));

  if (frame > 0) {
    for (const object of clip.objects[frame]) {
      const hit = mode === 'attack' ? object.hitAttack : object.hitClean;
      chart.append(svg('polygon', { points: polygon(object.corners, box), fill: hit ? '#ffb454' : '#adc3bd', 'fill-opacity': hit ? .68 : .25, stroke: hit ? '#ffb454' : '#94b2aa', 'stroke-width': hit ? 2.2 : 1.1 }));
    }
  }

  const progress = points.slice(0, Math.floor(step) + 1);
  if (step < MAX_STEP) progress.push(currentPosition(points, step));
  chart.append(svg('path', { d: polyline(progress, box), fill: 'none', stroke: color, 'stroke-width': 9, opacity: .15, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  chart.append(svg('path', { d: polyline(progress, box), fill: 'none', stroke: color, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  const [startX, startY] = project(points[0], box);
  chart.append(svg('circle', { cx: startX, cy: startY, r: 3, fill: '#d0dcda', opacity: .8 }));
  if (frame > 0) {
    const hit = clip.collision[mode][frame - 1];
    if (hit) {
      const [x, y] = project(points[frame], box);
      chart.append(svg('circle', { cx: x, cy: y, r: 15, fill: '#ffb454', 'fill-opacity': .13, stroke: '#ffb454', 'stroke-width': 1.4 }));
    }
    chart.append(svg('polygon', { points: polygon(clip.egoBoxes[mode][frame], box), fill: color, 'fill-opacity': .47, stroke: '#e7efee', 'stroke-width': 1.4 }));
  }
  const [x, y] = project(currentPosition(points, step), box);
  chart.append(svg('circle', { cx: x, cy: y, r: 3, fill: '#fff', stroke: color, 'stroke-width': 2 }));
}

function makePlayer(id, position) {
  const clip = DATA.clips[String(id)];
  clip.box = bounds(clip);
  const row = document.createElement('section');
  row.className = 'clip-row';
  row.setAttribute('aria-label', `Driving example ${position + 1}`);
  row.innerHTML = `
    <div class="tile video-tile clean"><span class="tag">CLEAN</span><video playsinline muted preload="metadata" aria-label="Clean video for example ${position + 1}" src="assets/clean_${id}_8s.mp4"></video></div>
    <div class="tile trajectory-tile clean"><svg role="img" aria-label="Animated clean trajectory for example ${position + 1}"></svg><span class="impact-flash" aria-hidden="true"></span></div>
    <div class="tile video-tile attack"><span class="tag">ADVERSARIAL</span><video playsinline muted preload="metadata" aria-label="Adversarial video for example ${position + 1}" src="assets/attack_${id}_8s.mp4"></video></div>
    <div class="tile trajectory-tile attack"><svg role="img" aria-label="Animated adversarial trajectory for example ${position + 1}"></svg><span class="impact-flash" aria-hidden="true"></span></div>
    <div class="transport"><button type="button" class="play" aria-label="Play example ${position + 1}">▶</button><input class="timeline" type="range" min="0" max="8" step="0.01" value="0" aria-label="Timeline for example ${position + 1}"><span class="clock">0.0 / 8.0 s</span></div>`;
  document.getElementById('gallery').append(row);
  const videos = row.querySelectorAll('video');
  const charts = row.querySelectorAll('svg');
  const tiles = row.querySelectorAll('.trajectory-tile');
  const button = row.querySelector('.play');
  const timeline = row.querySelector('.timeline');
  const clock = row.querySelector('.clock');
  let playing = false, handle = 0;

  function render() {
    const time = Math.min(8, Math.max(0, videos[0].currentTime || 0));
    if (Math.abs(videos[1].currentTime - time) > .10) videos[1].currentTime = time;
    timeline.value = time;
    clock.textContent = `${time.toFixed(1)} / 8.0 s`;
    drawChart(charts[0], clip, 'clean', time);
    drawChart(charts[1], clip, 'attack', time);
    const frame = Math.min(MAX_STEP, Math.round(time * 5));
    tiles[0].classList.toggle('hit', frame > 0 && clip.collision.clean[frame - 1]);
    tiles[1].classList.toggle('hit', frame > 0 && clip.collision.attack[frame - 1]);
    if (time >= 8 && playing) pause();
    if (playing) handle = requestAnimationFrame(render);
  }

  function pause() {
    playing = false;
    videos.forEach(video => video.pause());
    cancelAnimationFrame(handle);
    button.textContent = '▶';
    button.setAttribute('aria-label', `Play example ${position + 1}`);
  }

  async function play() {
    for (const other of players) if (other !== controller) other.pause();
    if (videos[0].currentTime >= 7.98) videos.forEach(video => { video.currentTime = 0; });
    playing = true;
    button.textContent = 'Ⅱ';
    button.setAttribute('aria-label', `Pause example ${position + 1}`);
    try { await Promise.all([...videos].map(video => video.play())); }
    catch { pause(); return; }
    handle = requestAnimationFrame(render);
  }

  const controller = { pause };
  players.push(controller);
  button.addEventListener('click', () => playing ? pause() : play());
  videos.forEach(video => video.addEventListener('click', () => playing ? pause() : play()));
  videos.forEach(video => video.addEventListener('ended', pause));
  videos.forEach(video => video.addEventListener('seeked', render));
  timeline.addEventListener('input', () => {
    videos.forEach(video => { video.currentTime = Number(timeline.value); });
    render();
  });
  render();
}

ORDER.forEach(makePlayer);
