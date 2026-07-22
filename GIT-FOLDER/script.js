const API = "https://cloudflareworkers.workers.dev";

const fileInput = document.getElementById("videoFile");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const uploadButton = document.getElementById("uploadBtn");
const progressBar = document.getElementById("progressBar");
const statusElement = document.getElementById("status");

const MAX_UPLOAD_SIZE = 6 * 1024 * 1024 * 1024;

uploadButton.addEventListener("click", uploadVideo);

async function uploadVideo() {
    const file = fileInput.files[0];
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!file) {
        alert("Please select a video file.");
        return;
    }

    if (!title) {
        alert("Please enter a video title.");
        return;
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
        alert("The video must be larger than 0 bytes and no more than 6 GB.");
        return;
    }

    const mimeType = getMimeType(file);

    if (!mimeType) {
        alert("Only MP4 and WebM files are supported.");
        return;
    }

    uploadButton.disabled = true;
    progressBar.value = 0;
    setStatus("Reading video metadata...");

    try {
        const metadata = await getVideoMetadata(file);

        setStatus("Generating thumbnail...");

let thumbnailBlob = null;

try {
    thumbnailBlob =
        await generateVideoThumbnail(file);
} catch (error) {
    console.warn(
        "Thumbnail generation failed:",
        error
    );
}


async function uploadThumbnail(
    videoId,
    thumbnailBlob
) {
    const response =
        await fetch(
            `${API}/thumbnail`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "image/webp",
                    "X-Video-Id": videoId,
                    "Accept": "application/json"
                },

                body: thumbnailBlob
            }
        );

    const text =
        await response.text();

    let result;

    try {
        result = JSON.parse(text);
    } catch {
        throw new Error(
            "Thumbnail endpoint returned invalid JSON."
        );
    }

    if (!response.ok || !result.success) {
        throw new Error(
            result.error ||
            `Thumbnail upload failed with HTTP ${response.status}.`
        );
    }

    return result;
}
        /*
         * 1. Start multipart upload
         */
        setStatus("Starting upload...");

        const upload = await fetchJson(`${API}/upload/start`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                title,
                description,
                size: file.size,
                fileSize: file.size,
                mimeType,
                width: metadata.width,
                height: metadata.height,
                duration: metadata.duration
            })
        });

        const uploadId = upload.uploadId;
        const objectKey = upload.objectKey;
        const videoId = upload.videoId;
        const chunkSize = Number(upload.partSize) || 8 * 1024 * 1024;

        if (!uploadId || !objectKey) {
            throw new Error(
                "The Worker did not return an upload ID and object key."
            );
        }

        if (chunkSize < 5 * 1024 * 1024) {
            throw new Error("The multipart chunk size is too small.");
        }

        /*
         * 2. Upload every part
         */
        const totalParts = Math.ceil(file.size / chunkSize);

       for (
    let partNumber = 1, offset = 0;
    offset < file.size;
    partNumber++, offset += chunkSize
) {
    const chunk = file.slice(
        offset,
        Math.min(offset + chunkSize, file.size)
    );

    const part = await uploadPartWithRetry({
        uploadId,
        objectKey,
        partNumber,
        totalParts,
        chunk,
        maxAttempts: 5
    });

    if (!part.etag) {
        throw new Error(
            `The Worker did not return an ETag for part ${partNumber}.`
        );
    }

    const uploadedBytes = Math.min(
        offset + chunk.size,
        file.size
    );

    progressBar.value = Math.round(
        (uploadedBytes / file.size) * 100
    );
}

        /*
         * 3. Finish multipart upload
         */
        setStatus("Finalizing upload...");

        const complete = await fetchJson(`${API}/upload/finish`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                uploadId,
                objectKey
            })
        });

        if (thumbnailBlob && complete.videoId) {
    setStatus("Uploading thumbnail...");

    try {
        await uploadThumbnail(
            complete.videoId,
            thumbnailBlob
        );
    } catch (error) {
        console.warn(
            "Thumbnail upload failed:",
            error
        );
    }
}

        progressBar.value = 100;

        const videoUrl =
            complete.url ||
            `${window.location.origin}/vid?id=${encodeURIComponent(
                complete.videoId || videoId
            )}`;

        statusElement.innerHTML = `
            Upload complete!
            <br><br>
            <a href="${escapeHtml(videoUrl)}"
               target="_blank"
               rel="noopener noreferrer">
                ${escapeHtml(videoUrl)}
            </a>
        `;
    } catch (error) {
        console.error(error);
        setStatus(`Upload failed: ${error.message}`);
    } finally {
        uploadButton.disabled = false;
    }
}

/*
============================================================
UPLOAD VIDEO
============================================================
*/

