import fs from "node:fs";
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { getLessonQuizState, submitLessonQuiz } from "../services/lessonQuizService.js";
import {
  getLessonStreamAsset,
  getServiceStreamAsset,
  getStreamManifestPath,
  getStreamPosterPath,
  getStreamRenditionPlaylistPath,
  getStreamSegmentPath,
  getServiceStreamPosterPath,
  getServiceStreamVideoPath,
  supportsTelegramWebAppStreaming,
  type LessonDay,
  type ServiceStreamKey,
} from "../services/streamingAssets.js";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import {
  completeStreamSession,
  createStreamSession,
  createServiceStreamSession,
  getActiveStreamSession,
  getActiveServiceStreamSession,
  getLessonStreamAvailability,
  getServiceStreamAvailability,
  markStreamError,
  markServiceStreamError,
  recordStreamProgress,
  recordServiceStreamProgress,
  completeServiceStreamSession,
  verifyServiceWatchToken,
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

function parseLessonDay(value: string): LessonDay | null {
  const dayNumber = Number(value);
  return dayNumber === 1 || dayNumber === 2 || dayNumber === 3 ? dayNumber : null;
}

function parseServiceKey(value: string): ServiceStreamKey | null {
  return value === "career-astrology" ? value : null;
}

function buildSessionMediaUrl(dayNumber: LessonDay, sessionId: string, fileName: string): string {
  return `/api/stream/media/${dayNumber}/${encodeURIComponent(fileName)}?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildSessionPosterUrl(dayNumber: LessonDay, sessionId: string): string {
  return `/api/stream/poster/${dayNumber}?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildWatchPage(params: {
  dayNumber: LessonDay;
  token: string;
  title: string;
  watchBaseUrl: string;
  streamReady: boolean;
  quizState: Awaited<ReturnType<typeof getLessonQuizState>>;
  showExternalFallback: boolean;
}) {
  const bootstrap = JSON.stringify({
    token: params.token,
    streamReady: params.streamReady,
    watchBaseUrl: params.watchBaseUrl,
    showExternalFallback: params.showExternalFallback,
    quiz: params.quizState,
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
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>${escapeHtml(params.title)} | Express English Academy</title>
  <style>
    :root{color-scheme:dark;--bg:#090910;--card:#13131d;--muted:#b7b0d6;--text:#f6f1ff;--accent:#f0c14e;--ok:#9fe3b5;--line:rgba(255,255,255,.08);--soft:rgba(255,255,255,.05);--warn:rgba(240,193,78,.12);--err:rgba(255,100,100,.12)}
    *{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;min-height:100vh;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:var(--text);background:radial-gradient(circle at top left,rgba(240,193,78,.08),transparent 28%),linear-gradient(180deg,#09090d 0%,#12121b 100%)}
    .shell{width:min(860px,calc(100vw - 24px));margin:0 auto;padding:16px 0 32px}.card{background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.32)}
    .header{padding:18px 20px 10px}.eyebrow{margin:0 0 10px;color:var(--accent);font-size:12px;letter-spacing:.16em;text-transform:uppercase}h1{margin:0;font-size:clamp(28px,4vw,40px);line-height:1.08}.subcopy{margin:10px 0 0;color:var(--muted);font-size:15px;line-height:1.55}
    .player-wrap{padding:0 14px 14px}.player-frame{width:100%;aspect-ratio:16/9;background:#000;border-radius:18px;overflow:hidden}video{width:100%;height:100%;display:block;background:#000}
    .status,.hint,.error,.quiz,.footer{margin:0 20px 16px}.status{color:var(--muted);font-size:15px;line-height:1.55}.hint,.error,.quiz-card,.result-card{padding:14px 16px;border-radius:18px}.hint{display:none;background:var(--warn);border:1px solid rgba(240,193,78,.2);color:#f6df95}.error{display:none;background:var(--err);border:1px solid rgba(255,100,100,.2);color:#ffb4b4}
    .footer{display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--muted);font-size:14px}.footer strong{color:var(--ok)}.inline-link{color:var(--accent);text-decoration:none}
    .quiz[hidden]{display:none}.quiz-heading{margin:0 0 8px;font-size:22px}.quiz-copy{margin:0 0 14px;color:var(--muted);line-height:1.55}.quiz-card,.result-card,.question-card{background:var(--soft);border:1px solid var(--line);margin-bottom:14px}.result-card strong{color:var(--ok)}.result-meta{margin-top:8px;color:var(--muted);font-size:14px}
    .question-card{padding:14px 16px}.question-title{margin:0 0 12px;font-size:16px;line-height:1.5}.options{display:grid;gap:8px}.option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04)}.option input{margin-top:3px}
    .quiz-actions{display:flex;flex-wrap:wrap;gap:10px}.button{border:0;border-radius:999px;padding:12px 18px;font:inherit;cursor:pointer}.button-primary{background:var(--accent);color:#181410;font-weight:600}.button-secondary{background:transparent;color:var(--text);border:1px solid var(--line)}
    .quiz-feedback{display:none;margin-bottom:14px;padding:14px 16px;border-radius:16px;font-size:14px}.quiz-feedback.is-error{display:block;background:var(--err);border:1px solid rgba(255,100,100,.2);color:#ffb4b4}.quiz-feedback.is-success{display:block;background:rgba(159,227,181,.12);border:1px solid rgba(159,227,181,.2);color:var(--ok)}
    @media (max-width:768px){.shell{width:min(100vw,calc(100vw - 12px));padding-top:8px}.card{border-radius:18px}.header{padding:16px 14px 10px}.player-wrap{padding:0 8px 8px}.status,.hint,.error,.quiz,.footer{margin-left:14px;margin-right:14px}.footer{flex-direction:column;align-items:flex-start}.quiz-heading{font-size:20px}}
  </style>
</head>
<body>
  <div class="shell"><div class="card">
    <div class="header">
      <p class="eyebrow">Express English Academy</p>
      <h1>${escapeHtml(params.title)}</h1>
      <p class="subcopy">Player intern pentru lecția ta. După minimum 60 de secunde, testul se activează mai jos pe pagină.</p>
    </div>
    <div class="player-wrap"><div class="player-frame"><video id="lesson-player" controls playsinline preload="metadata"></video></div></div>
    <div class="status" id="status">Pregătesc playerul și sesiunea de vizionare...</div>
    <div class="hint" id="hint">Pentru imagine mai mare, rotește telefonul pe orizontală.</div>
    <div class="error" id="error"></div>
    <div class="footer"><span id="quality-label">Calitate: <strong>auto</strong></span>${params.showExternalFallback ? `<span>Deschidere separată: <a class="inline-link" href="${escapeHtml(params.watchBaseUrl)}" target="_blank" rel="noopener">același player</a></span>` : ""}</div>
    <section class="quiz" id="quiz-section" hidden></section>
  </div></div>
  <script src="/vendor/hls/hls.min.js"></script>
  <script>
    const bootstrap=${bootstrap};
    const player=document.getElementById("lesson-player");
    const statusNode=document.getElementById("status");
    const hintNode=document.getElementById("hint");
    const errorNode=document.getElementById("error");
    const qualityNode=document.getElementById("quality-label");
    const quizNode=document.getElementById("quiz-section");
    const tg=window.Telegram&&window.Telegram.WebApp?window.Telegram.WebApp:null;
    const platform=tg&&tg.platform?tg.platform:(((navigator.userAgentData&&navigator.userAgentData.mobile)||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))?"mobile-browser":"desktop-browser");
    const isMobile=/ios|android|mobile/i.test(String(platform));
    const state={sessionId:null,sentSecond:-1,completeSent:false,quizFeedback:null,quizFeedbackTone:"success",quiz:bootstrap.quiz};
    if(tg){try{tg.ready();tg.expand()}catch(_){}} if(isMobile){hintNode.style.display="block"}
    const setStatus=(m)=>statusNode.textContent=m;
    const setError=(m)=>{errorNode.style.display="block";errorNode.textContent=m;setStatus("Playerul nu a putut fi pornit.")};
    const fmt=(v)=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("ro-RO",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})};
    const scrollQuiz=()=>{if(window.location.hash==="#quiz-section"){window.requestAnimationFrame(()=>quizNode.scrollIntoView({behavior:"smooth",block:"start"}))}};
    function renderQuiz(){
      if(!state.quiz||!state.quiz.enabled){quizNode.hidden=true;return} quizNode.hidden=false;
      const result=state.quiz.latestResult?'<div class="result-card"><strong>Ultimul scor: '+state.quiz.latestResult.latestCorrectAnswers+'/'+state.quiz.latestResult.latestTotalQuestions+' ('+state.quiz.latestResult.latestPercentage+'%)</strong><div class="result-meta">Cel mai bun scor: '+state.quiz.latestResult.bestCorrectAnswers+'/'+state.quiz.latestResult.latestTotalQuestions+' ('+state.quiz.latestResult.bestPercentage+'%)'+(state.quiz.latestResult.lastAttemptAt?' · Ultima încercare: '+fmt(state.quiz.latestResult.lastAttemptAt):'')+' · Încercări: '+state.quiz.latestResult.attemptCount+'</div></div>':'';
      const feedback=state.quizFeedback?'<div class="quiz-feedback is-'+state.quizFeedbackTone+'">'+state.quizFeedback+'</div>':'';
      if(!state.quiz.unlocked){
        quizNode.innerHTML='<h2 class="quiz-heading">'+(state.quiz.title||"Test după lecție")+'</h2><p class="quiz-copy">'+(state.quiz.intro||"Testul se activează după minimum 60 de secunde de playback.")+'</p>'+feedback+result+'<div class="quiz-card">Testul se activează după minimum 60 de secunde de vizionare în player. Când pragul este atins, secțiunea aceasta devine interactivă fără să revii în chat.</div>';
        scrollQuiz(); return;
      }
      const cards=state.quiz.questions.map((question,index)=>'<article class="question-card"><p class="question-title">'+(index+1)+'. '+question.prompt+'</p><div class="options">'+question.options.map((option,optionIndex)=>'<label class="option"><input type="radio" name="question-'+question.id+'" value="'+optionIndex+'" /><span>'+option+'</span></label>').join("")+'</div></article>').join("");
      quizNode.innerHTML='<h2 class="quiz-heading">'+(state.quiz.title||"Test după lecție")+'</h2><p class="quiz-copy">'+(state.quiz.intro||"Poți relua testul ori de câte ori vrei.")+'</p>'+feedback+result+'<form class="quiz-form" id="quiz-form">'+cards+'<div class="quiz-actions"><button class="button button-primary" type="submit">Trimite răspunsurile</button><button class="button button-secondary" type="button" id="quiz-repeat">Repetă testul</button></div></form>';
      const form=document.getElementById("quiz-form"); if(form){form.addEventListener("submit",submitQuiz)}
      const repeat=document.getElementById("quiz-repeat"); if(repeat){repeat.addEventListener("click",()=>{state.quizFeedback=null;state.quizFeedbackTone="success";const currentForm=document.getElementById("quiz-form");if(currentForm){currentForm.reset()}})}
      scrollQuiz();
    }
    async function sendJson(url,payload,keepalive=false){
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive});
      if(!response.ok){const payloadError=await response.json().catch(()=>({}));throw new Error(payloadError.message||"Request eșuat.")}
      return response.json().catch(()=>({}));
    }
    async function submitQuiz(event){
      event.preventDefault();
      if(!state.quiz||!state.quiz.unlocked||!state.quiz.submitUrl){return}
      const answers=state.quiz.questions.map((question)=>{const selected=document.querySelector('input[name="question-'+question.id+'"]:checked');return selected?Number(selected.value):null});
      if(answers.some((value)=>value===null)){state.quizFeedback="Răspunde la toate întrebările înainte de trimitere.";state.quizFeedbackTone="error";renderQuiz();return}
      try{
        const result=await sendJson(state.quiz.submitUrl,{token:bootstrap.token,answers});
        state.quiz.latestResult={attemptCount:result.attemptCount,latestCorrectAnswers:result.correctAnswers,latestTotalQuestions:result.totalQuestions,latestPercentage:result.percentage,bestPercentage:result.bestPercentage,bestCorrectAnswers:result.bestCorrectAnswers,lastAttemptAt:new Date().toISOString()};
        state.quizFeedback="Testul a fost salvat. Poți relua oricând pentru un scor mai bun.";state.quizFeedbackTone="success";renderQuiz();
      }catch(error){state.quizFeedback=error instanceof Error?error.message:"Nu am putut salva răspunsurile.";state.quizFeedbackTone="error";renderQuiz()}
    }
    function capQuality(hls,maxRendition){
      const eligible=hls.levels.map((level,index)=>({index,height:level.height||0})).filter((level)=>level.height>0&&level.height<=maxRendition);
      if(eligible.length===0){qualityNode.innerHTML="Calitate: <strong>auto</strong>";return}
      const top=eligible[eligible.length-1]; hls.autoLevelCapping=top.index; qualityNode.innerHTML="Calitate: <strong>auto până la "+top.height+"p</strong>";
    }
    async function reportError(message){try{await sendJson(bootstrap.errorUrl,{token:bootstrap.token,sessionId:state.sessionId,message},true)}catch(_){}}
    async function pushProgress(force){
      if(!state.sessionId){return}
      const currentTime=Math.floor(player.currentTime||0); if(!force&&currentTime<=state.sentSecond+14){return} state.sentSecond=currentTime;
      try{
        const result=await sendJson(bootstrap.progressUrl,{sessionId:state.sessionId,currentTimeSec:currentTime,durationSec:Number.isFinite(player.duration)?Math.floor(player.duration):null},force);
        if(result.quizUnlocked&&state.quiz&&!state.quiz.unlocked){state.quiz.unlocked=true;state.quizFeedback=null;state.quizFeedbackTone="success";renderQuiz();setStatus("Testul este disponibil mai jos pe pagină.");scrollQuiz()}
      }catch(error){console.warn(error)}
    }
    async function completePlayback(){
      if(!state.sessionId||state.completeSent){return} state.completeSent=true;
      try{await sendJson(bootstrap.completeUrl,{sessionId:state.sessionId,currentTimeSec:Math.floor(player.currentTime||0)},true);setStatus("Lecția este marcată ca vizionată. Dacă ai depășit un minut, testul este disponibil mai jos pe pagină.")}catch(error){console.warn(error)}
    }
    function attachSource(payload){
      if(player.canPlayType("application/vnd.apple.mpegurl")){player.src=payload.manifestUrl;qualityNode.innerHTML="Calitate: <strong>auto nativ</strong>";setStatus("Playerul este gata. Poți porni lecția.");return}
      if(!window.Hls||!window.Hls.isSupported()){throw new Error("Browserul nu suportă HLS în configurația curentă.")}
      const hls=new window.Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true});
      hls.loadSource(payload.manifestUrl);hls.attachMedia(player);
      hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{capQuality(hls,payload.maxRendition);setStatus("Playerul este gata. Poți porni lecția.")});
      hls.on(window.Hls.Events.ERROR,(_,data)=>{if(data&&data.fatal){reportError("Eroare HLS fatală: "+data.type);setError("Conexiunea video a fost întreruptă. Reîncarcă pagina și încearcă din nou.")}});
    }
    async function bootstrapPlayer(){
      if(!bootstrap.streamReady){setError("Stream-ul pentru această lecție nu este pregătit încă pe server.");return}
      try{
        const payload=await sendJson(bootstrap.sessionUrl,{token:bootstrap.token,platform:String(platform),userAgent:navigator.userAgent,prefersNativeHls:Boolean(player.canPlayType("application/vnd.apple.mpegurl"))});
        state.sessionId=payload.sessionId; player.poster=payload.posterUrl; attachSource(payload);
      }catch(error){const message=error instanceof Error?error.message:"Nu am putut inițializa sesiunea de streaming."; await reportError(message); setError(message)}
    }
    player.addEventListener("play",()=>{void pushProgress(true)});
    player.addEventListener("timeupdate",()=>{void pushProgress(false)});
    player.addEventListener("ended",()=>{void completePlayback()});
    player.addEventListener("error",()=>{void reportError("Player media error")});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){void pushProgress(true)}});
    window.addEventListener("beforeunload",()=>{void pushProgress(true); if(!state.completeSent&&player.currentTime>0){void completePlayback()}});
    renderQuiz(); void bootstrapPlayer();
  </script>
