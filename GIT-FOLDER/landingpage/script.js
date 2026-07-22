const API =
    "https://cloudflareworkers.workers.dev";


/*
============================================================
Page elements
============================================================
*/

const messageElement =
    document.getElementById("message");

const videoSection =
    document.getElementById("videoSection");

const videoPlayer =
    document.getElementById("videoPlayer");

const titleElement =
    document.getElementById("videoTitle");

const descriptionElement =
    document.getElementById("description");

const detailsElement =
    document.getElementById("details");

const viewCountElement =
    document.getElementById("viewCount");

const expirationBanner =
    document.getElementById("expirationBanner");

const expirationTitle =
    document.getElementById("expirationTitle");

const expirationMessage =
    document.getElementById("expirationMessage");

const extendButton =
    document.getElementById("extendButton");

const commentsSection =
    document.getElementById("commentsSection");

const commentsContainer =
    document.getElementById("commentsContainer");


document.addEventListener(
    "DOMContentLoaded",
    loadVideo
);


/*
============================================================
Load video metadata and player
============================================================
*/

async function loadVideo() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const videoId =
        parameters.get("id");

    if (!videoId) {
        showError(
            "The video ID is missing from the URL."
        );

        return;
    }

    try {
        const response =
            await fetch(
                `${API}/video?id=${encodeURIComponent(videoId)}`,
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
                "The video API returned invalid JSON: " +
                text.slice(0, 200)
            );
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                `Video request failed with HTTP ${response.status}.`
            );
        }

        const video =
            result.video;

        if (!video) {
            throw new Error(
                "The video metadata was missing from the API response."
            );
        }

        /*
        ------------------------------------------------------------
        Populate page content
        ------------------------------------------------------------
        */

        if (titleElement) {
            titleElement.textContent =
                video.title ||
                "Untitled video";
        }

        if (descriptionElement) {
            descriptionElement.textContent =
                video.description || "";
        }

        if (detailsElement) {
            detailsElement.textContent =
                formatDetails(video);
        }

        if (viewCountElement) {
            viewCountElement.textContent =
                `${Number(video.views || 0).toLocaleString()} views`;
        }

        /*
        ------------------------------------------------------------
        Render expiration banner
        ------------------------------------------------------------
        */

        renderExpiration(
            video,
            videoId
        );

        /*
        ------------------------------------------------------------
        Configure video source
        ------------------------------------------------------------
        */

        if (!videoPlayer) {
            throw new Error(
                "The videoPlayer element is missing from index.html."
            );
        }

        videoPlayer.src =
            `${API}/stream?id=${encodeURIComponent(videoId)}`;

        videoPlayer.addEventListener(
            "error",
            handleVideoPlaybackError,
            {
                once: true
            }
        );

        /*
        ------------------------------------------------------------
        Count the first playback in this page session
        ------------------------------------------------------------
        */

        let viewReported = false;

        videoPlayer.addEventListener(
            "play",
            () => {
                if (viewReported) {
                    return;
                }

                viewReported = true;

                reportView(videoId);
            }
        );

        /*
        ------------------------------------------------------------
        Reveal player
        ------------------------------------------------------------
        */

        if (messageElement) {
            messageElement.hidden = true;
        }

        if (videoSection) {
            videoSection.hidden = false;
        }

        videoPlayer.load();

        /*
        ------------------------------------------------------------
        Load comments separately.

        A giscus failure must never prevent video playback.
        ------------------------------------------------------------
        */

        try {
            loadVideoComments(videoId);
        } catch (commentError) {
            console.warn(
                "Comments could not be loaded:",
                commentError
            );
        }
    } catch (error) {
        console.error(
            "Unable to load video:",
            error
        );

        showError(
            error instanceof Error
                ? error.message
                : String(error)
        );
    }
}


/*
============================================================
Video playback error
============================================================
*/

function handleVideoPlaybackError() {
    const mediaError =
        videoPlayer?.error;

    console.error(
        "Video playback error:",
        mediaError
    );

    showError(
        "The video file could not be loaded from storage."
    );
}


/*
============================================================
Giscus comments
============================================================
*/

function loadVideoComments(videoId) {
    if (!commentsContainer) {
        console.warn(
            "The commentsContainer element is missing from index.html."
        );

        return;
    }

    /*
     * Clear an existing giscus frame or script before loading.
     */
    commentsContainer.replaceChildren();

    const script =
        document.createElement("script");

    script.src =
        "https://giscus.app/client.js";

    script.async = true;

    script.crossOrigin =
        "anonymous";

    /*
     * Giscus requires owner/repository, not a GitHub URL.
     */
    script.setAttribute(
        "data-repo",
        "yourgithubaccountusername/video-comments"
    );

    script.setAttribute(
        "data-repo-id",
        "xxxxxxxxxxxx"
    );

    script.setAttribute(
        "data-category",
        "Video Comments"
    );

    script.setAttribute(
        "data-category-id",
        "xxxxxxxxxxxx"
    );

    script.setAttribute(
        "data-mapping",
        "specific"
    );

    /*
     * Each video ID receives a separate GitHub discussion.
     */
    script.setAttribute(
        "data-term",
        `video-${videoId}`
    );

    script.setAttribute(
        "data-strict",
        "1"
    );

    script.setAttribute(
        "data-reactions-enabled",
        "1"
    );

    script.setAttribute(
        "data-emit-metadata",
        "0"
    );

    script.setAttribute(
        "data-input-position",
        "top"
    );

    script.setAttribute(
        "data-theme",
        "dark"
    );

    script.setAttribute(
        "data-lang",
        "en"
    );

    script.setAttribute(
        "data-loading",
        "lazy"
    );

    script.addEventListener(
        "error",
        () => {
            console.warn(
                "The giscus client script failed to load."
            );

            if (commentsSection) {
                commentsSection.hidden = true;
            }
        },
        {
            once: true
        }
    );

    commentsContainer.append(script);

    if (commentsSection) {
        commentsSection.hidden = false;
    }
}


