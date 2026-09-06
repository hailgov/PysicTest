/* ============================================================
   PYSIC
   ============================================================ */


/* ============================================================
   STORAGE KEYS
   ============================================================ */

const KEYS = {
    playlists: "pysic_playlists",
    liked: "pysic_liked",
    profile: "pysic_profile",
    accent: "pysic_accent",
    volume: "pysic_volume",
    loop: "pysic_loop"
};


/* ============================================================
   STATE
   ============================================================ */

const state = {

    page: "home",

    currentPlaylist: null,

    searchResults: [],

    liked: [],

    playlists: [],

    cached: [],

    queue: [],

    queueIndex: -1,

    currentSong: null,

    currentJob: null,

    isPlaying: false,

    loop: false,

    searchTimer: null

};


/* ============================================================
   DOM
   ============================================================ */

const $ = selector =>
    document.querySelector(selector);

const audio =
    $("#audio");


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    loadLocalData();

    applyAccent();

    setupNavigation();

    setupPlayer();

    setupModals();

    setupSearch();

    updateProfileUI();

    await refreshCache();

    renderSidebar();

    renderPage("home");

}


/* ============================================================
   LOCAL DATA
   ============================================================ */

function loadLocalData() {

    try {

        state.playlists =
            JSON.parse(
                localStorage.getItem(
                    KEYS.playlists
                )
            ) || [];

    } catch {

        state.playlists = [];

    }


    try {

        state.liked =
            JSON.parse(
                localStorage.getItem(
                    KEYS.liked
                )
            ) || [];

    } catch {

        state.liked = [];

    }


    state.loop =
        localStorage.getItem(
            KEYS.loop
        ) === "true";


    /*
     * Always ensure the permanent
     * Liked Songs playlist exists.
     */

    ensureLikedPlaylist();

}


function savePlaylists() {

    localStorage.setItem(
        KEYS.playlists,
        JSON.stringify(
            state.playlists
        )
    );

}


function saveLiked() {

    localStorage.setItem(
        KEYS.liked,
        JSON.stringify(
            state.liked
        )
    );

    syncLikedPlaylist();

}


/* ============================================================
   LIKED SONGS PLAYLIST
   ============================================================ */

function ensureLikedPlaylist() {

    let likedPlaylist =
        state.playlists.find(
            playlist =>
                playlist.id === "liked"
        );

    if (!likedPlaylist) {

        likedPlaylist = {
            id: "liked",

            name: "Liked Songs",

            image: null,

            tracks: state.liked
        };

        state.playlists.unshift(
            likedPlaylist
        );

    } else {

        likedPlaylist.name =
            "Liked Songs";

        likedPlaylist.tracks =
            state.liked;

    }

    savePlaylists();

}


function syncLikedPlaylist() {

    const playlist =
        state.playlists.find(
            p => p.id === "liked"
        );

    if (playlist) {

        playlist.tracks =
            state.liked;

    }

    savePlaylists();

}


/* ============================================================
   PROFILE
   ============================================================ */

function getProfile() {

    try {

        return JSON.parse(
            localStorage.getItem(
                KEYS.profile
            )
        ) || {
            name: "Listener",
            image: null
        };

    } catch {

        return {
            name: "Listener",
            image: null
        };

    }

}


function saveProfile(profile) {

    localStorage.setItem(
        KEYS.profile,
        JSON.stringify(profile)
    );

}


function updateProfileUI() {

    const profile =
        getProfile();

    const name =
        profile.name || "Listener";


    $("#sidebar-profile-name")
        .textContent = name;

    $("#top-profile-name")
        .textContent = name;


    setAvatar(
        $("#sidebar-avatar"),
        profile
    );

    setAvatar(
        $("#top-avatar"),
        profile
    );

}


function setAvatar(element, profile) {

    if (!element) return;

    if (profile.image) {

        element.innerHTML = `
            <img
                src="${profile.image}"
                alt=""
            >
        `;

    } else {

        element.textContent =
            getInitials(
                profile.name
            );

    }

}


function getInitials(name) {

    return String(name || "P")
        .trim()
        .split(/\s+/)
        .map(word =>
            word[0]
        )
        .join("")
        .slice(0, 2)
        .toUpperCase();

}


/* ============================================================
   ACCENT
   ============================================================ */

function applyAccent() {

    const saved =
        localStorage.getItem(
            KEYS.accent
        ) || "#a78bfa";

    setAccent(saved);

}


function setAccent(hex) {

    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        return;
    }

    const rgb =
        hexToRgb(hex);

    document.documentElement
        .style.setProperty(
            "--accent",
            hex
        );

    document.documentElement
        .style.setProperty(
            "--accent-rgb",
            `${rgb.r}, ${rgb.g}, ${rgb.b}`
        );

    localStorage.setItem(
        KEYS.accent,
        hex
    );

}


function hexToRgb(hex) {

    return {
        r: parseInt(
            hex.slice(1, 3),
            16
        ),

        g: parseInt(
            hex.slice(3, 5),
            16
        ),

        b: parseInt(
            hex.slice(5, 7),
            16
        )
    };

}


/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {

    document.querySelectorAll(
        ".nav-item"
    ).forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const page =
                    button.dataset.page;

                renderPage(page);

            }
        );

    });

}


function renderPage(page) {

    state.page = page;

    state.currentPlaylist =
        null;


    document.querySelectorAll(
        ".nav-item"
    ).forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });


    if (page === "home") {
        renderHome();

    } else if (page === "search") {
        renderSearchPage();

    } else if (page === "liked") {
        renderLikedPage();

    } else if (page === "cache") {
        renderCachePage();
    }


    renderSidebar();

}