</body>
</html>`;
}

function buildServiceWatchPage(params: {
  serviceKey: ServiceStreamKey;
  token: string;
  title: string;
  watchBaseUrl: string;
  streamReady: boolean;
  showExternalFallback: boolean;
}) {
  const bootstrap = JSON.stringify({
    token: params.token,
    streamReady: params.streamReady,
    watchBaseUrl: params.watchBaseUrl,
    showExternalFallback: params.showExternalFallback,
    sessionUrl: "/api/stream/service/session",
    progressUrl: "/api/stream/service/progress",
    completeUrl: "/api/stream/service/complete",
    errorUrl: "/api/stream/service/error",
  });

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>${escapeHtml(params.title)} | Express English Academy</title>
  <style>
    :root{color-scheme:dark;--bg:#090910;--card:#13131d;--muted:#b7b0d6;--text:#f6f1ff;--accent:#f0c14e;--line:rgba(255,255,255,.08);--soft:rgba(255,255,255,.05);--warn:rgba(240,193,78,.12);--err:rgba(255,100,100,.12)}
    *{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;min-height:100vh;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:var(--text);background:radial-gradient(circle at top left,rgba(240,193,78,.08),transparent 28%),linear-gradient(180deg,#09090d 0%,#12121b 100%)}
    .shell{width:min(460px,calc(100vw - 18px));margin:0 auto;padding:10px 0 28px}.card{background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.32)}
    .header{padding:18px 18px 12px}.eyebrow{margin:0 0 10px;color:var(--accent);font-size:12px;letter-spacing:.16em;text-transform:uppercase}h1{margin:0;font-size:clamp(28px,5vw,38px);line-height:1.08}.subcopy{margin:10px 0 0;color:var(--muted);font-size:15px;line-height:1.55}
    .player-wrap{padding:0 12px 12px}.player-frame{width:100%;aspect-ratio:9/16;max-height:78vh;background:#000;border-radius:18px;overflow:hidden}video{width:100%;height:100%;display:block;background:#000;object-fit:contain}
    .status,.hint,.error,.footer{margin:0 18px 14px}.status{color:var(--muted);font-size:15px;line-height:1.55}.hint,.error{display:none;padding:14px 16px;border-radius:18px}.hint{background:var(--warn);border:1px solid rgba(240,193,78,.2);color:#f6df95}.error{background:var(--err);border:1px solid rgba(255,100,100,.2);color:#ffb4b4}
    .footer{display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--muted);font-size:14px}.inline-link{color:var(--accent);text-decoration:none}
    @media (max-width:768px){.shell{width:min(100vw,calc(100vw - 12px));padding-top:8px}.card{border-radius:18px}.header{padding:16px 14px 10px}.player-wrap{padding:0 8px 8px}.status,.hint,.error,.footer{margin-left:14px;margin-right:14px}.footer{flex-direction:column;align-items:flex-start}}
  </style>
</head>
<body>
  <div class="shell"><div class="card">
    <div class="header">
      <p class="eyebrow">Express English Academy</p>
      <h1>${escapeHtml(params.title)}</h1>
      <p class="subcopy">Video intern optimizat pentru mobil. Poți urmări prezentarea direct aici, cu încărcare rapidă și acces protejat.</p>
    </div>
    <div class="player-wrap"><div class="player-frame"><video id="service-player" controls playsinline preload="metadata"></video></div></div>
    <div class="status" id="status">Pregătesc playerul și sesiunea video...</div>
    <div class="hint" id="hint">Dacă vrei o imagine mai mare, rotește telefonul pe orizontală sau deschide fullscreen.</div>
    <div class="error" id="error"></div>
    <div class="footer">${params.showExternalFallback ? `<span>Deschidere separată: <a class="inline-link" href="${escapeHtml(params.watchBaseUrl)}" target="_blank" rel="noopener">același player</a></span>` : "<span>Acces protejat prin bot</span>"}</div>
  </div></div>
  <script>
    const bootstrap=${bootstrap};
    const player=document.getElementById("service-player");
    const statusNode=document.getElementById("status");
    const hintNode=document.getElementById("hint");
    const errorNode=document.getElementById("error");
    const tg=window.Telegram&&window.Telegram.WebApp?window.Telegram.WebApp:null;
    const platform=tg&&tg.platform?tg.platform:(((navigator.userAgentData&&navigator.userAgentData.mobile)||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))?"mobile-browser":"desktop-browser");
    const isMobile=/ios|android|mobile/i.test(String(platform));
    const state={sessionId:null,completeSent:false};
    if(tg){try{tg.ready();tg.expand()}catch(_){}} if(isMobile){hintNode.style.display="block"}
    const setStatus=(m)=>statusNode.textContent=m;
    const setError=(m)=>{errorNode.style.display="block";errorNode.textContent=m;setStatus("Playerul nu a putut fi pornit.")};
    async function sendJson(url,payload,keepalive=false){
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),keepalive});
      if(!response.ok){const payloadError=await response.json().catch(()=>({}));throw new Error(payloadError.message||"Request eșuat.")}
      return response.json().catch(()=>({}));
    }
    async function reportError(message){try{await sendJson(bootstrap.errorUrl,{token:bootstrap.token,sessionId:state.sessionId,message},true)}catch(_){}}
    async function pushProgress(force){
      if(!state.sessionId){return}
      try{await sendJson(bootstrap.progressUrl,{sessionId:state.sessionId,currentTimeSec:Math.floor(player.currentTime||0)},force)}catch(error){console.warn(error)}
    }
    async function completePlayback(){
      if(!state.sessionId||state.completeSent){return} state.completeSent=true;
      try{await sendJson(bootstrap.completeUrl,{sessionId:state.sessionId,currentTimeSec:Math.floor(player.currentTime||0)},true);setStatus("Video-ul a fost urmărit. Poți reveni în bot pentru pasul următor.")}catch(error){console.warn(error)}
    }
    async function bootstrapPlayer(){
      if(!bootstrap.streamReady){setError("Video-ul pentru acest serviciu nu este pregătit încă pe server.");return}
      try{
        const payload=await sendJson(bootstrap.sessionUrl,{token:bootstrap.token,platform:String(platform),userAgent:navigator.userAgent});
        state.sessionId=payload.sessionId; player.poster=payload.posterUrl; player.src=payload.videoUrl; setStatus("Playerul este gata. Poți porni video-ul.");
      }catch(error){const message=error instanceof Error?error.message:"Nu am putut inițializa sesiunea video."; await reportError(message); setError(message)}
    }
    player.addEventListener("play",()=>{void pushProgress(true)});
    player.addEventListener("timeupdate",()=>{void pushProgress(false)});
    player.addEventListener("ended",()=>{void completePlayback()});
    player.addEventListener("error",()=>{void reportError("Player media error")});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){void pushProgress(true)}});
    window.addEventListener("beforeunload",()=>{void pushProgress(true); if(!state.completeSent&&player.currentTime>0){void completePlayback()}});
    void bootstrapPlayer();
  </script>
</body>
</html>`;
}

