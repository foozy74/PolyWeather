import './app.css';
import { createIcons, CloudLightning, ShieldAlert, MapPin, Activity, Navigation, ChevronDown, ChevronUp } from 'lucide';
import Chart from 'chart.js/auto';

// Initialize Lucide icons on the initial HTML
createIcons({ icons: { CloudLightning, ShieldAlert } });

let cities = [];
let expandedCity = null;
let cityDetailData = {};
let activeChartInstance = null;

const grid = document.getElementById('cities-grid');
const loading = document.getElementById('loading');
const errorContainer = document.getElementById('error-message');
const errorText = document.getElementById('error-text');

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const res = await fetch('/api/cities');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    cities = data.cities || [];
    renderCities();
    // Start lazy-loading city detail data in the background (staggered)
    fetchAllCityDetails();
  } catch (err) {
    errorText.textContent = err.message;
    errorContainer.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

// ── Lazy background fetch for all cities (staggered to not hammer the Pi) ────

async function fetchAllCityDetails() {
  for (const city of cities) {
    fetchCityDetailForCard(city.name);
    await new Promise(r => setTimeout(r, 300)); // 300ms stagger between requests
  }
}

async function fetchCityDetailForCard(cityName) {
  try {
    const res = await fetch(`/api/city/${cityName}`);
    if (!res.ok) return;
    const data = await res.json();
    cityDetailData[cityName] = data;

    // If this city is expanded, render the chart now
    if (expandedCity === cityName) {
      renderChartForCity(cityName);
    }

    // Update the card's displayed values without a full re-render
    updateCityCardValues(cityName, data);
  } catch (err) {
    console.error(`Failed to fetch details for ${cityName}:`, err);
  }
}

// ── Update individual card DOM elements in-place ──────────────────────────────

function updateCityCardValues(cityName, data) {
  const overview = data?.overview || {};
  const airportCurrent = data?.airport_current || {};
  const official = data?.official || {};

  const temp = overview.current_temp
    ?? airportCurrent.temp
    ?? official?.metar?.current?.temp
    ?? null;

  const windSpeed = airportCurrent.wind_speed_kt
    ?? official?.metar?.current?.wind_speed_kt
    ?? null;

  const tempEl = document.getElementById(`temp-${cityName}`);
  const windEl = document.getElementById(`wind-${cityName}`);

  if (tempEl) {
    tempEl.textContent = typeof temp === 'number' ? temp.toFixed(1) : '--';
  }
  if (windEl) {
    windEl.textContent = typeof windSpeed === 'number' ? windSpeed.toFixed(1) : '--';
  }
}

// ── Render all city cards ─────────────────────────────────────────────────────

function renderCities() {
  grid.innerHTML = '';
  cities.forEach(city => {
    const isExpanded = expandedCity === city.name;

    // If we already have detail data for this city, use it; otherwise show '--'
    const detail = cityDetailData[city.name];
    const overview = detail?.overview || {};
    const airportCurrent = detail?.airport_current || {};
    const currentTemp = overview.current_temp ?? airportCurrent.temp ?? null;
    const windSpeed = airportCurrent.wind_speed_kt ?? null;

    const card = document.createElement('div');
    card.className = `glass-card rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-2 ring-blue-500/50 scale-[1.02]' : 'hover:bg-white/5 hover:border-slate-700'}`;
    card.onclick = () => toggleCity(city.name);

    let innerHTML = `
      <div class="p-5">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-emerald-500/10 rounded-xl">
              <i data-lucide="map-pin" class="w-5 h-5 text-emerald-400"></i>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-100">${city.display_name}</h2>
              <div class="flex items-center gap-4 mt-1">
                <span class="text-sm font-medium text-slate-400">${city.icao || ''}</span>
                <span class="text-xs px-2 py-0.5 rounded-full border ${riskBadge(city.risk_level)}">${city.risk_level || ''}</span>
              </div>
            </div>
          </div>
          <div class="p-2 rounded-full hover:bg-slate-700/50 transition-colors">
            <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-5 h-5 text-slate-400"></i>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-6">
          <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="activity" class="w-4 h-4 text-amber-400"></i>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktuell (METAR)</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span id="temp-${city.name}" class="text-2xl font-bold text-slate-100">${typeof currentTemp === 'number' ? currentTemp.toFixed(1) : '--'}</span>
              <span class="text-sm text-slate-400">°C</span>
            </div>
          </div>

          <div class="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="navigation" class="w-4 h-4 text-blue-400"></i>
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wind</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span id="wind-${city.name}" class="text-2xl font-bold text-slate-100">${typeof windSpeed === 'number' ? windSpeed.toFixed(1) : '--'}</span>
              <span class="text-sm text-slate-400">kt</span>
            </div>
          </div>
        </div>
    `;

    if (isExpanded) {
      innerHTML += `
        <div class="pt-4 mt-4 border-t border-slate-700/50" onclick="event.stopPropagation()">
          <h3 class="text-sm font-semibold text-slate-300 mb-2">Stündliche Vorhersage vs. Ist-Werte</h3>
          <div class="w-full h-64 mt-4 relative" id="chart-container-${city.name}">
            <div id="chart-loading-${city.name}" class="absolute inset-0 flex items-center justify-center">
              <div class="flex flex-col items-center">
                <div class="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span class="text-sm text-slate-400">Lade Daten...</span>
              </div>
            </div>
            <canvas id="chart-${city.name}" class="hidden"></canvas>
          </div>
        </div>
      `;
    }

    innerHTML += `</div>`;
    card.innerHTML = innerHTML;
    grid.appendChild(card);
  });

  // Render Lucide icons into newly created elements
  createIcons({ icons: { MapPin, Activity, Navigation, ChevronDown, ChevronUp } });

  // If a city is expanded, draw its chart
  if (expandedCity) {
    if (cityDetailData[expandedCity]) {
      renderChartForCity(expandedCity);
    }
    // else: fetchCityDetailForCard will call renderChartForCity when data arrives
  }
}

// ── Toggle expand/collapse ────────────────────────────────────────────────────

async function toggleCity(cityName) {
  if (expandedCity === cityName) {
    expandedCity = null;
    if (activeChartInstance) {
      activeChartInstance.destroy();
      activeChartInstance = null;
    }
  } else {
    expandedCity = cityName;
    // Kick off a fresh fetch if we don't have detail data yet
    if (!cityDetailData[cityName]) {
      fetchCityDetailForCard(cityName);
    }
  }
  renderCities();
}

// ── Chart rendering ───────────────────────────────────────────────────────────

function renderChartForCity(cityName) {
  const data = cityDetailData[cityName];
  if (!data) return;

  const canvas = document.getElementById(`chart-${cityName}`);
  const chartLoading = document.getElementById(`chart-loading-${cityName}`);
  if (!canvas) return;

  const timeseries = data?.timeseries || data || {};
  const hourly = timeseries.hourly || {};

  const labels = hourly.times || [];
  const forecastTemps = hourly.temps || [];

  if (labels.length === 0) {
    if (chartLoading) chartLoading.innerHTML = '<span class="text-sm text-slate-500">Keine Stundendaten verfügbar.</span>';
    return;
  }

  chartLoading?.classList.add('hidden');
  canvas.classList.remove('hidden');

  if (activeChartInstance) {
    activeChartInstance.destroy();
  }

  // Map METAR observations onto the hourly time axis
  const metarObs = timeseries.metar_today_obs || [];
  const obsData = new Array(labels.length).fill(null);
  metarObs.forEach(obs => {
    const hourPrefix = String(obs.time ?? '').split(':')[0].padStart(2, '0');
    const idx = labels.findIndex(l => String(l).startsWith(hourPrefix));
    if (idx !== -1) obsData[idx] = obs.temp;
  });

  activeChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Vorhersage',
          data: forecastTemps,
          borderColor: 'rgba(59, 130, 246, 0.85)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
        },
        {
          label: 'Ist (METAR)',
          data: obsData,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          spanGaps: true,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.5)', maxTicksLimit: 8 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.5)', callback: v => v + '°C' },
        },
      },
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskBadge(level) {
  if (level === 'high') return 'border-red-500/40 text-red-400 bg-red-500/10';
  if (level === 'medium') return 'border-amber-500/40 text-amber-400 bg-amber-500/10';
  return 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
}

init();
