/**
 * Cloudflare R2 + D1 video Worker
 *
 * Required bindings:
 *   env.VIDEOS -> R2 bucket
 *   env.DB     -> D1 database
 *
 * Required D1 tables:
 *   videos
 *   multipart_uploads
 *   multipart_parts
 *   upload_sessions
 */

const ALLOWED_ORIGINS = new Set([
    "https://domain.com",
    "https://www.domain.com",
    "https://sub.domain.com",
    "http://localhost:3000",
    "http://127.0.0.1:5500"
]);

const DEFAULT_MAX_UPLOAD_SIZE =
    6 * 1024 * 1024 * 1024;

const DEFAULT_CHUNK_SIZE =
    8 * 1024 * 1024;

const ID_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";


export default {

    async fetch(request, env) {

        const url =
            new URL(request.url);

        const pathname =
            url.pathname.length > 1
                ? url.pathname.replace(/\/+$/, "")
                : url.pathname;


        if (request.method === "OPTIONS") {

            return optionsResponse(request);

        }


        try {

            /*
            ================================================
            Debug route
            ================================================
            */

            if (
                request.method === "GET" &&
                pathname === "/debug"
            ) {

                return json(
                    request,
                    {
                        success: true,
                        version: "video-worker-upload-v1",
                        pathname
                    }
                );

            }


            /*
            ================================================
            Multipart upload routes
            ================================================
            */

            if (
                request.method === "POST" &&
                pathname === "/upload/start"
            ) {

                return await uploadStart(
                    request,
                    env
                );

            }


            if (
                request.method === "POST" &&
                pathname === "/upload/part"
            ) {

                return await uploadPart(
                    request,
                    env
                );

            }


            if (
                request.method === "POST" &&
                pathname === "/upload/finish"
            ) {

                return await uploadFinish(
                    request,
                    env
                );

            }

if (
    request.method === "POST" &&
    pathname === "/view"
) {
    return await recordVideoView(request, env);
}


if (
    request.method === "POST" &&
    pathname === "/extend"
) {
    return await extendVideo(request, env);
}



            /*
            ================================================
            Video metadata
            ================================================
            */

            if (
                request.method === "GET" &&
                pathname === "/video"
            ) {

                return await getVideoMetadata(
                    request,
                    env
                );

            }


            /*
            ================================================
            Video streaming
            ================================================
            */

            if (
                (
                    request.method === "GET" ||
                    request.method === "HEAD"
                ) &&
                pathname === "/stream"
            ) {

                return await streamVideo(
                    request,
                    env
                );

            }


            /*
            ================================================
            Popular videos
            ================================================
            */

            if (
                request.method === "GET" &&
                pathname === "/popular"
            ) {

                return await getPopular(
                    request,
                    env
                );

            }

/*
            ================================================
            Search videos
            ================================================
            */

if (
    request.method === "GET" &&
    pathname === "/search"
) {
    return await searchVideos(
        request,
        env
    );
}
             /*
            ================================================
            admin clean up of database password protected
            ================================================
            */

if (
    request.method === "POST" &&
    pathname === "/admin/run-cleanup"
) {
    const authorization =
        request.headers.get("Authorization");

    if (
        authorization !==
        `Bearer ${env.ADMIN_CLEANUP_SECRET}`
    ) {
        return json(
            request,
            {
                success: false,
                error: "Unauthorized."
            },
            401
        );
    }

    const result =
        await cleanupExpiredVideos(env);

    return json(
        request,
        {
            success: true,
            ...result
        },
        result.failedVideos > 0
            ? 207
            : 200
    );
}

/*
            ================================================
            Thumbnail of videos
            ================================================
            */

            if (
    request.method === "POST" &&
    pathname === "/thumbnail"
) {
    return await uploadThumbnailImage(
        request,
        env
    );
}

/*
============================================================
Thumbnail display route
============================================================
*/

if (
    (
        request.method === "GET" ||
        request.method === "HEAD"
    ) &&
    pathname === "/thumbnail"
) {
    return await getThumbnail(
        request,
        env
    );
}

/*
============================================================
Admin authentication
============================================================
*/

if (
    request.method === "POST" &&
    pathname === "/admin/login"
) {
    return await adminLogin(
        request,
        env
    );
}


/*
============================================================
Admin video listing
============================================================
*/

if (
    request.method === "GET" &&
    pathname === "/admin/videos"
) {
    const admin =
        await requireAdmin(
            request,
            env
        );

    if (!admin.authorized) {
        return json(
            request,
            {
                success: false,
                error: "Unauthorized."
            },
            401
        );
    }

    return await getAdminVideos(
        request,
        env
    );
}

if (
    request.method === "DELETE" &&
    pathname === "/admin/video"
) {
    const admin =
        await requireAdmin(
            request,
            env
        );

    if (!admin.authorized) {
        return json(
            request,
            {
                success: false,
                error: "Unauthorized."
            },
            401
        );
    }

    return await deleteAdminVideo(
        request,
        env
    );
}

/*
============================================================
Set or remove permanent status
============================================================
*/

if (
    request.method === "POST" &&
    pathname === "/admin/video/permanent"
) {
    const admin =
        await requireAdmin(
            request,
            env
        );

    if (!admin.authorized) {
        return json(
            request,
            {
                success: false,
                error: "Unauthorized."
            },
            401
        );
    }

    return await setVideoPermanentStatus(
        request,
        env
    );
}

            /*
            ================================================
            Route fallback
            ================================================
            */

if (
    request.method === "GET" &&
    pathname === "/"
) {
    return json(
        request,
        {
            success: true,
            service: "Video upload Worker",
            version: "video-worker-upload-v1",
            endpoints: [
                "POST /upload/start",
                "POST /upload/part",
                "POST /upload/finish",
                "GET /video?id=VIDEO_ID",
                "GET /stream?id=VIDEO_ID",
                "GET /popular?page=1",
                "GET /debug"
            ]
        }
    );
}

            return json(
                request,
                {
                    success: false,
                    error: "Endpoint not found",
                    method: request.method,
                    pathname
                },
                404
            );

        } catch (error) {

            console.error(
                "Worker error:",
                error?.stack || error
            );


            return json(
                request,
                {
                    success: false,
                    error:
                        error?.message ||
                        "Internal server error"
                },
                500
            );

        }

    },


    async scheduled(event, env, ctx) {
        console.log(
            "Video cleanup started:",
            new Date().toISOString()
        );

        ctx.waitUntil(
            cleanupExpiredVideos(env)
        );
    }
};

/*
============================================================
Responses and CORS
============================================================
*/

function corsHeaders(request) {

    const origin =
        request?.headers?.get?.("Origin") || "";


    return {

        "Access-Control-Allow-Origin":
            ALLOWED_ORIGINS.has(origin)
                ? origin
                : "https://sub.domain.com",

        "Access-Control-Allow-Methods":
    "GET, HEAD, POST, DELETE, OPTIONS",

        "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Upload-Id, Part-Number, Object-Key, X-Viewer-Id, X-Video-Id",

        "Access-Control-Expose-Headers":
            "Content-Length, Content-Range, ETag, Accept-Ranges",

        "Access-Control-Max-Age":
            "86400",

        "Vary":
            "Origin"

    };

}

/*
============================================================
Admin token helpers
============================================================
*/

function encodeBase64Url(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary +=
            String.fromCharCode(byte);
    }

    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}


function decodeBase64Url(value) {
    const normalized =
        value
            .replaceAll("-", "+")
            .replaceAll("_", "/");

    const padding =
        "=".repeat(
            (4 - normalized.length % 4) % 4
        );

    const binary =
        atob(normalized + padding);

    return Uint8Array.from(
        binary,
        character =>
            character.charCodeAt(0)
    );
}


async function importAdminSigningKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        {
            name: "HMAC",
            hash: "SHA-256"
        },
        false,
        [
            "sign",
            "verify"
        ]
    );
}