function streamFile(request: FastifyRequest, reply: FastifyReply, filePath: string, contentType: string, cacheControl: string) {
  const stat = fs.statSync(filePath);
  const rangeHeader = typeof request.headers.range === "string" ? request.headers.range : null;

  reply
    .header("Content-Type", contentType)
    .header("Cache-Control", cacheControl)
    .header("X-Content-Type-Options", "nosniff")
    .header("Accept-Ranges", "bytes");

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;
      const safeEnd = Number.isFinite(end) ? Math.min(stat.size - 1, end) : stat.size - 1;

      if (safeStart <= safeEnd) {
        reply
          .code(206)
          .header("Content-Length", safeEnd - safeStart + 1)
          .header("Content-Range", `bytes ${safeStart}-${safeEnd}/${stat.size}`);

        return reply.send(fs.createReadStream(filePath, { start: safeStart, end: safeEnd }));
      }
    }
  }

  reply.header("Content-Length", stat.size);
  return reply.send(fs.createReadStream(filePath));
}

function rewriteMasterPlaylist(dayNumber: LessonDay, sessionId: string, content: string): string {
  const asset = getLessonStreamAsset(dayNumber);
  const allowedPlaylists = new Set(asset.renditions.map((rendition) => rendition.playlistFileName));
  return content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith("#") || !allowedPlaylists.has(trimmed)
      ? line
      : buildSessionMediaUrl(dayNumber, sessionId, trimmed);
  }).join("\n");
}

