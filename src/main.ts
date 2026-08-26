import './style.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
}

type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  url: string;
  color: string;
};

const starterTracks: Track[] = [
  { id: 'night-drive', title: 'Night Drive', artist: 'Sonora Sessions', album: 'After Hours', duration: '04:18', url: '', color: '#e8875d' },
  { id: 'soft-focus', title: 'Soft Focus', artist: 'Mira Vale', album: 'Small Hours', duration: '03:42', url: '', color: '#b8c96b' },
  { id: 'blue-hour', title: 'Blue Hour', artist: 'North Arcade', album: 'City Weather', duration: '05:06', url: '', color: '#71a6a1' },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
const audio = new Audio();
audio.preload = 'metadata';
let tracks: Track[] = [...starterTracks];
let currentIndex = 0;
let isPlaying = false;
let timerSeconds = 0;
let timerId: number | undefined;
let audioContext: AudioContext | undefined;
let sourceNode: MediaElementAudioSourceNode | undefined;
let equalizerNodes: BiquadFilterNode[] = [];
const bands = [60, 170, 310, 600, 1000, 3000, 6000, 12000];

app.innerHTML = `
  <main class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">S</span><span>sonora</span></div>
      <p class="eyebrow">YOUR LIBRARY</p>
      <nav class="nav-list">
        <button class="nav-item active"><span class="nav-icon">◉</span> Now playing</button>
        <button class="nav-item" id="libraryButton"><span class="nav-icon">▤</span> Local library <span class="nav-count" id="trackCount">3</span></button>
      </nav>
      <div class="side-note"><span class="pulse-dot"></span><div><strong>Offline mode</strong><small>Your music stays on this device.</small></div></div>
      <div class="sidebar-footer"><span class="tiny-eq"><i></i><i></i><i></i><i></i></span><span>Built for quiet listening</span></div>
    </aside>

    <section class="content">
      <header class="topbar"><div><p class="kicker">PERSONAL AUDIO SPACE</p><h1>Now playing</h1></div><label class="add-button"><input id="fileInput" type="file" accept="audio/*" multiple /><span>＋</span> Add local music</label></header>
      <div class="workspace">
        <section class="hero-panel">
          <div class="artwork" id="artwork"><div class="art-grid"></div><span class="art-label">SONORA<br /><b>01</b></span><div class="art-orbit"></div></div>
          <div class="track-info"><div class="track-overline" id="trackAlbum">AFTER HOURS · 2026</div><h2 id="trackTitle">Night Drive</h2><p id="trackArtist">Sonora Sessions</p><div class="meta-row"><span id="trackDuration">04:18</span><span class="separator">•</span><span id="trackFormat">LOCAL FLAC / MP3</span></div></div>
          <button class="heart-button" id="favoriteButton" aria-label="Favorite">♡</button>
        </section>

        <section class="player-panel">
          <div class="progress-wrap"><span id="currentTime">00:00</span><input id="progress" type="range" min="0" max="100" value="0" aria-label="Track progress" /><span id="totalTime">04:18</span></div>
          <div class="transport"><button class="icon-button" id="shuffleButton" aria-label="Shuffle">⤨</button><button class="icon-button" id="previousButton" aria-label="Previous">◀◀</button><button class="play-button" id="playButton" aria-label="Play">▶</button><button class="icon-button" id="nextButton" aria-label="Next">▶▶</button><button class="icon-button" id="repeatButton" aria-label="Repeat">↻</button></div>
          <div class="volume-row"><span>Volume</span><input id="volume" type="range" min="0" max="1" value="0.78" step="0.01" aria-label="Volume" /><span class="volume-value" id="volumeValue">78%</span></div>
        </section>

        <div class="lower-grid">
          <section class="panel queue-panel"><div class="panel-heading"><div><p class="kicker">UP NEXT</p><h3>Queue <span id="queueCount">03</span></h3></div><button class="text-button" id="clearButton">Clear all</button></div><div class="queue-list" id="queueList"></div></section>
          <section class="panel equalizer-panel"><div class="panel-heading"><div><p class="kicker">SHAPE YOUR SOUND</p><h3>Equalizer</h3></div><button class="preset-button" id="presetButton">Balanced <span>⌄</span></button></div><div class="eq-chart"><div class="eq-line" id="eqLine"></div><div class="eq-bars" id="eqBars"></div></div><div class="band-labels"><span>60</span><span>170</span><span>310</span><span>600</span><span>1k</span><span>3k</span><span>6k</span><span>12k</span></div><div class="eq-sliders" id="eqSliders"></div></section>
        </div>
        <section class="timer-panel"><div class="timer-icon">◷</div><div class="timer-copy"><p class="kicker">SLEEP TIMER</p><h3 id="timerLabel">Music will play until you say so.</h3></div><div class="timer-actions"><button class="timer-option" data-minutes="15">15 min</button><button class="timer-option" data-minutes="30">30 min</button><button class="timer-option" data-minutes="60">60 min</button><button class="timer-option" data-minutes="0">Off</button></div><div class="timer-display" id="timerDisplay">OFF</div></section>
      </div>
    </section>
  </main>
`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const trackTitle = $('#trackTitle'); const trackArtist = $('#trackArtist'); const trackAlbum = $('#trackAlbum'); const trackDuration = $('#trackDuration'); const totalTime = $('#totalTime'); const artwork = $('#artwork');

function formatTime(seconds: number) { if (!Number.isFinite(seconds)) return '00:00'; return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`; }
function loadTrack(index: number) { currentIndex = (index + tracks.length) % tracks.length; const track = tracks[currentIndex]; trackTitle.textContent = track.title; trackArtist.textContent = track.artist; trackAlbum.textContent = `${track.album.toUpperCase()} · LOCAL`; trackDuration.textContent = track.duration; totalTime.textContent = track.duration; artwork.style.setProperty('--art-color', track.color); audio.src = track.url; renderQueue(); }
function setupAudioGraph() { if (audioContext) return; audioContext = new AudioContext(); sourceNode = audioContext.createMediaElementSource(audio); equalizerNodes = bands.map((frequency, index) => { const filter = audioContext!.createBiquadFilter(); filter.type = 'peaking'; filter.frequency.value = frequency; filter.Q.value = 1.1; filter.gain.value = index === 3 || index === 4 ? 1 : 0; return filter; }); sourceNode.connect(equalizerNodes[0]); equalizerNodes.forEach((node, index) => index < equalizerNodes.length - 1 ? node.connect(equalizerNodes[index + 1]) : node.connect(audioContext!.destination)); }
async function togglePlay() { if (!tracks[currentIndex].url) { alert('Tambahkan file audio lokal untuk mulai mendengarkan.'); return; } setupAudioGraph(); if (audioContext?.state === 'suspended') await audioContext.resume(); if (audio.paused) { await audio.play(); isPlaying = true; } else { audio.pause(); isPlaying = false; } updatePlayButton(); }
function updatePlayButton() { $('#playButton').textContent = isPlaying ? 'Ⅱ' : '▶'; $('#playButton').classList.toggle('playing', isPlaying); }
function renderQueue() { const list = $('#queueList'); list.innerHTML = tracks.map((track, index) => `<button class="queue-item ${index === currentIndex ? 'selected' : ''}" data-index="${index}"><span class="queue-art" style="--art-color:${track.color}">${index === currentIndex && isPlaying ? '<i></i><i></i><i></i>' : String(index + 1).padStart(2, '0')}</span><span class="queue-details"><strong>${track.title}</strong><small>${track.artist} · ${track.album}</small></span><span class="queue-time">${track.duration}</span><span class="more">•••</span></button>`).join(''); $('#trackCount').textContent = String(tracks.length); $('#queueCount').textContent = String(tracks.length).padStart(2, '0'); list.querySelectorAll<HTMLButtonElement>('.queue-item').forEach(item => item.onclick = () => { loadTrack(Number(item.dataset.index)); if (tracks[currentIndex].url) { togglePlay(); } }); }
function renderEqualizer() { $('#eqSliders').innerHTML = bands.map((_, index) => `<input class="eq-slider" data-band="${index}" type="range" min="-12" max="12" value="${index === 3 || index === 4 ? 1 : 0}" step="1" aria-label="${bands[index]} Hz gain" />`).join(''); $('#eqSliders').querySelectorAll<HTMLInputElement>('input').forEach(slider => slider.oninput = () => { const index = Number(slider.dataset.band); if (equalizerNodes[index]) equalizerNodes[index].gain.value = Number(slider.value); updateEqVisuals(); }); updateEqVisuals(); }
function updateEqVisuals() { const values = [...document.querySelectorAll<HTMLInputElement>('.eq-slider')].map(input => Number(input.value)); $('#eqBars').innerHTML = values.map(value => `<span style="height:${Math.max(18, 40 + value * 3)}%"></span>`).join(''); $('#eqLine').style.clipPath = `polygon(${values.map((value, index) => `${(index / 7) * 100}% ${50 - value * 2.2}%`).join(', ')}, 100% 100%, 0 100%)`; }

$('#playButton').onclick = togglePlay; $('#previousButton').onclick = () => loadTrack(currentIndex - 1); $('#nextButton').onclick = () => { loadTrack(currentIndex + 1); if (isPlaying && tracks[currentIndex].url) audio.play(); }; $('#shuffleButton').onclick = () => { loadTrack(Math.floor(Math.random() * tracks.length)); }; $('#repeatButton').onclick = () => { audio.loop = !audio.loop; $('#repeatButton').classList.toggle('active', audio.loop); }; $<HTMLInputElement>('#volume').oninput = event => { audio.volume = Number((event.target as HTMLInputElement).value); $('#volumeValue').textContent = `${Math.round(audio.volume * 100)}%`; }; $<HTMLInputElement>('#progress').oninput = event => { if (audio.duration) audio.currentTime = (Number((event.target as HTMLInputElement).value) / 100) * audio.duration; }; $('#favoriteButton').onclick = event => { const button = event.currentTarget as HTMLButtonElement; button.textContent = button.textContent === '♡' ? '♥' : '♡'; button.classList.toggle('liked'); }; $('#clearButton').onclick = () => { tracks = [tracks[currentIndex]]; currentIndex = 0; renderQueue(); }; $('#libraryButton').onclick = () => $<HTMLInputElement>('#fileInput').click(); $<HTMLInputElement>('#fileInput').onchange = event => { const files = [...(event.target as HTMLInputElement).files ?? []]; files.forEach(file => tracks.push({ id: crypto.randomUUID(), title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Local file', album: 'Your library', duration: '—', url: URL.createObjectURL(file), color: ['#e8875d', '#b8c96b', '#71a6a1', '#d7a95e'][tracks.length % 4] })); if (files.length) { loadTrack(tracks.length - files.length); renderQueue(); } }; audio.ontimeupdate = () => { $('#currentTime').textContent = formatTime(audio.currentTime); $('#progress').setAttribute('value', audio.duration ? String((audio.currentTime / audio.duration) * 100) : '0'); }; audio.onloadedmetadata = () => { const duration = formatTime(audio.duration); trackDuration.textContent = duration; totalTime.textContent = duration; const track = tracks[currentIndex]; if (track) track.duration = duration; renderQueue(); }; audio.onended = () => { if (!audio.loop) { loadTrack(currentIndex + 1); if (tracks[currentIndex].url) audio.play(); } }; audio.onplay = () => { isPlaying = true; updatePlayButton(); renderQueue(); }; audio.onpause = () => { isPlaying = false; updatePlayButton(); renderQueue(); };
document.querySelectorAll<HTMLButtonElement>('.timer-option').forEach(button => button.onclick = () => { const minutes = Number(button.dataset.minutes); window.clearInterval(timerId); timerSeconds = minutes * 60; document.querySelectorAll('.timer-option').forEach(option => option.classList.toggle('active', option === button)); if (!minutes) { $('#timerDisplay').textContent = 'OFF'; $('#timerLabel').textContent = 'Music will play until you say so.'; return; } $('#timerLabel').textContent = `Music will stop in ${minutes} minutes.`; const tick = () => { $('#timerDisplay').textContent = formatTime(timerSeconds); if (timerSeconds <= 0) { audio.pause(); $('#timerDisplay').textContent = 'DONE'; $('#timerLabel').textContent = 'Rest well. Playback has stopped.'; window.clearInterval(timerId); } timerSeconds--; }; tick(); timerId = window.setInterval(tick, 1000); });
renderEqualizer(); loadTrack(0); audio.volume = 0.78;