async function createAdminToken(env) {
    if (!env.ADMIN_TOKEN_SECRET) {
        throw new Error(
            "ADMIN_TOKEN_SECRET is not configured."
        );
    }

    const now =
        Math.floor(Date.now() / 1000);

    const payload = {
        issuedAt:
            now,

        expiresAt:
            now + (60 * 60),

        nonce:
            crypto.randomUUID()
    };

    const encodedPayload =
        encodeBase64Url(
            new TextEncoder().encode(
                JSON.stringify(payload)
            )
        );

    const signingKey =
        await importAdminSigningKey(
            env.ADMIN_TOKEN_SECRET
        );

    const signature =
        await crypto.subtle.sign(
            "HMAC",
            signingKey,
            new TextEncoder().encode(
                encodedPayload
            )
        );

    return (
        encodedPayload +
        "." +
        encodeBase64Url(
            new Uint8Array(signature)
        )
    );
}


async function verifyAdminToken(
    token,
    env
) {
    if (
        !token ||
        !env.ADMIN_TOKEN_SECRET
    ) {
        return false;
    }

    const pieces =
        token.split(".");

    if (pieces.length !== 2) {
        return false;
    }

    const [
        encodedPayload,
        encodedSignature
    ] = pieces;

    let payload;

    try {
        payload =
            JSON.parse(
                new TextDecoder().decode(
                    decodeBase64Url(
                        encodedPayload
                    )
                )
            );
    } catch {
        return false;
    }

    const now =
        Math.floor(Date.now() / 1000);

    if (
        !Number.isFinite(
            Number(payload.expiresAt)
        ) ||
        Number(payload.expiresAt) <= now
    ) {
        return false;
    }

    const signingKey =
        await importAdminSigningKey(
            env.ADMIN_TOKEN_SECRET
        );

    try {
        return await crypto.subtle.verify(
            "HMAC",
            signingKey,
            decodeBase64Url(
                encodedSignature
            ),
            new TextEncoder().encode(
                encodedPayload
            )
        );
    } catch {
        return false;
    }
}


/*
============================================================
Password Comparisson Helper
============================================================
*/


async function hashText(value) {
    const digest =
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
                value
            )
        );

    return new Uint8Array(digest);
}


async function secureTextEquals(
    first,
    second
) {
    const firstHash =
        await hashText(first);

    const secondHash =
        await hashText(second);

    if (
        firstHash.length !==
        secondHash.length
    ) {
        return false;
    }

    let difference = 0;

    for (
        let index = 0;
        index < firstHash.length;
        index++
    ) {
        difference |=
            firstHash[index] ^
            secondHash[index];
    }

    return difference === 0;
}


async function requireAdmin(
    request,
    env
) {
    const authorization =
        request.headers.get(
            "Authorization"
        ) || "";

    if (
        !authorization.startsWith(
            "Bearer "
        )
    ) {
        return {
            authorized: false
        };
    }

    const token =
        authorization
            .slice(7)
            .trim();

    return {
        authorized:
            await verifyAdminToken(
                token,
                env
            )
    };
}


/*
============================================================
LIKE Escaping helper for search bar
============================================================
*/


function escapeLikePattern(value) {
    return String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll("%", "\\%")
        .replaceAll("_", "\\_");
}


function optionsResponse(request) {

    return new Response(
        null,
        {
            status: 204,
            headers: corsHeaders(request)
        }
    );

}


/*
Always call this as:

json(request, data, status)
*/

function json(
    request,
    data,
    status = 200
) {

    return new Response(
        JSON.stringify(data),
        {
            status,

            headers: {

                ...corsHeaders(request),

                "Content-Type":
                    "application/json; charset=utf-8",

                "Cache-Control":
                    "no-store"

            }
        }
    );

}


/*
============================================================
ID generation
============================================================
*/

function randomVideoId(
    length = 12
) {

    const bytes =
        new Uint8Array(length);

    crypto.getRandomValues(bytes);


    let output = "";


    for (const byte of bytes) {

        output +=
            ID_ALPHABET[
                byte %
                ID_ALPHABET.length
            ];

    }


    return output;

}


async function uniqueVideoId(env) {

    for (
        let attempt = 0;
        attempt < 10;
        attempt++
    ) {

        const id =
            randomVideoId();


        const existingVideo =
            await env.DB
                .prepare(`
                    SELECT 1
                    FROM videos
                    WHERE id = ?
                    LIMIT 1
                `)
                .bind(id)
                .first();


        const existingUpload =
            await env.DB
                .prepare(`
                    SELECT 1
                    FROM multipart_uploads
                    WHERE video_id = ?
                    LIMIT 1
                `)
                .bind(id)
                .first();


        if (
            !existingVideo &&
            !existingUpload
        ) {

            return id;

        }

    }


    throw new Error(
        "Could not generate a unique video ID."
    );

}


function positiveNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);


    return (
        Number.isFinite(number) &&
        number >= 0
    )
        ? number
        : fallback;

}

function startOfUtcDay(timestampSeconds) {
    const date =
        new Date(timestampSeconds * 1000);

    return Math.floor(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
        ) / 1000
    );
}
/*
============================================================
POST /upload/start
============================================================
*/

async function uploadStart(
    request,
    env
) {

    let body;


    try {

        body =
            await request.json();

    } catch {

        return json(
            request,
            {
                success: false,
                error: "Invalid JSON body."
            },
            400
        );

    }


    const title =
        typeof body.title === "string"
            ? body.title.trim()
            : "";


    const description =
        typeof body.description === "string"
            ? body.description.trim()
            : "";


    const mimeType =
        typeof body.mimeType === "string"
            ? body.mimeType
            : "";


    const fileSize =
        Number(
            body.size ??
            body.fileSize
        );


    const width =
        positiveNumber(
            body.width
        );


    const height =
        positiveNumber(
            body.height
        );


    const duration =
        positiveNumber(
            body.duration
        );


    const maxTitle =
        Number(
            env.MAX_TITLE ||
            120
        );


    const maxDescription =
        Number(
            env.MAX_DESCRIPTION ||
            500
        );


    const maxUploadSize =
        Number(
            env.MAX_UPLOAD_SIZE ||
            DEFAULT_MAX_UPLOAD_SIZE
        );


    const partSize =
        Number(
            env.CHUNK_SIZE ||
            DEFAULT_CHUNK_SIZE
        );


    if (!title) {

        return json(
            request,
            {
                success: false,
                error: "A title is required."
            },
            400
        );

    }


    if (
        title.length >
        maxTitle
    ) {

        return json(
            request,
            {
                success: false,
                error: "Title is too long."
            },
            400
        );

    }


    if (
        description.length >
        maxDescription
    ) {

        return json(
            request,
            {
                success: false,
                error: "Description is too long."
            },
            400
        );

    }


   if (
    ![
        "video/mp4",
        "video/webm",
        "video/ogg",
        "application/ogg",
        "video/quicktime"
    ].includes(mimeType)
) {
    return json(
        request,
        {
            success: false,
            error:
                "Supported formats are MP4, M4V, WebM, OGV/OGG, and MOV."
        },
        400
    );
}


    if (
        !Number.isFinite(fileSize) ||
        fileSize <= 0
    ) {

        return json(
            request,
            {
                success: false,
                error: "Invalid file size."
            },
            400
        );

    }


    if (
        fileSize >
        maxUploadSize
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "The file exceeds the 6 GB limit."
            },
            400
        );

    }


    if (
        !Number.isInteger(partSize) ||
        partSize <
            5 * 1024 * 1024
    ) {

        throw new Error(
            "CHUNK_SIZE must be at least 5 MiB."
        );

    }


    const videoId =
        await uniqueVideoId(env);


    function getExtensionFromMimeType(mimeType) {
    switch (mimeType) {
        case "video/mp4":
            return "mp4";

        case "video/webm":
            return "webm";

        case "video/quicktime":
            return "mov";

        case "video/ogg":
        case "application/ogg":
            return "ogv";

        default:
            throw new Error(
                `Unsupported MIME type: ${mimeType}`
            );
    }
}

