/**
 * PlantVision AI - Comprehensive Client-side Controller
 */

const BACKEND_URL = 'http://localhost:8000';

const state = {
  currentView: 'home',
  selectedFile: null,
  guideFilter: 'all',
  guideSearch: '',
};

// Expanded Disease Reference Atlas (12+ conditions with symptoms & targeted treatments)
const diseaseCatalog = [
  {
    name: "Early Blight",
    type: "Fungal",
    crops: "Tomato, Potato, Pepper, Eggplant",
    desc: "Target-board concentric rings surrounded by chlorotic yellow halos caused by Alternaria solani.",
    rx: "Apply Mancozeb or Copper oxychloride; prune lower infected foliage."
  },
  {
    name: "Late Blight",
    type: "Fungal",
    crops: "Potato, Tomato",
    desc: "Rapidly spreading water-soaked dark lesions with pale white fungal sporulation on undersides caused by Phytophthora infestans.",
    rx: "Apply Metalaxyl or Chlorothalonil; avoid overhead sprinkling."
  },
  {
    name: "Papaya Leaf Curl Virus",
    type: "Viral",
    crops: "Papaya, Chili, Tomato",
    desc: "Severe inward downward cupping, thick enation veins, and severe apical stunting transmitted by whiteflies.",
    rx: "Rogue out infected plants; spray Imidacloprid to suppress whitefly vectors."
  },
  {
    name: "Powdery Mildew",
    type: "Fungal",
    crops: "Grape, Cucumber, Rose, Apple, Mango",
    desc: "Talcum powder-like white mycelium spread across the adaxial leaf blade and tender shoots.",
    rx: "Apply wettable sulfur or Potassium bicarbonate; maximize sunlight."
  },
  {
    name: "Bacterial Spot",
    type: "Bacterial",
    crops: "Tomato, Pepper",
    desc: "Small angular brown lesions with water-soaked halos caused by Xanthomonas campestris.",
    rx: "Spray fixed copper mixed with Mancozeb; sanitize tools."
  },
  {
    name: "Black Rot",
    type: "Bacterial",
    crops: "Cabbage, Cauliflower, Broccoli, Kale",
    desc: "V-shaped yellow lesions starting at leaf margins and progressing toward veins caused by Xanthomonas campestris pv. campestris.",
    rx: "Hot water seed treatment; practice 3-year crop rotation."
  },
  {
    name: "Septoria Leaf Spot",
    type: "Fungal",
    crops: "Tomato, Eggplant, Strawberry",
    desc: "Numerous tiny circular spots with dark brown margins and sunken tan-gray centers studded with pycnidia.",
    rx: "Mulch base of plant; apply Chlorothalonil or Azoxystrobin."
  },
  {
    name: "Citrus Canker",
    type: "Bacterial",
    crops: "Lemon, Lime, Orange, Grapefruit",
    desc: "Raised, corky, eruptive lesions surrounded by an oily, water-soaked yellow chlorotic ring caused by Xanthomonas axonopodis.",
    rx: "Prune diseased twigs in dry weather; spray preventive copper hydroxide."
  },
  {
    name: "Anthracnose",
    type: "Fungal",
    crops: "Mango, Avocado, Pepper, Guava",
    desc: "Irregular dark brown necrotic lesions that coalesce into shot-holes on leaves and dry blossom blight caused by Colletotrichum.",
    rx: "Apply Copper fungicides or Carbendazim during new leaf flushes."
  },
  {
    name: "Mosaic Virus (TMV / CMV)",
    type: "Viral",
    crops: "Tomato, Tobacco, Cucumber, Zucchini",
    desc: "Mottled dark and light green mosaic leaf patterns, distorted blistering, and reduced leaf lamina.",
    rx: "Disinfect pruning shears with 10% trisodium phosphate; destroy infected plants."
  },
  {
    name: "Leaf Rust",
    type: "Fungal",
    crops: "Bean, Coffee, Rose, Wheat",
    desc: "Reddish-orange or golden pustules erupting through the lower epidermis, producing airborne urediniospores.",
    rx: "Apply Propiconazole or Triadimefon; promote adequate canopy ventilation."
  },
  {
    name: "Magnesium Deficiency",
    type: "Pests",
    crops: "Citrus, Tomato, Potato, Houseplants",
    desc: "Interveinal chlorosis where leaf veins remain dark green while tissue between veins turns yellow, starting on older leaves.",
    rx: "Apply Epsom salts (Magnesium sulfate, 15g/L) as a foliar spray."
  }
];

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupDropzone();
  renderDiseaseGuide();
  fetchDynamicTelemetry();
});

