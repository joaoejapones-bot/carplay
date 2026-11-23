// ============================================
// CarPlay Map App - Player de Mídia (Build 2)
// ============================================

// Estado do Player
const playerState = {
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    volume: 0.5,
    currentUrl: null,
    mediaElement: null
};

// Nome do banco IndexedDB
const DB_NAME = 'CarPlayMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'mediaFiles';

// ============================================
// IndexedDB - Gerenciamento de Mídia
// ============================================
let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('name', 'name', { unique: false });
            }
        };
    });
}

async function clearPlaylist() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function saveMediaFile(file) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

    // Nome limpo sem extensão
    const cleanName = file.name.replace(/\.[^/.]+$/, '');

    const mediaRecord = {
        name: cleanName,
        type: file.type,
        blob: file,
        createdAt: Date.now()
    };

    const request = store.add(mediaRecord);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    });
}

async function loadPlaylist() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

    request.onsuccess = () => {
        const files = request.result.sort((a, b) => a.createdAt - b.createdAt);
        resolve(files);
    };
    request.onerror = () => reject(request.error);
    });
}

// ============================================
// Importação de Arquivos
// ============================================
async function importMediaFiles(files) {
    try {
        // Limpa playlist anterior
        await clearPlaylist();
        
        // Salva novos arquivos
        for (const file of files) {
            await saveMediaFile(file);
        }

        // Carrega playlist atualizada
        playerState.playlist = await loadPlaylist();
        playerState.currentIndex = 0;

        console.log(`Importados ${playerState.playlist.length} arquivos`);
        updateTrackHUD();
        
        return playerState.playlist.length;
    } catch (error) {
        console.error('Erro ao importar arquivos:', error);
        throw error;
    }
}

async function loadSavedPlaylist() {
    try {
        await initDB();
        playerState.playlist = await loadPlaylist();
        
        if (playerState.playlist.length > 0) {
            console.log(`Playlist carregada: ${playerState.playlist.length} faixas`);
            updateTrackHUD();
        }
    } catch (error) {
        console.error('Erro ao carregar playlist salva:', error);
    }
}

// ============================================
// Player de Mídia
// ============================================
function initMediaElement() {
    // Cria elemento de vídeo oculto (suporta áudio e vídeo)
    playerState.mediaElement = document.createElement('video');
    playerState.mediaElement.style.display = 'none';
    playerState.mediaElement.volume = playerState.volume;
    document.body.appendChild(playerState.mediaElement);

    // Evento quando a faixa termina
    playerState.mediaElement.addEventListener('ended', () => {
        playNext();
    });

    // Evento de erro
    playerState.mediaElement.addEventListener('error', (e) => {
        console.error('Erro no player:', e);
        playNext();
    });
}

function loadTrack(index) {
    if (index < 0 || index >= playerState.playlist.length) {
        return;
    }

    // Revoga URL anterior se existir
    if (playerState.currentUrl) {
        URL.revokeObjectURL(playerState.currentUrl);
        playerState.currentUrl = null;
    }

    const track = playerState.playlist[index];
    playerState.currentIndex = index;
    playerState.currentUrl = URL.createObjectURL(track.blob);
    
    playerState.mediaElement.src = playerState.currentUrl;
    updateTrackHUD();
}

function playTrack(index) {
    loadTrack(index);
    playerState.mediaElement.play()
        .then(() => {
            playerState.isPlaying = true;
            updatePlayButton();
            // Notifica mudança de estado para atualizar UI
            if (window.updateModalPlayButton) {
                window.updateModalPlayButton();
            }
            if (window.updateModalTrackInfo) {
                window.updateModalTrackInfo();
            }
            if (window.updatePlaylistModal) {
                window.updatePlaylistModal();
            }
        })
        .catch(error => {
            console.error('Erro ao reproduzir:', error);
        });
}

function playCurrent() {
    if (playerState.playlist.length === 0) {
        console.warn('Playlist vazia');
        return;
    }
    
    if (playerState.mediaElement.src) {
        playerState.mediaElement.play()
            .then(() => {
                playerState.isPlaying = true;
                updatePlayButton();
            })
            .catch(error => console.error('Erro ao reproduzir:', error));
    } else {
        playTrack(playerState.currentIndex);
    }
}

function pauseTrack() {
    playerState.mediaElement.pause();
    playerState.isPlaying = false;
    updatePlayButton();
    // Notifica mudança de estado para atualizar UI
    if (window.updateModalPlayButton) {
        window.updateModalPlayButton();
    }
}

function togglePlayPause() {
    if (playerState.playlist.length === 0) {
        console.warn('Playlist vazia');
        return;
    }

    if (playerState.isPlaying) {
        pauseTrack();
    } else {
        playCurrent();
    }
    
    // Notifica mudança de estado para atualizar UI
    if (window.updateModalPlayButton) {
        window.updateModalPlayButton();
    }
}

function playNext() {
    if (playerState.playlist.length === 0) return;
    
    const nextIndex = (playerState.currentIndex + 1) % playerState.playlist.length;
    playTrack(nextIndex);
}

function playPrevious() {
    if (playerState.playlist.length === 0) return;

    const currentTime = playerState.mediaElement.currentTime;
    
    // Se passou mais de 3 segundos, reinicia a faixa atual
    if (currentTime > 3) {
        playerState.mediaElement.currentTime = 0;
    } else {
        // Volta para a faixa anterior
        const prevIndex = playerState.currentIndex === 0 
            ? playerState.playlist.length - 1 
            : playerState.currentIndex - 1;
        playTrack(prevIndex);
    }
}

function setVolume(value) {
    // Limita entre 0.0 e 1.0
    playerState.volume = Math.max(0.0, Math.min(1.0, value));
    playerState.mediaElement.volume = playerState.volume;
    showVolumeIndicator();
}

function increaseVolume() {
    setVolume(playerState.volume + 0.1);
}

function decreaseVolume() {
    setVolume(playerState.volume - 0.1);
}

// ============================================
// Atualização de UI
// ============================================
function updatePlayButton() {
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');

    if (playerState.isPlaying) {
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
    } else {
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
    }
}

function updateTrackHUD() {
    const trackNameEl = document.getElementById('track-name');
    const trackCounterEl = document.getElementById('track-counter');

    if (playerState.playlist.length > 0 && playerState.currentIndex < playerState.playlist.length) {
        const track = playerState.playlist[playerState.currentIndex];
        trackNameEl.textContent = track.name;
        trackCounterEl.textContent = `${playerState.currentIndex + 1}/${playerState.playlist.length}`;
    } else {
        trackNameEl.textContent = 'Nenhuma faixa';
        trackCounterEl.textContent = '0/0';
    }
}

function showVolumeIndicator() {
    const indicator = document.getElementById('volume-indicator');
    const volumeValue = document.getElementById('volume-value');
    
    volumeValue.textContent = `${Math.round(playerState.volume * 100)}%`;
    indicator.style.display = 'flex';
    
    // Esconde após 2 segundos
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 2000);
}

// ============================================
// Inicialização do Player
// ============================================
async function initPlayer() {
    await initDB();
    await loadSavedPlaylist();
    initMediaElement();
    
    console.log('Player de mídia inicializado');
}

// ============================================
// Exporta funções para uso no app.js
// ============================================
window.PlayerAPI = {
    initPlayer,
    importMediaFiles,
    togglePlayPause,
    playNext,
    playPrevious,
    playTrack,
    increaseVolume,
    decreaseVolume,
    getPlaylist: () => playerState.playlist,
    getCurrentIndex: () => playerState.currentIndex,
    getPlayerState: () => playerState
};
