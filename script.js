
const API_KEY = "f68397bec9b266a5646c2197f99648c0";
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/";

let currentContent = null;
let moviePage = 1;
let seriesPage = 1;
let searchTimeout;
let requestVersion = { movie: 0, tv: 0 };

const GENRES = {
  movie: [],
  tv: []
};

const $ = id => document.getElementById(id);

async function apiRequest(endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${endpoint}${separator}api_key=${API_KEY}&language=it-IT`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDb ha restituito l'errore ${response.status}`);
  }

  return response.json();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function createCard(item, type) {
  const title = item.title || item.name || "Senza titolo";
  const poster = item.poster_path
    ? IMAGE_URL + "w342" + item.poster_path
    : "";

  const rating = Number(item.vote_average || 0).toFixed(1);

  return `
    <div class="movie-card" onclick="openDetails(${Number(item.id)}, '${type}')">
      <img src="${poster}" alt="${escapeHTML(title)}" loading="lazy">
      <p>${escapeHTML(title)}</p>
      <span class="card-rating">★ ${rating}</span>
    </div>
  `;
}

function renderResults(container, results, type) {
  container.innerHTML = results.length
    ? results.map(item => createCard(item, type)).join("")
    : '<p class="empty-message">Nessun contenuto trovato.</p>';
}

function renderMixedResults(container, results) {
  container.innerHTML = results.length
    ? results
        .filter(item => item.media_type === "movie" || item.media_type === "tv")
        .map(item => createCard(item, item.media_type))
        .join("")
    : '<p class="empty-message">Nessun risultato trovato.</p>';
}

async function loadPopularMovies() {
  const container = $("popular-movies");
  container.innerHTML = '<p class="empty-message">Caricamento film...</p>';

  try {
    const data = await apiRequest("/movie/popular");
    renderResults(container, data.results, "movie");
  } catch (error) {
    container.innerHTML = '<p class="empty-message">Errore nel caricamento dei film.</p>';
    console.error(error);
  }
}

async function loadPopularSeries() {
  const container = $("popular-series");
  container.innerHTML = '<p class="empty-message">Caricamento serie TV...</p>';

  try {
    const data = await apiRequest("/tv/popular");
    renderResults(container, data.results, "tv");
  } catch (error) {
    container.innerHTML = '<p class="empty-message">Errore nel caricamento delle serie.</p>';
    console.error(error);
  }
}

async function loadTopRated() {
  const container = $("top-rated");
  container.innerHTML = '<p class="empty-message">Caricamento...</p>';

  try {
    const data = await apiRequest("/movie/top_rated");
    renderResults(container, data.results, "movie");
  } catch (error) {
    container.innerHTML = '<p class="empty-message">Errore nel caricamento.</p>';
    console.error(error);
  }
}

async function loadGenres() {
  try {
    const [movies, series] = await Promise.all([
      apiRequest("/genre/movie/list"),
      apiRequest("/genre/tv/list")
    ]);

    GENRES.movie = movies.genres || [];
    GENRES.tv = series.genres || [];

    fillGenreSelect("movie-genre", GENRES.movie);
    fillGenreSelect("series-genre", GENRES.tv);
    renderHomeGenres();
  } catch (error) {
    console.error("Errore nel caricamento dei generi:", error);
  }
}

function fillGenreSelect(id, genres) {
  const select = $(id);
  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = '<option value="">Tutti i generi</option>' +
    genres.map(genre =>
      `<option value="${genre.id}">${escapeHTML(genre.name)}</option>`
    ).join("");

  select.value = previousValue;
}

function renderHomeGenres() {
  const container = $("home-genres");

  const genres = GENRES.movie.slice(0, 12);

  container.innerHTML = genres.map(genre => `
    <button class="genre-chip"
      onclick="openGenre(${genre.id}, 'movie')">
      ${escapeHTML(genre.name)}
    </button>
  `).join("");
}

function openGenre(genreId, type) {
  showPage(type === "movie" ? "movies" : "series");

  const select = $(type === "movie" ? "movie-genre" : "series-genre");
  select.value = String(genreId);

  if (type === "movie") loadMovies();
  else loadSeries();
}

