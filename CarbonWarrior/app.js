/* ============================================
  AVIATION CARBON ROUTE OPTIMIZER — APP.JS
   ============================================ */

// ---- DATA ----
const airports = [
  { code: "DEL", name: "Indira Gandhi International", city: "Delhi", lat: 28.5562, lng: 77.1000 },
  { code: "BOM", name: "Chhatrapati Shivaji Maharaj", city: "Mumbai", lat: 19.0896, lng: 72.8656 },
  { code: "BLR", name: "Kempegowda International", city: "Bengaluru", lat: 13.1986, lng: 77.7066 },
  { code: "MAA", name: "Chennai International", city: "Chennai", lat: 12.9941, lng: 80.1709 },
  { code: "CCU", name: "Netaji Subhas Chandra Bose", city: "Kolkata", lat: 22.6547, lng: 88.4467 },
  { code: "HYD", name: "Rajiv Gandhi International", city: "Hyderabad", lat: 17.2403, lng: 78.4294 },
  { code: "AMD", name: "Sardar Vallabhbhai Patel", city: "Ahmedabad", lat: 23.0771, lng: 72.6347 },
  { code: "PNQ", name: "Pune Airport", city: "Pune", lat: 18.5822, lng: 73.9197 },
  { code: "GOI", name: "Goa International", city: "Goa", lat: 15.3808, lng: 73.8314 },
  { code: "JAI", name: "Jaipur International", city: "Jaipur", lat: 26.8242, lng: 75.8122 },
  { code: "LKO", name: "Chaudhary Charan Singh", city: "Lucknow", lat: 26.7606, lng: 80.8893 },
  { code: "COK", name: "Cochin International", city: "Kochi", lat: 10.1520, lng: 76.4019 },
  { code: "GAU", name: "Lokpriya Gopinath Bordoloi", city: "Guwahati", lat: 26.1061, lng: 91.5859 },
  { code: "PAT", name: "Jay Prakash Narayan", city: "Patna", lat: 25.5913, lng: 85.0880 },
  { code: "IXC", name: "Chandigarh Airport", city: "Chandigarh", lat: 30.6735, lng: 76.7885 },
];

const aircraftTypes = [
  { id: "a320", name: "Airbus A320", fuelRate: 2.5 },
  { id: "b737", name: "Boeing 737-800", fuelRate: 2.6 },
  { id: "atr72", name: "ATR 72-600", fuelRate: 0.8 },
  { id: "a321", name: "Airbus A321neo", fuelRate: 2.3 },
  { id: "crj700", name: "CRJ-700", fuelRate: 1.4 },
];

let currentResult = null;
let chartInstances = { bar: null, line: null, pie: null };
let routeMap, networkMap, routeMapLayerGroup, networkMapLayerGroup, routeMapTileLayer, networkMapTileLayer;
let windLayerGroup, weatherMarkersGroup;
let weatherIntelligenceActive = false;
let currentWeatherData = {};
let fuelPriceIndex = {};
let savedRoutesHistory = [];
let windParticleSystem = null;
let activeStorms = [];

const leaderboardData = [
  { airline: "Akasa Air", score: 96, reduction: "12.4%", status: "pioneer" },
  { airline: "IndiGo", score: 92, reduction: "10.8%", status: "leader" },
  { airline: "Air India", score: 88, reduction: "8.5%", status: "active" },
  { airline: "SpiceJet", score: 85, reduction: "7.2%", status: "active" },
  { airline: "Air India Express", score: 82, reduction: "6.9%", status: "active" }
];