function rewriteRenditionPlaylist(dayNumber: LessonDay, sessionId: string, content: string): string {
  return content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith("#") ? line : buildSessionMediaUrl(dayNumber, sessionId, trimmed);
  }).join("\n");
}

function resolveStreamFile(dayNumber: LessonDay, fileName: string) {
  const asset = getLessonStreamAsset(dayNumber);
  if (fileName === "master.m3u8") {
    return { filePath: getStreamManifestPath(asset), kind: "master" as const, contentType: "application/vnd.apple.mpegurl; charset=utf-8" };
  }

  const rendition = asset.renditions.find((item) => item.playlistFileName === fileName);
  if (rendition) {
    return { filePath: getStreamRenditionPlaylistPath(asset, fileName), kind: "playlist" as const, contentType: "application/vnd.apple.mpegurl; charset=utf-8" };
  }

  const allowedPrefixes = asset.renditions.map((item) => item.playlistFileName.replace(/\.m3u8$/i, ""));
  const segmentPattern = new RegExp(`^(${allowedPrefixes.join("|")})_\\d+\\.(ts|m4s)$`);
  if (segmentPattern.test(fileName)) {
    return { filePath: getStreamSegmentPath(asset, fileName), kind: "segment" as const, contentType: fileName.endsWith(".m4s") ? "video/iso.segment" : "video/mp2t" };
  }

  return null;
}