async function loadMovies(loadMore = false) {
  if (!loadMore) moviePage = 1;

  const version = ++requestVersion.movie;
  const container = $("movies-list");

  if (!loadMore) {
    container.innerHTML = '<p class="empty-message">Caricamento film...</p>';
  }

  const genre = $("movie-genre").value;
  const sort = $("movie-sort").value;
  const year = $("movie-year").value.trim();
  const rating = $("movie-rating").value.trim();

  const params = new URLSearchParams({
    sort_by: sort,
    page: String(loadMore ? moviePage + 1 : 1)
  });

  if (genre) params.set("with_genres", genre);
  if (year) params.set("primary_release_year", year);
  if (rating && Number(rating) >= 0 && Number(rating) <= 10) {
    params.set("vote_average.gte", rating);
    params.set("vote_count.gte", "10");
  }

  try {
    const data = await apiRequest(`/discover/movie?${params.toString()}`);

    if (version !== requestVersion.movie) return;

    if (loadMore) {
      moviePage++;
      container.insertAdjacentHTML(
        "beforeend",
        data.results.map(item => createCard(item, "movie")).join("")
      );
    } else {
      renderResults(container, data.results, "movie");
    }

    $("movies-more").style.display =
      moviePage < data.total_pages ? "block" : "none";

  } catch (error) {
    if (version !== requestVersion.movie) return;
    container.innerHTML = '<p class="empty-message">Errore nel caricamento dei film.</p>';
    console.error(error);
  }
}

async function loadSeries(loadMore = false) {
  if (!loadMore) seriesPage = 1;

  const version = ++requestVersion.tv;
  const container = $("series-list");

  if (!loadMore) {
    container.innerHTML = '<p class="empty-message">Caricamento serie...</p>';
  }

  const genre = $("series-genre").value;
  const sort = $("series-sort").value;
  const year = $("series-year").value.trim();
  const rating = $("series-rating").value.trim();

  const params = new URLSearchParams({
    sort_by: sort,
    page: String(loadMore ? seriesPage + 1 : 1)
  });

  if (genre) params.set("with_genres", genre);
  if (year) params.set("first_air_date_year", year);
  if (rating && Number(rating) >= 0 && Number(rating) <= 10) {
    params.set("vote_average.gte", rating);
    params.set("vote_count.gte", "10");
  }

  try {
    const data = await apiRequest(`/discover/tv?${params.toString()}`);

    if (version !== requestVersion.tv) return;

    if (loadMore) {
      seriesPage++;
      container.insertAdjacentHTML(
        "beforeend",
        data.results.map(item => createCard(item, "tv")).join("")
      );
    } else {
      renderResults(container, data.results, "tv");
    }

    $("series-more").style.display =
      seriesPage < data.total_pages ? "block" : "none";

  } catch (error) {
    if (version !== requestVersion.tv) return;
    container.innerHTML = '<p class="empty-message">Errore nel caricamento delle serie.</p>';
    console.error(error);
  }
}

function searchContent() {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    const query = $("search-input").value.trim();
    const container = $("search-results");

    if (!query) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = '<p class="empty-message">Ricerca in corso...</p>';

    try {
      const data = await apiRequest(
        `/search/multi?query=${encodeURIComponent(query)}`
      );

      renderMixedResults(container, data.results || []);
    } catch (error) {
      container.innerHTML = '<p class="empty-message">Errore durante la ricerca.</p>';
      console.error(error);
    }
  }, 350);
}

