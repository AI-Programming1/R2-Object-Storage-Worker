const API =
    "https://cloudflareworkers.workers.dev";

const TOKEN_KEY =
    "videoAdminToken";


/*
============================================================
Elements
============================================================
*/

const loginSection =
    document.getElementById("loginSection");

const adminSection =
    document.getElementById("adminSection");

const loginForm =
    document.getElementById("loginForm");

const passwordInput =
    document.getElementById("passwordInput");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");

const logoutButton =
    document.getElementById("logoutButton");

const refreshButton =
    document.getElementById("refreshButton");

const adminMessage =
    document.getElementById("adminMessage");

const videoList =
    document.getElementById("videoList");

const pagination =
    document.getElementById("pagination");

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const pageIndicator =
    document.getElementById("pageIndicator");


/*
============================================================
State
============================================================
*/

let adminToken =
    sessionStorage.getItem(TOKEN_KEY) || "";

let currentPage = 1;
let totalPages = 1;


/*
============================================================
Initialization
============================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    initializeAdminPortal
);


async function initializeAdminPortal() {
    if (!adminToken) {
        showLogin();
        return;
    }

    showAdmin();

    await loadAdminVideos(1);
}


/*
============================================================
Login
============================================================
*/

loginForm.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const password =
            passwordInput.value;

        if (!password) {
            showLoginMessage(
                "Enter the administrator password.",
                "error"
            );

            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Signing in...";

        try {
            const response =
                await fetch(
                    `${API}/admin/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            "Accept":
                                "application/json"
                        },

                        body: JSON.stringify({
                            password
                        })
                    }
                );

            const result =
                await readJsonResponse(response);

            if (
                !response.ok ||
                !result.success ||
                !result.token
            ) {
                throw new Error(
                    result.error ||
                    "Administrator login failed."
                );
            }

            adminToken =
                result.token;

            sessionStorage.setItem(
                TOKEN_KEY,
                adminToken
            );

            /*
             * Remove the password from memory and the field.
             */
            passwordInput.value = "";

            showAdmin();

            await loadAdminVideos(1);
        } catch (error) {
            console.error(
                "Admin login failed:",
                error
            );

            showLoginMessage(
                error instanceof Error
                    ? error.message
                    : String(error),
                "error"
            );
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Sign in";
        }
    }
);


/*
============================================================
Logout
============================================================
*/

logoutButton.addEventListener(
    "click",
    logout
);


function logout() {
    adminToken = "";

    sessionStorage.removeItem(
        TOKEN_KEY
    );

    videoList.replaceChildren();

    showLogin();

    showLoginMessage(
        "You have been logged out.",
        "success"
    );
}


/*
============================================================
Load videos
============================================================
*/

async function loadAdminVideos(page) {
    showAdminMessage(
        "Loading videos..."
    );

    videoList.hidden = true;
    pagination.hidden = true;

    try {
        const response =
            await fetch(
                `${API}/admin/videos?page=${encodeURIComponent(page)}`,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${adminToken}`
                    }
                }
            );

        const result =
            await readJsonResponse(response);

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "Could not load administrator videos."
            );
        }

        currentPage =
            Number(result.page || 1);

        totalPages =
            Math.max(
                1,
                Number(result.totalPages || 1)
            );

        renderVideos(
            result.videos || []
        );

        renderPagination(result);
    } catch (error) {
        console.error(
            "Could not load admin videos:",
            error
        );

        showAdminMessage(
            error instanceof Error
                ? error.message
                : String(error),
            "error"
        );
    }
}


/*
============================================================
Render videos
============================================================
*/

function renderVideos(videos) {
    videoList.replaceChildren();

    if (videos.length === 0) {
        showAdminMessage(
            "No videos were found."
        );

        videoList.hidden = true;

        return;
    }

    for (const video of videos) {
        videoList.append(
            createVideoCard(video)
        );
    }

    adminMessage.hidden = true;
    videoList.hidden = false;
}


