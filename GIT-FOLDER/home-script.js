const API =
    "https://cloudflareworker.workers.dev";


/*
============================================================
Page elements
============================================================
*/

const statusMessage =
    document.getElementById("statusMessage");

const videoGrid =
    document.getElementById("videoGrid");

const pagination =
    document.getElementById("pagination");

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const pageIndicator =
    document.getElementById("pageIndicator");

const searchForm =
    document.getElementById("searchForm");

const searchInput =
    document.getElementById("searchInput");

const searchButton =
    document.getElementById("searchButton");

const clearSearchButton =
    document.getElementById("clearSearchButton");

const pageTitle =
    document.getElementById("pageTitle");

const pageSubtitle =
    document.getElementById("pageSubtitle");


/*
============================================================
Current page state
============================================================
*/

let currentPage = 1;
let currentQuery = "";


/*
============================================================
Initialization
============================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    initializeHomepage
);


function initializeHomepage() {
    const state =
        readStateFromUrl();

    currentPage =
        state.page;

    currentQuery =
        state.query;

    if (searchInput) {
        searchInput.value =
            currentQuery;
    }

    updateSearchInterface();

    loadVideos(
        currentPage,
        currentQuery,
        false
    );
}


/*
============================================================
Search events
============================================================
*/

searchForm?.addEventListener(
    "submit",
    event => {
        event.preventDefault();

        const query =
            normalizeSearchQuery(
                searchInput?.value || ""
            );

        if (query.length < 2) {
            showError(
                "Search must contain at least 2 characters."
            );

            searchInput?.focus();

            return;
        }

        currentQuery =
            query;

        currentPage = 1;

        if (searchInput) {
            searchInput.value =
                currentQuery;
        }

        updateSearchInterface();

        loadVideos(
            currentPage,
            currentQuery
        );
    }
);


clearSearchButton?.addEventListener(
    "click",
    () => {
        currentQuery = "";
        currentPage = 1;

        if (searchInput) {
            searchInput.value = "";
        }

        updateSearchInterface();

        loadVideos(
            currentPage,
            currentQuery
        );

        searchInput?.focus();
    }
);


/*
============================================================
Pagination events
============================================================
*/

previousButton?.addEventListener(
    "click",
    () => {
        if (currentPage <= 1) {
            return;
        }

        loadVideos(
            currentPage - 1,
            currentQuery
        );
    }
);


nextButton?.addEventListener(
    "click",
    () => {
        loadVideos(
            currentPage + 1,
            currentQuery
        );
    }
);


/*
============================================================
Browser Back and Forward buttons
============================================================
*/

window.addEventListener(
    "popstate",
    () => {
        const state =
            readStateFromUrl();

        currentPage =
            state.page;

        currentQuery =
            state.query;

        if (searchInput) {
            searchInput.value =
                currentQuery;
        }

        updateSearchInterface();

        loadVideos(
            currentPage,
            currentQuery,
            false
        );
    }
);


/*
============================================================
Load popular or searched videos
============================================================
*/

async function loadVideos(
    page,
    query = "",
    updateHistory = true
) {
    showLoading(query);

    const normalizedQuery =
        normalizeSearchQuery(query);

    const searching =
        normalizedQuery.length >= 2;

    const endpoint =
        searching
            ? `${API}/search?q=${encodeURIComponent(normalizedQuery)}` +
              `&page=${encodeURIComponent(page)}`
            : `${API}/popular?page=${encodeURIComponent(page)}`;

    try {
        const response =
            await fetch(
                endpoint,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );

        const text =
            await response.text();

        let result;

        try {
            result =
                JSON.parse(text);
        } catch {
            throw new Error(
                "The video API returned invalid JSON."
            );
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                `Request failed with HTTP ${response.status}.`
            );
        }

        currentPage =
            Number(result.page || 1);

        currentQuery =
            searching
                ? normalizedQuery
                : "";

        if (updateHistory) {
            updatePageUrl(
                currentPage,
                currentQuery
            );
        }

        updateSearchInterface();

        renderVideos(
            result.videos || []
        );

        renderPagination(
            result
        );
    } catch (error) {
        console.error(
            "Unable to load videos:",
            error
        );
      if (searchButton) {
    searchButton.disabled = false;
    }
        showError(
            error instanceof Error
                ? error.message
                : String(error)
        );
    }
}


/*
============================================================
Render search and popular headings
============================================================
*/

function updateSearchInterface() {
    const searching =
        currentQuery.length >= 2;

    if (clearSearchButton) {
        clearSearchButton.hidden =
            !searching;
    }

    if (pageTitle) {
        pageTitle.textContent =
            searching
                ? "Search Results"
                : "Most Viewed";
    }

    if (pageSubtitle) {
        pageSubtitle.textContent =
            searching
                ? `Showing title matches for “${currentQuery}”.`
                : "Videos with at least 15 views, ranked from most viewed to least viewed.";
    }
}


/*
============================================================
Render video results
============================================================
*/

function renderVideos(videos) {
    videoGrid.replaceChildren();

    if (videos.length === 0) {
        statusMessage.hidden = false;

        if (currentQuery) {
            statusMessage.textContent =
                `No active videos matched “${currentQuery}”.`;
        } else if (currentPage === 1) {
            statusMessage.textContent =
                "No videos have reached 15 views yet.";
        } else {
            statusMessage.textContent =
                "There are no videos on this page.";
        }

        videoGrid.hidden = true;

        return;
    }

    for (const video of videos) {
        videoGrid.append(
            createVideoCard(video)
        );
    }

    statusMessage.hidden = true;
    videoGrid.hidden = false;
}