const extension = getExtensionFromMimeType(mimeType);


    const objectKey =
        `videos/${videoId}.${extension}`;


    const expectedChunks =
        Math.ceil(
            fileSize /
            partSize
        );


    const now =
        Math.floor(
            Date.now() /
            1000
        );


    const retentionSeconds =
        fileSize <=
        1024 * 1024 * 1024

            ? 365 *
              24 *
              60 *
              60

            : 180 *
              24 *
              60 *
              60;


    const expiresAt =
        now +
        retentionSeconds;


    const multipart =
        await env.VIDEOS
            .createMultipartUpload(
                objectKey,
                {
                    httpMetadata: {
                        contentType:
                            mimeType
                    }
                }
            );


    try {

        await env.DB.batch([

            env.DB
                .prepare(`
                    INSERT INTO multipart_uploads (
                        upload_id,
                        video_id,
                        object_key,
                        title,
                        description,
                        mime_type,
                        file_size,
                        width,
                        height,
                        duration_seconds,
                        created_at,
                        expires_at,
                        completed
                    )
                    VALUES (
                        ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, 0
                    )
                `)
                .bind(
                    multipart.uploadId,
                    videoId,
                    objectKey,
                    title,
                    description,
                    mimeType,
                    fileSize,
                    width,
                    height,
                    duration,
                    now,
                    expiresAt
                ),


            env.DB
                .prepare(`
                    INSERT INTO upload_sessions (
                        upload_id,
                        created,
                        updated,
                        expected_chunks,
                        received_chunks,
                        completed
                    )
                    VALUES (
                        ?, ?, ?, ?, 0, 0
                    )
                `)
                .bind(
                    multipart.uploadId,
                    now,
                    now,
                    expectedChunks
                )

        ]);

    } catch (error) {

        try {

            await multipart.abort();

        } catch (abortError) {

            console.error(
                "Unable to abort failed multipart upload:",
                abortError
            );

        }


        throw error;

    }


    return json(
        request,
        {
            success: true,
            videoId,
            uploadId:
                multipart.uploadId,
            objectKey,
            partSize,
            expectedChunks,
            expiresAt
        }
    );

}


/*
============================================================
POST /upload/part
============================================================
*/

async function uploadPart(
    request,
    env
) {

    const uploadId =
        request.headers.get(
            "Upload-Id"
        );


    const objectKey =
        request.headers.get(
            "Object-Key"
        );


    const partNumber =
        Number.parseInt(
            request.headers.get(
                "Part-Number"
            ) || "",
            10
        );


    if (
        !uploadId ||
        !objectKey
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Upload-Id and Object-Key headers are required."
            },
            400
        );

    }


    if (
        !Number.isInteger(partNumber) ||
        partNumber < 1 ||
        partNumber > 10000
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Invalid multipart part number."
            },
            400
        );

    }


    const session =
        await env.DB
            .prepare(`
                SELECT
                    mu.video_id,
                    mu.object_key,
                    mu.completed,
                    us.expected_chunks

                FROM multipart_uploads AS mu

                JOIN upload_sessions AS us
                    ON us.upload_id =
                       mu.upload_id

                WHERE mu.upload_id = ?

                LIMIT 1
            `)
            .bind(uploadId)
            .first();


    if (!session) {

        return json(
            request,
            {
                success: false,
                error:
                    "Upload session not found."
            },
            404
        );

    }


    if (
        session.object_key !==
        objectKey
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Object key does not match this upload."
            },
            403
        );

    }


    if (
        Number(
            session.completed
        ) === 1
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Upload is already complete."
            },
            409
        );

    }


    if (
        partNumber >
        Number(
            session.expected_chunks
        )
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Part number exceeds expected part count."
            },
            400
        );

    }


    const chunk =
        await request.arrayBuffer();


    if (
        chunk.byteLength === 0
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Uploaded part is empty."
            },
            400
        );

    }


    const multipart =
        env.VIDEOS
            .resumeMultipartUpload(
                objectKey,
                uploadId
            );


    const uploadedPart =
        await multipart.uploadPart(
            partNumber,
            chunk
        );


    const now =
        Math.floor(
            Date.now() /
            1000
        );


    await env.DB
        .prepare(`
            INSERT INTO multipart_parts (
                upload_id,
                part_number,
                etag,
                size
            )
            VALUES (?, ?, ?, ?)

            ON CONFLICT (
                upload_id,
                part_number
            )

            DO UPDATE SET
                etag =
                    excluded.etag,
                size =
                    excluded.size
        `)
        .bind(
            uploadId,
            partNumber,
            uploadedPart.etag,
            chunk.byteLength
        )
        .run();


    await env.DB
        .prepare(`
            UPDATE upload_sessions

            SET
                updated = ?,

                received_chunks = (
                    SELECT COUNT(*)
                    FROM multipart_parts
                    WHERE upload_id = ?
                )

            WHERE upload_id = ?
        `)
        .bind(
            now,
            uploadId,
            uploadId
        )
        .run();


    return json(
        request,
        {
            success: true,
            videoId:
                session.video_id,
            uploadId,
            objectKey,
            partNumber:
                uploadedPart.partNumber ??
                partNumber,
            etag:
                uploadedPart.etag,
            size:
                chunk.byteLength
        }
    );

}


/*
============================================================
POST /upload/finish
============================================================
*/

async function uploadFinish(
    request,
    env
) {

    let body;


    try {

        body =
            await request.json();

    } catch {

        return json(
            request,
            {
                success: false,
                error: "Invalid JSON body."
            },
            400
        );

    }


    const uploadId =
        typeof body.uploadId === "string"
            ? body.uploadId.trim()
            : "";


    const objectKey =
        typeof body.objectKey === "string"
            ? body.objectKey.trim()
            : "";


    if (
        !uploadId ||
        !objectKey
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "uploadId and objectKey are required."
            },
            400
        );

    }


    const upload =
        await env.DB
            .prepare(`
                SELECT
                    mu.*,
                    us.expected_chunks,
                    us.received_chunks

                FROM multipart_uploads AS mu

                JOIN upload_sessions AS us
                    ON us.upload_id =
                       mu.upload_id

                WHERE mu.upload_id = ?

                LIMIT 1
            `)
            .bind(uploadId)
            .first();


    if (!upload) {

        return json(
            request,
            {
                success: false,
                error:
                    "Upload session not found."
            },
            404
        );

    }


    if (
        upload.object_key !==
        objectKey
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Object key does not match this upload."
            },
            403
        );

    }


    const partQuery =
        await env.DB
            .prepare(`
                SELECT
                    part_number,
                    etag,
                    size

                FROM multipart_parts

                WHERE upload_id = ?

                ORDER BY
                    part_number ASC
            `)
            .bind(uploadId)
            .all();


    const storedParts =
        partQuery.results || [];


    const expectedChunks =
        Number(
            upload.expected_chunks
        );


    if (
        storedParts.length !==
        expectedChunks
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    `Upload is incomplete: ` +
                    `${storedParts.length} of ` +
                    `${expectedChunks} parts received.`
            },
            409
        );

    }


    for (
        let index = 0;
        index < storedParts.length;
        index++
    ) {

        if (
            Number(
                storedParts[index]
                    .part_number
            ) !==
            index + 1
        ) {

            return json(
                request,
                {
                    success: false,
                    error:
                        `Missing multipart part ` +
                        `${index + 1}.`
                },
                409
            );

        }

    }


    const uploadedBytes =
        storedParts.reduce(
            (sum, part) =>
                sum +
                Number(
                    part.size || 0
                ),
            0
        );


    if (
        uploadedBytes !==
        Number(
            upload.file_size
        )
    ) {

        return json(
            request,
            {
                success: false,
                error:
                    "Uploaded byte count does not match the original file size."
            },
            409
        );

    }


    const completedParts =
        storedParts.map(
            part => ({
                partNumber:
                    Number(
                        part.part_number
                    ),
                etag:
                    part.etag
            })
        );


    const multipart =
        env.VIDEOS
            .resumeMultipartUpload(
                objectKey,
                uploadId
            );


    await multipart.complete(
        completedParts
    );


    const now =
        Math.floor(
            Date.now() /
            1000
        );


    const webmKey =
        upload.mime_type ===
        "video/webm"

            ? objectKey
            : null;


    const mp4Key =
        upload.mime_type ===
        "video/mp4"

            ? objectKey
            : null;


    await env.DB.batch([

        env.DB
            .prepare(`
                INSERT INTO videos (
                    id,
                    title,
                    description,
                    filename,
                    mime_type,
                    file_size,
                    width,
                    height,
                    duration_seconds,
                    thumbnail_key,
                    webm_key,
                    mp4_key,
                    upload_date,
                    expiration_date,
                    extension_count,
                    views,
                    last_extension_hash,
                    status
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, NULL, ?, ?,
                    ?, ?, 0, 0, NULL,
                    'active'
                )
            `)
            .bind(
                upload.video_id,
                upload.title,
                upload.description,
                objectKey,
                upload.mime_type,
                Number(
                    upload.file_size
                ),
                Number(
                    upload.width || 0
                ),
                Number(
                    upload.height || 0
                ),
                Number(
                    upload.duration_seconds ||
                    0
                ),
                webmKey,
                mp4Key,
                now,
                Number(
                    upload.expires_at
                )
            ),


        env.DB
            .prepare(`
                DELETE FROM multipart_parts
                WHERE upload_id = ?
            `)
            .bind(uploadId),


        env.DB
            .prepare(`
                DELETE FROM upload_sessions
                WHERE upload_id = ?
            `)
            .bind(uploadId),


        env.DB
            .prepare(`
                DELETE FROM multipart_uploads
                WHERE upload_id = ?
            `)
            .bind(uploadId)

    ]);


    return json(
        request,
        {
            success: true,
            videoId:
                upload.video_id,
            objectKey,
            url:
                `https://domain.com/vid?id=` +
                encodeURIComponent(
                    upload.video_id
                )
        }
    );

}