/*
============================================================
Expiration banner
============================================================
*/

function renderExpiration(
    video,
    videoId
) {
    /*
     * The page can still work when the expiration elements
     * have not been added to index.html.
     */

    if (
        !expirationBanner ||
        !expirationMessage ||
        !extendButton
    ) {
        console.warn(
            "Expiration banner elements are missing from index.html."
        );

        return;
    }

    /*
     * Permanent videos must not display expiration controls.
     */
    if (
        video.never_expires === true ||
        Number(video.never_expires) === 1
    ) {
        expirationBanner.hidden = true;
        extendButton.hidden = true;
        extendButton.onclick = null;

        return;
    }

    if (!video.show_expiration_banner) {
        expirationBanner.hidden = true;

        return;
    }

    expirationBanner.hidden = false;

    if (expirationTitle) {
        expirationTitle.textContent =
            "This video will expire soon.";
    }

    const secondsRemaining =
        Math.max(
            0,
            Number(
                video.seconds_remaining || 0
            )
        );

    const daysRemaining =
        Math.max(
            1,
            Math.ceil(
                secondsRemaining /
                86400
            )
        );

    expirationMessage.textContent =
        `This video is scheduled to expire in ` +
        `${daysRemaining} ` +
        `day${daysRemaining === 1 ? "" : "s"}.`;

    if (video.can_extend) {
        extendButton.hidden = false;
        extendButton.disabled = false;

        extendButton.textContent =
            `Extend for ` +
            `${Number(video.extension_months || 12)} months`;

        extendButton.onclick =
            () => submitExtension(videoId);
    } else {
        extendButton.hidden = true;
        extendButton.onclick = null;
    }
}


/*
============================================================
Submit video extension
============================================================
*/

async function submitExtension(videoId) {
    if (
        !extendButton ||
        !expirationMessage
    ) {
        return;
    }

    extendButton.disabled = true;
    extendButton.textContent =
        "Extending...";

    try {
        const response =
            await fetch(
                `${API}/extend`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        id: videoId
                    })
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
                "The extension API returned invalid JSON."
            );
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                `Extension failed with HTTP ${response.status}.`
            );
        }

        expirationMessage.textContent =
            result.message ||
            "The video expiration was extended.";

        extendButton.hidden = true;

        setTimeout(
            () => {
                if (expirationBanner) {
                    expirationBanner.hidden = true;
                }
            },
            4000
        );
    } catch (error) {
        console.error(
            "Video extension failed:",
            error
        );

        expirationMessage.textContent =
            error instanceof Error
                ? error.message
                : String(error);

        extendButton.disabled = false;
        extendButton.textContent =
            "Try extension again";
    }
}


/*
============================================================
Browser-based view reporting
============================================================
*/

async function reportView(videoId) {
    try {
        const response =
            await fetch(
                `${API}/view`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json",

                        "X-Viewer-Id":
                            getViewerId()
                    },

                    body: JSON.stringify({
                        id: videoId
                    })
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
                "The view API returned invalid JSON."
            );
        }

        if (
            !response.ok ||
            !result.success
        ) {
            throw new Error(
                result.error ||
                `View request failed with HTTP ${response.status}.`
            );
        }

        if (viewCountElement) {
            viewCountElement.textContent =
                `${Number(result.views || 0).toLocaleString()} views`;
        }
    } catch (error) {
        /*
         * View-count failures must not interrupt playback.
         */

        console.warn(
            "Could not record video view:",
            error
        );
    }
}


function getViewerId() {
    const storageKey =
        "videoViewerId";

    let viewerId =
        localStorage.getItem(
            storageKey
        );

    if (!viewerId) {
        if (
            typeof crypto.randomUUID ===
            "function"
        ) {
            viewerId =
                crypto.randomUUID();
        } else {
            viewerId =
                createFallbackViewerId();
        }

        localStorage.setItem(
            storageKey,
            viewerId
        );
    }

    return viewerId;
}


function createFallbackViewerId() {
    const randomPart =
        Math.random()
            .toString(36)
            .slice(2);

    return (
        `${Date.now()}-` +
        `${randomPart}-` +
        `${randomPart}`
    );
}


/*
============================================================
UI helpers
============================================================
*/

function showError(message) {
    if (videoSection) {
        videoSection.hidden = true;
    }

    if (commentsSection) {
        commentsSection.hidden = true;
    }

    if (messageElement) {
        messageElement.hidden = false;

        messageElement.textContent =
            `Unable to load video: ${message}`;
    }
}


function formatDetails(video) {
    const details = [];

    const duration =
        Number(
            video.duration_seconds
        );

    if (
        Number.isFinite(duration) &&
        duration > 0
    ) {
        details.push(
            formatDuration(duration)
        );
    }

    const uploaded =
        Number(
            video.upload_date
        );

    if (
        Number.isFinite(uploaded) &&
        uploaded > 0
    ) {
        details.push(
            `Uploaded ${new Date(
                uploaded * 1000
            ).toLocaleDateString()}`
        );
    }

    return details.join(" • ");
}


function formatDuration(totalSeconds) {
    const secondsValue =
        Math.max(
            0,
            Math.floor(
                Number(totalSeconds || 0)
            )
        );

    const hours =
        Math.floor(
            secondsValue / 3600
        );

    const minutes =
        Math.floor(
            (
                secondsValue % 3600
            ) / 60
        );

    const seconds =
        secondsValue % 60;

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