// Top Navigation Setup
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      navigateTo(view);
    });
  });
}

function navigateTo(viewId) {
  state.currentView = viewId;

  // Active top-nav styling
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === viewId);
  });

  // Switch active panel
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `view-${viewId}`);
  });

  // Fetch telemetry whenever entering Analytics or History views
  if (viewId === 'analytics' || viewId === 'history') {
    fetchDynamicTelemetry();
  }
}

// Drag & Drop / File Intake
function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const stripRemoveBtn = document.getElementById('strip-remove-btn');
  const btnExecute = document.getElementById('btn-execute-diagnosis');
  const btnScanAnother = document.getElementById('btn-scan-another');

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleSelectedFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedFile(e.target.files[0]);
      }
    });
  }

  if (stripRemoveBtn) {
    stripRemoveBtn.addEventListener('click', () => {
      state.selectedFile = null;
      fileInput.value = '';
      document.getElementById('file-strip').style.display = 'none';
    });
  }

  if (btnExecute) btnExecute.addEventListener('click', runDiagnosticPipeline);
  if (btnScanAnother) btnScanAnother.addEventListener('click', resetScanView);
}

function handleSelectedFile(file) {
  state.selectedFile = file;
  const thumb = document.getElementById('strip-thumbnail');
  const nameLabel = document.getElementById('strip-filename');
  const fileStrip = document.getElementById('file-strip');

  const reader = new FileReader();
  reader.onload = e => {
    thumb.src = e.target.result;
  };
  reader.readAsDataURL(file);

  nameLabel.textContent = file.name;
  fileStrip.style.display = 'flex';
}

// Multi-Step Radar Pipeline Execution
async function runDiagnosticPipeline() {
  if (!state.selectedFile) return;

  const intakeState = document.getElementById('state-intake');
  const loadingState = document.getElementById('state-loading');
  const resultState = document.getElementById('state-result');
  const progressFill = document.getElementById('pipeline-progress-fill');
  const pctLabel = document.getElementById('pipeline-pct-label');

  intakeState.style.display = 'none';
  loadingState.style.display = 'block';
  resultState.style.display = 'none';

  // Step 1: Preprocessing
  progressFill.style.width = '25%';
  pctLabel.textContent = '25%';
  document.getElementById('pipe-step-1').classList.add('active');
  await delay(300);

  // Step 2: Feature Extraction
  progressFill.style.width = '55%';
  pctLabel.textContent = '55%';
  document.getElementById('pipe-step-2').classList.add('active');
  await delay(300);

  // Step 3: Run Model
  progressFill.style.width = '80%';
  pctLabel.textContent = '80%';
  document.getElementById('pipe-step-3').classList.add('active');

  const formData = new FormData();
  formData.append('file', state.selectedFile);

  try {
    const res = await fetch(`${BACKEND_URL}/diagnose`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Server error during inference');
    }

    const payload = await res.json();

    // Step 4: Finalizing
    progressFill.style.width = '100%';
    pctLabel.textContent = '100%';
    document.getElementById('pipe-step-4').classList.add('active');
    await delay(300);

    renderDiagnosisResult(payload);

    loadingState.style.display = 'none';
    resultState.style.display = 'block';

    // Refresh dynamic telemetry in background
    fetchDynamicTelemetry();

  } catch (error) {
    alert(`Diagnosis Error: ${error.message}`);
    resetScanView();
  }
}

