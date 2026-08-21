// SGTI Mobile Georeporting App Logic

let map;
let marker;
let userCoords = { lat: -12.041600, lng: -77.091100 }; // Carmen de la Legua Reynoso (Default)
const API_URL = '/api/reportes-movil';
const IS_NATIVE = window.Capacitor && window.Capacitor.isNativePlatform();

async function getAddressFromCoords(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es`);
        const data = await response.json();
        if (data && data.address) {
            const addr = data.address;
            let parts = [];
            if (addr.road) parts.push(addr.road);
            if (addr.house_number) parts.push(addr.house_number);
            
            if (parts.length === 0) {
                if (addr.suburb) parts.push(addr.suburb);
            }
            return parts.join(' ');
        }
    } catch (e) {
        console.warn('Reverse Geocoding Error:', e);
    }
    return null;
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    getLocation();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView([userCoords.lat, userCoords.lng], 16);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    marker = L.marker([userCoords.lat, userCoords.lng], { draggable: true }).addTo(map);
    
    marker.on('dragend', async function(event) {
        const position = marker.getLatLng();
        userCoords.lat = position.lat;
        userCoords.lng = position.lng;
        
        updateLocationStatus('<i class="fas fa-circle-notch fa-spin"></i> Obteniendo dirección...');
        const address = await getAddressFromCoords(userCoords.lat, userCoords.lng);
        const statusHtml = address 
            ? `<i class="fas fa-map-marker-alt" style="color: var(--accent)"></i> <b>${address}</b>` 
            : `<i class="fas fa-hand-pointer"></i> Ubicación ajustada manualmente`;
        updateLocationStatus(statusHtml);
    });
}

async function getLocation() {
    updateLocationStatus('<i class="fas fa-circle-notch fa-spin"></i> Intentando detectar ubicación...');
    
    if (IS_NATIVE) {
        try {
            const { Geolocation } = window.Capacitor.Plugins;
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000
            });
            
            userCoords.lat = coordinates.coords.latitude;
            userCoords.lng = coordinates.coords.longitude;
            await updateMapToCoords();
            return;
        } catch (e) {
            console.error('Capacitor Geolocation Error:', e);
        }
    }

    // Fallback to Web Geolocation
    if (navigator.geolocation) {
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                userCoords.lat = position.coords.latitude;
                userCoords.lng = position.coords.longitude;
                await updateMapToCoords();
            },
            (error) => {
                console.warn('GPS Error:', error.code, error.message);
                let msg = 'Ubicación no detectada. ';
                
                if (error.code === 1) msg += 'Permiso denegado.';
                else if (error.code === 2) msg += 'Sin señal GPS.';
                else if (error.code === 3) msg += 'Tiempo agotado.';
                
                updateLocationStatus(`<i class="fas fa-exclamation-triangle" style="color: #f87171"></i> ${msg} <br><b>Usa el mapa manualmente.</b>`);
                map.setView([userCoords.lat, userCoords.lng], 16);
            },
            options
        );
    } else {
        updateLocationStatus('Geolocalización no soportada.');
    }
}

async function updateMapToCoords() {
    const newLatLng = new L.LatLng(userCoords.lat, userCoords.lng);
    map.setView(newLatLng, 17);
    marker.setLatLng(newLatLng);

    updateLocationStatus('<i class="fas fa-circle-notch fa-spin"></i> Obteniendo dirección...');
    const address = await getAddressFromCoords(userCoords.lat, userCoords.lng);
    if (address) {
        updateLocationStatus(`<i class="fas fa-check-circle" style="color: var(--accent)"></i> <b>${address}</b>`);
    } else {
        updateLocationStatus('<i class="fas fa-check-circle" style="color: var(--accent)"></i> Ubicación detectada');
    }
}

function updateLocationStatus(html) {
    document.getElementById('location-status').innerHTML = html;
}

function setupEventListeners() {
    // Navigation: Step 1 to Step 2
    document.getElementById('btn-to-details').addEventListener('click', () => {
        showSection('section-details');
        document.getElementById('step-2-dot').classList.add('active');
    });

    // Navigation: Back to Step 1
    document.getElementById('btn-back-to-map').addEventListener('click', () => {
        showSection('section-location');
        document.getElementById('step-2-dot').classList.remove('active');
    });

    // Refresh Location
    document.getElementById('btn-refresh-location').addEventListener('click', () => {
        getLocation();
    });

    // Submit Report
    document.getElementById('btn-submit').addEventListener('click', submitReport);
}

function showSection(id) {
    document.querySelectorAll('.form-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo(0, 0);
}

async function submitReport() {
    const btn = document.getElementById('btn-submit');
    const mensaje = document.getElementById('mensaje').value;
    const categoria = document.getElementById('categoria').value;
    const prioridad = document.getElementById('prioridad').value;
    const reportadoPor = document.getElementById('reportadoPor').value;

    if (!mensaje) {
        alert('Por favor, ingresa los detalles de la intervención.');
        return;
    }

    // UI Feedback
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...';

    const payload = {
        mensaje,
        categoria,
        prioridad,
        reportadoPor,
        estado: 'nuevo', // Valor por defecto
        lat: userCoords.lat,
        lng: userCoords.lng,
        ubicacion: `Reporte Móvil GPS (${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)})`,
        fotoUrl: null // Por ahora no hay captura de foto en esta UI
    };


    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('report-id-text').innerText = `ID: ${result.id}`;
            showSection('section-success');
            document.querySelector('.step-indicator').classList.add('hidden');
        } else {
            throw new Error(result.error || 'Error al enviar reporte');
        }
    } catch (error) {
        alert('Error: ' + error.message);
        btn.disabled = false;
        btn.innerHTML = 'Enviar Reporte <i class="fas fa-paper-plane"></i>';
    }
}