async function openDetails(id, type) {
  $("details-modal").classList.add("active");

  currentContent = null;

  $("details-title").textContent = "Caricamento...";
  $("details-image").src = "";
  $("details-meta").textContent = "";
  $("details-rating").textContent = "";
  $("details-genres").innerHTML = "";
  $("details-overview").textContent = "";
  $("details-cast").innerHTML = "";
  $("details-tmdb-id").textContent = "...";
  $("trailer-container").innerHTML = "";
  $("similar-list").innerHTML = "";
  $("favorite-button").textContent = "♡ Aggiungi ai preferiti";

  try {
    const [data, credits, videos, similar] = await Promise.all([
      apiRequest(`/${type}/${id}`),
      apiRequest(`/${type}/${id}/credits`),
      apiRequest(`/${type}/${id}/videos`),
      apiRequest(`/${type}/${id}/similar`)
    ]);

    const title = data.title || data.name;
    const date = data.release_date || data.first_air_date || "";
    const year = date ? date.slice(0, 4) : "Anno sconosciuto";

    currentContent = {
      id: data.id,
      title,
      type
    };

    $("details-title").textContent = title;
    $("details-image").src = data.poster_path
      ? IMAGE_URL + "w500" + data.poster_path
      : "";

    $("details-meta").textContent =
      `${year} · ${type === "movie" ? "Film" : "Serie TV"}`;

    $("details-rating").textContent =
      `★ ${Number(data.vote_average || 0).toFixed(1)} / 10`;

    $("details-overview").textContent =
      data.overview || "Descrizione non disponibile.";

    $("details-tmdb-id").textContent = data.id;

    const genres = data.genres || [];
    $("details-genres").innerHTML = genres.map(genre =>
      `<span class="genre-chip">${escapeHTML(genre.name)}</span>`
    ).join("");

    const cast = (credits.cast || []).slice(0, 10);

    $("details-cast").innerHTML = cast.length
      ? cast.map(person =>
          `<span class="cast-person">${escapeHTML(person.name)}</span>`
        ).join("")
      : '<span class="empty-message">Cast non disponibile.</span>';

    const trailer = (videos.results || []).find(video =>
      video.site === "YouTube" &&
      (video.type === "Trailer" || video.type === "Teaser")
    );

    if (trailer) {
      $("trailer-container").innerHTML = `
        <h3>Trailer</h3>
        <iframe
          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}"
          title="Trailer"
          allowfullscreen
          loading="lazy">
        </iframe>
      `;
    }

    const similarItems = (similar.results || []).slice(0, 6);

    $("similar-list").innerHTML = similarItems.length
      ? similarItems.map(item => createCard(item, type)).join("")
      : '<p class="empty-message">Nessun contenuto simile disponibile.</p>';

    updateFavoriteButton();

  } catch (error) {
    $("details-title").textContent = "Errore nel caricamento dei dettagli.";
    console.error(error);
  }
}

function closeDetails() {
  $("details-modal").classList.remove("active");
}

async function copyTmdbId() {
  const id = $("details-tmdb-id").textContent.trim();

  if (!id || id === "...") {
    alert("ID TMDb non disponibile.");
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(id);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = id;
      document.body.appendChild(textarea);
      textarea.select();

      const copied = document.execCommand("copy");
      textarea.remove();

      if (!copied) throw new Error("Copia non riuscita");
    }

    alert("ID TMDb copiato!");
  } catch (error) {
    alert("Impossibile copiare l'ID.");
  }
}

// Preferiti

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("lumystream-favorites") || "[]");
  } catch {
    return [];
  }
}

function isFavorite(content) {
  return getFavorites().some(item =>
    item.id === content.id && item.type === content.type
  );
}

function updateFavoriteButton() {
  if (!currentContent) return;

  $("favorite-button").textContent = isFavorite(currentContent)
    ? "♥ Rimuovi dai preferiti"
    : "♡ Aggiungi ai preferiti";
}

function toggleFavorite() {
  if (!currentContent) return;

  let favorites = getFavorites();

  if (isFavorite(currentContent)) {
    favorites = favorites.filter(item =>
      !(item.id === currentContent.id && item.type === currentContent.type)
    );
  } else {
    favorites.unshift(currentContent);
  }

  localStorage.setItem("lumystream-favorites", JSON.stringify(favorites));

  updateFavoriteButton();
  renderFavorites();
}

async function renderFavorites() {
  const container = $("favorites-list");
  const favorites = getFavorites();

  if (!favorites.length) {
    container.innerHTML = '<p class="empty-message">Non hai ancora aggiunto preferiti.</p>';
    return;
  }

  container.innerHTML = '<p class="empty-message">Caricamento preferiti...</p>';

  const results = await Promise.all(
    favorites.map(async item => {
      try {
        return await apiRequest(`/${item.type}/${item.id}`);
      } catch {
        return null;
      }
    })
  );

  const valid = results.filter(Boolean);

  container.innerHTML = valid.length
    ? valid.map(item => {
        const type = item.title ? "movie" : "tv";
        return createCard(item, type);
      }).join("")
    : '<p class="empty-message">Impossibile caricare i preferiti.</p>';
}