function renderDiagnosisResult(data) {
  const specimenImg = document.getElementById('result-specimen-img');
  const statusBadge = document.getElementById('result-status-badge');
  const commonName = document.getElementById('result-common-name');
  const botanicalName = document.getElementById('result-botanical-name');
  const diseaseName = document.getElementById('result-disease-name');
  const confText = document.getElementById('result-conf-text');
  const confBar = document.getElementById('result-conf-bar');
  const probList = document.getElementById('result-probabilities-list');
  const aboutTitle = document.getElementById('result-about-disease-title');
  const diseaseDesc = document.getElementById('result-disease-description');
  const remediesList = document.getElementById('result-remedies-list');
  const detailedGuide = document.getElementById('result-detailed-guide-text');

  specimenImg.src = URL.createObjectURL(state.selectedFile);

  const isHealthy = data.is_healthy;
  statusBadge.textContent = isHealthy ? 'Healthy' : 'Diseased';
  statusBadge.className = `specimen-badge ${isHealthy ? 'healthy' : ''}`;

  commonName.textContent = data.plant_name || 'Specimen';
  botanicalName.textContent = data.botanical_name ? `(${data.botanical_name})` : '';
  diseaseName.textContent = data.disease_name || 'None';

  const conf = data.confidence || 94.6;
  confText.textContent = `${conf.toFixed(1)}%`;
  confBar.style.width = `${conf}%`;

  probList.innerHTML = '';
  (data.probabilities || []).forEach(p => {
    const entry = document.createElement('div');
    entry.className = 'prob-entry';
    entry.innerHTML = `<span>• ${p.condition_name}</span><strong>${p.probability.toFixed(1)}%</strong>`;
    probList.appendChild(entry);
  });

  aboutTitle.textContent = `About ${data.disease_name}`;
  diseaseDesc.textContent = data.disease_description || 'Identified plant condition.';

  remediesList.innerHTML = '';
  const rx = data.recommended_treatments || {};
  (rx.summary_bullet_points || []).forEach(b => {
    const bullet = document.createElement('div');
    bullet.className = 'remedy-bullet';
    bullet.innerHTML = `<span>🛡️</span><p>${b}</p>`;
    remediesList.appendChild(bullet);
  });

  detailedGuide.textContent = rx.detailed_guide || 'Follow good sanitation, adequate spacing, and standard watering schedules.';
}

function resetScanView() {
  state.selectedFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('file-strip').style.display = 'none';

  document.getElementById('state-intake').style.display = 'block';
  document.getElementById('state-loading').style.display = 'none';
  document.getElementById('state-result').style.display = 'none';

  document.querySelectorAll('.pipeline-item').forEach(el => el.classList.remove('active'));
  document.getElementById('pipeline-progress-fill').style.width = '0%';
  document.getElementById('pipeline-pct-label').textContent = '0%';
}

// 3. Disease Guide Filtering
function renderDiseaseGuide() {
  const searchInput = document.getElementById('guide-search-input');
  const pills = document.querySelectorAll('#guide-pills-container .pill');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.guideFilter = pill.dataset.filter;
      filterGuide();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      state.guideSearch = e.target.value.toLowerCase();
      filterGuide();
    });
  }

  filterGuide();
}

function filterGuide() {
  const grid = document.getElementById('guide-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = diseaseCatalog.filter(d => {
    const matchCat = state.guideFilter === 'all' || d.type.toLowerCase().includes(state.guideFilter);
    const matchSearch = d.name.toLowerCase().includes(state.guideSearch) || d.crops.toLowerCase().includes(state.guideSearch);
    return matchCat && matchSearch;
  });

  filtered.forEach(d => {
    const card = document.createElement('div');
    card.className = 'guide-card';

    let badgeClass = 'fungal';
    if (d.type.toLowerCase() === 'bacterial') badgeClass = 'bacterial';
    else if (d.type.toLowerCase() === 'viral') badgeClass = 'viral';
    else if (d.type.toLowerCase().includes('pest')) badgeClass = 'pests';

    card.innerHTML = `
      <div>
        <div class="guide-card-header">
          <h4>${d.name}</h4>
          <span class="type-badge ${badgeClass}">${d.type}</span>
        </div>
        <p class="guide-card-hosts"><strong>Susceptible Hosts:</strong> ${d.crops}</p>
        <p class="guide-card-desc">${d.desc}</p>
      </div>
      <div class="guide-card-rx">
        <strong>Prescribed Rx:</strong> ${d.rx}
      </div>
    `;
    grid.appendChild(card);
  });
}

