import { FastifyPluginAsync } from "fastify";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
  completeStreamSession,
  createStreamSession,
  getLessonStreamAvailability,
  markStreamError,
  recordStreamProgress,
  verifyLessonWatchToken,
} from "../services/streamingService.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildWatchPage(params: {
  dayNumber: 1 | 2 | 3;
  token: string;
  title: string;
  watchBaseUrl: string;
  posterUrl: string;
  streamReady: boolean;
}) {
  const bootstrap = JSON.stringify({
    dayNumber: params.dayNumber,
    token: params.token,
    title: params.title,
    posterUrl: params.posterUrl,
    streamReady: params.streamReady,
    sessionUrl: "/api/stream/session",
    progressUrl: "/api/stream/progress",
    completeUrl: "/api/stream/complete",
    errorUrl: "/api/stream/error",
  });

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(params.title)} | Express English Academy</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0b10;
        --panel: rgba(20, 20, 28, 0.92);
        --panel-border: rgba(255, 255, 255, 0.08);
        --text: #f5f3ff;
        --muted: #b8b2d8;
        --accent: #f0c14e;
        --danger: #ffb4b4;
        --danger-bg: rgba(255, 94, 94, 0.12);
        --warning-bg: rgba(240, 193, 78, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(113, 84, 255, 0.18), transparent 36%),
          linear-gradient(180deg, #09090d 0%, #12121b 100%);
      }

      .shell {
        width: min(1080px, calc(100vw - 24px));
        margin: 0 auto;
        padding: 16px 0 32px;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      }

      .header {
        padding: 20px 20px 12px;
      }

      .eyebrow {
        margin: 0 0 8px;
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(24px, 4vw, 40px);
        line-height: 1.1;
      }

      .meta {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--muted);
        font-size: 14px;
      }

      .player-wrap {
        padding: 0 14px 14px;
      }

      .player-frame {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        border-radius: 18px;
        overflow: hidden;
      }

      video {
        width: 100%;
        height: 100%;
        display: block;
        background: #000;
      }

      .status {
        padding: 16px 20px 8px;
        color: var(--muted);
        font-size: 15px;
      }

      .hint,
      .error {
        margin: 0 20px 16px;
        padding: 14px 16px;
        border-radius: 16px;
        font-size: 14px;
      }

      .hint {
        display: none;
        background: var(--warning-bg);
        border: 1px solid rgba(240, 193, 78, 0.22);
        color: #f7e3a4;
      }

      .error {
        display: none;
        background: var(--danger-bg);
        border: 1px solid rgba(255, 94, 94, 0.2);
        color: var(--danger);
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 0 20px 20px;
        color: var(--muted);
        font-size: 14px;
      }

      .footer strong {
        color: #9fe3b5;
      }

      a.inline-link {
        color: var(--accent);
        text-decoration: none;
      }

      @media (max-width: 768px) {
        .shell {
          width: min(100vw, calc(100vw - 12px));
          padding-top: 8px;
        }

        .card {
          border-radius: 18px;
        }

        .header {
          padding: 16px 14px 10px;
        }

        .player-wrap {
          padding: 0 8px 8px;
        }

        .status,
        .hint,
        .error,
        .footer {
          margin-left: 14px;
          margin-right: 14px;
          padding-left: 0;
          padding-right: 0;
        }

        .footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="card">
        <div class="header">
          <p class="eyebrow">Express English Academy</p>
          <h1>${escapeHtml(params.title)}</h1>
          <div class="meta">
            <span class="badge">Streaming intern securizat</span>
            <span class="badge">Player optimizat pentru Telegram și browser</span>
          </div>
        </div>

        <div class="player-wrap">
          <div class="player-frame">
            <video id="lesson-player" controls playsinline preload="metadata" poster="${escapeHtml(params.posterUrl)}"></video>
          </div>
        </div>

        <div class="status" id="status">Pregătesc playerul și sesiunea de vizionare...</div>
        <div class="hint" id="hint">Pentru lecțiile landscape, rotește telefonul în modul orizontal dacă vrei o imagine mai mare.</div>
        <div class="error" id="error"></div>

        <div class="footer">
          <span id="quality-label">Calitate: <strong>auto</strong></span>
          <span>Fallback browser: <a class="inline-link" href="${escapeHtml(params.watchBaseUrl)}" target="_blank" rel="noopener">deschide separat</a></span>
        </div>
      </div>
    </div>

    <script src="/vendor/hls/hls.min.js"></script>
    <script>
      const bootstrap = ${bootstrap};
      const player = document.getElementById("lesson-player");
      const statusNode = document.getElementById("status");
      const hintNode = document.getElementById("hint");
      const errorNode = document.getElementById("error");
      const qualityNode = document.getElementById("quality-label");
      const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
      const platform = tg && tg.platform
        ? tg.platform
        : ((navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
          ? "mobile-browser"
          : "desktop-browser");
      const isMobile = /ios|android|mobile/i.test(String(platform));
      const state = {
        sessionId: null,
        sentSecond: -1,
        completeSent: false,
      };

      if (tg) {
        try {
          tg.ready();
          tg.expand();
        } catch (_) {}
      }

      if (isMobile) {
        hintNode.style.display = "block";
      }

      function setStatus(message) {
        statusNode.textContent = message;
      }

      function setError(message) {
        errorNode.style.display = "block";
        errorNode.textContent = message;
        setStatus("Playerul nu a putut fi pornit.");
      }

      async function sendJson(url, payload, keepalive = false) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive,
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.message || "Request eșuat.");
        }

        return response.json().catch(() => ({}));
      }

      function applyQualityCap(hls, maxRendition) {
        const eligibleLevels = hls.levels
          .map((level, index) => ({ index, height: level.height || 0 }))
          .filter((level) => level.height > 0 && level.height <= maxRendition);

        if (eligibleLevels.length === 0) {
          qualityNode.innerHTML = "Calitate: <strong>auto</strong>";
          return;
        }

        const topLevel = eligibleLevels[eligibleLevels.length - 1];
        hls.autoLevelCapping = topLevel.index;
        qualityNode.innerHTML = "Calitate: <strong>auto până la " + topLevel.height + "p</strong>";
      }

      async function reportError(message) {
        try {
          await sendJson(bootstrap.errorUrl, {
            token: bootstrap.token,
            sessionId: state.sessionId,
            message,
          }, true);
        } catch (_) {}
      }

      async function pushProgress(force) {
        if (!state.sessionId) {
          return;
        }

        const currentTime = Math.floor(player.currentTime || 0);
        if (!force && currentTime <= state.sentSecond + 14) {
          return;
        }

        state.sentSecond = currentTime;

        try {
          const result = await sendJson(bootstrap.progressUrl, {
            sessionId: state.sessionId,
            currentTimeSec: currentTime,
            durationSec: Number.isFinite(player.duration) ? Math.floor(player.duration) : null,
          }, force);

          if (result.quizUnlocked) {
            setStatus("Ai acumulat destul playback. Testul pentru lecție este acum disponibil în bot.");
          }
        } catch (error) {
          console.warn(error);
        }
      }

      async function completePlayback() {
        if (!state.sessionId || state.completeSent) {
          return;
        }

        state.completeSent = true;

        try {
          await sendJson(bootstrap.completeUrl, {
            sessionId: state.sessionId,
            currentTimeSec: Math.floor(player.currentTime || 0),
          }, true);
          setStatus("Lecția este marcată ca vizionată. Poți reveni în bot pentru test și pașii următori.");
        } catch (error) {
          console.warn(error);
        }
      }

      function attachPlayerSource(payload) {
        if (player.canPlayType("application/vnd.apple.mpegurl")) {
          player.src = payload.manifestUrl;
          qualityNode.innerHTML = "Calitate: <strong>auto nativ</strong>";
          setStatus("Playerul este gata. Poți porni lecția.");
          return;
        }

        if (!window.Hls || !window.Hls.isSupported()) {
          throw new Error("Browserul nu suportă HLS în configurația curentă.");
        }

        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: false,
          capLevelToPlayerSize: true,
        });

        hls.loadSource(payload.manifestUrl);
        hls.attachMedia(player);
        hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
          applyQualityCap(hls, payload.maxRendition);
          setStatus("Playerul este gata. Poți porni lecția.");
        });
        hls.on(window.Hls.Events.ERROR, function (_, data) {
          if (data && data.fatal) {
            reportError("Eroare HLS fatală: " + data.type);
            setError("Conexiunea video a fost întreruptă. Reîncarcă pagina și încearcă din nou.");
          }
        });
      }

      async function bootstrapPlayer() {
        if (!bootstrap.streamReady) {
          setError("Stream-ul pentru această lecție nu este pregătit încă pe server.");
          return;
        }

        try {
          const payload = await sendJson(bootstrap.sessionUrl, {
            token: bootstrap.token,
            platform: String(platform),
            userAgent: navigator.userAgent,
            prefersNativeHls: Boolean(player.canPlayType("application/vnd.apple.mpegurl")),
          });

          state.sessionId = payload.sessionId;
          player.poster = payload.posterUrl;
          attachPlayerSource(payload);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Nu am putut inițializa sesiunea de streaming.";
          await reportError(message);
          setError(message);
        }
      }

      player.addEventListener("play", function () {
        void pushProgress(true);
      });

      player.addEventListener("timeupdate", function () {
        void pushProgress(false);
      });

      player.addEventListener("ended", function () {
        void completePlayback();
      });

      player.addEventListener("error", function () {
        void reportError("Player media error");
      });

      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
          void pushProgress(true);
        }
      });

      window.addEventListener("beforeunload", function () {
        void pushProgress(true);
        if (!state.completeSent && player.currentTime > 0) {
          void completePlayback();
        }
      });

      void bootstrapPlayer();
    </script>
  </body>
