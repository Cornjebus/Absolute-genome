// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// TAB 1: Gel Simulation
const gelCanvas = document.getElementById('gelCanvas');
const ctx = gelCanvas.getContext('2d');
const timeSlider = document.getElementById('time-slider');
const timeVal = document.getElementById('time-val');
const mgSlider = document.getElementById('mg-slider');
const mgVal = document.getElementById('mg-val');
const enzymeSelect = document.getElementById('enzyme-select');

let kineticsChart = null;

function renderGel() {
  const t = parseInt(timeSlider.value);
  timeVal.innerText = t + 's';
  const mg = parseFloat(mgSlider.value);
  mgVal.innerText = mg.toFixed(1) + ' mM';
  const enzyme = enzymeSelect.value;

  // Clear gel
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, gelCanvas.width, gelCanvas.height);

  // Draw lanes: 1=Ladder, 2=Primer alone, 3=Consensus (TATAATTAATTT), 4=Control (TTAAATATTTAT)
  const lanes = [
    { name: 'MW', x: 50 },
    { name: 'Primer', x: 120 },
    { name: 'Consensus', x: 200 },
    { name: 'Control', x: 280 }
  ];

  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';

  lanes.forEach(l => {
    ctx.fillText(l.name, l.x, 24);
    // Draw lane track
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(l.x, 35);
    ctx.lineTo(l.x, 400);
    ctx.stroke();
  });

  // Calculate kinetics
  // Consensus pauses heavily in 19-30 nt window; control reads through to 49 nt
  let arrestIntensityConsensus = 0;
  let fullIntensityConsensus = 0;
  let arrestIntensityControl = 0;
  let fullIntensityControl = 0;

  const rateModifier = enzyme === 'orf2p' ? 0.8 : (enzyme === 'commercial' ? 1.4 : 1.0);
  const mgFactor = (mg / 3.0);

  // Time evolution
  const progress = Math.min(1.0, (t * rateModifier * mgFactor) / 300);
  arrestIntensityConsensus = 0.85 * (1 - Math.exp(-t / 40)) * (enzyme === 'commercial' ? 0.4 : 0.95);
  fullIntensityConsensus = 0.25 * Math.max(0, (t - 60) / 240);

  arrestIntensityControl = 0.05 * (1 - Math.exp(-t / 30));
  fullIntensityControl = 0.85 * progress;

  // Helper to draw band
  function drawBand(x, y, height, width, intensity, color) {
    if (intensity <= 0) return;
    const gradient = ctx.createLinearGradient(x - width/2, y, x + width/2, y);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, color.replace('ALPHA', intensity.toFixed(2)));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - width/2, y - height/2, width, height);
  }

  // Ladder bands
  const ladderY = [70, 110, 160, 220, 290, 360];
  ladderY.forEach(y => drawBand(50, y, 4, 30, 0.7, 'rgba(148, 163, 184, ALPHA)'));

  // Primer band (18 nt, bottom ~370)
  drawBand(120, 370, 5, 36, 0.9, 'rgba(56, 189, 248, ALPHA)');
  drawBand(200, 370, 5, 36, Math.max(0.1, 1 - arrestIntensityConsensus - fullIntensityConsensus), 'rgba(56, 189, 248, ALPHA)');
  drawBand(280, 370, 5, 36, Math.max(0.1, 1 - arrestIntensityControl - fullIntensityControl), 'rgba(56, 189, 248, ALPHA)');

  // 19-30 nt Arrest Zone (~240-270)
  drawBand(200, 255, 12, 38, arrestIntensityConsensus, 'rgba(56, 189, 248, ALPHA)');
  drawBand(280, 255, 6, 38, arrestIntensityConsensus, 'rgba(56, 189, 248, ALPHA)');

  // 49 nt Full Length (~110)
  drawBand(200, 110, 6, 38, fullIntensityConsensus, 'rgba(16, 185, 129, ALPHA)');
  drawBand(280, 110, 8, 38, fullIntensityConsensus, 'rgba(16, 185, 129, ALPHA)');
}

timeSlider.addEventListener('input', renderGel);
mgSlider.addEventListener('input', renderGel);
enzymeSelect.addEventListener('change', () => { renderGel(); updateKineticsChart(); });