/*
============================================================
GET /video
============================================================
*/

async function getVideoMetadata(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
        return json(
            request,
            {
                success: false,
                error: "Missing video ID."
            },
            400
        );
    }

    const video = await env.DB
        .prepare(`
            SELECT
                id,
                title,
                description,
                mime_type,
                file_size,
                width,
                height,
                duration_seconds,
                views,
                upload_date,
                expiration_date,
                never_expires,
                extension_count

            FROM videos

            WHERE id = ?
            AND status = 'active'

            LIMIT 1
        `)
        .bind(id)
        .first();

    if (!video) {
        return json(
            request,
            {
                success: false,
                error: "Video not found."
            },
            404
        );
    }

const now =
    Math.floor(Date.now() / 1000);

const neverExpires =
    Number(video.never_expires) === 1;

const expired =
    !neverExpires &&
    Number(video.expiration_date) <= now;

    /*
    ============================================================
    Expiration banner calculations go here
    ============================================================
    */



    const expirationDate =
        Number(video.expiration_date);

    const secondsRemaining =
        expirationDate - now;

    const twentyNineDays =
        29 * 24 * 60 * 60;

    const sevenDays =
        7 * 24 * 60 * 60;

    const showExpirationBanner =
        !neverExpires &&
        secondsRemaining > 0 &&
        secondsRemaining <= twentyNineDays;

    const canExtend =
        !neverExpires &&
        secondsRemaining > 0 &&
        secondsRemaining <= sevenDays;

    const isSmallVideo =
        Number(video.file_size) <=
        1024 * 1024 * 1024;

    const extensionMonths =
        isSmallVideo ? 12 : 6;

    /*
    ============================================================
    Final metadata response
    ============================================================
    */

    return json(
        request,
        {
            success: true,

            video: {
                ...video,

                streamUrl:
                    `/stream?id=` +
                    encodeURIComponent(id),

                seconds_remaining:
                    Math.max(0, secondsRemaining),

                show_expiration_banner:
                    showExpirationBanner,

                can_extend:
                    canExtend,

                extension_months:
                    extensionMonths
            }
        }
    );
}

/*
============================================================
GET /stream
============================================================
*/

/*
============================================================
GET /stream?id=VIDEO_ID
============================================================
*/

async function streamVideo(request, env) {
    const url = new URL(request.url);
    const videoId = url.searchParams.get("id");

    if (!videoId) {
        return new Response(
            "Missing video ID",
            {
                status: 400,
                headers: corsHeaders(request)
            }
        );
    }

    const video = await env.DB
        .prepare(`
            SELECT
                id,
                filename,
                mime_type,
                webm_key,
                mp4_key,
                expiration_date,
                never_expires,
                status

            FROM videos

            WHERE id = ?

            LIMIT 1
        `)
        .bind(videoId)
        .first();

    if (!video) {
        return new Response(
            "Video not found",
            {
                status: 404,
                headers: corsHeaders(request)
            }
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const expired =
    Number(video.never_expires) !== 1 &&
    Number(video.expiration_date) <= now;

    if (
        video.status !== "active" ||
        Number(video.expiration_date) <= now
    ) {
        return new Response(
            "Video unavailable",
            {
                status: 410,
                headers: corsHeaders(request)
            }
        );
    }

    const objectKey =
        video.webm_key ||
        video.mp4_key ||
        video.filename;

    if (!objectKey) {
        return new Response(
            "Video object key is missing",
            {
                status: 500,
                headers: corsHeaders(request)
            }
        );
    }

    /*
     * Read object metadata first.
     */
    const objectMetadata =
        await env.VIDEOS.head(objectKey);

    if (!objectMetadata) {
        return new Response(
            "Video object not found in R2",
            {
                status: 404,
                headers: corsHeaders(request)
            }
        );
    }

    const totalSize =
        Number(objectMetadata.size);

    const contentType =
        video.mime_type ||
        objectMetadata.httpMetadata?.contentType ||
        "application/octet-stream";

    const rangeHeader =
        request.headers.get("Range");

    /*
     * No Range header:
     * return the full object.
     */
    if (!rangeHeader) {
        const object =
            await env.VIDEOS.get(objectKey);

        if (!object) {
            return new Response(
                "Video object not found in R2",
                {
                    status: 404,
                    headers: corsHeaders(request)
                }
            );
        }

        return new Response(
            request.method === "HEAD"
                ? null
                : object.body,
            {
                status: 200,

                headers: {
                    ...corsHeaders(request),

                    "Content-Type":
                        contentType,

                    "Content-Length":
                        String(totalSize),

                    "Accept-Ranges":
                        "bytes",

                    "Cache-Control":
                        "public, max-age=3600"
                }
            }
        );
    }

    /*
     * Parse:
     * Range: bytes=START-END
     */
    const match =
        /^bytes=(\d*)-(\d*)$/.exec(
            rangeHeader.trim()
        );

    if (!match) {
        return new Response(
            "Invalid Range",
            {
                status: 416,

                headers: {
                    ...corsHeaders(request),

                    "Content-Range":
                        `bytes */${totalSize}`
                }
            }
        );
    }

    let start;
    let end;

    /*
     * Suffix range:
     * bytes=-500
     */
    if (
        match[1] === "" &&
        match[2] !== ""
    ) {
        const suffixLength =
            Number(match[2]);

        if (
            !Number.isFinite(suffixLength) ||
            suffixLength <= 0
        ) {
            return new Response(
                "Invalid Range",
                {
                    status: 416,

                    headers: {
                        ...corsHeaders(request),

                        "Content-Range":
                            `bytes */${totalSize}`
                    }
                }
            );
        }

        start =
            Math.max(
                totalSize - suffixLength,
                0
            );

        end =
            totalSize - 1;
    } else {
        start =
            Number(match[1]);

        end =
            match[2] !== ""
                ? Number(match[2])
                : totalSize - 1;
    }

    if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end < start ||
        start >= totalSize
    ) {
        return new Response(
            "Range Not Satisfiable",
            {
                status: 416,

                headers: {
                    ...corsHeaders(request),

                    "Content-Range":
                        `bytes */${totalSize}`
                }
            }
        );
    }

    end =
        Math.min(
            end,
            totalSize - 1
        );

    const length =
        end - start + 1;

    const object =
        await env.VIDEOS.get(
            objectKey,
            {
                range: {
                    offset: start,
                    length
                }
            }
        );

    if (!object) {
        return new Response(
            "Video object not found in R2",
            {
                status: 404,
                headers: corsHeaders(request)
            }
        );
    }

    return new Response(
        request.method === "HEAD"
            ? null
            : object.body,
        {
            status: 206,

            headers: {
                ...corsHeaders(request),

                "Content-Type":
                    contentType,

                "Content-Length":
                    String(length),

                "Content-Range":
                    `bytes ${start}-${end}/${totalSize}`,

                "Accept-Ranges":
                    "bytes",

                "Cache-Control":
                    "public, max-age=3600"
            }
        }
    );
}

/*
============================================================
POST /extend
============================================================
*/

async function extendVideo(request, env) {
    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            request,
            {
                success: false,
                error: "Invalid JSON body."
            },
            400
        );
    }

    const videoId =
        typeof body.id === "string"
            ? body.id.trim()
            : "";

    if (!videoId) {
        return json(
            request,
            {
                success: false,
                error: "A video ID is required."
            },
            400
        );
    }

    const video =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    file_size,
                    expiration_date,
                    never_expires,
                    extension_count,
                    status

                FROM videos

                WHERE id = ?

                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!video) {
        return json(
            request,
            {
                success: false,
                error: "Video not found."
            },
            404
        );
    }

    const now =
        Math.floor(Date.now() / 1000);

    if (video.status !== "active") {
        return json(
            request,
            {
                success: false,
                error: "This video is not active."
            },
            410
        );
    }

    const currentExpiration =
        Number(video.expiration_date);

    const secondsRemaining =
        currentExpiration - now;

    const sevenDays =
        7 * 24 * 60 * 60;

    /*
     * Extension is available only during the final
     * seven days before expiration.
     */
    if (
        secondsRemaining <= 0 ||
        secondsRemaining > sevenDays
    ) {
        return json(
            request,
            {
                success: false,
                error:
                    "This video can only be extended during " +
                    "its final seven days."
            },
            409
        );
    }

    const oneGigabyte =
        1024 * 1024 * 1024;

    const isSmallVideo =
        Number(video.file_size) <= oneGigabyte;

    const extensionSeconds =
        isSmallVideo
            ? 365 * 24 * 60 * 60
            : 180 * 24 * 60 * 60;

    /*
     * Extend from the current expiration date so the
     * remaining time is preserved.
     */
    const newExpiration =
        currentExpiration + extensionSeconds;

    /*
     * The expiration_date check prevents two simultaneous
     * requests from both extending from the same old date.
     */
    const updateResult =
        await env.DB
            .prepare(`
                UPDATE videos

                SET
                    expiration_date = ?,
                    extension_count = extension_count + 1,
                    last_extension_hash = NULL

                WHERE id = ?
                AND expiration_date = ?
                AND status = 'active'
            `)
            .bind(
                newExpiration,
                videoId,
                currentExpiration
            )
            .run();

    const changed =
        Number(updateResult?.meta?.changes || 0);

    if (changed !== 1) {
        return json(
            request,
            {
                success: false,
                error:
                    "The video expiration changed during this request. " +
                    "Refresh the page and try again."
            },
            409
        );
    }

    /*
     * The existing extensions.hashed_ip column is NOT NULL.
     * Store a neutral value unless you migrate that table.
     */
    await env.DB
        .prepare(`
            INSERT INTO extensions (
                video_id,
                extension_time,
                hashed_ip
            )

            VALUES (?, ?, ?)
        `)
        .bind(
            videoId,
            now,
            "not-collected"
        )
        .run();

    return json(
        request,
        {
            success: true,

            videoId,

            expirationDate:
                newExpiration,

            extensionCount:
                Number(video.extension_count || 0) + 1,

            extensionDays:
                isSmallVideo ? 365 : 180,

            extensionMonths:
                isSmallVideo ? 12 : 6,

            message:
                isSmallVideo
                    ? "Video extended for another 12 months."
                    : "Video extended for another 6 months."
        }
    );
}