function showPlaylist(id) {

    const playlist =
        state.playlists.find(
            p => p.id === id
        );

    if (!playlist) return;

    state.currentPlaylist =
        playlist;

    document.querySelectorAll(
        ".nav-item"
    ).forEach(button => {
        button.classList.remove(
            "active"
        );
    });

    renderPlaylistPage(
        playlist
    );

    renderSidebar();

}


/* ============================================================
   HOME
   ============================================================ */

function renderHome() {

    $("#content").innerHTML = `
        <div class="page">

            <div class="hero">

                <div class="hero-content">

                    <div class="eyebrow">
                        YOUR MUSIC
                    </div>

                    <h1>
                        Welcome back.
                    </h1>

                    <p>
                        Search YouTube, build playlists,
                        save music locally and make Pysic
                        yours.
                    </p>

                    <button
                        class="accent-button"
                        onclick="focusSearch()"
                    >
                        Start listening
                    </button>

                </div>

            </div>


            <div class="section">

                <div class="section-header">

                    <h2>
                        Your library
                    </h2>

                    <span>
                        ${state.playlists.length} playlists
                    </span>

                </div>

                <div
                    class="card-grid"
                    id="home-playlists"
                ></div>

            </div>


            <div class="section">

                <div class="section-header">

                    <h2>
                        Recently cached
                    </h2>

                    <span>
                        ${state.cached.length} songs
                    </span>

                </div>

                <div
                    id="home-cache"
                    class="results"
                ></div>

            </div>

        </div>
    `;


    renderHomePlaylists();

    renderHomeCache();

}


function renderHomePlaylists() {

    const container =
        $("#home-playlists");

    if (!container) return;


    const playlists =
        state.playlists.slice(0, 8);


    container.innerHTML =
        playlists.map(
            playlistCard
        ).join("");

}