async function uploadPartWithRetry({
    uploadId,
    objectKey,
    partNumber,
    totalParts,
    chunk,
    maxAttempts
}) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            setStatus(
                attempt === 1
                    ? `Uploading part ${partNumber} of ${totalParts}...`
                    : `Retrying part ${partNumber} of ${totalParts} ` +
                      `(attempt ${attempt} of ${maxAttempts})...`
            );

            const result = await fetchJson(
                `${API}/upload/part`,
                {
                    method: "POST",

                    headers: {
                        "Upload-Id": uploadId,
                        "Part-Number": String(partNumber),
                        "Object-Key": objectKey,
                        "Content-Type": "application/octet-stream",
                        "Accept": "application/json"
                    },

                    body: chunk
                },
                120000
            );

            if (!result.success) {
                throw new Error(
                    result.error ||
                    `Part ${partNumber} was rejected.`
                );
            }

            return result;
        } catch (error) {
            lastError = error;

            console.warn(
                `Part ${partNumber} attempt ${attempt} failed:`,
                error
            );

            if (attempt === maxAttempts) {
                break;
            }

            /*
             * Exponential delay:
             * 1s, 2s, 4s, 8s
             */
            const delay =
                1000 * Math.pow(2, attempt - 1);

            await sleep(delay);
        }
    }

    throw new Error(
        `Part ${partNumber} failed after ${maxAttempts} attempts: ` +
        `${
            lastError instanceof Error
                ? lastError.message
                : String(lastError)
        }`
    );
}

function sleep(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}


async function fetchJson(
    url,
    options,
    timeoutMilliseconds = 30000
) {
    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(
            () => controller.abort(),
            timeoutMilliseconds
        );

    let response;

    try {
        response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error(
                `${options.method || "GET"} ` +
                `${new URL(url).pathname} timed out.`
            );
        }

        throw new Error(
            `Network request failed: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    } finally {
        clearTimeout(timeoutId);
    }

    const text =
        await response.text();

    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(
                `${options.method || "GET"} ` +
                `${new URL(url).pathname} returned invalid JSON ` +
                `(${response.status}): ${text.slice(0, 200)}`
            );
        }
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.error ||
            `${options.method || "GET"} ` +
            `${new URL(url).pathname} failed with HTTP ` +
            `${response.status}`
        );
    }

    return data;
}

function getMimeType(file) {
    const supportedMimeTypes = new Set([
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
        "application/ogg"
    ]);

    if (supportedMimeTypes.has(file.type)) {
        return file.type === "application/ogg"
            ? "video/ogg"
            : file.type;
    }

    const name = file.name.toLowerCase();

    if (
        name.endsWith(".mp4") ||
        name.endsWith(".m4v")
    ) {
        return "video/mp4";
    }

    if (name.endsWith(".webm")) {
        return "video/webm";
    }

    if (
        name.endsWith(".ogv") ||
        name.endsWith(".ogg")
    ) {
        return "video/ogg";
    }

    if (name.endsWith(".mov")) {
        return "video/quicktime";
    }

    return "";
}

function getVideoMetadata(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);

        video.preload = "metadata";

        video.onloadedmetadata = () => {
            resolve({
                width: video.videoWidth || 0,
                height: video.videoHeight || 0,
                duration: Number.isFinite(video.duration)
                    ? Math.floor(video.duration)
                    : 0
            });

            URL.revokeObjectURL(objectUrl);
        };

        video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Unable to read the video metadata."));
        };

        video.src = objectUrl;
    });
}

async function generateVideoThumbnail(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        const objectUrl = URL.createObjectURL(file);

        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";

        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            video.removeAttribute("src");
            video.load();
        };

        video.onloadedmetadata = () => {
            const duration =
                Number.isFinite(video.duration)
                    ? video.duration
                    : 0;

            const seekTime =
                Math.min(
                    5,
                    Math.max(0.1, duration * 0.1)
                );

            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const sourceWidth =
                video.videoWidth || 1280;

            const sourceHeight =
                video.videoHeight || 720;

            const targetWidth = 640;

            const targetHeight =
                Math.round(
                    targetWidth *
                    sourceHeight /
                    sourceWidth
                );

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const context =
                canvas.getContext("2d");

            if (!context) {
                cleanup();
                reject(
                    new Error(
                        "Could not create the thumbnail canvas."
                    )
                );
                return;
            }

            context.drawImage(
                video,
                0,
                0,
                targetWidth,
                targetHeight
            );

            canvas.toBlob(
                blob => {
                    cleanup();

                    if (!blob) {
                        reject(
                            new Error(
                                "Could not generate the video thumbnail."
                            )
                        );
                        return;
                    }

                    resolve(blob);
                },
                "image/webp",
                0.82
            );
        };

        video.onerror = () => {
            cleanup();

            reject(
                new Error(
                    "The browser could not extract a thumbnail."
                )
            );
        };

        video.src = objectUrl;
    });
}

function setStatus(message) {
    statusElement.textContent = message;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}