function initKineticsChart() {
  const ctxK = document.getElementById('kineticsChart').getContext('2d');
  const times = [15, 30, 60, 120, 240, 360, 480, 600];
  
  kineticsChart = new Chart(ctxK, {
    type: 'line',
    data: {
      labels: times.map(t => t + 's'),
      datasets: [
        {
          label: 'Consensus Motif Arrest Fraction (19-30 nt)',
          data: times.map(t => 0.88 * (1 - Math.exp(-t / 45))),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
  const enzyme = enzymeSelect.value;
  const mod = enzyme === 'commercial' ? 0.45 : (enzyme === 'orf2p' ? 0.85 : 0.92);
  const times = [15, 30, 60, 120, 240, 360, 480, 600];
  kineticsChart.data.datasets[0].data = times.map(t => mod * (1 - Math.exp(-t / 45)));
  kineticsChart.update();
}

// TAB 2: Bilateral Collatz Engine
function toBinary8(n: number) {}
function toBinary8(n9 {
  let v = n < 0 ? (256 + n) : n;
  return (v >>> 0).toString(2).padStart(8, '0');
}

function runBilateralCollatz(seed) {
  let pos = Math.abs(seed);
  let neg = -pos;

  let posSteps = [pos];
  let negSteps = [neg];

  for (let i = 0; i < 40 && pos !== 1; i++) {
    if (pos % 2 === 0) pos = pos / 2;
    else pos = 3 * pos + 1;
    posSteps.push(pos);
  }

  for (let i = 0; i < 40 && neg !== -1; i++) {
    if (neg % 2 === 0) neg = neg / 2;
    else neg = 3 * neg - 1; // 3n + sign(n)
    negSteps.push(neg);
  }

  document.getElementById('pos-manifold').innerText = posSteps.join(' -> ');
  document.getElementById('neg-manifold').innerText = negSteps.join(' -> ');

  const tbody = document.getElementById('bit-tbody');
  tbody.innerHTML = '';

  const maxLen = Math.min(posSteps.length, negSteps.length, 12);
  for (let i = 0; i < maxLen; i++) {
    const pVal = posSteps[i];
    const nVal = negSteps[i];
    const pBin = toBinary8(pVal);
    const nBin = toBinary8(nVal);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i}</td>
      <td><strong>${pVal}</strong></td>
      <td><code>${pBin}</code></td>
      <td><strong>${nVal}</strong></td>
      <td><code>${nBin}</code></td>
      <td style="color:#38bdf8;">Bitwise Mirror (Two's Comp)</td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById('btn-run-collatz').addEventListener('click', () => {
  const seed = parseInt(document.getElementById('collatz-input').value) || 27;
  runBilateralCollatz(seed);
});

// TAB 3: Syntax Scanner
const sampleMarsHill = `>MarsHill_phage_array_214k
ATGCGTATAATTAATTTGCAGTCGTAGCTGCAGTCGATCGTAGCTAGCTAGCTGATCGATCGATCGTAGC
TATAATTAATTTCCGGTTACGTACGTAAACCATTAGCTAGCTAGCGCTACGATCGATCGATCGTAGCTAG
TATAATTAATTTTGCTAGCTAGCTAGCTAGCTAGCTACGATCGATCGTAGCTAGCTAGCTAGC`;

const sampleChr21 = `>Human_Chr21_AP001685_L1_Locus
AATTTTCTATTTATTTATTTATTTATTTTTGAGATGGAGTCTCGCTCTGTCGCCCAAAATATAATTAATTT
CCTGGGTTCAAGCGATTCTCCTGCCTCAGCCTCCCAAGTAGCTGGGACTACAGGCACGTATAATTAATTT
GGCTAATTTTTGTATTTTTAGTAGAGACGGGGTTTCACCATGTTGGCCAGGATGGTCTTGATCTCCTGACC`;

document.getElementById('btn-load-mars').addEventListener('click', () => {
  document.getElementById('fasta-input').value = sampleMarsHill;
});

document.getElementById('btn-load-chr21').addEventListener('click', () => {
  document.getElementById('fasta-input').value = sampleChr21;
});

document.getElementById('btn-scan').addEventListener('click', () => {
  const seq = document.getElementById('fasta-input').value.toUpperCase().replace(/[^ATGC]/g, '');
  if (!seq) return;

  const brakeMotif = 'TATAATTAATTT';
  const brakeIndel = 'TATAATTAATTTT';

  const hits = [];
  let idx = 0;
  while ((idx = seq.indexOf(brakeMotif, idx)) !== -1) {
    const isIndel = seq.substr(idx, brakeIndel.length) === brakeIndel;
    hits.push({
      pos: idx + 1,
      motif: isIndel ? brakeIndel : brakeMotif,
      type: isIndel ? 'Lineage Indel Variant (+T)' : 'Conserved Core Brake'
    });
    idx += brakeMotif.length;
  }

  const resCard = document.getElementById('scan-results-card');
  const summaryDiv = document.getElementById('scan-summary');
  const hitsDiv = document.getElementById('scan-hits-list');

  resCard.style.display = 'block';
  summaryDiv.innerHTML = `<p>Scanned <strong>${seq.length} bp</strong> &bull; Found <strong>${hits.length}</strong> Absolute Syntax motif junction(s).</p>`;

  if (hits.length === 0) {
    hitsDiv.innerHTML = '<p style="color:#94a3b8; margin-top:8px;">No exact Absolute Syntax motif junctions detected in this window.</p>';
  } else {
    let html = '<ul style="margin-top:10px; list-style:none;">';
    hits.forEach(h => {
      html += `<li style="padding:8px 0; border-bottom:1px solid #23304c;">
        <span style="color:#38bdf8; font-weight:bold;">Pos ${h.pos}</span>: 
        <code>${h.motif}</code> &mdash; 
        <span style="color:#10b981;">${h.type}</span>
      </li>`;
    });
    html += '</ul>';
    hitsDiv.innerHTML = html;
  }
});

// Initializations
renderGel();
initKineticsChart();
runBilateralCollatz(27);