function renderHomeCache() {

    const container =
        $("#home-cache");

    if (!container) return;


    if (!state.cached.length) {

        container.innerHTML = `
            <div class="empty-state">

                <div class="empty-icon">
                    =
                </div>

                <h3>
                    No cached songs
                </h3>

                <p>
                    Keep a song downloaded and
                    it'll appear here.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        state.cached
            .slice(0, 5)
            .map(
                cachedSongRow
            )
            .join("");

}


/* ============================================================
   PLAYLIST CARDS
   ============================================================ */

function playlistCard(playlist) {

    const image =
        playlist.image ||
        createFallbackImage(
            playlist.name
        );


    return `
        <div
            class="playlist-card"
            onclick="showPlaylist('${playlist.id}')"
        >

            <div class="playlist-card-image">

                <img
                    src="${image}"
                    alt=""
                >

            </div>

            <div class="playlist-card-name">
                ${escapeHtml(
                    playlist.name
                )}
            </div>

            <div class="playlist-card-meta">
                ${playlist.tracks.length}
                ${playlist.tracks.length === 1
                    ? "song"
                    : "songs"}
            </div>

        </div>
    `;

}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

    const input =
        $("#global-search-input");


    input.addEventListener(
        "input",
        () => {

            const value =
                input.value.trim();

            $("#clear-search")
                .classList.toggle(
                    "hidden",
                    !value
                );

            clearTimeout(
                state.searchTimer
            );

            if (!value) {

                state.searchResults = [];

                if (
                    state.page === "search"
                ) {
                    renderSearchPage();
                }

                return;
            }


            state.searchTimer =
                setTimeout(
                    () => search(value),
                    350
                );

        }
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                const value =
                    input.value.trim();

                if (value) {
                    search(value);
                }

            }

        }
    );


    $("#clear-search")
        .addEventListener(
            "click",
            () => {

                input.value = "";

                state.searchResults = [];

                $("#clear-search")
                    .classList.add(
                        "hidden"
                    );

                renderSearchPage();

                input.focus();

            }
        );

}


function focusSearch() {

    const input =
        $("#global-search-input");

    input.focus();

    input.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


async function search(query) {

    renderSearchPage(
        true,
        query
    );


    try {

        const response =
            await fetch(
                `/api/search?q=${encodeURIComponent(
                    query
                )}`
            );


        const data =
            await response.json();


        if (!data.success) {
            throw new Error(
                data.error
            );
        }


        state.searchResults =
            data.results || [];


        renderSearchPage(
            false,
            query
        );


    } catch (error) {

        notify(
            "Search failed",
            error.message,
            "!"
        );

        state.searchResults = [];

        renderSearchPage(
            false,
            query
        );

    }

}


function renderSearchPage(
    loading = false,
    query = ""
) {

    $("#content").innerHTML = `
        <div class="page">

            <div class="search-heading">

                <div>

                    <div class="eyebrow">
                        DISCOVER
                    </div>

                    <h1>
                        ${query
                            ? `Results for "${escapeHtml(query)}"`
                            : "Search"}
                    </h1>

                </div>

                <span
                    class="search-result-count"
                >
                    ${
                        loading
                            ? "Searching..."
                            : `${state.searchResults.length} results`
                    }
                </span>

            </div>


            ${
                loading
                    ? `
                        <div class="empty-state">

                            <div class="empty-icon">
                                /
                            </div>

                            <h3>
                                Searching
                            </h3>

                            <p>
                                Finding music for you...
                            </p>

                        </div>
                    `
                    : state.searchResults.length
                        ? `
                            <div
                                class="results"
                                id="search-results"
                            ></div>
                        `
                        : `
                            <div class="empty-state">

                                <div class="empty-icon">
                                    /
                                </div>

                                <h3>
                                    Find something to play
                                </h3>

                                <p>
                                    Search for a song,
                                    artist, album or anything
                                    else on YouTube.
                                </p>

                            </div>
                        `
            }

        </div>
    `;


    if (
        !loading &&
        state.searchResults.length
    ) {

        renderSearchResults();

    }

}


function renderSearchResults() {

    const container =
        $("#search-results");

    if (!container) return;


    container.innerHTML =
        state.searchResults
            .map(
                (song, index) =>
                    searchResultHTML(
                        song,
                        index
                    )
            )
            .join("");

}


function searchResultHTML(
    song,
    index
) {

    const liked =
        isLiked(song.id);


    return `
        <div
            class="search-result"
            style="animation-delay:${index * 25}ms"
        >

            <img
                class="result-cover"
                src="${song.thumbnail}"
                alt=""
                loading="lazy"
            >


            <div class="result-info">

                <div class="result-title">
                    ${escapeHtml(
                        song.title
                    )}
                </div>

                <div class="result-artist">
                    ${escapeHtml(
                        song.channel
                    )}
                </div>

            </div>


            <div class="result-actions">

                <button
                    class="result-button"
                    title="Like"
                    onclick="toggleLikeFromData(
                        ${index}
                    )"
                >
                    ${liked ? "*" : "+"}
                </button>

                <button
                    class="result-button"
                    title="Add to playlist"
                    onclick="openPlaylistFromSearch(
                        ${index}
                    )"
                >
                    +
                </button>

                <button
                    class="result-button"
                    title="Keep downloaded"
                    onclick="downloadSongFromSearch(
                        ${index},
                        true
                    )"
                >
                    =
                </button>

                <button
                    class="result-button result-play"
                    title="Play"
                    onclick="playFromSearch(
                        ${index}
                    )"
                >
                    >
                </button>

            </div>

        </div>
    `;

}


/* ============================================================
   SONG HELPERS
   ============================================================ */

function isLiked(id) {

    return state.liked.some(
        song => song.id === id
    );

}


function toggleLikeFromData(index) {

    const song =
        state.searchResults[index];

    if (song) {
        toggleLike(song);
    }

}


function toggleLike(song) {

    const index =
        state.liked.findIndex(
            item =>
                item.id === song.id
        );


    if (index === -1) {

        state.liked.push(
            normalizeSong(song)
        );

        saveLiked();


        notify(
            "Liked song",
            `"${song.title}" added to Liked Songs`,
            "+"
        );

    } else {

        state.liked.splice(
            index,
            1
        );

        saveLiked();


        notify(
            "Removed like",
            `"${song.title}" removed from Liked Songs`,
            "-"
        );

    }


    refreshCurrentPage();

}


function normalizeSong(song) {

    return {
        id: song.id,
        title: song.title,
        channel: song.channel,
        thumbnail: song.thumbnail,
        url: song.url,
        duration: song.duration || 0
    };

}


/* ============================================================
   PLAYLIST PICKER
   ============================================================ */

let playlistSongToAdd = null;


function openPlaylistFromSearch(index) {

    const song =
        state.searchResults[index];

    if (song) {
        openPlaylistModal(song);
    }

}


function openPlaylistModal(song) {

    playlistSongToAdd =
        normalizeSong(song);


    const modal =
        $("#playlist-modal");

    const list =
        $("#playlist-picker-list");


    list.innerHTML =
        state.playlists
            .map(
                playlistPickerItem
            )
            .join("");


    modal.classList.remove(
        "hidden"
    );

}


function closePlaylistModal() {

    $("#playlist-modal")
        .classList.add(
            "hidden"
        );

    playlistSongToAdd = null;

}


function playlistPickerItem(
    playlist
) {

    const image =
        playlist.image ||
        createFallbackImage(
            playlist.name
        );


    return `
        <button
            class="playlist-picker-item"
            onclick="addToPlaylist(
                '${playlist.id}'
            )"
        >

            <img
                class="playlist-picker-image"
                src="${image}"
                alt=""
            >

            <div
                class="playlist-picker-info"
            >

                <div
                    class="playlist-picker-name"
                >
                    ${escapeHtml(
                        playlist.name
                    )}
                </div>

                <div
                    class="playlist-picker-count"
                >
                    ${playlist.tracks.length}
                    ${
                        playlist.tracks.length === 1
                            ? "song"
                            : "songs"
                    }
                </div>

            </div>

        </button>
    `;

}


function addToPlaylist(
    playlistId
) {

    if (!playlistSongToAdd) {
        return;
    }


    const playlist =
        state.playlists.find(
            p => p.id === playlistId
        );


    if (!playlist) return;


    const exists =
        playlist.tracks.some(
            track =>
                track.id ===
                playlistSongToAdd.id
        );


    if (exists) {

        notify(
            "Already in playlist",
            `"${playlistSongToAdd.title}" is already there`,
            "="
        );

        closePlaylistModal();

        return;

    }


    playlist.tracks.push(
        normalizeSong(
            playlistSongToAdd
        )
    );


    savePlaylists();


    notify(
        "Added to playlist",
        `"${playlistSongToAdd.title}" -> ${playlist.name}`,
        "+"
    );


    closePlaylistModal();

    renderSidebar();

    refreshCurrentPage();

}


/* ============================================================
   PLAYLIST CREATION
   ============================================================ */

function setupModals() {

    $("#create-playlist-sidebar")
        .addEventListener(
            "click",
            openCreatePlaylistModal
        );


    $("#close-create-playlist")
        .addEventListener(
            "click",
            closeCreatePlaylistModal
        );


    $("#cancel-create-playlist")
        .addEventListener(
            "click",
            closeCreatePlaylistModal
        );


    $("#confirm-create-playlist")
        .addEventListener(
            "click",
            createPlaylist
        );


    $("#playlist-name-input")
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {
                    createPlaylist();
                }

            }
        );


    setupImagePreview(
        "#playlist-image-input",
        "#playlist-image-preview"
    );


    $("#close-delete-playlist")
        .addEventListener(
            "click",
            closeDeletePlaylistModal
        );


    $("#cancel-delete-playlist")
        .addEventListener(
            "click",
            closeDeletePlaylistModal
        );


    $("#delete-playlist-input")
        .addEventListener(
            "input",
            updateDeleteButton
        );


    $("#confirm-delete-playlist")
        .addEventListener(
            "click",
            deletePlaylist
        );


    $("#open-profile")
        .addEventListener(
            "click",
            openProfileModal
        );


    $("#top-profile")
        .addEventListener(
            "click",
            openProfileModal
        );


    $("#close-profile")
        .addEventListener(
            "click",
            closeProfileModal
        );


    $("#cancel-profile")
        .addEventListener(
            "click",
            closeProfileModal
        );


    $("#save-profile")
        .addEventListener(
            "click",
            saveProfileModal
        );


    setupImagePreview(
        "#profile-image-input",
        "#profile-preview"
    );

}


function openCreatePlaylistModal() {

    $("#playlist-name-input")
        .value = "";

    $("#playlist-image-input")
        .value = "";

    $("#playlist-image-preview")
        .innerHTML = "+";


    $("#create-playlist-modal")
        .classList.remove(
            "hidden"
        );


    setTimeout(
        () =>
            $("#playlist-name-input")
                .focus(),
        100
    );

}


function closeCreatePlaylistModal() {

    $("#create-playlist-modal")
        .classList.add(
            "hidden"
        );

}


async function createPlaylist() {

    const input =
        $("#playlist-name-input");

    const name =
        input.value.trim();


    if (!name) {

        notify(
            "Playlist name required",
            "Give your playlist a name.",
            "!"
        );

        input.focus();

        return;

    }


    const imageInput =
        $("#playlist-image-input");


    let image = null;


    if (
        imageInput.files &&
        imageInput.files[0]
    ) {

        image =
            await compressImage(
                imageInput.files[0]
            );

    }


    const playlist = {

        id:
            "playlist_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2),

        name,

        image,

        tracks: []

    };


    state.playlists.push(
        playlist
    );


    savePlaylists();

    closeCreatePlaylistModal();

    renderSidebar();

    refreshCurrentPage();


    notify(
        "Playlist created",
        `"${name}" is ready`,
        "+"
    );

}


/* ============================================================
   DELETE PLAYLIST
   ============================================================ */

let playlistPendingDelete = null;


function openDeletePlaylistModal(
    playlist
) {

    if (
        playlist.id === "liked"
    ) {

        notify(
            "Can't delete playlist",
            "Liked Songs is permanent.",
            "!"
        );

        return;

    }


    playlistPendingDelete =
        playlist;


    $("#delete-playlist-title")
        .textContent =
        playlist.name;


    $("#delete-playlist-input")
        .value = "";


    $("#confirm-delete-playlist")
        .disabled = true;


    $("#delete-playlist-modal")
        .classList.remove(
            "hidden"
        );


    setTimeout(
        () =>
            $("#delete-playlist-input")
                .focus(),
        100
    );

}


function updateDeleteButton() {

    if (
        !playlistPendingDelete
    ) {
        return;
    }


    const value =
        $("#delete-playlist-input")
            .value;


    $("#confirm-delete-playlist")
        .disabled =
            value !==
            playlistPendingDelete.name;

}


function closeDeletePlaylistModal() {

    $("#delete-playlist-modal")
        .classList.add(
            "hidden"
        );

    playlistPendingDelete =
        null;

}


function deletePlaylist() {

    if (
        !playlistPendingDelete
    ) {
        return;
    }


    const playlist =
        playlistPendingDelete;


    if (
        $("#delete-playlist-input")
            .value !== playlist.name
    ) {
        return;
    }


    state.playlists =
        state.playlists.filter(
            p =>
                p.id !== playlist.id
        );


    savePlaylists();


    closeDeletePlaylistModal();


    notify(
        "Playlist deleted",
        `"${playlist.name}" was deleted`,
        "x"
    );


    renderPage("home");

}


/* ============================================================
   PLAYLIST PAGE
   ============================================================ */

function renderPlaylistPage(
    playlist
) {

    const image =
        playlist.image ||
        createFallbackImage(
            playlist.name
        );


    $("#content").innerHTML = `
        <div class="page">

            <div class="playlist-hero">

                <div
                    class="playlist-large-image"
                >

                    <img
                        src="${image}"
                        alt=""
                    >

                </div>


                <div
                    class="playlist-detail-info"
                >

                    <div class="eyebrow">
                        PLAYLIST
                    </div>

                    <h1>
                        ${escapeHtml(
                            playlist.name
                        )}
                    </h1>

                    <p>
                        ${playlist.tracks.length}
                        ${
                            playlist.tracks.length === 1
                                ? "song"
                                : "songs"
                        }
                    </p>


                    <div
                        class="playlist-detail-actions"
                    >

                        ${
                            playlist.tracks.length
                                ? `
                                    <button
                                        class="accent-button"
                                        onclick="playPlaylist()"
                                    >
                                        Play
                                    </button>
                                `
                                : ""
                        }


                        ${
                            playlist.id !== "liked"
                                ? `
                                    <button
                                        class="playlist-delete"
                                        onclick="openDeletePlaylistModal(
                                            state.currentPlaylist
                                        )"
                                    >
                                        Delete
                                    </button>
                                `
                                : ""
                        }

                    </div>

                </div>

            </div>


            <div class="section">

                ${
                    playlist.tracks.length
                        ? `
                            <div
                                class="results"
                                id="playlist-tracks"
                            ></div>
                        `
                        : `
                            <div class="empty-state">

                                <div class="empty-icon">
                                    +
                                </div>

                                <h3>
                                    This playlist is empty
                                </h3>

                                <p>
                                    Search for music and
                                    add songs here.
                                </p>

                            </div>
                        `
                }

            </div>

        </div>
    `;


    if (playlist.tracks.length) {

        $("#playlist-tracks")
            .innerHTML =
                playlist.tracks
                    .map(
                        playlistTrackHTML
                    )
                    .join("");

    }

}


function playlistTrackHTML(
    song,
    index
) {

    return `
        <div class="search-result">

            <img
                class="result-cover"
                src="${song.thumbnail}"
                alt=""
                loading="lazy"
            >

            <div class="result-info">

                <div class="result-title">
                    ${escapeHtml(
                        song.title
                    )}
                </div>

                <div class="result-artist">
                    ${escapeHtml(
                        song.channel
                    )}
                </div>

            </div>

            <div class="result-actions">

                <button
                    class="result-button"
                    onclick="removeFromCurrentPlaylist(
                        ${index}
                    )"
                >
                    -
                </button>

                <button
                    class="result-button result-play"
                    onclick="playPlaylistTrack(
                        ${index}
                    )"
                >
                    >
                </button>

            </div>

        </div>
    `;

}


function removeFromCurrentPlaylist(
    index
) {

    const playlist =
        state.currentPlaylist;

    if (!playlist) return;


    const song =
        playlist.tracks[index];


    playlist.tracks.splice(
        index,
        1
    );


    if (
        playlist.id === "liked"
    ) {

        state.liked =
            playlist.tracks;

        saveLiked();

    } else {

        savePlaylists();

    }


    notify(
        "Removed from playlist",
        `"${song.title}" removed from ${playlist.name}`,
        "-"
    );


    renderPlaylistPage(
        playlist
    );

    renderSidebar();

}


function playPlaylist() {

    const playlist =
        state.currentPlaylist;

    if (
        !playlist ||
        !playlist.tracks.length
    ) {
        return;
    }


    state.queue =
        [...playlist.tracks];

    state.queueIndex = 0;

    playSong(
        state.queue[0]
    );

}


function playPlaylistTrack(
    index
) {

    const playlist =
        state.currentPlaylist;

    state.queue =
        [...playlist.tracks];

    state.queueIndex =
        index;

    playSong(
        state.queue[index]
    );

}


/* ============================================================
   LIKED PAGE
   ============================================================ */

function renderLikedPage() {

    const playlist =
        state.playlists.find(
            p => p.id === "liked"
        );


    state.currentPlaylist =
        playlist;


    renderPlaylistPage(
        playlist
    );

}


/* ============================================================
   CACHE
   ============================================================ */

async function refreshCache() {

    try {

        const response =
            await fetch(
                "/api/cache"
            );


        const data =
            await response.json();


        if (data.success) {

            state.cached =
                data.songs || [];

        }

    } catch (error) {

        console.error(
            "Cache error:",
            error
        );

    }

}


function renderCachePage() {

    $("#content").innerHTML = `
        <div class="page">

            <div class="page-header">

                <div class="eyebrow">
                    LOCAL STORAGE
                </div>

                <h1>
                    Cached songs
                </h1>

                <p>
                    Music you've chosen to keep
                    on your local Pysic server.
                </p>

            </div>


            ${
                state.cached.length
                    ? `
                        <div
                            class="results"
                            id="cache-results"
                        ></div>
                    `
                    : `
                        <div class="empty-state">

                            <div class="empty-icon">
                                =
                            </div>

                            <h3>
                                Your cache is empty
                            </h3>

                            <p>
                                Use the "=" button on a song
                                to keep it downloaded.
                            </p>

                        </div>
                    `
            }

        </div>
    `;


    if (state.cached.length) {

        $("#cache-results")
            .innerHTML =
                state.cached
                    .map(
                        cachedSongRow
                    )
                    .join("");

    }

}


function cachedSongRow(
    item
) {

    return `
        <div class="cache-row">

            <img
                class="cache-cover"
                src="${item.thumbnail}"
                alt=""
                loading="lazy"
            >

            <div class="result-info">

                <div class="result-title">
                    ${escapeHtml(
                        item.title
                    )}
                </div>

                <div class="result-artist">
                    ${escapeHtml(
                        item.channel
                    )}
                </div>

            </div>


            <div class="cache-actions">

                <button
                    class="result-button"
                    onclick="playCached(
                        '${item.cache_id}'
                    )"
                >
                    >
                </button>

                <a
                    class="result-button"
                    href="${item.file_url}"
                    download
                >
                    v
                </a>

                <button
                    class="result-button"
                    onclick="deleteCached(
                        '${item.cache_id}'
                    )"
                >
                    x
                </button>

            </div>

        </div>
    `;

}


async function playCached(
    cacheId
) {

    const cached =
        state.cached.find(
            item =>
                item.cache_id === cacheId
        );


    if (!cached) return;


    const song = {

        id: cached.video_id,

        title: cached.title,

        channel: cached.channel,

        thumbnail: cached.thumbnail,

        url:
            `https://www.youtube.com/watch?v=${cached.video_id}`

    };


    state.currentSong =
        song;

    state.currentJob =
        null;


    updatePlayerSong(
        song
    );


    audio.src =
        cached.file_url;


    try {

        await audio.play();

        state.isPlaying = true;

        updatePlayButton();

    } catch (error) {

        notify(
            "Playback failed",
            error.message,
            "!"
        );

    }

}


