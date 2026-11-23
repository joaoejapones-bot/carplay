// ============================================
// CarPlay Map App - Build 1
// ============================================

// Estado da aplicação
const state = {
    map: null,
    vehicleMarker: null,
    watchId: null,
    followMode: true,
    isPlaying: false,
    currentPosition: null,
    darkMode: false,
    tileLayer: null,
    deviceBearing: 0,
    orientationPermissionGranted: false
};

// ============================================
// Inicialização do Mapa
// ============================================
function initMap() {
    // Inicializa o mapa com rotação habilitada (plugin Leaflet.ROTATE)
    state.map = L.map('map', {
        center: [-23.5505, -46.6333],
        zoom: 15,
        zoomControl: false, // Desabilita controles padrão, usaremos customizados
        rotate: true, // Habilita rotação do mapa
        bearing: 0, // Rotação inicial
        rotateControl: false // Desabilita controle de rotação padrão
    });

    // Carrega o mapa base (OpenStreetMap - gratuito sem API key)
    state.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(state.map);

    // Cria o marcador do veículo
    createVehicleMarker();

    // Configura eventos do mapa
    setupMapEvents();

    // Solicita permissão de orientação do dispositivo (iOS 13+)
    requestOrientationPermission();

    // Inicia geolocalização
    startGeolocation();

    console.log('Mapa inicializado com sucesso');
}

// ============================================
// Permissão de Orientação do Dispositivo (iOS 13+)
// ============================================
function requestOrientationPermission() {
    // Verifica se é iOS 13+ que requer permissão explícita
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        
        // Cria um botão para solicitar permissão (iOS requer gesto do usuário)
        const permissionBtn = document.createElement('button');
        permissionBtn.textContent = 'Ativar rotação do mapa';
        permissionBtn.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 16px 24px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            z-index: 5000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        permissionBtn.addEventListener('click', async () => {
            try {
                const permissionState = await DeviceOrientationEvent.requestPermission();
                if (permissionState === 'granted') {
                    state.orientationPermissionGranted = true;
                    document.body.removeChild(permissionBtn);
                    setupDeviceOrientation();
                    console.log('Permissão de orientação concedida');
                } else {
                    console.warn('Permissão de orientação negada');
                    document.body.removeChild(permissionBtn);
                }
            } catch (error) {
                console.error('Erro ao solicitar permissão:', error);
                document.body.removeChild(permissionBtn);
            }
        });
        
        document.body.appendChild(permissionBtn);
    } else {
        // Android ou iOS < 13 não requer permissão
        state.orientationPermissionGranted = true;
        setupDeviceOrientation();
    }
}

// ============================================
// Orientação do Dispositivo (Rotação do Mapa)
// ============================================
function setupDeviceOrientation() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        console.log('Listener de orientação do dispositivo configurado');
    } else {
        console.warn('DeviceOrientationEvent não suportado');
    }
}

function handleDeviceOrientation(event) {
    // alpha: rotação em torno do eixo Z (0-360 graus)
    // beta: rotação em torno do eixo X (-180 a 180)
    // gamma: rotação em torno do eixo Y (-90 a 90)
    
    if (event.alpha !== null) {
        // Converte alpha para bearing (ângulo em relação ao norte)
        // alpha = 0 é norte, aumenta no sentido horário
        const bearing = 360 - event.alpha;
        
        state.deviceBearing = bearing;
        
        // Aplica rotação ao mapa usando o plugin Leaflet.ROTATE
        if (state.map && state.map.setBearing) {
            state.map.setBearing(bearing);
        }
    }
}

// ============================================
// Marcador Customizado do Veículo
// ============================================
function createVehicleMarker() {
    const iconHtml = `
        <div class="vehicle-marker">
            <div class="vehicle-marker-icon"></div>
        </div>
    `;

    const customIcon = L.divIcon({
        html: iconHtml,
        className: 'vehicle-marker',
        iconSize: [40, 48],
        iconAnchor: [20, 24]
    });

    state.vehicleMarker = L.marker([-23.5505, -46.6333], {
        icon: customIcon
    }).addTo(state.map);
}

// ============================================
// Geolocalização
// ============================================
function startGeolocation() {
    if (!navigator.geolocation) {
        console.warn('Geolocalização não suportada neste navegador');
        showDefaultLocation();
        return;
    }

    state.watchId = navigator.geolocation.watchPosition(
        updatePosition,
        handleGeolocationError,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        }
    );
}