function createVideoCard(video) {
    const article =
        document.createElement("article");

    article.className =
        "video-card";

    article.dataset.videoId =
        video.id;

    const thumbnail =
        document.createElement("div");

    thumbnail.className =
        "thumbnail-container";

    if (video.thumbnailUrl) {
        const image =
            document.createElement("img");

        image.src =
            video.thumbnailUrl;

        image.alt =
            video.title
                ? `Thumbnail for ${video.title}`
                : "Video thumbnail";

        image.loading = "lazy";

        image.addEventListener(
            "error",
            () => {
                image.remove();

                thumbnail.append(
                    createThumbnailPlaceholder(
                        video.title
                    )
                );
            },
            {
                once: true
            }
        );

        thumbnail.append(image);
    } else {
        thumbnail.append(
            createThumbnailPlaceholder(
                video.title
            )
        );
    }

    const content =
        document.createElement("div");

    content.className =
        "video-content";

    const heading =
        document.createElement("h3");

    const link =
        document.createElement("a");

    link.href =
        video.videoUrl;

    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.textContent =
        video.title ||
        "Untitled video";

    heading.append(link);

    const description =
        document.createElement("p");

    description.className =
        "description";

    description.textContent =
        video.description ||
        "No description provided.";

    const metadata =
        document.createElement("div");

    metadata.className =
        "metadata";

    metadata.append(
        createMetadataItem(
            `${Number(video.views || 0).toLocaleString()} views`
        ),

        createMetadataItem(
            formatFileSize(
                Number(video.fileSize || 0)
            )
        ),

        createMetadataItem(
            formatDuration(
                Number(video.durationSeconds || 0)
            )
        ),

        createMetadataItem(
            `Uploaded ${formatDate(video.uploadDate)}`
        )
    );

    const statuses =
        document.createElement("div");

    statuses.className =
        "status-row";

    statuses.append(
        createStatusBadge(
            video.status || "unknown"
        ),

        createStatusBadge(
            video.moderationStatus || "unknown"
        )
    );

    const expirationBadge =
        createStatusBadge(
            video.neverExpires
                ? "Permanent"
                : `Expires ${formatDate(video.expirationDate)}`,

            video.neverExpires
                ? "permanent"
                : "expiring"
        );

    statuses.append(
        expirationBadge
    );

    const actions =
        document.createElement("div");

    actions.className =
        "actions";

    const permanentButton =
        document.createElement("button");

    const deleteButton =
    document.createElement("button");

deleteButton.type = "button";
deleteButton.className = "delete-button";
deleteButton.textContent = "Delete permanently";

deleteButton.addEventListener(
    "click",
    () => {
        deleteVideo(
            video,
            deleteButton
        );
    }
);

    permanentButton.type = "button";

    if (video.neverExpires) {
        permanentButton.className =
            "normal-button";

        permanentButton.textContent =
            "Return to expiration queue";
    } else {
        permanentButton.className =
            "permanent-button";

        permanentButton.textContent =
            "Keep permanently";
    }

    permanentButton.addEventListener(
        "click",
        () => {
            updatePermanentStatus(
                video,
                !video.neverExpires,
                permanentButton
            );
        }
    );

    actions.append(
    permanentButton,
    deleteButton
);

    content.append(
        heading,
        description,
        metadata,
        statuses,
        actions
    );

    article.append(
        thumbnail,
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


function createMetadataItem(text) {
    const item =
        document.createElement("span");

    item.textContent = text;

    return item;
}


function createStatusBadge(
    text,
    extraClass = ""
) {
    const badge =
        document.createElement("span");

    badge.className =
        `status-badge ${extraClass}`.trim();

    badge.textContent =
        text;

    return badge;
}


/*
============================================================
Change permanent status
============================================================
*/

async function updatePermanentStatus(
    video,
    permanent,
    button
) {
    const actionDescription =
        permanent
            ? `keep “${video.title}” permanently`
            : `return “${video.title}” to its expiration schedule`;

    const confirmed =
        window.confirm(
            `Are you sure you want to ${actionDescription}?`
        );

    if (!confirmed) {
        return;
    }

    const originalText =
        button.textContent;

    button.disabled = true;

    button.textContent =
        permanent
            ? "Saving..."
            : "Updating...";

    try {
        const response =
            await fetch(
                `${API}/admin/video/permanent`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${adminToken}`
                    },

                    body: JSON.stringify({
                        id:
                            video.id,

                        permanent
                    })
                }
            );

        const result =
            await readJsonResponse(response);

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "Could not update permanent status."
            );
        }

        showAdminMessage(
            result.message ||
            "Video status updated.",
            "success"
        );

        /*
         * Reload the current page so all displayed metadata
         * comes from the database.
         */
        await loadAdminVideos(
            currentPage
        );
    } catch (error) {
        console.error(
            "Permanent-status update failed:",
            error
        );

        button.disabled = false;
        button.textContent =
            originalText;

        showAdminMessage(
            error instanceof Error
                ? error.message
                : String(error),
            "error"
        );
    }
}


/*
============================================================
Pagination
============================================================
*/

previousButton.addEventListener(
    "click",
    () => {
        if (currentPage > 1) {
            loadAdminVideos(
                currentPage - 1
            );
        }
    }
);


nextButton.addEventListener(
    "click",
    () => {
        if (currentPage < totalPages) {
            loadAdminVideos(
                currentPage + 1
            );
        }
    }
);


function renderPagination(result) {
    previousButton.disabled =
        !result.hasPreviousPage;

    nextButton.disabled =
        !result.hasNextPage;

    pageIndicator.textContent =
        `Page ${currentPage} of ${totalPages}`;

    pagination.hidden =
        Number(result.totalVideos || 0) === 0;
}


/*
============================================================
Refresh
============================================================
*/

refreshButton.addEventListener(
    "click",
    () => {
        loadAdminVideos(
            currentPage
        );
    }
);


/*
============================================================
Session handling
============================================================
*/

function handleExpiredSession() {
    adminToken = "";

    sessionStorage.removeItem(
        TOKEN_KEY
    );

    showLogin();

    showLoginMessage(
        "Your administrator session expired. Sign in again.",
        "error"
    );
}


function showLogin() {
    loginSection.hidden = false;
    adminSection.hidden = true;

    passwordInput.focus();
}


function showAdmin() {
    loginSection.hidden = true;
    adminSection.hidden = false;
}


/*
============================================================
Messages
============================================================
*/

function showLoginMessage(
    message,
    type = ""
) {
    loginMessage.hidden = false;

    loginMessage.className =
        `message ${type}`.trim();

    loginMessage.textContent =
        message;
}


function showAdminMessage(
    message,
    type = ""
) {
    adminMessage.hidden = false;

    adminMessage.className =
        `message ${type}`.trim();

    adminMessage.textContent =
        message;
}


/*
============================================================
Response and formatting helpers
============================================================
*/

async function readJsonResponse(response) {
    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            `The Worker returned invalid JSON ` +
            `(HTTP ${response.status}).`
        );
    }
}


function formatDate(timestampSeconds) {
    const timestamp =
        Number(timestampSeconds || 0);

    if (
        !Number.isFinite(timestamp) ||
        timestamp <= 0
    ) {
        return "Unknown";
    }

    return new Date(
        timestamp * 1000
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
            Math.floor(
                Number(totalSeconds || 0)
            )
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


function formatFileSize(bytes) {
    const value =
        Number(bytes || 0);

    if (
        !Number.isFinite(value) ||
        value <= 0
    ) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const unitIndex =
        Math.min(
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            ),
            units.length - 1
        );

    const size =
        value /
        Math.pow(
            1024,
            unitIndex
        );

    return (
        `${size.toFixed(
            unitIndex === 0 ? 0 : 1
        )} ${units[unitIndex]}`
    );
}

/*
============================================================
Delete video permanently
============================================================
*/

async function deleteVideo(
    video,
    button
) {
    const confirmed =
        window.confirm(
            `Permanently delete “${video.title}”? ` +
            `This removes the R2 file, thumbnail, views, ` +
            `metadata, and cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    const secondConfirmation =
        window.confirm(
            "This action is irreversible. Continue?"
        );

    if (!secondConfirmation) {
        return;
    }

    const originalText =
        button.textContent;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
        const response =
            await fetch(
                `${API}/admin/video`,
                {
                    method: "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        "Authorization":
                            `Bearer ${adminToken}`
                    },

                    body: JSON.stringify({
                        id: video.id
                    })
                }
            );

        const result =
            await readJsonResponse(response);

        if (response.status === 401) {
            handleExpiredSession();
            return;
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                "Could not delete the video."
            );
        }

        showAdminMessage(
            result.message,
            "success"
        );

        await loadAdminVideos(
            currentPage
        );
    } catch (error) {
        console.error(
            "Admin deletion failed:",
            error
        );

        button.disabled = false;
        button.textContent =
            originalText;

        showAdminMessage(
            error instanceof Error
                ? error.message
                : String(error),
            "error"
        );
    }
}