async function deleteCached(
    cacheId
) {

    const cached =
        state.cached.find(
            item =>
                item.cache_id === cacheId
        );


    if (!cached) return;


    try {

        const response =
            await fetch(
                `/api/cache/${cacheId}`,
                {
                    method: "DELETE"
                }
            );


        const data =
            await response.json();


        if (!data.success) {
            throw new Error(
                data.error
            );
        }


        state.cached =
            state.cached.filter(
                item =>
                    item.cache_id !==
                    cacheId
            );


        notify(
            "Removed from cache",
            `"${cached.title}" deleted`,
            "-"
        );


        renderCachePage();


    } catch (error) {

        notify(
            "Couldn't remove song",
            error.message,
            "!"
        );

    }

}


/* ============================================================
   PLAYBACK
   ============================================================ */

async function playFromSearch(
    index
) {

    const song =
        state.searchResults[index];

    if (!song) return;


    state.queue =
        [...state.searchResults];

    state.queueIndex =
        index;


    await playSong(
        song
    );

}


async function playSong(
    song,
    keep = false
) {

    const cached =
        state.cached.find(
            item =>
                item.video_id === song.id
        );


    if (cached) {

        state.currentSong =
            song;

        state.currentJob =
            null;


        updatePlayerSong(
            song
        );


        audio.src =
            cached.file_url;


        try {

            await audio.play();

            state.isPlaying = true;

            updatePlayButton();

        } catch (error) {

            notify(
                "Playback failed",
                error.message,
                "!"
            );

        }

        return;

    }


    notify(
        "Downloading",
        `"${song.title}"`,
        ">"
    );


    try {

        const response =
            await fetch(
                "/api/download",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        song,
                        keep
                    })
                }
            );


        const data =
            await response.json();


        if (!data.success) {

            throw new Error(
                data.error
            );

        }


        state.currentSong =
            song;

        state.currentJob =
            data.job_id;


        updatePlayerSong(
            song
        );


        const toast =
            createDownloadToast(
                song
            );


        const result =
            await waitForDownload(
                data.job_id,
                toast
            );


        if (
            keep &&
            result.cached
        ) {

            await refreshCache();

        }


        notify(
            "Download complete",
            `"${song.title}" is ready`,
            "+"
        );


        const playbackUrl =
            result.url;


        audio.src =
            playbackUrl;


        try {

            await audio.play();

            state.isPlaying =
                true;

            updatePlayButton();

        } catch (error) {

            notify(
                "Playback blocked",
                "Press play to start the song.",
                "!"
            );

        }


    } catch (error) {

        notify(
            "Download failed",
            error.message,
            "!"
        );

    }

}