/*
============================================================
GET /search?q=QUERY&page=1
============================================================
*/

async function searchVideos(request, env) {
    const url =
        new URL(request.url);

    const rawQuery =
        url.searchParams.get("q") || "";

    /*
     * Normalize repeated whitespace while preserving
     * apostrophes and normal title punctuation.
     */
    const query =
        rawQuery
            .trim()
            .replace(/\s+/g, " ");

    const requestedPage =
        Number.parseInt(
            url.searchParams.get("page") || "1",
            10
        );

    const page =
        Number.isInteger(requestedPage) &&
        requestedPage > 0
            ? requestedPage
            : 1;

    const limit = 10;
    const offset = (page - 1) * limit;

    /*
     * Require at least two characters to avoid expensive
     * searches for every one-letter request.
     */
    if (query.length < 2) {
        return json(
            request,
            {
                success: false,
                error:
                    "Search must contain at least 2 characters."
            },
            400
        );
    }

    /*
     * Cloudflare currently documents a 50-byte limit for
     * LIKE and GLOB patterns in D1. Keep our public search
     * comfortably below that limit.
     */
    if (
        query.length > 40 ||
        new TextEncoder().encode(query).length > 40
    ) {
        return json(
            request,
            {
                success: false,
                error:
                    "Search cannot exceed 40 characters."
            },
            400
        );
    }

    const now =
        Math.floor(Date.now() / 1000);

    /*
     * Escape LIKE wildcard characters so a user searching
     * for "%" or "_" does not turn them into SQL wildcards.
     */
    const escapedQuery =
        escapeLikePattern(query);

    const containsPattern =
        `%${escapedQuery}%`;

    const beginsPattern =
        `${escapedQuery}%`;

    const exactPattern =
        escapedQuery;

    const countRow =
        await env.DB
            .prepare(`
                SELECT COUNT(*) AS total

                FROM videos

                WHERE status = 'active'
                AND never_expires = 1
                OR expiration_date > ?
                AND LOWER(title)
                    LIKE LOWER(?) ESCAPE '\\'
            `)
            .bind(
                now,
                containsPattern
            )
            .first();

    const totalVideos =
        Number(countRow?.total || 0);

    const totalPages =
        Math.max(
            1,
            Math.ceil(totalVideos / limit)
        );

    const result =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    title,
                    description,
                    mime_type,
                    file_size,
                    width,
                    height,
                    duration_seconds,
                    thumbnail_key,
                    views,
                    upload_date,
                    expiration_date

                FROM videos

                WHERE status = 'active'
                AND expiration_date > ?
                AND LOWER(title)
                    LIKE LOWER(?) ESCAPE '\\'

                ORDER BY
                    CASE
                        WHEN LOWER(title) = LOWER(?)
                            THEN 0

                        WHEN LOWER(title)
                            LIKE LOWER(?) ESCAPE '\\'
                            THEN 1

                        ELSE 2
                    END ASC,

                    views DESC,
                    upload_date DESC

                LIMIT ?
                OFFSET ?
            `)
            .bind(
                now,
                containsPattern,
                exactPattern,
                beginsPattern,
                limit,
                offset
            )
            .all();

    const videos =
        (result.results || []).map(video => ({
            id:
                video.id,

            title:
                video.title,

            description:
                video.description,

            mimeType:
                video.mime_type,

            fileSize:
                Number(video.file_size || 0),

            width:
                Number(video.width || 0),

            height:
                Number(video.height || 0),

            durationSeconds:
                Number(video.duration_seconds || 0),

            views:
                Number(video.views || 0),

            uploadDate:
                Number(video.upload_date || 0),

            expirationDate:
                Number(video.expiration_date || 0),

            videoUrl:
                `https://domain.com/vid?id=` +
                encodeURIComponent(video.id),

            thumbnailUrl:
                video.thumbnail_key
                    ? `${url.origin}/thumbnail?id=` +
                      encodeURIComponent(video.id)
                    : null
        }));

    return json(
        request,
        {
            success: true,

            query,

            page,

            limit,

            totalVideos,

            totalPages,

            hasPreviousPage:
                page > 1,

            hasNextPage:
                page < totalPages,

            previousPage:
                page > 1
                    ? page - 1
                    : null,

            nextPage:
                page < totalPages
                    ? page + 1
                    : null,

            videos
        }
    );
}

/*
============================================================
GET /popular?page=1
============================================================
*/