function updatePosition(position) {
    const { latitude, longitude, heading, speed } = position.coords;
    
    state.currentPosition = { lat: latitude, lng: longitude };

    // Atualiza posição do marcador
    state.vehicleMarker.setLatLng([latitude, longitude]);

    // Atualiza rotação do marcador (se heading disponível)
    if (heading !== null && heading !== undefined) {
        const markerElement = state.vehicleMarker.getElement();
        if (markerElement) {
            markerElement.style.transform = `rotate(${heading}deg)`;
        }
    }

    // Atualiza HUD de velocidade
    updateSpeedHUD(speed);

    // Centraliza mapa se followMode estiver ativo
    if (state.followMode) {
        state.map.setView([latitude, longitude], state.map.getZoom());
    }

    console.log('Posição atualizada:', { latitude, longitude, heading, speed });
}

function handleGeolocationError(error) {
    console.warn('Erro de geolocalização:', error.message);
    
    switch (error.code) {
        case error.PERMISSION_DENIED:
            console.warn('Permissão de GPS negada pelo usuário');
            break;
        case error.POSITION_UNAVAILABLE:
            console.warn('Posição indisponível');
            break;
        case error.TIMEOUT:
            console.warn('Timeout ao obter posição');
            break;
        default:
            console.warn('Erro desconhecido de geolocalização');
    }

    // Mostra localização padrão se GPS falhar
    showDefaultLocation();
}

function showDefaultLocation() {
    // Mantém o mapa em São Paulo como fallback
    state.map.setView([-23.5505, -46.6333], 15);
    updateSpeedHUD(null);
}

// ============================================
// HUD de Velocidade
// ============================================
function updateSpeedHUD(speed) {
    const speedElement = document.getElementById('speed-value');
    
    if (speed !== null && speed !== undefined && speed >= 0) {
        // Converte m/s para km/h
        const speedKmh = Math.round(speed * 3.6);
        speedElement.textContent = speedKmh;
    } else {
        speedElement.textContent = '0';
    }
}

// ============================================
// Eventos do Mapa
// ============================================
function setupMapEvents() {
    // Desativa followMode quando usuário arrasta o mapa
    state.map.on('movestart', () => {
        if (state.followMode) {
            state.followMode = false;
            updateFollowButton();
        }
    });
}

// ============================================
// Controles de Zoom
// ============================================
function setupZoomControls() {
    document.getElementById('zoom-in').addEventListener('click', () => {
        state.map.zoomIn();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        state.map.zoomOut();
    });
}

// ============================================
// Botão de Seguir Veículo
// ============================================
function setupFollowButton() {
    const followBtn = document.getElementById('follow-btn');
    
    followBtn.addEventListener('click', () => {
        state.followMode = true;
        
        if (state.currentPosition) {
            state.map.setView([state.currentPosition.lat, state.currentPosition.lng], state.map.getZoom());
        }
        
        updateFollowButton();
        console.log('Follow mode ativado');
    });

    updateFollowButton();
}

function updateFollowButton() {
    const followBtn = document.getElementById('follow-btn');
    
    if (state.followMode) {
        followBtn.classList.add('active');
    } else {
        followBtn.classList.remove('active');
    }
}

// ============================================
// Modo Escuro
// ============================================
function setupDarkMode() {
    const darkModeBtn = document.getElementById('dark-mode-btn');
    
    darkModeBtn.addEventListener('click', () => {
        state.darkMode = !state.darkMode;
        toggleMapTheme();
        updateDarkModeButton();
        console.log('Dark mode:', state.darkMode ? 'Ativado' : 'Desativado');
    });

    updateDarkModeButton();
}

function toggleMapTheme() {
    const mapElement = document.getElementById('map');
    
    if (state.darkMode) {
        // Modo escuro - aplica filtro CSS ao OpenStreetMap
        mapElement.classList.add('dark-mode');
    } else {
        // Modo claro - remove filtro
        mapElement.classList.remove('dark-mode');
    }
}

function updateDarkModeButton() {
    const iconMoon = document.getElementById('icon-moon');
    const iconSun = document.getElementById('icon-sun');

    if (state.darkMode) {
        iconMoon.style.display = 'none';
        iconSun.style.display = 'block';
    } else {
        iconMoon.style.display = 'block';
        iconSun.style.display = 'none';
    }
}