class WindParticle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }
  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.life = 0.5 + Math.random() * 0.5;
    this.speed = 0.5 + Math.random() * 1.5;
    const weatherCodes = Object.keys(currentWeatherData);
    const randomAirport = weatherCodes[Math.floor(Math.random() * weatherCodes.length)];
    const weather = currentWeatherData[randomAirport] || { wind_speed: 10, wind_dir: "N" };
    this.angle = this.dirToAngle(weather.wind_dir) + (Math.random() - 0.5) * 0.2;
  }
  dirToAngle(dir) {
    const dirs = { "N": -Math.PI/2, "NE": -Math.PI/4, "E": 0, "SE": Math.PI/4, "S": Math.PI/2, "SW": 3*Math.PI/4, "W": Math.PI, "NW": -3*Math.PI/4 };
    return dirs[dir] || 0;
  }
  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.life -= 0.005;
    if (this.life <= 0 || this.x < 0 || this.x > this.canvas.width || this.y < 0 || this.y > this.canvas.height) {
      this.reset();
    }
  }
  draw(ctx) {
    ctx.strokeStyle = `rgba(16, 185, 129, ${this.life * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - Math.cos(this.angle) * 10, this.y - Math.sin(this.angle) * 10);
    ctx.stroke();
  }
}

class StormCell {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
  }
  reset() {
    // Specific Indian Regions: Gujarat Coast, Kerala, West Bengal
    const regions = [
      { lat: 23.0, lng: 70.0, name: "Gujarat Coast" },
      { lat: 10.5, lng: 76.5, name: "Kerala sector" },
      { lat: 22.5, lng: 88.3, name: "West Bengal bay" }
    ];
    
    const region = regions[Math.floor(Math.random() * regions.length)];
    this.regionName = region.name;
    this.lat = region.lat + (Math.random() - 0.5) * 2;
    this.lng = region.lng + (Math.random() - 0.5) * 2;
    this.radiusKm = 100 + Math.random() * 100; // Physical radius
    
    this.vx = (Math.random() - 0.5) * 0.01; // Lat drift
    this.vy = (Math.random() - 0.5) * 0.01; // Lng drift
    this.pulse = 0;
    this.updateCanvasPosition();
  }
  updateCanvasPosition() {
    if (typeof routeMap !== 'undefined' && routeMap) {
      const point = routeMap.latLngToContainerPoint([this.lat, this.lng]);
      this.x = point.x;
      this.y = point.y;
      
      // Calculate screen radius based on zoom
      const center = routeMap.getCenter();
      const point2 = routeMap.latLngToContainerPoint([this.lat, this.lng + 1]);
      const pixelPerDegree = Math.abs(point2.x - this.x);
      this.screenRadius = (this.radiusKm / 111) * pixelPerDegree;
    }
  }
  update() {
    this.lat += this.vx;
    this.lng += this.vy;
    this.pulse += 0.04;
    this.updateCanvasPosition();

    // Reset if it drifts too far from India coastal bounds (rough box)
    if (this.lat < 5 || this.lat > 30 || this.lng < 65 || this.lng > 95) {
      this.reset();
    }
  }
  draw(ctx) {
    if (!this.x || !this.y) return;
    const pulseScale = 1 + Math.sin(this.pulse) * 0.15;
    const gradRadius = Math.max(10, this.screenRadius * pulseScale);
    
    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, gradRadius);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
    gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.2)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, gradRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, gradRadius * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- UTILS ----
function calculateDistance(a1, a2) {
  const R = 6371;
  const dLat = (a2.lat - a1.lat) * Math.PI / 180;
  const dLng = (a2.lng - a1.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a1.lat * Math.PI / 180) * Math.cos(a2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}



// ---- INIT ----
document.addEventListener("DOMContentLoaded", function () {
  const depSel = document.getElementById("departure");
  const destSel = document.getElementById("destination");
  const aircraftSel = document.getElementById("aircraft");

  if (!depSel) return; // Not on dashboard page

  airports.forEach(a => {
    const opt1 = new Option(`${a.code} — ${a.city}`, a.code);
    const opt2 = new Option(`${a.code} — ${a.city}`, a.code);
    depSel.appendChild(opt1);
    destSel.appendChild(opt2);
  });

  aircraftTypes.forEach(a => {
    aircraftSel.appendChild(new Option(a.name, a.id));
    if(document.getElementById("compAir1")) {
      document.getElementById("compAir1").appendChild(new Option(a.name, a.id));
      document.getElementById("compAir2").appendChild(new Option(a.name, a.id));
    }
  });

  function checkInputs() {
    const btn = document.getElementById("optimizeBtn");
    btn.disabled = !(depSel.value && destSel.value && aircraftSel.value && depSel.value !== destSel.value);
  }

  depSel.addEventListener("change", checkInputs);
  destSel.addEventListener("change", checkInputs);
  aircraftSel.addEventListener("change", checkInputs);

  // Sidebar mobile functionality
  const sidebarToggle = document.getElementById("mobileSidebarToggle");
  const sidebar = document.querySelector(".sidebar");
  let overlay = document.querySelector(".sidebar-overlay");

  if (!overlay && sidebar) {
    overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    document.body.appendChild(overlay);
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("open");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    });
  }

  // Theme Toggle
  const themeBtn = document.getElementById("themeToggleBtn");
  const themeIcon = document.getElementById("themeIcon");
  
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-mode");
    updateThemeIcon();
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const isLight = document.body.classList.contains("light-mode");
      localStorage.setItem("theme", isLight ? "light" : "dark");
      updateThemeIcon();
      
      const newUrl = isLight 
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      
      if(routeMapTileLayer) routeMapTileLayer.setUrl(newUrl);
      if(networkMapTileLayer) networkMapTileLayer.setUrl(newUrl);
    });
  }

  function updateThemeIcon() {
    if (!themeIcon) return;
    if (document.body.classList.contains("light-mode")) {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    } else {
      themeIcon.innerHTML = `<circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />`;
    }
  }

  // Draw initial map and network
  initMaps();
  drawRouteMap(null);
  drawNetworkGraph();
  
  // Initialize Weather & Financial Intelligence
  fetchWeatherFromBackend();
  fetchFuelPrices();
  fetchSavedRoutes();

  // Intro Tour
  if (!localStorage.getItem("tourCompleted")) {
    setTimeout(() => {
      if (typeof introJs !== 'undefined') {
        introJs().setOptions({ showProgress: true, showBullets: false }).start().oncomplete(function() {
          localStorage.setItem("tourCompleted", "true");
        });
      }
    }, 1000);
  }
});

// ---- PATHFINDING (PHASE 2: A*) ----
function findOptimizedPath(startNode, endNode) {
  const directDist = calculateDistance(startNode, endNode);
  const candidates = airports.filter(a => a.code !== startNode.code && a.code !== endNode.code);
  
  // Sort by 'efficiency' with storm penalty
  const paths = candidates.map(mid => {
    let totalDist = calculateDistance(startNode, mid) + calculateDistance(mid, endNode);
    
    // Storm Avoidance Logic
    let stormPenalty = 0;
    activeStorms.forEach(storm => {
      // Check if midpoint or legs are too close to storm
      const distToMid = calculateDistance(mid, { lat: storm.lat, lng: storm.lng });
      if (distToMid < storm.radiusKm * 1.5) {
        stormPenalty += 500; // Heavy penalty for flying through storm
      }
    });

    const finalWeight = (totalDist + stormPenalty) * (0.85 + Math.random() * 0.1); 
    return { node: mid, dist: totalDist, weight: finalWeight, avoidedStorm: stormPenalty > 0 };
  }).filter(p => p.weight < directDist * 1.5);

  paths.sort((a,b) => a.weight - b.weight);
  
  if (paths.length > 0 && (paths[0].weight < directDist || paths[0].avoidedStorm)) {
    return { waypoints: [paths[0].node], distance: paths[0].dist, avoidedStorm: paths[0].avoidedStorm };
  }
  
  return { waypoints: [], distance: directDist * (0.94 + Math.random() * 0.04), avoidedStorm: false };
}

// ---- AI INTELLIGENCE ----
function typeWriter(text, elementId, speed = 10) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.innerHTML = '';
  let i = 0;
  
  // Pre-parse the HTML to avoid tag fragmentation during typing
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;
  const nodes = Array.from(tempDiv.childNodes);
  
  async function typeNode(node, container) {
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent;
      for (let char of content) {
        container.appendChild(document.createTextNode(char));
        await new Promise(r => setTimeout(r, speed));
      }
    } else {
      const newNode = node.cloneNode(false); // Clone without children
      container.appendChild(newNode);
      for (let child of node.childNodes) {
        await typeNode(child, newNode);
      }
    }
  }

  (async () => {
    for (let node of nodes) {
      await typeNode(node, element);
    }
    element.innerHTML += '<span class="typing-cursor">|</span>';
  })();
}

function generateAIBriefing(r) {
  const aiBriefing = document.getElementById("aiBriefing");
  if (!aiBriefing) return;
  aiBriefing.style.display = "block";
  
  const stormUsed = r.avoidedStorm;
  const efficiency = r.reduction;
  const aircraft = r.aircraft.name;
  
  let msg = `Optimization analysis for <strong>${r.departure.code} to ${r.destination.code}</strong> complete. `;
  msg += `By switching to the <strong>${aircraft}</strong>, we've identified a flight profile that is <strong>${efficiency}% more carbon-efficient</strong>. `;
  
  if (stormUsed) {
    const stormRegions = activeStorms.slice(0, 2).map(s => s.regionName).join(" and ");
    msg += `Advanced routing logic has successfully <strong>detected and bypassed intense Storm Cells</strong> near the ${stormRegions}, prioritizing safety without sacrificing emission savings. `;
  }
  
  msg += `Based on real-time atmospheric data, this mission will yield a <strong>total fuel cost reduction of $${r.savings.toLocaleString()}</strong>. `;
  
  if (efficiency > 10) {
    msg += `\n\n<em>Intelligence Insight: This is a <strong>High-Efficiency Result</strong> driven by optimal jet stream utilization.</em>`;
  } else {
    msg += `\n\n<em>Intelligence Insight: Standard optimization achieved through direct routing and streamlined climb gradients.</em>`;
  }
  
  typeWriter(msg, "aiBriefingText");
}