async function downloadSongFromSearch(
    index,
    keep = true
) {

    const song =
        state.searchResults[index];

    if (!song) return;


    await playSong(
        song,
        keep
    );

}


/* ============================================================
   DOWNLOAD UI
   ============================================================ */

function createDownloadToast(
    song
) {

    const container =
        $("#toast-container");


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "toast";


    const jobId =
        "progress-" +
        Date.now();


    toast.innerHTML = `

        <div class="toast-icon">
            >
        </div>

        <div class="toast-content">

            <div class="toast-title">
                Downloading
            </div>

            <div class="toast-message">
                ${escapeHtml(
                    song.title
                )}
            </div>

        </div>

        <div class="download-progress">

            <div
                class="download-progress-bar"
                id="${jobId}"
            ></div>

        </div>

    `;


    container.appendChild(
        toast
    );


    toast.dataset.progressId =
        jobId;


    return toast;

}


async function waitForDownload(
    jobId,
    toast
) {

    while (true) {

        const response =
            await fetch(
                `/api/download/${jobId}`
            );


        const data =
            await response.json();


        const progress =
            document.getElementById(
                toast.dataset.progressId
            );


        if (progress) {

            progress.style.width =
                `${data.progress || 0}%`;

        }


        if (
            data.status ===
            "finished"
        ) {

            removeToast(
                toast
            );

            return data;

        }


        if (
            data.status ===
            "error"
        ) {

            removeToast(
                toast
            );

            throw new Error(
                data.error ||
                "Download failed."
            );

        }


        await sleep(
            250
        );

    }

}


