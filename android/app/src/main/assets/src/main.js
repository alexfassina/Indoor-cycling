// Indoor Cycling App - Main Logic
// Uses Web Bluetooth API to connect to BLE power/cadence sensors

// BLE Service UUIDs
const SERVICES = {
  CYCLING_POWER: 0x1818,
  CYCLING_SPEED_CADENCE: 0x1816
};

// BLE Characteristic UUIDs
const CHARACTERISTICS = {
  POWER_MEASUREMENT: 0x2A63,    // Cycling Power Measurement
  CSC_MEASUREMENT: 0x2A5B       // CSC Measurement
};

// App State
const state = {
  device: null,
  server: null,
  powerChar: null,
  cscChar: null,
  isConnected: false,
  isSessionActive: false,
  session: {
    startTime: null,
    powerReadings: [],
    cadenceReadings: [],
    duration: 0
  },
  currentPower: 0,
  currentCadence: 0,
  sessions: []
};

// DOM Elements
const elements = {
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  connectBtn: document.getElementById('connect-btn'),
  powerValue: document.getElementById('power-value'),
  cadenceValue: document.getElementById('cadence-value'),
  duration: document.getElementById('duration'),
  avgPower: document.getElementById('avg-power'),
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  sessionList: document.getElementById('session-list')
};

// Initialize app
function init() {
  loadSessions();
  setupEventListeners();
  renderHistory();
}

// Setup event listeners
function setupEventListeners() {
  elements.connectBtn.addEventListener('click', connectToSensor);
  elements.startBtn.addEventListener('click', startSession);
  elements.stopBtn.addEventListener('click', stopSession);
}

// Connect to BLE sensor
async function connectToSensor() {
  if (!navigator.bluetooth) {
    updateStatus('error', 'Bluetooth not supported on this device');
    return;
  }

  try {
    updateStatus('searching', 'Searching for sensor...');
    elements.connectBtn.disabled = true;

    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [SERVICES.CYCLING_POWER] },
        { services: [SERVICES.CYCLING_SPEED_CADENCE] },
        { namePrefix: 'Stages' },
        { namePrefix: 'Power' },
        { namePrefix: 'Cadence' }
      ],
      optionalServices: [SERVICES.CYCLING_POWER, SERVICES.CYCLING_SPEED_CADENCE]
    });

    state.device = device;
    
    device.addEventListener('gattserverdisconnected', handleDisconnect);
    
    updateStatus('searching', 'Connecting...');
    
    const server = await device.gatt.connect();
    state.server = server;
    
    // Get services
    const powerService = await server.getPrimaryService(SERVICES.CYCLING_POWER);
    const cscService = await server.getPrimaryService(SERVICES.CYCLING_SPEED_CADENCE);
    
    // Get characteristics
    state.powerChar = await powerService.getCharacteristic(CHARACTERISTICS.POWER_MEASUREMENT);
    state.cscChar = await cscService.getCharacteristic(CHARACTERISTICS.CSC_MEASUREMENT);
    
    // Subscribe to notifications
    await state.powerChar.startNotifications();
    state.powerChar.addEventListener('characteristicvaluechanged', handlePowerData);
    
    try {
      await state.cscChar.startNotifications();
      state.cscChar.addEventListener('characteristicvaluechanged', handleCSCData);
    } catch (e) {
      console.log('CSC not available:', e);
    }
    
    state.isConnected = true;
    updateStatus('connected', `Connected to ${device.name || 'Sensor'}`);
    elements.connectBtn.textContent = 'Disconnect';
    elements.connectBtn.disabled = false;
    elements.connectBtn.onclick = disconnect;
    
  } catch (error) {
    console.error('Connection error:', error);
    updateStatus('error', error.message || 'Connection failed');
    elements.connectBtn.disabled = false;
  }
}

// Handle power data
function handlePowerData(event) {
  const value = event.target.value;
  const flags = value.getUint16(0);
  
  // Instantaneous power is at offset 2, sint16
  const power = value.getInt16(2);
  
  state.currentPower = Math.max(0, power);
  elements.powerValue.textContent = state.currentPower;
  
  if (state.isSessionActive) {
    state.session.powerReadings.push({
      time: Date.now() - state.session.startTime,
      value: state.currentPower
    });
  }
}