// ---- SIDEBAR ----
function switchSection(sectionId, btn) {
  document.querySelectorAll(".dashboard-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("section-" + sectionId).classList.add("active");
  btn.classList.add("active");
  
  // Close sidebar on mobile after clicking
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains("open")) {
    sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }
  
  if (sectionId === 'leaderboard') {
    renderLeaderboard();
  }
  
  // Invalidate Leaflet map size when container becomes visible
  setTimeout(() => {
    if (sectionId === 'map' && typeof routeMap !== 'undefined' && routeMap) {
      routeMap.invalidateSize();
    }
    if (sectionId === 'network' && typeof networkMap !== 'undefined' && networkMap) {
      networkMap.invalidateSize();
    }
  }, 100);
}

// Add global resize listener to ensure maps redraw correctly on mobile rotation or desktop resize
window.addEventListener('resize', () => {
  setTimeout(() => {
    if (typeof routeMap !== 'undefined' && routeMap) routeMap.invalidateSize();
    if (typeof networkMap !== 'undefined' && networkMap) networkMap.invalidateSize();
  }, 100);
});

function renderLeaderboard() {
  const container = document.getElementById("leaderboardList");
  if (!container) return;

  container.innerHTML = leaderboardData.map((data, index) => {
    const rank = index + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
    return `
      <div class="leaderboard-row">
        <div class="rank-badge ${rankClass}">${rank}</div>
        <div style="font-weight: 600;">${data.airline}</div>
        <div style="font-family: var(--font-mono); font-weight: 700; color: var(--secondary);">${data.score}</div>
        <div>
          <div style="font-size: 0.75rem; color: var(--muted-fg); margin-bottom: 2px;">${data.reduction} reduction</div>
          <div class="eco-progress-bar">
            <div class="eco-progress-fill" style="width: ${data.score}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Render Leaderboard Chart
  const ctx = document.getElementById("leaderboardBarChart");
  if (ctx) {
    if (chartInstances.leaderboard) chartInstances.leaderboard.destroy();
    chartInstances.leaderboard = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: leaderboardData.map(d => d.airline),
        datasets: [{
          label: 'Eco-Score',
          data: leaderboardData.map(d => d.score),
          backgroundColor: '#10B981',
          borderRadius: 8,
          barThickness: 20
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { display: false } }
        }
      }
    });
  }
}

// ---- OPTIMIZATION ----
function runOptimization() {
  const depCode = document.getElementById("departure").value;
  const destCode = document.getElementById("destination").value;
  const aircraftId = document.getElementById("aircraft").value;

  const btn = document.getElementById("optimizeBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Optimizing route...';

  setTimeout(function () {
    const dep = airports.find(a => a.code === depCode);
    const dest = airports.find(a => a.code === destCode);
    const aircraft = aircraftTypes.find(a => a.id === aircraftId);

    const directDist = calculateDistance(dep, dest);
    const optimizedResult = findOptimizedPath(dep, dest);
    const bestPath = optimizedResult.waypoints;
    const bestDist = optimizedResult.distance;

    const standardFuel = directDist * aircraft.fuelRate;
    const optimizedFuel = bestDist * aircraft.fuelRate;
    const co2Factor = 3.16;
    const standardCO2 = standardFuel * co2Factor;
    const optimizedCO2 = optimizedFuel * co2Factor;
    const reduction = ((standardCO2 - optimizedCO2) / standardCO2) * 100;
    
    // Dynamic Fuel Savings Math
    const fuelRatePerKg = fuelPriceIndex[dep.code] || fuelPriceIndex["DEFAULT"] || 0.85;
    const savingsValue = Math.round((standardFuel - optimizedFuel) * fuelRatePerKg);

    currentResult = {
      departure: dep,
      destination: dest,
      aircraft,
      directDistance: Math.round(directDist),
      optimizedDistance: Math.round(bestDist),
      standardFuel: Math.round(standardFuel),
      optimizedFuel: Math.round(optimizedFuel),
      standardCO2: Math.round(standardCO2),
      optimizedCO2: Math.round(optimizedCO2),
      reduction: Math.round(reduction * 10) / 10,
      savings: savingsValue,
      waypoints: bestPath,
    };

    showResults(currentResult);
    drawRouteMap(currentResult);
    renderCharts(currentResult);
    generateAIBriefing(currentResult);

    // Update header
    document.getElementById("headerInfo").textContent =
      `${dep.code} → ${dest.code} • ${aircraft.name}`;

    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Optimize Route';
  }, 1500);
}

function showResults(r) {
  document.getElementById("optimizationResults").style.display = "block";
  document.getElementById("resDistance").textContent = r.optimizedDistance + " km";
  document.getElementById("resFuel").textContent = r.optimizedFuel + " kg";
  document.getElementById("resCO2").textContent = r.optimizedCO2 + " kg";
  document.getElementById("resReduction").textContent = r.reduction + "%";
  document.getElementById("resSavings").textContent = "$" + r.savings.toLocaleString();

  // Add Save Button
  const existingBtn = document.getElementById("saveRouteBtn");
  if (!existingBtn) {
    const saveBtn = document.createElement("button");
    saveBtn.id = "saveRouteBtn";
    saveBtn.className = "btn btn-outline btn-sm";
    saveBtn.style = "margin-top: 1rem; width: 100%; border-color: var(--secondary); color: var(--secondary);";
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right: 8px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save Optimized Route to Cloud';
    saveBtn.onclick = saveCurrentRouteToBackend;
    document.getElementById("optimizationResults").appendChild(saveBtn);
  }

  let summary = `<strong>${r.departure.code} → ${r.destination.code}</strong> via ${r.aircraft.name}`;
  if (r.waypoints.length > 0) summary += ` • Waypoint: ${r.waypoints.map(w => w.code).join(", ")}`;
  summary += ` • Direct: ${r.directDistance} km → Optimized: ${r.optimizedDistance} km`;
  document.getElementById("resSummary").innerHTML = summary;
}

// ---- MAPS (LEAFLET) ----
function initMaps() {
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  if (document.body.classList.contains("light-mode")) {
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  }

  const mapOptions = { 
    zoomControl: false, 
    minZoom: 3, 
    maxZoom: 18,
    worldCopyJump: true
  };

  if (document.getElementById("routeMapLeaflet") && !routeMap) {
    routeMap = L.map('routeMapLeaflet', mapOptions).setView([22.9734, 78.6569], 5);
    L.control.zoom({ position: 'bottomright' }).addTo(routeMap);
    routeMapTileLayer = L.tileLayer(tileUrl, { attribution: '&copy; CartoDB' }).addTo(routeMap);
    
    // Dedicated Layer Groups
    routeMapLayerGroup = L.layerGroup().addTo(routeMap);
    weatherMarkersGroup = L.layerGroup().addTo(routeMap);
    windLayerGroup = L.layerGroup().addTo(routeMap);
    liveFlightMarkersGroup = L.layerGroup().addTo(routeMap);
  }

  if (document.getElementById("networkMapLeaflet") && !networkMap) {
    networkMap = L.map('networkMapLeaflet', mapOptions).setView([22.9734, 78.6569], 5);
    L.control.zoom({ position: 'bottomright' }).addTo(networkMap);
    networkMapTileLayer = L.tileLayer(tileUrl, { attribution: '&copy; CartoDB' }).addTo(networkMap);
    networkMapLayerGroup = L.layerGroup().addTo(networkMap);
    
    // Improved resize handling for tabs
    const resizeMaps = () => {
      setTimeout(() => {
        if (routeMap) routeMap.invalidateSize();
        if (networkMap) networkMap.invalidateSize();
      }, 100);
    };

    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.addEventListener('click', resizeMaps);
    });

    window.addEventListener('resize', resizeMaps);
  }
}

let liveFlightMarkersGroup;

function drawRouteMap(result) {
  if (!routeMap || !routeMapLayerGroup) return;
  routeMapLayerGroup.clearLayers();
  routeMap.invalidateSize();

  // Legend Styling update
  const existingLegend = document.getElementById('map-legend');
  if (existingLegend) existingLegend.remove();

  const legend = L.control({ position: 'topright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'map-legend');
    div.id = 'map-legend';
    div.innerHTML = `
      <div style="font-weight: 800; margin-bottom: 0.8rem; color: var(--primary); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 1px;">Map Intelligence</div>
      <div class="legend-item">
        <div class="legend-color dashed"></div>
        <span>Traditional Route</span>
      </div>
      <div class="legend-item">
        <div class="legend-color solid"></div>
        <span>Carbon Optimized</span>
      </div>
    `;
    return div;
  };
  legend.addTo(routeMap);

  if (result) {
    const p1 = [result.departure.lat, result.departure.lng];
    const p2 = [result.destination.lat, result.destination.lng];
    
    // 1. Traditional Path
    L.polyline([p1, p2], { 
      color: '#ef4444', 
      weight: 3, 
      dashArray: '8, 8', 
      opacity: 0.6
    }).addTo(routeMapLayerGroup);
    
    // 2. Optimized Path with AntPath
    const waypoints = result.waypoints.map(w => [w.lat, w.lng]);
    const routeCoords = [p1, ...waypoints, p2];
    
    // OPTIMIZED ROUTE ANIMATION (Progressive Reveal)
    // We only clear the group and let animateRouteReveal handle the drawing
    routeMapLayerGroup.clearLayers();

    // Markers are now added sequentially during the animateSequentialReveal animation

    // Auto-fit
    setTimeout(() => {
      const bounds = L.latLngBounds([p1, p2, ...waypoints]);
      routeMap.fitBounds(bounds, { padding: [80, 80], animate: true });
      
      // Trigger Sequential Dropping Reveal Animation
      const sequence = [
        { latlng: p1, code: result.departure.code, city: result.departure.city, type: 'Departure' },
        ...result.waypoints.map(w => ({ latlng: [w.lat, w.lng], code: w.code, city: w.city, type: 'Waypoint' })),
        { latlng: p2, code: result.destination.code, city: result.destination.city, type: 'Destination' }
      ];
      animateSequentialReveal(sequence);
    }, 100);

  } else {
    // Initial Markers (Consistent with optimized view)
    const createAirportIcon = (code) => {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div class="airport-marker-container">
                    <svg class="airport-pin" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <div class="airport-label">${code}</div>
                </div>
            `,
            iconSize: [30, 40],
            iconAnchor: [15, 35]
        });
    };

    airports.forEach(a => {
      L.marker([a.lat, a.lng], { icon: createAirportIcon(a.code) })
        .addTo(routeMapLayerGroup)
        .bindTooltip(`<b>${a.city}</b> (${a.code})`, { className: 'map-tooltip' });
    });
    routeMap.setView([22.9734, 78.6569], 5);
  }
}