async function getPopular(request, env) {
    const url =
        new URL(request.url);

    const requestedPage =
        Number.parseInt(
            url.searchParams.get("page") || "1",
            10
        );

    const page =
        Number.isInteger(requestedPage) &&
        requestedPage > 0
            ? requestedPage
            : 1;

    const limit = 10;
    const offset = (page - 1) * limit;

    const now =
        Math.floor(Date.now() / 1000);

    /*
     * Count all homepage-eligible videos first so the
     * frontend knows how many pagination buttons to show.
     */
    const countRow =
        await env.DB
            .prepare(`
                SELECT COUNT(*) AS total

                FROM videos

                WHERE status = 'active'
                AND never_expires = 1
                OR expiration_date > ?
                AND views >= 15
            `)
            .bind(now)
            .first();

    const totalVideos =
        Number(countRow?.total || 0);

    const totalPages =
        Math.max(
            1,
            Math.ceil(totalVideos / limit)
        );

    /*
     * If the requested page is past the final page,
     * return an empty result instead of repeating data.
     */
    if (
        totalVideos > 0 &&
        page > totalPages
    ) {
        return json(
            request,
            {
                success: true,
                page,
                limit,
                totalVideos,
                totalPages,
                hasPreviousPage:
                    page > 1,
                hasNextPage:
                    false,
                videos: []
            }
        );
    }

    const result =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    title,
                    description,
                    mime_type,
                    file_size,
                    width,
                    height,
                    duration_seconds,
                    thumbnail_key,
                    views,
                    upload_date,
                    expiration_date

                FROM videos

                WHERE status = 'active'
                AND expiration_date > ?
                AND views >= 15

                ORDER BY
                    views DESC,
                    upload_date DESC

                LIMIT ?
                OFFSET ?
            `)
            .bind(
                now,
                limit,
                offset
            )
            .all();

    const videos =
        (result.results || []).map(video => ({
            id:
                video.id,

            title:
                video.title,

            description:
                video.description,

            mimeType:
                video.mime_type,

            fileSize:
                Number(video.file_size || 0),

            width:
                Number(video.width || 0),

            height:
                Number(video.height || 0),

            durationSeconds:
                Number(video.duration_seconds || 0),

            views:
                Number(video.views || 0),

            uploadDate:
                Number(video.upload_date || 0),

            expirationDate:
                Number(video.expiration_date || 0),

            /*
             * Public static viewer page.
             */
            videoUrl:
                `https://domain.com/vid?id=` +
                encodeURIComponent(video.id),

            /*
             * Use the Worker endpoint because R2 remains private.
             * This will return 404 until thumbnail upload support
             * is added, so home.html should show a placeholder.
             */
            thumbnailUrl:
                video.thumbnail_key
                    ? `${url.origin}/thumbnail?id=` +
                      encodeURIComponent(video.id)
                    : null
        }));

    return json(
        request,
        {
            success: true,

            page,

            limit,

            minimumViews:
                15,

            totalVideos,

            totalPages,

            hasPreviousPage:
                page > 1,

            hasNextPage:
                page < totalPages,

            previousPage:
                page > 1
                    ? page - 1
                    : null,

            nextPage:
                page < totalPages
                    ? page + 1
                    : null,

            videos
        }
    );
}


/*
============================================================
POST /thumbnail
============================================================
*/

async function uploadThumbnailImage(request, env) {
    const videoId =
        request.headers.get("X-Video-Id")?.trim() || "";

    if (!videoId) {
        return json(
            request,
            {
                success: false,
                error: "X-Video-Id header is required."
            },
            400
        );
    }

    const contentType =
        request.headers.get("Content-Type") || "";

    if (contentType !== "image/webp") {
        return json(
            request,
            {
                success: false,
                error: "Thumbnail must be WebP."
            },
            415
        );
    }

    const video =
        await env.DB
            .prepare(`
                SELECT id
                FROM videos
                WHERE id = ?
                AND status = 'active'
                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!video) {
        return json(
            request,
            {
                success: false,
                error: "Video not found."
            },
            404
        );
    }

    const body =
        await request.arrayBuffer();

    if (body.byteLength === 0) {
        return json(
            request,
            {
                success: false,
                error: "Thumbnail file is empty."
            },
            400
        );
    }

    const maxThumbnailSize =
        2 * 1024 * 1024;

    if (body.byteLength > maxThumbnailSize) {
        return json(
            request,
            {
                success: false,
                error: "Thumbnail exceeds the 2 MB limit."
            },
            413
        );
    }

    const thumbnailKey =
        `thumbnails/${videoId}.webp`;

    await env.VIDEOS.put(
        thumbnailKey,
        body,
        {
            httpMetadata: {
                contentType: "image/webp",
                cacheControl:
                    "public, max-age=86400"
            }
        }
    );

    await env.DB
        .prepare(`
            UPDATE videos
            SET thumbnail_key = ?
            WHERE id = ?
        `)
        .bind(
            thumbnailKey,
            videoId
        )
        .run();

    return json(
        request,
        {
            success: true,
            videoId,
            thumbnailKey,
            thumbnailUrl:
                `/thumbnail?id=` +
                encodeURIComponent(videoId)
        }
    );
}


/*
============================================================
GET /thumbnail?id=VIDEO_ID
============================================================
*/

async function getThumbnail(request, env) {
    const url =
        new URL(request.url);

    const videoId =
        url.searchParams.get("id");

    if (!videoId) {
        return new Response(
            "Missing video ID",
            {
                status: 400,
                headers: corsHeaders(request)
            }
        );
    }

    const video =
        await env.DB
            .prepare(`
                SELECT thumbnail_key
                FROM videos
                WHERE id = ?
                AND status = 'active'
                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!video?.thumbnail_key) {
        return new Response(
            "Thumbnail not found",
            {
                status: 404,
                headers: corsHeaders(request)
            }
        );
    }

    const object =
        await env.VIDEOS.get(
            video.thumbnail_key
        );

    if (!object) {
        return new Response(
            "Thumbnail object not found",
            {
                status: 404,
                headers: corsHeaders(request)
            }
        );
    }

    return new Response(
        request.method === "HEAD"
            ? null
            : object.body,
        {
            status: 200,

            headers: {
                ...corsHeaders(request),

                "Content-Type":
                    "image/webp",

                "Content-Length":
                    String(object.size),

                "Cache-Control":
                    "public, max-age=86400"
            }
        }
    );
}


/*
============================================================
Permanently delete expired videos
============================================================
*/