// Handle CSC data (Cadence)
function handleCSCData(event) {
  const value = event.target.value;
  const flags = value.getUint8(0);
  
  // Check if crank revolution data is present
  if (flags & 0x02) {
    const crankRevolutions = value.getUint16(2);
    const crankEventTime = value.getUint16(4);
    
    // Calculate cadence (RPM)
    // This is simplified - real implementation needs proper timing
    state.currentCadence = Math.round((crankRevolutions * 60) / (crankEventTime / 1024));
    state.currentCadence = Math.min(200, Math.max(0, state.currentCadence));
    
    elements.cadenceValue.textContent = state.currentCadence;
    
    if (state.isSessionActive) {
      state.session.cadenceReadings.push({
        time: Date.now() - state.session.startTime,
        value: state.currentCadence
      });
    }
  }
}

// Handle disconnect
function handleDisconnect() {
  state.isConnected = false;
  state.device = null;
  state.server = null;
  state.powerChar = null;
  state.cscChar = null;
  
  updateStatus('disconnected', 'Disconnected');
  elements.connectBtn.textContent = 'Connect Sensor';
  elements.connectBtn.onclick = connectToSensor;
  elements.connectBtn.disabled = false;
  
  elements.powerValue.textContent = '--';
  elements.cadenceValue.textContent = '--';
}

// Disconnect manually
async function disconnect() {
  if (state.device && state.device.gatt.connected) {
    state.device.gatt.disconnect();
  }
}

// Update connection status
function updateStatus(status, text) {
  elements.statusDot.className = 'status-indicator ' + status;
  elements.statusText.textContent = text;
}

// Start session
function startSession() {
  if (!state.isConnected) {
    alert('Connect to a sensor first!');
    return;
  }
  
  state.isSessionActive = true;
  state.session = {
    startTime: Date.now(),
    powerReadings: [],
    cadenceReadings: [],
    duration: 0
  };
  
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
  
  // Start duration timer
  state.sessionTimer = setInterval(updateDuration, 1000);
}

// Stop session
function stopSession() {
  state.isSessionActive = false;
  
  if (state.sessionTimer) {
    clearInterval(state.sessionTimer);
  }
  
  // Calculate averages
  const avgPower = calculateAverage(state.session.powerReadings);
  
  // Save session
  const sessionData = {
    id: Date.now(),
    date: new Date().toISOString(),
    duration: state.session.duration,
    avgPower: avgPower,
    maxPower: Math.max(...state.session.powerReadings.map(r => r.value), 0),
    avgCadence: calculateAverage(state.session.cadenceReadings),
    data: state.session
  };
  
  state.sessions.unshift(sessionData);
  saveSessions();
  
  // Reset UI
  elements.startBtn.disabled = false;
  elements.stopBtn.disabled = true;
  elements.duration.textContent = '00:00:00';
  elements.avgPower.textContent = '-- W';
  
  renderHistory();
}

// Update duration display
function updateDuration() {
  state.session.duration = Math.floor((Date.now() - state.session.startTime) / 1000);
  elements.duration.textContent = formatDuration(state.session.duration);
  
  // Update average power
  const avgPower = calculateAverage(state.session.powerReadings);
  elements.avgPower.textContent = avgPower + ' W';
}

// Calculate average from readings
function calculateAverage(readings) {
  if (readings.length === 0) return 0;
  const sum = readings.reduce((acc, r) => acc + r.value, 0);
  return Math.round(sum / readings.length);
}

// Format duration as HH:MM:SS
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Save sessions to localStorage
function saveSessions() {
  try {
    localStorage.setItem('indoor-cycling-sessions', JSON.stringify(state.sessions));
  } catch (e) {
    console.error('Failed to save sessions:', e);
  }
}

// Load sessions from localStorage
function loadSessions() {
  try {
    const stored = localStorage.getItem('indoor-cycling-sessions');
    if (stored) {
      state.sessions = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load sessions:', e);
  }
}

// Render history
function renderHistory() {
  if (state.sessions.length === 0) {
    elements.sessionList.innerHTML = '<li class="empty-state">No sessions yet</li>';
    return;
  }
  
  elements.sessionList.innerHTML = state.sessions.slice(0, 10).map(session => {
    const date = new Date(session.date);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    return `
      <li>
        <span class="session-date">${dateStr}</span>
        <div class="session-summary">
          <span>${formatDuration(session.duration)}</span>
          <span>${session.avgPower}W</span>
        </div>
      </li>
    `;
  }).join('');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