// Continua a guardare: registra i contenuti per cui è stato premuto Guarda.

function getContinueWatching() {
  try {
    return JSON.parse(localStorage.getItem("lumystream-recent") || "[]");
  } catch {
    return [];
  }
}

function saveRecent(content) {
  let recent = getContinueWatching();

  recent = recent.filter(item =>
    !(item.id === content.id && item.type === content.type)
  );

  recent.unshift({
    id: content.id,
    title: content.title,
    type: content.type,
    date: Date.now()
  });

  recent = recent.slice(0, 12);

  localStorage.setItem("lumystream-recent", JSON.stringify(recent));
  renderContinueWatching();
}

async function renderContinueWatching() {
  const container = $("continue-list");
  const recent = getContinueWatching();

  if (!recent.length) {
    container.innerHTML = '<p class="empty-message">I contenuti che aprirai appariranno qui.</p>';
    return;
  }

  const results = await Promise.all(
    recent.map(async item => {
      try {
        const data = await apiRequest(`/${item.type}/${item.id}`);
        return { data, type: item.type };
      } catch {
        return null;
      }
    })
  );

  container.innerHTML = results.filter(Boolean).map(item =>
    createCard(item.data, item.type)
  ).join("");
}

// Sorgente esterna

function saveSource() {
  const url = $("source-url").value.trim();
  const mode = $("source-mode").value;

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Protocollo non valido");
    }

    localStorage.setItem("lumystream-source", url);
    localStorage.setItem("lumystream-source-mode", mode);

    alert("Sorgente salvata!");
  } catch {
    alert("Inserisci un URL valido che inizi con http:// o https://");
  }
}

function removeSource() {
  localStorage.removeItem("lumystream-source");
  localStorage.removeItem("lumystream-source-mode");

  $("source-url").value = "";
  alert("Sorgente rimossa.");
}

function buildSourceUrl(content) {
  const template = localStorage.getItem("lumystream-source");

  if (!template) {
    alert("Configura prima una sorgente nelle impostazioni.");
    return null;
  }

  return template
    .replaceAll("{id}", encodeURIComponent(content.id))
    .replaceAll("{title}", encodeURIComponent(content.title))
    .replaceAll("{type}", encodeURIComponent(content.type));
}

function watchContent() {
  if (!currentContent) {
    alert("Seleziona prima un contenuto.");
    return;
  }

  const url = buildSourceUrl(currentContent);
  if (!url) return;

  saveRecent(currentContent);

  const mode = localStorage.getItem("lumystream-source-mode") || "embed";

  if (mode === "external") {
    window.open(url, "_blank", "noopener");
    return;
  }

  $("player-title").textContent = currentContent.title;
  $("external-player").src = url;
  $("player-modal").classList.add("active");
}

function closePlayer() {
  $("player-modal").classList.remove("active");
  $("external-player").src = "about:blank";
}

// Navigazione

function showPage(page) {
  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
  });

  const selected = $(`${page}-page`);
  if (selected) selected.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(element => {
    element.classList.toggle("active", element.dataset.page === page);
  });

  if (page === "movies") loadMovies();
  if (page === "series") loadSeries();
  if (page === "favorites") renderFavorites();
  if (page === "home") renderContinueWatching();
}

// Tema e impostazioni

function changeTheme() {
  const theme = $("theme-select").value;

  document.body.classList.toggle("light-theme", theme === "light");
  localStorage.setItem("lumystream-theme", theme);
}

function loadSettings() {
  $("source-url").value =
    localStorage.getItem("lumystream-source") || "";

  $("source-mode").value =
    localStorage.getItem("lumystream-source-mode") || "embed";

  const theme = localStorage.getItem("lumystream-theme") || "dark";

  $("theme-select").value = theme;
  document.body.classList.toggle("light-theme", theme === "light");
}

// Avvio

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    showPage(item.dataset.page);
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  loadSettings();

  await Promise.all([
    loadGenres(),
    loadPopularMovies(),
    loadPopularSeries(),
    loadTopRated(),
    renderContinueWatching()
  ]);
});