</html>`;
}

export const streamingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { day: string };
    Querystring: { token?: string };
  }>("/watch/lesson/:day", async (request, reply) => {
    const token = request.query.token?.trim();
    const dayNumber = Number(request.params.day);

    if (![1, 2, 3].includes(dayNumber) || !token) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Link-ul lecției este invalid.");
    }

    const payload = verifyLessonWatchToken(token);
    if (!payload || payload.dayNumber !== dayNumber) {
      return reply.code(403).type("text/plain; charset=utf-8").send("Accesul la lecție nu este valid.");
    }

    const availability = getLessonStreamAvailability(dayNumber as 1 | 2 | 3);
    const publicBaseUrl = config.STREAM_PUBLIC_BASE_URL.replace(/\/+$/, "");
    const html = buildWatchPage({
      dayNumber: dayNumber as 1 | 2 | 3,
      token,
      title: `Lecția ${dayNumber}`,
      watchBaseUrl: `${publicBaseUrl}/watch/lesson/${dayNumber}?token=${encodeURIComponent(token)}`,
      posterUrl: `${publicBaseUrl}/stream/posters/lesson-${dayNumber}.jpg`,
      streamReady: availability.ready,
    });

    return reply.type("text/html; charset=utf-8").send(html);
  });

  fastify.post<{
    Body: {
      token?: string;
      platform?: string | null;
      userAgent?: string | null;
      prefersNativeHls?: boolean;
    };
  }>("/api/stream/session", async (request, reply) => {
    try {
      const token = request.body.token?.trim();
      if (!token) {
        return reply.code(400).send({ message: "Token-ul de streaming lipsește." });
      }

      return await createStreamSession({
        token,
        platform: request.body.platform,
        userAgent: request.body.userAgent,
        prefersNativeHls: request.body.prefersNativeHls,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sesiunea de streaming nu a putut fi creată.";
      logger.warn({ err: error }, "Crearea sesiunii de streaming a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{
    Body: {
      sessionId?: string;
      currentTimeSec?: number;
      durationSec?: number | null;
    };
  }>("/api/stream/progress", async (request, reply) => {
    try {
      const sessionId = request.body.sessionId?.trim();
      if (!sessionId) {
        return reply.code(400).send({ message: "sessionId lipsește." });
      }

      return await recordStreamProgress({
        sessionId,
        currentTimeSec: request.body.currentTimeSec ?? 0,
        durationSec: request.body.durationSec ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nu am putut salva progresul.";
      logger.warn({ err: error }, "Actualizarea progresului de streaming a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{
    Body: {
      sessionId?: string;
      currentTimeSec?: number | null;
    };
  }>("/api/stream/complete", async (request, reply) => {
    try {
      const sessionId = request.body.sessionId?.trim();
      if (!sessionId) {
        return reply.code(400).send({ message: "sessionId lipsește." });
      }

      await completeStreamSession({
        sessionId,
        currentTimeSec: request.body.currentTimeSec ?? null,
      });

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nu am putut finaliza sesiunea.";
      logger.warn({ err: error }, "Finalizarea sesiunii de streaming a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{
    Body: {
      token?: string | null;
      sessionId?: string | null;
      message?: string;
    };
  }>("/api/stream/error", async (request, reply) => {
    await markStreamError({
      token: request.body.token ?? null,
      sessionId: request.body.sessionId ?? null,
      message: request.body.message?.trim() || "unknown_stream_error",
    });

    return reply.code(204).send();
  });
};
