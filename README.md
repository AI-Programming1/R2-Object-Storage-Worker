
# Cloudflare Video Hosting Platform

This project is a lightweight, self-hosted video hosting platform built on Cloudflare’s serverless infrastructure. It uses Cloudflare Workers for the application and API layer, R2 for video and thumbnail storage, and D1 for video metadata, upload sessions, expiration dates, view counts, and administrative records. The platform is designed to provide reliable video uploads and streaming without requiring a traditional server.

Videos are uploaded using multipart uploads with support for retries and resumable sessions. The platform includes individual video pages, byte-range streaming, thumbnails, search, popular-video listings, view tracking, expiration management, extension requests, and automated cleanup. Supported formats include MP4, WebM, MOV, M4V, OGV, and OGG, although browser playback and thumbnail generation may depend on the codec contained inside each file.

An authenticated administration panel provides tools for reviewing videos, searching by title, monitoring metadata, managing permanent videos, and deleting content. Public video pages can also include comments powered by GitHub Discussions through giscus. The frontend can communicate with the Worker through either a `workers.dev` address or a custom Cloudflare-managed domain such as `video.example.com`.

The project currently represents a stable Version 1.0 architecture focused on reliability and incremental improvements. Future enhancements may include server-side transcoding, broader codec support, improved thumbnail generation, additional moderation tools, and more advanced analytics.