async function cleanupExpiredVideos(env) {
    const now =
        Math.floor(Date.now() / 1000);

    const query =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    filename,
                    webm_key,
                    mp4_key,
                    thumbnail_key

                FROM videos

                WHERE expiration_date <= ?
                AND never_expires = 0
                AND status IN ('active', 'expired')

                LIMIT 100
            `)
            .bind(now)
            .all();

    const expiredVideos =
        query.results || [];

    const report = {
        found: expiredVideos.length,
        deletedVideos: 0,
        deletedObjects: 0,
        failedVideos: 0,
        failures: []
    };

    for (const video of expiredVideos) {
        const uniqueObjectKeys =
            [...new Set([
                video.filename,
                video.webm_key,
                video.mp4_key,
                video.thumbnail_key
            ].filter(
                key =>
                    typeof key === "string" &&
                    key.trim() !== ""
            ))];

        try {
            for (const objectKey of uniqueObjectKeys) {
                await env.VIDEOS.delete(objectKey);

                const stillExists =
                    await env.VIDEOS.head(objectKey);

                if (stillExists) {
                    throw new Error(
                        `R2 object still exists after deletion: ${objectKey}`
                    );
                }

                report.deletedObjects++;
            }

            await env.DB.batch([
                env.DB
                    .prepare(`
                        DELETE FROM video_viewers
                        WHERE video_id = ?
                    `)
                    .bind(video.id),

                env.DB
                    .prepare(`
                        DELETE FROM daily_views
                        WHERE video_id = ?
                    `)
                    .bind(video.id),

                env.DB
                    .prepare(`
                        DELETE FROM extensions
                        WHERE video_id = ?
                    `)
                    .bind(video.id),

                env.DB
                    .prepare(`
                        DELETE FROM upload_logs
                        WHERE video_id = ?
                    `)
                    .bind(video.id),

                env.DB
                    .prepare(`
                        DELETE FROM videos
                        WHERE id = ?
                    `)
                    .bind(video.id)
            ]);

            report.deletedVideos++;
        } catch (error) {
            report.failedVideos++;

            report.failures.push({
                videoId: video.id,
                error:
                    error?.message ||
                    String(error)
            });

            console.error(
                `Cleanup failed for ${video.id}:`,
                error
            );
        }
    }

    return report;
}

/*
============================================================
Abort and remove abandoned multipart uploads
============================================================
*/

async function cleanupAbandonedUploads(env) {
    const now =
        Math.floor(Date.now() / 1000);

    const staleAfterSeconds =
        24 * 60 * 60;

    const cutoff =
        now - staleAfterSeconds;

    const query =
        await env.DB
            .prepare(`
                SELECT
                    upload_id,
                    video_id,
                    object_key,
                    created_at,
                    completed

                FROM multipart_uploads

                WHERE completed = 0
                AND created_at <= ?

                LIMIT 100
            `)
            .bind(cutoff)
            .all();

    const abandonedUploads =
        query.results || [];

    let cleaned = 0;
    let failed = 0;

    console.log(
        `Found ${abandonedUploads.length} abandoned upload(s).`
    );

    for (const upload of abandonedUploads) {
        try {
            /*chunk
             * Abort the live multipart upload if R2 still
             * recognizes the upload ID.
             */
            try {
                const multipart =
                    env.VIDEOS.resumeMultipartUpload(
                        upload.object_key,
                        upload.upload_id
                    );

                await multipart.abort();

                console.log(
                    `Aborted multipart upload: ${upload.upload_id}`
                );
            } catch (abortError) {
                /*
                 * This can occur when R2 already aborted it
                 * automatically or it was already completed.
                 * Continue with object and D1 cleanup.
                 */
                console.warn(
                    `Could not abort multipart ${upload.upload_id}:`,
                    abortError?.message || abortError
                );
            }

            /*
             * If a final object was somehow created before
             * database finalization failed, delete it too.
             */
            const completedObject =
                await env.VIDEOS.head(
                    upload.object_key
                );

            if (completedObject) {
                await env.VIDEOS.delete(
                    upload.object_key
                );

                const stillExists =
                    await env.VIDEOS.head(
                        upload.object_key
                    );

                if (stillExists) {
                    throw new Error(
                        `Abandoned object still exists: ${upload.object_key}`
                    );
                }

                console.log(
                    `Deleted abandoned R2 object: ${upload.object_key}`
                );
            }

            const chunkQuery =
    await env.DB
        .prepare(`
            SELECT r2_key
            FROM upload_chunks
            WHERE upload_id = ?
        `)
        .bind(upload.upload_id)
        .all();

const chunkKeys =
    (chunkQuery.results || [])
        .map(row => row.r2_key)
        .filter(Boolean);

for (const chunkKey of chunkKeys) {
    await env.VIDEOS.delete(chunkKey);

    console.log(
        `Deleted temporary chunk object: ${chunkKey}`
    );
}

            await env.DB.batch([
                env.DB
                    .prepare(`
                        DELETE FROM multipart_parts
                        WHERE upload_id = ?
                    `)
                    .bind(upload.upload_id),

                env.DB
                    .prepare(`
                        DELETE FROM upload_chunks
                        WHERE upload_id = ?
                    `)
                    .bind(upload.upload_id),

                env.DB
                    .prepare(`
                        DELETE FROM upload_sessions
                        WHERE upload_id = ?
                    `)
                    .bind(upload.upload_id),

                env.DB
                    .prepare(`
                        DELETE FROM multipart_uploads
                        WHERE upload_id = ?
                    `)
                    .bind(upload.upload_id)
            ]);

            cleaned++;

            console.log(
                `Abandoned upload cleaned: ${upload.upload_id}`
            );
        } catch (error) {
            failed++;

            console.error(
                `Abandoned-upload cleanup failed for ` +
                `${upload.upload_id}:`,
                error?.stack || error
            );
        }
    }

    return {
        found:
            abandonedUploads.length,

        cleaned,

        failed
    };
}


/*
============================================================
Combined scheduled cleanup
============================================================
*/

async function runStorageCleanup(env) {
    const expiredResult =
        await cleanupExpiredVideos(env);

    const abandonedResult =
        await cleanupAbandonedUploads(env);

    console.log("Storage cleanup finished:", {
        expiredVideos:
            expiredResult.cleaned,

        expiredFailures:
            expiredResult.failed,

        abandonedUploads:
            abandonedResult.cleaned,

        abandonedFailures:
            abandonedResult.failed
    });

    return {
        expiredResult,
        abandonedResult
    };
}

       /*
============================================================
POST /view
============================================================
*/

async function recordVideoView(request, env) {
    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            request,
            {
                success: false,
                error: "Invalid JSON body."
            },
            400
        );
    }

    const videoId =
        typeof body.id === "string"
            ? body.id.trim()
            : "";

    const viewerId =
        request.headers.get("X-Viewer-Id")?.trim() || "";

    if (!videoId) {
        return json(
            request,
            {
                success: false,
                error: "A video ID is required."
            },
            400
        );
    }

    if (
        !viewerId ||
        viewerId.length < 16 ||
        viewerId.length > 100
    ) {
        return json(
            request,
            {
                success: false,
                error: "A valid viewer ID is required."
            },
            400
        );
    }

    const now =
        Math.floor(Date.now() / 1000);

    const video =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    views,
                    status,
                    expiration_date

                FROM videos

                WHERE id = ?

                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!video) {
        return json(
            request,
            {
                success: false,
                error: "Video not found."
            },
            404
        );
    }

    if (
        video.status !== "active" ||
        Number(video.expiration_date) <= now
    ) {
        return json(
            request,
            {
                success: false,
                error: "Video is unavailable."
            },
            410
        );
    }

    /*
     * One counted view per browser, per video, every 24 hours.
     */
    const cooldownSeconds =
        24 * 60 * 60;

    const cutoff =
        now - cooldownSeconds;

    const existingViewer =
        await env.DB
            .prepare(`
                SELECT last_view_at

                FROM video_viewers

                WHERE video_id = ?
                AND viewer_id = ?

                LIMIT 1
            `)
            .bind(
                videoId,
                viewerId
            )
            .first();

    if (
        existingViewer &&
        Number(existingViewer.last_view_at) > cutoff
    ) {
        return json(
            request,
            {
                success: true,
                counted: false,
                views: Number(video.views || 0),
                homepageEligible:
                    Number(video.views || 0) >= 15,
                cooldownSeconds
            }
        );
    }

    await env.DB.batch([
        env.DB
            .prepare(`
                INSERT INTO video_viewers (
                    video_id,
                    viewer_id,
                    last_view_at
                )

                VALUES (?, ?, ?)

                ON CONFLICT(video_id, viewer_id)
                DO UPDATE SET
                    last_view_at = excluded.last_view_at
            `)
            .bind(
                videoId,
                viewerId,
                now
            ),

        env.DB
            .prepare(`
                UPDATE videos

                SET views = views + 1

                WHERE id = ?
            `)
            .bind(videoId),

        env.DB
            .prepare(`
                INSERT INTO daily_views (
                    video_id,
                    day,
                    views
                )

                VALUES (?, ?, 1)

                ON CONFLICT(video_id, day)
                DO UPDATE SET
                    views = views + 1
            `)
            .bind(
                videoId,
                startOfUtcDay(now)
            )
    ]);

    const updatedVideo =
        await env.DB
            .prepare(`
                SELECT views
                FROM videos
                WHERE id = ?
            `)
            .bind(videoId)
            .first();

    const updatedViews =
        Number(updatedVideo?.views || 0);

    return json(
        request,
        {
            success: true,
            counted: true,
            views: updatedViews,
            homepageEligible:
                updatedViews >= 15,
            cooldownSeconds
        }
    );
}

/*
============================================================
POST /admin/login
============================================================
*/

async function adminLogin(
    request,
    env
) {
    let body;

    try {
        body =
            await request.json();
    } catch {
        return json(
            request,
            {
                success: false,
                error:
                    "Invalid JSON body."
            },
            400
        );
    }

    const password =
        typeof body.password === "string"
            ? body.password
            : "";

    if (
        !env.ADMIN_PASSWORD ||
        !env.ADMIN_TOKEN_SECRET
    ) {
        console.error(
            "Admin secrets are not configured."
        );

        return json(
            request,
            {
                success: false,
                error:
                    "Admin authentication is not configured."
            },
            500
        );
    }

    const validPassword =
        await secureTextEquals(
            password,
            env.ADMIN_PASSWORD
        );

    if (!validPassword) {
        /*
         * Do not reveal whether the username,
         * password, or configuration was wrong.
         */
        return json(
            request,
            {
                success: false,
                error:
                    "Invalid administrator credentials."
            },
            401
        );
    }

    const token =
        await createAdminToken(env);

    return json(
        request,
        {
            success: true,
            token,
            expiresIn:
                60 * 60
        }
    );
}

/*
============================================================
GET /admin/videos?page=1
============================================================
*/

async function getAdminVideos(
    request,
    env
) {
    const url =
        new URL(request.url);

    const requestedPage =
        Number.parseInt(
            url.searchParams.get("page") ||
            "1",
            10
        );

    const page =
        Number.isInteger(requestedPage) &&
        requestedPage > 0
            ? requestedPage
            : 1;

    const limit = 20;

    const offset =
        (page - 1) *
        limit;

    const countRow =
        await env.DB
            .prepare(`
                SELECT COUNT(*) AS total
                FROM videos
            `)
            .first();

    const totalVideos =
        Number(
            countRow?.total || 0
        );

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalVideos /
                limit
            )
        );

    const result =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    title,
                    description,
                    mime_type,
                    file_size,
                    duration_seconds,
                    thumbnail_key,
                    views,
                    upload_date,
                    expiration_date,
                    extension_count,
                    status,
                    moderation_status,
                    never_expires

                FROM videos

                ORDER BY
                    upload_date DESC

                LIMIT ?
                OFFSET ?
            `)
            .bind(
                limit,
                offset
            )
            .all();

    const origin =
        new URL(
            request.url
        ).origin;

    const videos =
        (result.results || [])
            .map(video => ({
                id:
                    video.id,

                title:
                    video.title,

                description:
                    video.description,

                mimeType:
                    video.mime_type,

                fileSize:
                    Number(
                        video.file_size || 0
                    ),

                durationSeconds:
                    Number(
                        video.duration_seconds ||
                        0
                    ),

                views:
                    Number(
                        video.views || 0
                    ),

                uploadDate:
                    Number(
                        video.upload_date || 0
                    ),

                expirationDate:
                    Number(
                        video.expiration_date ||
                        0
                    ),

                extensionCount:
                    Number(
                        video.extension_count ||
                        0
                    ),

                status:
                    video.status,

                moderationStatus:
                    video.moderation_status,

                neverExpires:
                    Number(
                        video.never_expires
                    ) === 1,

                videoUrl:
                    `https://domain.com/vid?id=` +
                    encodeURIComponent(
                        video.id
                    ),

                thumbnailUrl:
                    video.thumbnail_key
                        ? `${origin}/thumbnail?id=` +
                          encodeURIComponent(
                              video.id
                          )
                        : null
            }));

    return json(
        request,
        {
            success: true,
            page,
            limit,
            totalVideos,
            totalPages,

            hasPreviousPage:
                page > 1,

            hasNextPage:
                page < totalPages,

            videos
        }
    );
}