export const streamingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { day: string }; Querystring: { token?: string } }>("/watch/lesson/:day", async (request, reply) => {
    const token = request.query.token?.trim();
    const dayNumber = parseLessonDay(request.params.day);
    if (!dayNumber || !token) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Link-ul lecției este invalid.");
    }

    const payload = verifyLessonWatchToken(token);
    if (!payload || payload.dayNumber !== dayNumber) {
      return reply.code(403).type("text/plain; charset=utf-8").send("Accesul la lecție nu este valid.");
    }

    const asset = getLessonStreamAsset(dayNumber);
    const quizState = await getLessonQuizState(payload.userId, dayNumber);
    const publicBaseUrl = config.STREAM_PUBLIC_BASE_URL.replace(/\/+$/, "");
    const html = buildWatchPage({
      dayNumber,
      token,
      title: asset.title.replace(" - ", " · "),
      watchBaseUrl: `${publicBaseUrl}/watch/lesson/${dayNumber}?token=${encodeURIComponent(token)}`,
      streamReady: getLessonStreamAvailability(dayNumber).ready,
      quizState,
      showExternalFallback: supportsTelegramWebAppStreaming(),
    });

    reply.header("Cache-Control", "private, no-store").header("Pragma", "no-cache").header("Referrer-Policy", "same-origin").header("X-Robots-Tag", "noindex, nofollow, noarchive");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  fastify.get<{ Params: { serviceKey: string }; Querystring: { token?: string } }>("/watch/service/:serviceKey", async (request, reply) => {
    const token = request.query.token?.trim();
    const serviceKey = parseServiceKey(request.params.serviceKey);
    if (!serviceKey || !token) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Link-ul video este invalid.");
    }

    const payload = verifyServiceWatchToken(token);
    if (!payload || payload.serviceKey !== serviceKey) {
      return reply.code(403).type("text/plain; charset=utf-8").send("Accesul la acest video nu este valid.");
    }

    const asset = getServiceStreamAsset(serviceKey);
    const publicBaseUrl = config.STREAM_PUBLIC_BASE_URL.replace(/\/+$/, "");
    const html = buildServiceWatchPage({
      serviceKey,
      token,
      title: asset.title,
      watchBaseUrl: `${publicBaseUrl}/watch/service/${serviceKey}?token=${encodeURIComponent(token)}`,
      streamReady: getServiceStreamAvailability(serviceKey).ready,
      showExternalFallback: supportsTelegramWebAppStreaming(),
    });

    reply.header("Cache-Control", "private, no-store").header("Pragma", "no-cache").header("Referrer-Policy", "same-origin").header("X-Robots-Tag", "noindex, nofollow, noarchive");
    return reply.type("text/html; charset=utf-8").send(html);
  });

  fastify.get<{ Params: { day: string }; Querystring: { sessionId?: string } }>("/api/stream/poster/:day", async (request, reply) => {
    const dayNumber = parseLessonDay(request.params.day);
    const sessionId = request.query.sessionId?.trim();
    if (!dayNumber || !sessionId) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Cererea pentru poster este invalidă.");
    }

    try {
      await getActiveStreamSession(sessionId, dayNumber);
    } catch (error) {
      return reply.code(403).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Posterul nu poate fi accesat.");
    }

    const asset = getLessonStreamAsset(dayNumber);
    const posterPath = getStreamPosterPath(asset);
    if (!fs.existsSync(posterPath)) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Posterul lipsește.");
    }

    return streamFile(request, reply, posterPath, "image/jpeg", "private, max-age=300, no-transform");
  });

  fastify.get<{ Params: { serviceKey: string }; Querystring: { sessionId?: string } }>("/api/stream/service/poster/:serviceKey", async (request, reply) => {
    const serviceKey = parseServiceKey(request.params.serviceKey);
    const sessionId = request.query.sessionId?.trim();
    if (!serviceKey || !sessionId) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Cererea pentru poster este invalidă.");
    }

    try {
      await getActiveServiceStreamSession(sessionId, serviceKey);
    } catch (error) {
      return reply.code(403).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Posterul nu poate fi accesat.");
    }

    const asset = getServiceStreamAsset(serviceKey);
    const posterPath = getServiceStreamPosterPath(asset);
    if (!fs.existsSync(posterPath)) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Posterul lipsește.");
    }

    return streamFile(request, reply, posterPath, "image/jpeg", "private, max-age=300, no-transform");
  });

  fastify.get<{ Params: { day: string; file: string }; Querystring: { sessionId?: string } }>("/api/stream/media/:day/:file", async (request, reply) => {
    const dayNumber = parseLessonDay(request.params.day);
    const sessionId = request.query.sessionId?.trim();
    const fileName = decodeURIComponent(request.params.file);
    if (!dayNumber || !sessionId) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Cererea media este invalidă.");
    }

    try {
      await getActiveStreamSession(sessionId, dayNumber);
    } catch (error) {
      return reply.code(403).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Sesiunea media nu este validă.");
    }

    const resolvedFile = resolveStreamFile(dayNumber, fileName);
    if (!resolvedFile || !fs.existsSync(resolvedFile.filePath)) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Fișierul media nu există.");
    }

    if (resolvedFile.kind === "master") {
      const content = rewriteMasterPlaylist(dayNumber, sessionId, fs.readFileSync(resolvedFile.filePath, "utf8"));
      return reply.header("Content-Type", resolvedFile.contentType).header("Cache-Control", "private, max-age=60, must-revalidate").header("X-Content-Type-Options", "nosniff").send(content);
    }

    if (resolvedFile.kind === "playlist") {
      const content = rewriteRenditionPlaylist(dayNumber, sessionId, fs.readFileSync(resolvedFile.filePath, "utf8"));
      return reply.header("Content-Type", resolvedFile.contentType).header("Cache-Control", "private, max-age=60, must-revalidate").header("X-Content-Type-Options", "nosniff").send(content);
    }

    return streamFile(request, reply, resolvedFile.filePath, resolvedFile.contentType, "private, max-age=900, immutable");
  });

  fastify.get<{ Params: { serviceKey: string }; Querystring: { sessionId?: string } }>("/api/stream/service/media/:serviceKey", async (request, reply) => {
    const serviceKey = parseServiceKey(request.params.serviceKey);
    const sessionId = request.query.sessionId?.trim();
    if (!serviceKey || !sessionId) {
      return reply.code(400).type("text/plain; charset=utf-8").send("Cererea video este invalidă.");
    }

    try {
      await getActiveServiceStreamSession(sessionId, serviceKey);
    } catch (error) {
      return reply.code(403).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Sesiunea video nu este validă.");
    }

    const asset = getServiceStreamAsset(serviceKey);
    const videoPath = getServiceStreamVideoPath(asset);
    if (!fs.existsSync(videoPath)) {
      return reply.code(404).type("text/plain; charset=utf-8").send("Fișierul video nu există.");
    }

    return streamFile(request, reply, videoPath, "video/mp4", "private, max-age=900, immutable");
  });

  fastify.post<{ Body: { token?: string; platform?: string | null; userAgent?: string | null; prefersNativeHls?: boolean } }>("/api/stream/session", async (request, reply) => {
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

  fastify.post<{ Body: { token?: string; platform?: string | null; userAgent?: string | null } }>("/api/stream/service/session", async (request, reply) => {
    try {
      const token = request.body.token?.trim();
      if (!token) {
        return reply.code(400).send({ message: "Token-ul video lipsește." });
      }

      return await createServiceStreamSession({
        token,
        platform: request.body.platform,
        userAgent: request.body.userAgent,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sesiunea video nu a putut fi creată.";
      logger.warn({ err: error }, "Crearea sesiunii video pentru serviciu a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{ Body: { sessionId?: string; currentTimeSec?: number; durationSec?: number | null } }>("/api/stream/progress", async (request, reply) => {
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

  fastify.post<{ Body: { sessionId?: string; currentTimeSec?: number } }>("/api/stream/service/progress", async (request, reply) => {
    try {
      const sessionId = request.body.sessionId?.trim();
      if (!sessionId) {
        return reply.code(400).send({ message: "sessionId lipsește." });
      }

      await recordServiceStreamProgress({
        sessionId,
        currentTimeSec: request.body.currentTimeSec ?? 0,
      });

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nu am putut salva progresul video.";
      logger.warn({ err: error }, "Actualizarea progresului video pentru serviciu a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{ Body: { sessionId?: string; currentTimeSec?: number | null } }>("/api/stream/complete", async (request, reply) => {
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

  fastify.post<{ Body: { sessionId?: string; currentTimeSec?: number | null } }>("/api/stream/service/complete", async (request, reply) => {
    try {
      const sessionId = request.body.sessionId?.trim();
      if (!sessionId) {
        return reply.code(400).send({ message: "sessionId lipsește." });
      }

      await completeServiceStreamSession({
        sessionId,
        currentTimeSec: request.body.currentTimeSec ?? null,
      });

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nu am putut finaliza sesiunea video.";
      logger.warn({ err: error }, "Finalizarea sesiunii video pentru serviciu a eșuat.");
      return reply.code(400).send({ message });
    }
  });

  fastify.post<{ Body: { token?: string | null; sessionId?: string | null; message?: string } }>("/api/stream/error", async (request, reply) => {
    await markStreamError({
      token: request.body.token ?? null,
      sessionId: request.body.sessionId ?? null,
      message: request.body.message?.trim() || "unknown_stream_error",
    });

    return reply.code(204).send();
  });

  fastify.post<{ Body: { token?: string | null; sessionId?: string | null; message?: string } }>("/api/stream/service/error", async (request, reply) => {
    await markServiceStreamError({
      token: request.body.token ?? null,
      sessionId: request.body.sessionId ?? null,
      message: request.body.message?.trim() || "unknown_service_stream_error",
    });

    return reply.code(204).send();
  });

  fastify.post<{ Body: { token?: string; answers?: number[] } }>("/api/stream/quiz/submit", async (request, reply) => {
    try {
      const token = request.body.token?.trim();
      if (!token) {
        return reply.code(400).send({ message: "Token-ul pentru quiz lipsește." });
      }

      return await submitLessonQuiz({
        token,
        answers: Array.isArray(request.body.answers) ? request.body.answers : [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nu am putut salva quiz-ul.";
      logger.warn({ err: error }, "Trimiterea quiz-ului din player a eșuat.");
      return reply.code(400).send({ message });
    }
  });
};