// ============================================
// Barra de Controle Inferior
// ============================================
function setupControlBar() {
    // Volume -
    document.getElementById('btn-vol-down').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.decreaseVolume();
        }
    });

    // Anterior
    document.getElementById('btn-prev').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.playPrevious();
        }
    });

    // Play/Pause
    document.getElementById('btn-play').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.togglePlayPause();
        }
    });

    // Próxima
    document.getElementById('btn-next').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.playNext();
        }
    });

    // Volume +
    document.getElementById('btn-vol-up').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.increaseVolume();
        }
    });

    // Importar mídia
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    // File input change
    document.getElementById('file-input').addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0 && window.PlayerAPI) {
            try {
                const count = await window.PlayerAPI.importMediaFiles(files);
                console.log(`Importadas ${count} faixas`);
                updatePlaylistModal();
            } catch (error) {
                console.error('Erro ao importar:', error);
            }
        }
        // Limpa o input para permitir reimportar os mesmos arquivos
        event.target.value = '';
    });

    // Botão de música - abre modal
    document.getElementById('music-btn').addEventListener('click', () => {
        openMusicModal();
    });

    // Fechar modal
    document.getElementById('close-modal').addEventListener('click', () => {
        closeMusicModal();
    });

    // Controles do modal
    document.getElementById('modal-btn-prev').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.playPrevious();
        }
    });

    document.getElementById('modal-btn-play').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.togglePlayPause();
            updateModalPlayButton();
        }
    });

    document.getElementById('modal-btn-next').addEventListener('click', () => {
        if (window.PlayerAPI) {
            window.PlayerAPI.playNext();
        }
    });
}

// ============================================
// Modal do Player de Música
// ============================================
function openMusicModal() {
    const modal = document.getElementById('music-modal');
    modal.style.display = 'flex';
    updateModalTrackInfo();
    updatePlaylistModal();
}

function closeMusicModal() {
    const modal = document.getElementById('music-modal');
    modal.style.display = 'none';
}

function updateModalTrackInfo() {
    if (!window.PlayerAPI) return;

    const playlist = window.PlayerAPI.getPlaylist();
    const currentIndex = window.PlayerAPI.getCurrentIndex();

    const trackNameEl = document.getElementById('modal-track-name');
    const trackCounterEl = document.getElementById('modal-track-counter');

    if (playlist.length > 0 && currentIndex < playlist.length) {
        const track = playlist[currentIndex];
        trackNameEl.textContent = track.name;
        trackCounterEl.textContent = `${currentIndex + 1}/${playlist.length}`;
    } else {
        trackNameEl.textContent = 'Nenhuma faixa';
        trackCounterEl.textContent = '0/0';
    }

    updateModalPlayButton();
}

function updateModalPlayButton() {
    if (!window.PlayerAPI) return;

    const playerState = window.PlayerAPI.getPlayerState();
    const iconPlay = document.getElementById('modal-icon-play');
    const iconPause = document.getElementById('modal-icon-pause');

    // Verifica se está tocando através do estado do player
    const isPlaying = playerState && playerState.isPlaying;

    if (isPlaying) {
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
    } else {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
    }
}

function updatePlaylistModal() {
    if (!window.PlayerAPI) return;

    const playlist = window.PlayerAPI.getPlaylist();
    const currentIndex = window.PlayerAPI.getCurrentIndex();
    const playlistList = document.getElementById('playlist-list');

    if (playlist.length === 0) {
        playlistList.innerHTML = '<p class="empty-playlist">Nenhuma faixa carregada</p>';
        return;
    }

    playlistList.innerHTML = '';
    playlist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item' + (index === currentIndex ? ' active' : '');
        item.innerHTML = `
            <span class="playlist-item-number">${index + 1}</span>
            <span class="playlist-item-name">${track.name}</span>
        `;
        item.addEventListener('click', () => {
            if (window.PlayerAPI) {
                window.PlayerAPI.playTrack(index);
            }
        });
        playlistList.appendChild(item);
    });
}

// Expor funções de atualização para o player.js
window.updateModalPlayButton = updateModalPlayButton;
window.updateModalTrackInfo = updateModalTrackInfo;
window.updatePlaylistModal = updatePlaylistModal;

// ============================================
// Inicialização da Aplicação
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupZoomControls();
    setupFollowButton();
    setupDarkMode();
    setupControlBar();
    
    // Inicializa o player de mídia
    if (window.PlayerAPI) {
        window.PlayerAPI.initPlayer();
    }
    
    console.log('CarPlay Map App - Build 2 carregado');
});
