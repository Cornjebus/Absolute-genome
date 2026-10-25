const $ = id => document.getElementById(id);
function activateTab(tabName) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    const isTarget = p.id === 'tab-' + tabName;
    p.classList.toggle('active', isTarget);
    p.style.display = isTarget ? 'block' : 'none';
  });
}
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});
activateTab('wetlab');

const gelCanvas = $('gelCanvas'), ctx = gelCanvas.getContext('2d');
const timeSlider = $('time-slider'), timeVal = $('time-val');
const mgSlider = $('mg-slider'), mgVal = $('mg-val'), enzymeSelect = $('enzyme-select');
let kineticsChart = null;

function renderGel() {
  const t = parseInt(timeSlider.value), mg = parseFloat(mgSlider.value), enz = enzymeSelect.value;
  timeVal.innerText = t + 's';
  mgVal.innerText = mg.toFixed(1) + ' mM';
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, gelCanvas.width, gelCanvas.height);

  const lanes = [{name:'MW',x:50},{name:'Primer',x:120},{name:'Consensus',x:200},{name:'Control',x:280}];
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  lanes.forEach(l => {
    ctx.fillText(l.name, l.x, 24);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath(); ctx.moveTo(l.x, 35); ctx.lineTo(l.x, 400); ctx.stroke();
  });

  const rateMod = enz === 'orf2p' ? 0.8 : (enz === 'commercial' ? 1.4 : 1.0);
  const prog = Math.min(1.0, (t * rateMod * (mg / 3.0)) / 300);
  const arrCons = 0.85 * (1 - Math.exp(-t / 40)) * (enz === 'commercial' ? 0.4 : 0.95);
  const fullCons = 0.25 * Math.max(0, (t - 60) / 240);
  const arrCtrl = 0.05 * (1 - Math.exp(-t / 30));
  const fullCtrl = 0.85 * prog;

  function band(x, y, h, w, a, col) {
    if (a <= 0) return;
    const g = ctx.createLinearGradient(x - w/2, y, x + w/2, y);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, col.replace('ALPHA', a.toFixed(2)));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - w/2, y - h/2, w, h);
  }

  [70, 110, 160, 220, 290, 360].forEach(y => band(50, y, 4, 30, 0.7, 'rgba(148,163,184,ALPHA)'));
  band(120, 370, 5, 36, 0.9, 'rgba(56,189,248,ALPHA)');
  band(200, 370, 5, 36, Math.max(0.1, 1 - arrCons - fullCons), 'rgba(56,189,248,ALPHA)');
  band(280, 370, 5, 36, Math.max(0.1, 1 - arrCtrl - fullCtrl), 'rgba(56,189,248,ALPHA)');
  band(200, 255, 12, 38, arrCons, 'rgba(56,189,248,ALPHA)');
  band(280, 255, 6, 38, arrCtrl, 'rgba(56,189,248,ALPHA)');
  band(200, 110, 6, 38, fullCons, 'rgba(16,185,129,ALPHA)');
  band(280, 110, 8, 38, fullCtrl, 'rgba(16,185,129,ALPHA)');
}

timeSlider.addEventListener('input', renderGel);
mgSlider.addEventListener('input', renderGel);
enzymeSelect.addEventListener('change', () => { renderGel(); updateKineticsChart(); });

function initKineticsChart() {
  const times = [15, 30, 60, 120, 240, 360, 480, 600];
  kineticsChart = new Chart($('kineticsChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: times.map(t => t + 's'),
      datasets: [
        {
          label: 'Consensus Motif Arrest Fraction (19-30 nt)',
          data: times.map(t => 0.88 * (1 - Math.exp(-t / 45))),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.1)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Scramble Control Arrest Fraction (Delta-Tm 0.000 deg C)',
          data: times.map(t => 0.06 * (1 - Math.exp(-t / 30))),
          borderColor: '#10b981',
          borderDash: [5, 5],
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 1.0, title: { display: true, text: 'Pause / Arrest Ratio' } },
        x: { title: { display: true, text: 'Reaction Time (seconds)' } }
      }
    }
  });
}

function updateKineticsChart() {
  if (!kineticsChart) return;
  const enz = enzymeSelect.value;
  const mod = enz === 'commercial' ? 0.45 : (enz === 'orf2p' ? 0.85 : 0.92);
  const times = [15, 30, 60, 120, 240, 360, 480, 600];
  kineticsChart.data.datasets[0].data = times.map(t => mod * (1 - Math.exp(-t / 45)));
  kineticsChart.update();
}