function createVideoCard(video) {
    const article =
        document.createElement("article");

    article.className =
        "video-card";

    const videoUrl =
        typeof video.videoUrl === "string" &&
        video.videoUrl
            ? video.videoUrl
            : `/vid?id=${encodeURIComponent(video.id)}`;

    const thumbnailLink =
        document.createElement("a");

    thumbnailLink.className =
        "thumbnail-link";

    thumbnailLink.href =
        videoUrl;

    thumbnailLink.setAttribute(
        "aria-label",
        `Watch ${video.title || "video"}`
    );

    if (video.thumbnailUrl) {
        const image =
            document.createElement("img");

        image.className =
            "thumbnail-image";

        image.src =
            video.thumbnailUrl;

        image.alt =
            video.title
                ? `Thumbnail for ${video.title}`
                : "Video thumbnail";

        image.loading =
            "lazy";

        image.addEventListener(
            "error",
            () => {
                image.remove();

                thumbnailLink.prepend(
                    createThumbnailPlaceholder(
                        video.title
                    )
                );
            },
            {
                once: true
            }
        );

        thumbnailLink.append(image);
    } else {
        thumbnailLink.append(
            createThumbnailPlaceholder(
                video.title
            )
        );
    }

    const duration =
        Number(
            video.durationSeconds || 0
        );

    if (
        Number.isFinite(duration) &&
        duration > 0
    ) {
        const badge =
            document.createElement("span");

        badge.className =
            "duration-badge";

        badge.textContent =
            formatDuration(duration);

        thumbnailLink.append(badge);
    }

    const content =
        document.createElement("div");

    content.className =
        "video-content";

    const heading =
        document.createElement("h3");

    heading.className =
        "video-title";

    const titleLink =
        document.createElement("a");

    titleLink.href =
        videoUrl;

    titleLink.textContent =
        video.title ||
        "Untitled video";

    heading.append(titleLink);

    const meta =
        document.createElement("div");

    meta.className =
        "video-meta";

    meta.textContent =
        buildMetaText(video);

    const description =
        document.createElement("p");

    description.className =
        "video-description";

    description.textContent =
        video.description ||
        "No description provided.";

    content.append(
        heading,
        meta,
        description
    );

    article.append(
        thumbnailLink,
        content
    );

    return article;
}


function createThumbnailPlaceholder(title) {
    const placeholder =
        document.createElement("div");

    placeholder.className =
        "thumbnail-placeholder";

    placeholder.textContent =
        title || "Video";

    return placeholder;
}


/*
============================================================
Pagination
============================================================
*/

function renderPagination(result) {
    const totalPages =
        Math.max(
            1,
            Number(result.totalPages || 1)
        );

    const totalVideos =
        Number(result.totalVideos || 0);

    previousButton.disabled =
        !result.hasPreviousPage;

    nextButton.disabled =
        !result.hasNextPage;

    pageIndicator.textContent =
        `Page ${currentPage} of ${totalPages}`;

    pagination.hidden =
        totalVideos === 0;
}


/*
============================================================
URL state
============================================================
*/

function readStateFromUrl() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const requestedPage =
        Number.parseInt(
            parameters.get("page") || "1",
            10
        );

    const page =
        Number.isInteger(requestedPage) &&
        requestedPage > 0
            ? requestedPage
            : 1;

    const query =
        normalizeSearchQuery(
            parameters.get("q") || ""
        );

    return {
        page,
        query
    };
}


function updatePageUrl(
    page,
    query
) {
    const url =
        new URL(window.location.href);

    if (query) {
        url.searchParams.set(
            "q",
            query
        );
    } else {
        url.searchParams.delete(
            "q"
        );
    }

    if (page > 1) {
        url.searchParams.set(
            "page",
            String(page)
        );
    } else {
        url.searchParams.delete(
            "page"
        );
    }

    window.history.pushState(
        {
            page,
            query
        },
        "",
        url
    );
}


function normalizeSearchQuery(value) {
    return String(value)
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
}


/*
============================================================
Formatting helpers
============================================================
*/

function buildMetaText(video) {
    const parts = [];

    const views =
        Number(video.views || 0);

    parts.push(
        `${views.toLocaleString()} ` +
        `view${views === 1 ? "" : "s"}`
    );

    const uploadDate =
        Number(video.uploadDate || 0);

    if (
        Number.isFinite(uploadDate) &&
        uploadDate > 0
    ) {
        parts.push(
            formatUploadDate(
                uploadDate
            )
        );
    }

    return parts.join(" • ");
}


function formatUploadDate(timestampSeconds) {
    return new Date(
        timestampSeconds * 1000
    ).toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function formatDuration(totalSeconds) {
    const total =
        Math.max(
            0,
            Math.floor(totalSeconds)
        );

    const hours =
        Math.floor(total / 3600);

    const minutes =
        Math.floor(
            (total % 3600) / 60
        );

    const seconds =
        total % 60;

    if (hours > 0) {
        return (
            `${hours}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`
        );
    }

    return (
        `${minutes}:` +
        `${String(seconds).padStart(2, "0")}`
    );
}


/*
============================================================
Status helpers
============================================================
*/

function showLoading(query) {
    statusMessage.hidden = false;

    statusMessage.textContent =
        query
            ? `Searching for “${query}”...`
            : "Loading popular videos...";

    videoGrid.hidden = true;
    pagination.hidden = true;

    if (searchButton) {
        searchButton.disabled = true;
    }
}


function showError(message) {
    statusMessage.hidden = false;

    statusMessage.textContent =
        `Unable to load videos: ${message}`;

    videoGrid.hidden = true;
    pagination.hidden = true;

    if (searchButton) {
        searchButton.disabled = false;
    }
}