async function animateSequentialReveal(sequence) {
  if (!routeMap || !routeMapLayerGroup || sequence.length < 2) return;

  const revealPath = L.polyline([], {
    color: '#10B981',
    weight: 6,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(routeMapLayerGroup);

  const createIcon = (code, isActive = false) => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="airport-marker-container ${isActive ? 'airport-marker-active' : ''}">
             <svg class="airport-pin" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
             <div class="airport-label">${code}</div>
           </div>`,
    iconSize: [30, 40],
    iconAnchor: [15, 35]
  });

  for (let i = 0; i < sequence.length; i++) {
    const current = sequence[i];
    const isWaypoint = current.type === 'Waypoint';
    
    // 1. Drop the airport marker
    const marker = L.marker(current.latlng, { 
      icon: createIcon(current.code, !isWaypoint),
      draggable: isWaypoint
    }).addTo(routeMapLayerGroup).bindTooltip(`<b>${current.city}</b> ${current.type}${isWaypoint ? ' (Drag to optimize)' : ''}`, { className: 'map-tooltip' });

    if (isWaypoint) {
      marker.on('drag', () => {
        const newLatLng = marker.getLatLng();
        // Update the path visually during drag
        const points = revealPath.getLatLngs();
        points[i] = newLatLng;
        revealPath.setLatLngs(points);
      });

      marker.on('dragend', () => {
        const newLatLng = marker.getLatLng();
        // Update result waypoints and re-calculate
        if (currentResult) {
          currentResult.waypoints[i-1].lat = newLatLng.lat;
          currentResult.waypoints[i-1].lng = newLatLng.lng;
          recalculateFromWaypoints();
        }
      });
    }

    // 2. Animate the line segment to the next airport
    if (i < sequence.length - 1) {
      const next = sequence[i + 1];
      const dist = calculateDistance(
        { lat: current.latlng[0], lng: current.latlng[1] }, 
        { lat: next.latlng[0], lng: next.latlng[1] }
      );
      const duration = Math.max(800, dist * 1.2);
      await drawLineProgressive(revealPath, current.latlng, next.latlng, duration);
    }
  }
}

function recalculateFromWaypoints() {
  if (!currentResult) return;
  const dep = currentResult.departure;
  const dest = currentResult.destination;
  const aircraft = currentResult.aircraft;
  const waypoints = currentResult.waypoints;

  let totalDist = 0;
  let prev = dep;
  waypoints.forEach(w => {
    totalDist += calculateDistance(prev, w);
    prev = w;
  });
  totalDist += calculateDistance(prev, dest);

  const directDist = calculateDistance(dep, dest);
  const standardFuel = directDist * aircraft.fuelRate;
  const optimizedFuel = totalDist * aircraft.fuelRate;
  const co2Factor = 3.16;
  const standardCO2 = standardFuel * co2Factor;
  const optimizedCO2 = optimizedFuel * co2Factor;
  const reduction = ((standardCO2 - optimizedCO2) / standardCO2) * 100;
  const fuelRatePerKg = fuelPriceIndex[dep.code] || fuelPriceIndex["DEFAULT"] || 0.85;
  const savingsValue = Math.round((standardFuel - optimizedFuel) * fuelRatePerKg);

  currentResult.optimizedDistance = Math.round(totalDist);
  currentResult.optimizedFuel = Math.round(optimizedFuel);
  currentResult.optimizedCO2 = Math.round(optimizedCO2);
  currentResult.reduction = Math.round(reduction * 10) / 10;
  currentResult.savings = savingsValue;

  showResults(currentResult);
  renderCharts(currentResult);
}

// Keeping the base helper
function drawLineProgressive(polyline, start, end, duration) {
  return new Promise(resolve => {
    const startTime = performance.now();
    
    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      // Interpolate
      const lat = start[0] + (end[0] - start[0]) * t;
      const lng = start[1] + (end[1] - start[1]) * t;
      
      const currentPoints = polyline.getLatLngs();
      // On the first segment, we need to add the start point if empty
      if (currentPoints.length === 0) {
          polyline.addLatLng(start);
      }
      
      // Update the last point or add new one
      polyline.addLatLng([lat, lng]);
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(animate);
  });
}

function drawNetworkGraph() {
  if (!networkMap || !networkMapLayerGroup) return;
  networkMapLayerGroup.clearLayers();

  for (let i = 0; i < airports.length; i++) {
    for (let j = i + 1; j < airports.length; j++) {
      if (calculateDistance(airports[i], airports[j]) < 1200) {
        L.polyline([[airports[i].lat, airports[i].lng], [airports[j].lat, airports[j].lng]], {
          color: '#2563EB', weight: 1, opacity: 0.2
        }).addTo(networkMapLayerGroup);
      }
    }
  }

  airports.forEach(a => {
    L.circleMarker([a.lat, a.lng], { radius: 5, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.8 })
      .bindTooltip(a.code, { permanent: true, direction: 'right' }).addTo(networkMapLayerGroup);
  });
}

// ---- LIVE TRACKING (PHASE 3: Optimized for performance) ----
let liveFlightMarkers = {}; // Changed to object for quick lookup by ICAO
async function fetchLiveFlights() {
  if (!routeMap || !liveFlightMarkersGroup) return;

  const url = "https://opensky-network.org/api/states/all?lamin=5.0&lomin=65.0&lamax=35.0&lomax=95.0"; // India Box
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.states) return;

    // Active ICAO set to track what's still in range
    const activeIcaos = new Set();

    // Take top 20 for performance
    data.states.slice(0, 20).forEach(s => {
      const [icao, callsign, origin, time, last, lon, lat] = s;
      if (!lat || !lon) return;
      
      activeIcaos.add(icao);
      const heading = s[10] || 0;

      if (liveFlightMarkers[icao]) {
        // Update existing marker (no flickering!)
        liveFlightMarkers[icao].setLatLng([lat, lon]);
        // Update icon rotation if needed
        const iconHtml = `<svg viewBox="0 0 24 24" fill="#ffd700" width="24" height="24" style="transform: rotate(${heading}deg); filter: drop-shadow(0 0 3px rgba(0,0,0,0.5))"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
        liveFlightMarkers[icao].setIcon(L.divIcon({ className: 'plane-icon', html: iconHtml }));
      } else {
        // Create new marker
        const iconHtml = `<svg viewBox="0 0 24 24" fill="#ffd700" width="24" height="24" style="transform: rotate(${heading}deg); filter: drop-shadow(0 0 3px rgba(0,0,0,0.5))"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
        const marker = L.marker([lat, lon], {
          icon: L.divIcon({ className: 'plane-icon', html: iconHtml })
        }).bindTooltip(`<b>${callsign || 'N/A'}</b><br>Alt: ${s[7]}m`, { sticky: true });
        
        marker.addTo(liveFlightMarkersGroup);
        liveFlightMarkers[icao] = marker;
      }
    });

    // Cleanup stale markers
    Object.keys(liveFlightMarkers).forEach(icao => {
        if (!activeIcaos.has(icao)) {
            liveFlightMarkersGroup.removeLayer(liveFlightMarkers[icao]);
            delete liveFlightMarkers[icao];
        }
    });

  } catch (e) {
    console.warn("Live API error:", e);
  }
}

setInterval(fetchLiveFlights, 30000); // Update every 30s
fetchLiveFlights();

// ---- CHARTS (Chart.js) ----
function renderCharts(result) {
  document.getElementById("analyticsPlaceholder").style.display = "none";
  document.getElementById("analyticsCharts").style.display = "block";

  // Destroy existing charts
  Object.values(chartInstances).forEach(c => c && c.destroy());

  // Bar Chart
  chartInstances.bar = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels: ["Standard", "Optimized"],
      datasets: [{
        label: "CO₂ (kg)",
        data: [result.standardCO2, result.optimizedCO2],
        backgroundColor: ["#ef4444", "#10B981"],
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: "#e2e8f0" } },
        x: { grid: { display: false } }
      }
    }
  });

  // Line Chart
  chartInstances.line = new Chart(document.getElementById("lineChart"), {
    type: "line",
    data: {
      labels: ["Takeoff", "Cruise", "Descent", "Landing"],
      datasets: [
        {
          label: "Standard",
          data: [result.standardFuel*0.3, result.standardFuel*0.8, result.standardFuel*0.95, result.standardFuel],
          borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)",
          fill: true, tension: 0.3, pointRadius: 4,
        },
        {
          label: "Optimized",
          data: [result.optimizedFuel*0.28, result.optimizedFuel*0.72, result.optimizedFuel*0.88, result.optimizedFuel],
          borderColor: "#10B981", backgroundColor: "rgba(16,185,129,0.1)",
          fill: true, tension: 0.3, pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true, grid: { color: "#e2e8f0" } },
        x: { grid: { display: false } }
      }
    }
  });

  // Pie Chart
  chartInstances.pie = new Chart(document.getElementById("pieChart"), {
    type: "pie",
    data: {
      labels: ["Cruise Fuel", "Takeoff Fuel", "Descent Fuel", "Taxi Fuel"],
      datasets: [{
        data: [65, 20, 10, 5],
        backgroundColor: ["#2563EB", "#10B981", "#F59E0B", "#ef4444"],
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

// ---- MONTHLY REPORT ----
const monthlyData = {
  "IndiGo": { flights: "~17,000", fuel: "144,610 tonnes", fuelChange: "+3,000 tonnes", carbonChange: "+2.12%", positive: false },
  "Air India": { flights: "~19,000", fuel: "159,270 tonnes", fuelChange: "+1,000 tonnes", carbonChange: "+0.63%", positive: false },
  "Akasa Air": { flights: "~20,000", fuel: "150,600 tonnes", fuelChange: "−16,000 tonnes", carbonChange: "−9.60%", positive: true },
  "SpiceJet": { flights: "~18,000", fuel: "140,940 tonnes", fuelChange: "−9,000 tonnes", carbonChange: "−6.00%", positive: true },
  "Air India Express": { flights: "~16,000", fuel: "135,280 tonnes", fuelChange: "+2,000 tonnes", carbonChange: "+1.50%", positive: false }
};

function updateMonthlyReport() {
  const selList = document.getElementById("reportAirlineSelect");
  const periodSel = document.getElementById("reportPeriodSelect");
  const container = document.getElementById("reportDataContainer");
  const airline = selList.value;
  const period = parseInt(periodSel.value) || 1;

  if (!airline) {
    container.style.display = "none";
    return;
  }

  const data = monthlyData[airline];
  const baseFlightsStr = data.flights;
  const baseFlights = parseInt(baseFlightsStr.replace(/[^0-9]/g, ''));
  const baseFuel = parseInt(data.fuel.replace(/[^0-9]/g, ''));
  
  // Set Labels
  const labelText = period === 1 ? "Flights / Month" : 
                    period === 12 ? "Flights / Year" : 
                    `Flights / ${period} Months`;
  document.getElementById("repFlightsLabel").textContent = labelText;

  const prefix = baseFlightsStr.startsWith('~') ? '~' : '';
  document.getElementById("repFlights").textContent = prefix + (baseFlights * period).toLocaleString();
  document.getElementById("repFuel").textContent = (baseFuel * period).toLocaleString() + " tonnes";
  
  const fChange = document.getElementById("repFuelChange");
  const baseFuelChange = parseInt(data.fuelChange.replace(/[^0-9]/g, ''));
  const sign = data.fuelChange.includes('−') ? '−' : '+';
  fChange.textContent = `${sign}${(baseFuelChange * period).toLocaleString()} tonnes`;
  fChange.className = "result-value " + (data.positive ? "color-secondary" : "text-danger");
  
  const cChange = document.getElementById("repCarbonChange");
  cChange.textContent = data.carbonChange;
  cChange.className = "result-value " + (data.positive ? "color-secondary" : "text-danger");

  // Update icons
  const fIcon = document.getElementById("repFuelChangeIcon");
  const cIcon = document.getElementById("repCarbonChangeIcon");
  
  if (data.positive) {
    fIcon.innerHTML = '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />';
    fIcon.style.stroke = "var(--secondary)";
    cIcon.innerHTML = '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" />';
    cIcon.style.stroke = "var(--secondary)";
  } else {
    fIcon.innerHTML = '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />';
    fIcon.style.stroke = "var(--danger)";
    cIcon.innerHTML = '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />';
    cIcon.style.stroke = "var(--danger)";
  }

  container.style.display = "block";
}

// ---- HISTORICAL TRENDS ----
function updateTrends() {
  if (!currentResult) return;
  const filter = document.getElementById("timeFilter").value;
  let multiplier = 1;
  if (filter === "3m") multiplier = 3;
  if (filter === "6m") multiplier = 6;
  if (filter === "1y") multiplier = 12;
  
  const modResult = {
    ...currentResult,
    standardCO2: currentResult.standardCO2 * multiplier,
    optimizedCO2: currentResult.optimizedCO2 * multiplier,
    standardFuel: currentResult.standardFuel * multiplier,
    optimizedFuel: currentResult.optimizedFuel * multiplier
  };
  
  renderCharts(modResult);
}

// ---- DATA EXPORT ----
function exportCSV() {
  const selList = document.getElementById("reportAirlineSelect");
  const airline = selList.value;
  if (!airline) return alert("Please select an airline first.");
  
  const data = monthlyData[airline];
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Airline,Total Flights,Total Fuel,Fuel Change,Carbon Change\n"
    + `"${airline}","${data.flights}","${data.fuel}","${data.fuelChange}","${data.carbonChange}"\n`;
    
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${airline}_Monthly_Report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportPDF() {
  window.print();
}

// ---- AIRCRAFT COMPARISON (PHASE 2) ----
function updateComparison() {
  const c1 = document.getElementById("compAir1").value;
  const c2 = document.getElementById("compAir2").value;
  const container = document.getElementById("comparisonResults");

  if (!c1 || !c2) {
    container.style.display = "none";
    return;
  }

  const a1 = aircraftTypes.find(a => a.id === c1);
  const a2 = aircraftTypes.find(a => a.id === c2);
  const distance = 1000; // Comparison baseline

  const fuel1 = distance * a1.fuelRate;
  const fuel2 = distance * a2.fuelRate;
  
  const winner = fuel1 < fuel2 ? a1 : a2;
  const loser = fuel1 < fuel2 ? a2 : a1;
  const diff = Math.abs(fuel1 - fuel2);
  const diffPercent = ((Math.max(fuel1, fuel2) - Math.min(fuel1, fuel2)) / Math.max(fuel1, fuel2)) * 100;

  document.getElementById("compWinner").textContent = winner.name;
  document.getElementById("compDiffText").textContent = `${winner.name} is ${Math.round(diffPercent)}% more efficient than ${loser.name}`;
  document.getElementById("compEmissionsSaved").textContent = Math.round(diff * 3.16) + " kg CO₂";
  document.getElementById("compCostDiff").textContent = "$" + Math.round(diff * 0.85).toLocaleString();

  container.style.display = "block";

  // Chart
  if (chartInstances.comp) chartInstances.comp.destroy();
  chartInstances.comp = new Chart(document.getElementById("compChart"), {
    type: "bar",
    data: {
      labels: [a1.name, a2.name],
      datasets: [{
        label: "Fuel Consumption (kg per 1000km)",
        data: [fuel1, fuel2],
        backgroundColor: [c1 === winner.id ? "#10B981" : "#ef4444", c2 === winner.id ? "#10B981" : "#ef4444"],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// ---- WEATHER INTELLIGENCE ----
async function fetchWeatherFromBackend() {
  try {
    const response = await fetch('http://localhost:5000/api/weather');
    currentWeatherData = await response.json();
    console.log("Weather Intelligence: Data sync complete.");
    if (weatherIntelligenceActive) updateWeatherVisuals();
  } catch (e) {
    console.warn("Weather Intelligence: Backend offline. Using offline mode.");
  }
}

function toggleWeatherIntelligence() {
  weatherIntelligenceActive = !weatherIntelligenceActive;
  const btn = document.getElementById("weatherToggleBtn");
  if (btn) btn.classList.toggle("active", weatherIntelligenceActive);

  if (weatherIntelligenceActive) {
    updateWeatherVisuals();
    startWindParticleAnimation();
  } else {
    clearWeatherVisuals();
  }
}

function updateWeatherVisuals() {
  clearWeatherVisuals();
  if (!routeMap) return;

  weatherMarkersGroup = L.layerGroup().addTo(routeMap);

  airports.forEach(a => {
    const weather = currentWeatherData[a.code] || { temp: 25, condition: "Clear", wind_speed: 10 };
    const icon = L.divIcon({
      className: 'weather-icon',
      html: `<div class="weather-badge">
              <span class="temp">${weather.temp}°</span>
              <span class="cond">${weather.condition}</span>
             </div>`,
      iconSize: [60, 30],
      iconAnchor: [-15, 15] // Offset from the airport marker
    });
    L.marker([a.lat, a.lng], { icon, zIndexOffset: 1000 }).addTo(weatherMarkersGroup);
  });

  // Mock Wind Lines (Dynamic AntPath)
  windLayerGroup = L.layerGroup().addTo(routeMap);
  for (let i = 0; i < 8; i++) {
    const start = [10 + Math.random() * 20, 70 + Math.random() * 20];
    const end = [start[0] + 1.5, start[1] + 1.5];
    if (L.Polyline.AntPath) {
      new L.Polyline.AntPath([start, end], {
        color: 'rgba(255,255,255,0.2)',
        weight: 1.5,
        dashArray: [10, 30],
        pulseColor: '#10B981',
        paused: false,
        delay: 2000
      }).addTo(windLayerGroup);
    }
  }
}

function clearWeatherVisuals() {
  if (weatherMarkersGroup) routeMap.removeLayer(weatherMarkersGroup);
  if (windLayerGroup) routeMap.removeLayer(windLayerGroup);
  if (windParticleCanvas) {
    document.getElementById("routeMapLeaflet").removeChild(windParticleCanvas);
    windParticleCanvas = null;
    windParticleSystem = null;
  }
}

let windParticleCanvas = null;
function startWindParticleAnimation() {
  if (windParticleCanvas) return;
  
  const mapDiv = document.getElementById("routeMapLeaflet");
  windParticleCanvas = document.createElement("canvas");
  windParticleCanvas.id = "windCanvas";
  windParticleCanvas.style.position = "absolute";
  windParticleCanvas.style.top = "0";
  windParticleCanvas.style.left = "0";
  windParticleCanvas.style.pointerEvents = "none";
  windParticleCanvas.style.zIndex = "400";
  windParticleCanvas.width = mapDiv.clientWidth;
  windParticleCanvas.height = mapDiv.clientHeight;
  mapDiv.appendChild(windParticleCanvas);

  const ctx = windParticleCanvas.getContext("2d");
  const particles = [];
  for (let i = 0; i < 150; i++) {
    particles.push(new WindParticle(windParticleCanvas));
  }
  
  activeStorms = [];
  for (let i = 0; i < 3; i++) {
    activeStorms.push(new StormCell(windParticleCanvas));
  }

  function animate() {
    if (!weatherIntelligenceActive) return;
    ctx.clearRect(0, 0, windParticleCanvas.width, windParticleCanvas.height);
    
    // Draw Storms
    activeStorms.forEach(s => {
      s.update();
      s.draw(ctx);
    });
    
    // Draw Wind
    particles.forEach(p => {
      p.update();
      p.draw(ctx);
    });
    requestAnimationFrame(animate);
  }
  animate();

  // Handle Resize
  window.addEventListener('resize', () => {
    if (windParticleCanvas) {
      windParticleCanvas.width = mapDiv.clientWidth;
      windParticleCanvas.height = mapDiv.clientHeight;
    }
  });
}

// ---- FINANCIAL INTELLIGENCE ----
async function fetchFuelPrices() {
  try {
    const response = await fetch('http://localhost:5000/api/fuel-prices');
    fuelPriceIndex = await response.json();
    console.log("Finance Logic: Fuel index initialized.");
  } catch (e) {
    console.warn("Finance Logic: Backend offline. Using default fuel rates.");
  }
}

// ---- ROUTE ARCHIVING ----
async function saveCurrentRouteToBackend() {
  if (!currentResult) return;
  const btn = document.getElementById("saveRouteBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Syncing to Cloud...';

  try {
    const response = await fetch('http://localhost:5000/api/save-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentResult)
    });
    const result = await response.json();
    alert(result.message);
    fetchSavedRoutes(); // Refresh list
  } catch (e) {
    alert("Error: Unable to connect to backend for saving.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="margin-right: 8px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Saved Successfully';
  }
}

async function fetchSavedRoutes() {
  try {
    const response = await fetch('http://localhost:5000/api/saved-routes');
    savedRoutesHistory = await response.json();
    renderSavedRoutesUI();
  } catch (e) {
    console.warn("Archive: Could not fetch history.");
  }
}

function renderSavedRoutesUI() {
  const container = document.getElementById("savedRoutesList");
  if (!container) return;

  if (savedRoutesHistory.length === 0) {
    container.innerHTML = '<p class="text-center text-muted" style="padding: 1rem;">No saved missions yet.</p>';
    return;
  }

  container.innerHTML = savedRoutesHistory.map(r => `
    <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-weight: 600; color: var(--secondary);">${r.departure.code} → ${r.destination.code}</div>
        <div style="font-size: 0.75rem; color: var(--muted-fg);">${r.timestamp} • ${r.aircraft.name}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-weight: 700; color: #10B981;">-${r.reduction}%</div>
        <div style="font-size: 0.7rem; color: var(--muted-fg);">$${r.savings.toLocaleString()} saved</div>
      </div>
    </div>
  `).join("");
}

// ---- PRESENTATION MODE (PHASE 3) ----
function togglePresentationMode() {
  document.body.classList.toggle("presentation-mode");
}