/* ============================================================
   AUDIO EVENTS
   ============================================================ */

function setupPlayer() {

    $("#play-button")
        .addEventListener(
            "click",
            togglePlayback
        );


    $("#previous-button")
        .addEventListener(
            "click",
            previousSong
        );


    $("#next-button")
        .addEventListener(
            "click",
            nextSong
        );


    $("#skip-back-button")
        .addEventListener(
            "click",
            () => {
                audio.currentTime =
                    Math.max(
                        0,
                        audio.currentTime - 10
                    );
            }
        );


    $("#skip-forward-button")
        .addEventListener(
            "click",
            () => {
                audio.currentTime =
                    Math.min(
                        audio.duration || 0,
                        audio.currentTime + 10
                    );
            }
        );


    $("#loop-button")
        .addEventListener(
            "click",
            toggleLoop
        );


    $("#player-like")
        .addEventListener(
            "click",
            () => {

                if (
                    state.currentSong
                ) {

                    toggleLike(
                        state.currentSong
                    );

                    updatePlayerLike();

                }

            }
        );


    $("#progress")
        .addEventListener(
            "input",
            event => {

                if (
                    !audio.duration
                ) {
                    return;
                }

                audio.currentTime =
                    (
                        Number(
                            event.target.value
                        ) / 100
                    ) *
                    audio.duration;

            }
        );


    $("#volume")
        .value =
            localStorage.getItem(
                KEYS.volume
            ) || "0.8";


    audio.volume =
        Number(
            $("#volume").value
        );


    $("#volume")
        .addEventListener(
            "input",
            event => {

                audio.volume =
                    Number(
                        event.target.value
                    );

                localStorage.setItem(
                    KEYS.volume,
                    audio.volume
                );

            }
        );


    audio.addEventListener(
        "timeupdate",
        updateProgress
    );


    audio.addEventListener(
        "loadedmetadata",
        updateProgress
    );


    audio.addEventListener(
        "play",
        () => {

            state.isPlaying = true;

            updatePlayButton();

        }
    );


    audio.addEventListener(
        "pause",
        () => {

            state.isPlaying = false;

            updatePlayButton();

        }
    );


    audio.addEventListener(
        "ended",
        handleSongEnded
    );


    updatePlayButton();

    updateLoopButton();

}