function bin8(x) {
  const v = x < 0 ? (256 + x) : x;
  return (v >>> 0).toString(2).padStart(8, '0');
}

function runBilateralCollatz(seed) {
  let pos = Math.abs(seed), neg = -pos, pSteps = [pos], nSteps = [neg];
  for (let i = 0; i < 40 && pos !== 1; i++) {
    pos = (pos % 2 === 0) ? (pos / 2) : (3 * pos + 1);
    pSteps.push(pos);
  }
  for (let i = 0; i < 40 && neg !== -1; i++) {
    neg = (neg % 2 === 0) ? (neg / 2) : (3 * neg - 1);
    nSteps.push(neg);
  }
  $('pos-manifold').innerText = pSteps.join(' -> ');
  $('neg-manifold').innerText = nSteps.join(' -> ');
  const tbody = $('bit-tbody');
  tbody.innerHTML = '';
  const len = Math.min(pSteps.length, nSteps.length, 12);
  for (let i = 0; i < len; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + i + '</td><td><strong>' + pSteps[i] + '</strong></td><td><code>' + bin8(pSteps[i]) + '</code></td><td><strong>' + nSteps[i] + '</strong></td><td><code>' + bin8(nSteps[i]) + '</code></td><td style="color:#38bdf8;">Bitwise Mirror (Two\'s Comp)</td>';
    tbody.appendChild(tr);
  }
}

$('btn-run-collatz').addEventListener('click', () => {
  runBilateralCollatz(parseInt($('collatz-input').value) || 27);
});

const sampleMarsHill = ">MarsHill_phage_array_214k\nATGCGTATAATTAATTTGCAGTCGTAGCTGCAGTCGATCGTAGCTAGCTAGCTGATCGATCGATCGTAGC\nTATAATTAATTTCCGGTTACGTACGTAAACCATTAGCTAGCTAGCGCTACGATCGATCGATCGTAGCTAG\nTATAATTAATTTTGCTAGCTAGCTAGCTAGCTAGCTACGATCGATCGTAGCTAGCTAGCTAGC";
const sampleChr21 = ">Human_Chr21_AP001685_L1_Locus\nAATTTTCTATTTATTTATTTATTTATTTTTGAGATGGAGTCTCGCTCTGTCGCCCAAAATATAATTAATTT\nCCTGGGTTCAAGCGATTCTCCTGCCTCAGCCTCCCAAGTAGCTGGGACTACAGGCACGTATAATTAATTT\nGGCTAATTTTTGTATTTTTAGTAGAGACGGGGTTTCACCATGTTGGCCAGGATGGTCTTGATCTCCTGACC";

$('btn-load-mars').addEventListener('click', () => { $('fasta-input').value = sampleMarsHill; });
$('btn-load-chr21').addEventListener('click', () => { $('fasta-input').value = sampleChr21; });

$('btn-scan').addEventListener('click', () => {
  const raw = $('fasta-input').value.split('\n').filter(l => !l.startsWith('>')).join('');
  const seq = raw.toUpperCase().replace(/[^ATGC]/g, '');
  if (!seq) return;
  const motif = 'TATAATTAATTT', indel = 'TATAATTAATTTT', hits = [];
  let idx = 0;
  while ((idx = seq.indexOf(motif, idx)) !== -1) {
    const isIndel = seq.substr(idx, indel.length) === indel;
    hits.push({
      pos: idx + 1,
      motif: isIndel ? indel : motif,
      type: isIndel ? 'Lineage Indel Variant (+T)' : 'Conserved Core Brake'
    });
    idx += motif.length;
  }
  $('scan-results-card').style.display = 'block';
  $('scan-summary').innerHTML = '<p>Scanned <strong>' + seq.length + ' bp</strong> &bull; Found <strong>' + hits.length + '</strong> Absolute Syntax motif junction(s).</p>';
  if (!hits.length) {
    $('scan-hits-list').innerHTML = '<p style="color:#94a3b8;margin-top:8px;">No exact Absolute Syntax motif junctions detected in this window.</p>';
  } else {
    $('scan-hits-list').innerHTML = '<ul style="margin-top:10px;list-style:none;">' + hits.map(h => '<li style="padding:8px 0;border-bottom:1px solid #23304c;"><span style="color:#38bdf8;font-weight:bold;">Pos ' + h.pos + '</span>: <code>' + h.motif + '</code> &mdash; <span style="color:#10b981;">' + h.type + '</span></li>').join('') + '</ul>';
  }
});

renderGel();
initKineticsChart();
runBilateralCollatz(27);