/*
============================================================
POST /admin/video/permanent
============================================================
*/

async function setVideoPermanentStatus(
    request,
    env
) {
    let body;

    try {
        body =
            await request.json();
    } catch {
        return json(
            request,
            {
                success: false,
                error:
                    "Invalid JSON body."
            },
            400
        );
    }

    const videoId =
        typeof body.id === "string"
            ? body.id.trim()
            : "";

    const permanent =
        body.permanent === true;

    if (!videoId) {
        return json(
            request,
            {
                success: false,
                error:
                    "A video ID is required."
            },
            400
        );
    }

    if (
        typeof body.permanent !==
        "boolean"
    ) {
        return json(
            request,
            {
                success: false,
                error:
                    "permanent must be true or false."
            },
            400
        );
    }

    const existingVideo =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    expiration_date,
                    never_expires,
                    status

                FROM videos

                WHERE id = ?

                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!existingVideo) {
        return json(
            request,
            {
                success: false,
                error:
                    "Video not found."
            },
            404
        );
    }

    await env.DB
        .prepare(`
            UPDATE videos

            SET never_expires = ?

            WHERE id = ?
        `)
        .bind(
            permanent ? 1 : 0,
            videoId
        )
        .run();

    const now =
        Math.floor(
            Date.now() /
            1000
        );

    const expirationDate =
        Number(
            existingVideo.expiration_date
        );

    const queuedForDeletion =
        !permanent &&
        expirationDate <= now;

    return json(
        request,
        {
            success: true,

            videoId,

            neverExpires:
                permanent,

            queuedForDeletion,

            message:
                permanent
                    ? "Video will no longer expire."
                    : queuedForDeletion
                        ? "Video returned to the deletion queue and will be removed by the next cleanup."
                        : "Video returned to its normal expiration schedule."
        }
    );
}

/*
============================================================
DELETE /admin/video
============================================================
*/

async function deleteAdminVideo(request, env) {
    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            request,
            {
                success: false,
                error: "Invalid JSON body."
            },
            400
        );
    }

    const videoId =
        typeof body.id === "string"
            ? body.id.trim()
            : "";

    if (!videoId) {
        return json(
            request,
            {
                success: false,
                error: "A video ID is required."
            },
            400
        );
    }

    const video =
        await env.DB
            .prepare(`
                SELECT
                    id,
                    filename,
                    webm_key,
                    mp4_key,
                    thumbnail_key

                FROM videos

                WHERE id = ?

                LIMIT 1
            `)
            .bind(videoId)
            .first();

    if (!video) {
        return json(
            request,
            {
                success: false,
                error: "Video not found."
            },
            404
        );
    }

    const objectKeys =
        [...new Set([
            video.filename,
            video.webm_key,
            video.mp4_key,
            video.thumbnail_key
        ].filter(
            key =>
                typeof key === "string" &&
                key.trim() !== ""
        ))];

    try {
        /*
         * Delete R2 objects first.
         */
        for (const objectKey of objectKeys) {
            await env.VIDEOS.delete(
                objectKey
            );

            const stillExists =
                await env.VIDEOS.head(
                    objectKey
                );

            if (stillExists) {
                throw new Error(
                    `R2 object still exists after deletion: ${objectKey}`
                );
            }
        }

        /*
         * Delete related database records, then the video.
         */
        await env.DB.batch([
            env.DB
                .prepare(`
                    DELETE FROM video_viewers
                    WHERE video_id = ?
                `)
                .bind(videoId),

            env.DB
                .prepare(`
                    DELETE FROM daily_views
                    WHERE video_id = ?
                `)
                .bind(videoId),

            env.DB
                .prepare(`
                    DELETE FROM extensions
                    WHERE video_id = ?
                `)
                .bind(videoId),

            env.DB
                .prepare(`
                    DELETE FROM video_reports
                    WHERE video_id = ?
                `)
                .bind(videoId),

            env.DB
                .prepare(`
                    DELETE FROM upload_logs
                    WHERE video_id = ?
                `)
                .bind(videoId),

            env.DB
                .prepare(`
                    DELETE FROM videos
                    WHERE id = ?
                `)
                .bind(videoId)
        ]);

        return json(
            request,
            {
                success: true,
                videoId,
                deletedObjects:
                    objectKeys.length,
                message:
                    "Video and related data were permanently deleted."
            }
        );
    } catch (error) {
        console.error(
            `Admin video deletion failed for ${videoId}:`,
            error
        );

        return json(
            request,
            {
                success: false,
                error:
                    error?.message ||
                    "Video deletion failed."
            },
            500
        );
    }
}