function togglePlayback() {

    if (!state.currentSong) {

        if (
            state.searchResults.length
        ) {

            playFromSearch(0);

        } else {

            focusSearch();

        }

        return;

    }


    if (audio.paused) {

        audio.play();

    } else {

        audio.pause();

    }

}


function updatePlayButton() {

    $("#play-button")
        .textContent =
            state.isPlaying
                ? "||"
                : ">";

}


function updateProgress() {

    if (!audio.duration) {

        $("#progress")
            .value = 0;

        $("#current-time")
            .textContent = "0:00";

        return;

    }


    const percent =
        (
            audio.currentTime /
            audio.duration
        ) * 100;


    $("#progress")
        .value =
        percent;


    $("#current-time")
        .textContent =
        formatTime(
            audio.currentTime
        );


    $("#duration-time")
        .textContent =
        formatTime(
            audio.duration
        );

}


function formatTime(
    seconds
) {

    if (
        !Number.isFinite(
            seconds
        )
    ) {
        return "0:00";
    }


    seconds =
        Math.floor(
            seconds
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remaining =
        seconds % 60;


    return `${minutes}:${String(
        remaining
    ).padStart(2, "0")}`;

}


/* ============================================================
   QUEUE
   ============================================================ */

async function nextSong() {

    if (
        !state.queue.length
    ) {
        return;
    }


    if (
        state.queueIndex <
        state.queue.length - 1
    ) {

        state.queueIndex++;

    } else {

        state.queueIndex = 0;

    }


    await playSong(
        state.queue[
            state.queueIndex
        ]
    );

}


async function previousSong() {

    if (
        audio.currentTime > 4
    ) {

        audio.currentTime = 0;

        return;

    }


    if (
        !state.queue.length
    ) {
        return;
    }


    if (
        state.queueIndex > 0
    ) {

        state.queueIndex--;

    } else {

        state.queueIndex =
            state.queue.length - 1;

    }


    await playSong(
        state.queue[
            state.queueIndex
        ]
    );

}


async function handleSongEnded() {

    if (
        state.loop
    ) {

        audio.currentTime = 0;

        await audio.play();

        return;

    }


    if (
        state.currentJob
    ) {

        cleanupCurrentJob();

    }


    if (
        state.queue.length
    ) {

        await nextSong();

    } else {

        state.isPlaying = false;

        updatePlayButton();

    }

}


async function cleanupCurrentJob() {

    const job =
        state.currentJob;


    if (!job) return;


    try {

        await fetch(
            `/api/download/${job}/cleanup`,
            {
                method: "POST"
            }
        );

    } catch {

        // Nothing to do.
    }


    state.currentJob =
        null;

}


/* ============================================================
   LOOP
   ============================================================ */

function toggleLoop() {

    state.loop =
        !state.loop;


    localStorage.setItem(
        KEYS.loop,
        state.loop
    );


    updateLoopButton();


    notify(
        state.loop
            ? "Loop enabled"
            : "Loop disabled",
        state.loop
            ? "The current song will repeat."
            : "Playback will continue normally.",
        "@"
    );

}


function updateLoopButton() {

    $("#loop-button")
        .classList.toggle(
            "active",
            state.loop
        );

    $("#loop-button")
        .style.color =
            state.loop
                ? "var(--accent)"
                : "";

}


/* ============================================================
   PLAYER UI
   ============================================================ */

function updatePlayerSong(
    song
) {

    $("#player-title")
        .textContent =
        song.title;


    $("#player-artist")
        .textContent =
        song.channel;


    $("#player-cover")
        .innerHTML = `
            <img
                src="${song.thumbnail}"
                alt=""
            >
        `;


    updatePlayerLike();

}


function updatePlayerLike() {

    const button =
        $("#player-like");


    const liked =
        state.currentSong &&
        isLiked(
            state.currentSong.id
        );


    button.classList.toggle(
        "liked",
        Boolean(liked)
    );


    button.textContent =
        liked ? "*" : "+";

}


/* ============================================================
   PROFILE MODAL
   ============================================================ */

function openProfileModal() {

    const profile =
        getProfile();


    $("#profile-name-input")
        .value =
        profile.name || "Listener";


    if (profile.image) {

        $("#profile-preview")
            .innerHTML = `
                <img
                    src="${profile.image}"
                    alt=""
                >
            `;

    } else {

        $("#profile-preview")
            .textContent =
            getInitials(
                profile.name
            );

    }


    $("#profile-modal")
        .classList.remove(
            "hidden"
        );

}


function closeProfileModal() {

    $("#profile-modal")
        .classList.add(
            "hidden"
        );

}


async function saveProfileModal() {

    const oldProfile =
        getProfile();


    const name =
        $("#profile-name-input")
            .value.trim()
        || "Listener";


    let image =
        oldProfile.image || null;


    const input =
        $("#profile-image-input");


    if (
        input.files &&
        input.files[0]
    ) {

        image =
            await compressImage(
                input.files[0]
            );

    }


    saveProfile({
        name,
        image
    });


    updateProfileUI();

    closeProfileModal();


    notify(
        "Profile updated",
        "Your profile changes were saved.",
        "+"
    );

}


/* ============================================================
   IMAGE HANDLING
   ============================================================ */

function setupImagePreview(
    inputSelector,
    previewSelector
) {

    const input =
        $(inputSelector);

    const preview =
        $(previewSelector);


    if (!input || !preview) {
        return;
    }


    input.addEventListener(
        "change",
        async () => {

            if (
                !input.files ||
                !input.files[0]
            ) {
                return;
            }


            const data =
                await compressImage(
                    input.files[0],
                    256
                );


            preview.innerHTML = `
                <img
                    src="${data}"
                    alt=""
                >
            `;

        }
    );

}


function compressImage(
    file,
    size = 512
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload = event => {

                const image =
                    new Image();


                image.onload = () => {

                    let width =
                        image.width;

                    let height =
                        image.height;


                    const scale =
                        Math.min(
                            1,
                            size /
                            Math.max(
                                width,
                                height
                            )
                        );


                    width *= scale;
                    height *= scale;


                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    canvas.width =
                        width;

                    canvas.height =
                        height;


                    const context =
                        canvas.getContext(
                            "2d"
                        );


                    context.drawImage(
                        image,
                        0,
                        0,
                        width,
                        height
                    );


                    resolve(
                        canvas.toDataURL(
                            "image/jpeg",
                            .82
                        )
                    );

                };


                image.onerror =
                    reject;


                image.src =
                    event.target.result;

            };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* ============================================================
   SIDEBAR
   ============================================================ */

function renderSidebar() {

    const container =
        $("#sidebar-playlists");


    container.innerHTML =
        state.playlists
            .map(
                playlist =>
                    `
                        <button
                            class="
                                sidebar-playlist
                                ${
                                    state.currentPlaylist &&
                                    state.currentPlaylist.id ===
                                    playlist.id
                                        ? "active"
                                        : ""
                                }
                            "
                            onclick="showPlaylist(
                                '${playlist.id}'
                            )"
                        >

                            <img
                                class="
                                    sidebar-playlist-image
                                "
                                src="${
                                    playlist.image ||
                                    createFallbackImage(
                                        playlist.name
                                    )
                                }"
                                alt=""
                            >

                            <span
                                class="
                                    sidebar-playlist-name
                                "
                            >
                                ${escapeHtml(
                                    playlist.name
                                )}
                            </span>

                        </button>
                    `
            )
            .join("");

}


/* ============================================================
   UTILITIES
   ============================================================ */

function refreshCurrentPage() {

    if (
        state.currentPlaylist
    ) {

        const playlist =
            state.playlists.find(
                p =>
                    p.id ===
                    state.currentPlaylist.id
            );


        if (playlist) {

            state.currentPlaylist =
                playlist;

            renderPlaylistPage(
                playlist
            );

        } else {

            renderPage(
                "home"
            );

        }

        renderSidebar();

        return;

    }


    renderPage(
        state.page
    );

}


function createFallbackImage(
    name
) {

    const initials =
        getInitials(name);


    const svg = `
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="512"
            height="512"
            viewBox="0 0 512 512"
        >

            <rect
                width="512"
                height="512"
                fill="#15151b"
            />

            <text
                x="256"
                y="290"
                text-anchor="middle"
                font-family="Arial"
                font-size="170"
                font-weight="700"
                fill="white"
            >
                ${initials}
            </text>

        </svg>
    `;


    return (
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(svg)
    );

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


/* ============================================================
   TOASTS
   ============================================================ */

function notify(
    title,
    message = "",
    icon = ">"
) {

    const container =
        $("#toast-container");


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "toast";


    toast.innerHTML = `

        <div class="toast-icon">
            ${escapeHtml(icon)}
        </div>

        <div class="toast-content">

            <div class="toast-title">
                ${escapeHtml(title)}
            </div>

            ${
                message
                    ? `
                        <div class="toast-message">
                            ${escapeHtml(
                                message
                            )}
                        </div>
                    `
                    : ""
            }

        </div>

    `;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            removeToast(
                toast
            );

        },
        3300
    );


    return toast;

}


function removeToast(
    toast
) {

    if (!toast) return;


    toast.classList.add(
        "removing"
    );


    setTimeout(
        () => {

            if (
                toast.isConnected
            ) {
                toast.remove();
            }

        },
        250
    );

}


/* ============================================================
   GLOBAL BACK/FORWARD
   ============================================================ */

$("#back-button")
    .addEventListener(
        "click",
        () => {

            if (
                state.page === "search"
            ) {

                renderPage(
                    "home"
                );

            } else {

                renderPage(
                    "home"
                );

            }

        }
    );


$("#forward-button")
    .addEventListener(
        "click",
        () => {

            if (
                state.searchResults.length
            ) {

                renderPage(
                    "search"
                );

            }

        }
    );


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.target.matches(
                "input, textarea"
            )
        ) {
            return;
        }


        if (
            event.code === "Space"
        ) {

            event.preventDefault();

            togglePlayback();

        }


        if (
            event.code === "ArrowRight"
        ) {

            audio.currentTime =
                Math.min(
                    audio.duration || 0,
                    audio.currentTime + 5
                );

        }


        if (
            event.code === "ArrowLeft"
        ) {

            audio.currentTime =
                Math.max(
                    0,
                    audio.currentTime - 5
                );

        }

    }
);