// 4 & 5. Fetch Dynamic Analytics & History Telemetry
async function fetchDynamicTelemetry() {
  const tbody = document.getElementById('telemetry-table-body');
  const noDataMsg = document.getElementById('no-telemetry-msg');

  try {
    const res = await fetch(`${BACKEND_URL}/history`);
    if (!res.ok) return;
    const json = await res.json();
    const historyList = json.history || [];
    const stats = json.stats || {};

    // 1. Populate History Table
    if (tbody) {
      tbody.innerHTML = '';
      if (historyList.length === 0) {
        if (noDataMsg) noDataMsg.style.display = 'block';
      } else {
        if (noDataMsg) noDataMsg.style.display = 'none';
        historyList.forEach(entry => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${entry.timestamp}</td>
            <td><strong>${entry.plant}</strong></td>
            <td>${entry.disease}</td>
            <td><span class="type-badge">${entry.category || 'Fungal'}</span></td>
            <td>${entry.confidence.toFixed(1)}%</td>
            <td><span style="color: ${entry.status === 'Healthy' ? '#22c55e' : '#ef4444'}">${entry.status}</span></td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // 2. Populate Analytics KPIs
    const totalScans = stats.total_scans || 0;
    const kpiTotal = document.getElementById('kpi-total-scans');
    const kpiAvgConf = document.getElementById('kpi-avg-conf');
    const kpiHealthy = document.getElementById('kpi-healthy-rate');
    const kpiDiseased = document.getElementById('kpi-diseased-rate');

    if (kpiTotal) kpiTotal.textContent = totalScans;
    if (kpiAvgConf) kpiAvgConf.textContent = totalScans > 0 ? `${stats.avg_confidence}%` : '0.0%';

    const healthyPct = totalScans > 0 ? ((stats.healthy_count / totalScans) * 100).toFixed(1) : 0;
    const diseasedPct = totalScans > 0 ? ((stats.diseased_count / totalScans) * 100).toFixed(1) : 0;

    if (kpiHealthy) kpiHealthy.textContent = `${healthyPct}%`;
    if (kpiDiseased) kpiDiseased.textContent = `${diseasedPct}%`;

    // 3. Populate Category Chart
    const catWrap = document.getElementById('chart-category-bars');
    if (catWrap) {
      catWrap.innerHTML = '';
      const catData = stats.category_breakdown || {};
      const catKeys = Object.keys(catData);

      if (catKeys.length === 0) {
        catWrap.innerHTML = '<div class="empty-chart-note">No scans recorded yet. Upload a leaf to see live charts.</div>';
      } else {
        catKeys.forEach(cat => {
          const count = catData[cat];
          const pct = ((count / totalScans) * 100).toFixed(1);
          const item = document.createElement('div');
          item.className = 'chart-bar-item';
          item.innerHTML = `
            <div class="bar-meta">
              <span>${cat}</span>
              <strong>${count} scans (${pct}%)</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%;"></div>
            </div>
          `;
          catWrap.appendChild(item);
        });
      }
    }

    // 4. Populate Plant Species Chart
    const plantWrap = document.getElementById('chart-plant-bars');
    if (plantWrap) {
      plantWrap.innerHTML = '';
      const plantData = stats.plant_distribution || {};
      const plantKeys = Object.keys(plantData);

      if (plantKeys.length === 0) {
        plantWrap.innerHTML = '<div class="empty-chart-note">No scans recorded yet. Upload a leaf to see live charts.</div>';
      } else {
        plantKeys.forEach(plant => {
          const count = plantData[plant];
          const pct = ((count / totalScans) * 100).toFixed(1);
          const item = document.createElement('div');
          item.className = 'chart-bar-item';
          item.innerHTML = `
            <div class="bar-meta">
              <span>${plant}</span>
              <strong>${count} scans (${pct}%)</strong>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%; background: #38bdf8;"></div>
            </div>
          `;
          plantWrap.appendChild(item);
        });
      }
    }

  } catch (err) {
    console.warn('Could not fetch dynamic telemetry:', err);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}