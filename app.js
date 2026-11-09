(function () {
const {
  PHONE_THREADS,
  SCENE_TITLES,
  currentMainThought,
  formatTime,
  initialState,
  itemName,
  itemPlaceText,
  reducer,
  resultSummary,
} = window.ShowerGame;

const app = document.querySelector("#app");
let state = initialState();
let endingTimer = null;
let mainHintTimer = null;
let sleepTimer = null;
let lastFocus = null;
let lastMainThought = null;

function dispatch(action) {
  const previousPhase = state.phase;
  const previousPending = state.pendingPickup;
  const previousSleepTransition = state.sleepTransition;
  state = reducer(state, action);
  if (!previousPending && state.pendingPickup) {
    const item = state.pendingPickup.item;
    lastFocus = `[data-shot="${item}"], [data-action="pickupDropped:${item}"]`;
  }
  render();

  if (action.type === "showMainHint") {
    window.clearTimeout(mainHintTimer);
    mainHintTimer = window.setTimeout(() => dispatch({ type: "hideMainHint" }), 2400);
  }

  if (state.phase === "ending" && previousPhase !== "ending") {
    window.clearTimeout(endingTimer);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endingTimer = window.setTimeout(() => dispatch({ type: "finishEnding" }), reducedMotion ? 260 : 1500);
  }

  if (state.sleepTransition && !previousSleepTransition) {
    window.clearTimeout(sleepTimer);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sleepTimer = window.setTimeout(() => dispatch({ type: "wakeFromSofa" }), reducedMotion ? 180 : 1250);
  }

  if (action.type === "restart") window.clearTimeout(sleepTimer);
}

function render() {
  if (state.phase === "intro") app.innerHTML = introView();
  else if (state.phase === "result") app.innerHTML = resultView();
  else if (state.phase === "closed") app.innerHTML = closedView();
  else app.innerHTML = gameView();
  fitStage();
  const thought = app.querySelector(".main-thought");
  if (thought) {
    if (thought.dataset.thought !== lastMainThought) thought.classList.add("changed");
    lastMainThought = thought.dataset.thought;
  } else {
    lastMainThought = null;
  }
  if (state.pendingPickup) {
    const swapCard = app.querySelector(".swap-card");
    if (swapCard) swapCard.focus();
    return;
  }
  restoreFocus();
}

// 屏幕偏矮时，场景保持原设计尺寸并整体等比缩小，给底部旁白留出位置
function fitStage() {
  const shell = app.querySelector(".game-shell");
  const stage = app.querySelector(".stage");
  const viewport = stage && stage.querySelector(".scene-viewport");
  if (!shell || !viewport) return;
  const cs = getComputedStyle(shell);
  const designW = shell.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const designH = Math.min(designW * 1.435897, 589);
  const border = stage.offsetWidth - stage.clientWidth;
  const innerW = designW - border;
  const innerH = designH - border;
  const scale = Math.min(1, stage.clientHeight / innerH);
  if (scale >= 0.995) {
    viewport.style.removeProperty("width");
    viewport.style.removeProperty("height");
    viewport.style.removeProperty("transform");
    viewport.style.removeProperty("right");
    viewport.style.removeProperty("bottom");
    return;
  }
  viewport.style.right = "auto";
  viewport.style.bottom = "auto";
  viewport.style.width = `${innerW}px`;
  viewport.style.height = `${innerH}px`;
  viewport.style.transform = `scale(${scale})`;
}

window.addEventListener("resize", fitStage);

function button(label, action, className, attrs) {
  return `<button class="${className || "btn"}" data-action="${action}" ${attrs || ""}>${label}</button>`;
}

function hotspot(id, label, action, className, attrs) {
  const done = doneMark(id);
  const active = state.choicePanel === id ? "active" : "";
  const cue = shouldCueHotspot(id) ? "main-cue" : "";
  return `<button class="hotspot ${active} ${cue} ${className || ""}" data-shot="${id}" data-action="${action}" ${attrs || ""}><span>${label}${done}</span></button>`;
}

function doneMark(id) {
  const done = {
    bag: state.bagPlaced,
    parcel: state.parcelOpened,
    sofa: state.sofaSat,
    fridge: state.fridgeOpened,
    clothes: state.heldItems.includes("clothes"),
    towel: state.heldItems.includes("towel"),
    laundry: state.laundryStarted,
    remote: state.tvOn,
    drink: state.fridgeUsed.drink,
    leftovers: state.fridgeUsed.leftovers,
    sauce: state.fridgeUsed.sauce,
    coupon: state.fridgeUsed.coupon,
    bangs: state.mirrorUsed.bangs,
    eyes: state.mirrorUsed.eyes,
    pimple: state.mirrorUsed.pimple,
  }[id];
  return done ? " ✓" : "";
}

function introView() {
  return `
    <section class="phone-shell intro-screen">
      <div class="cover-art intro-cover-art" aria-hidden="true">
        <span class="cover-time">20:30 · 到家了</span>
        <span class="cover-light"></span>
      </div>
      <div class="cover-copy">
        <p>下班回家互动小游戏</p>
        <h1>先坐一下</h1>
        <strong>本来只想洗个澡。<br>可家里每样东西，都在说“先等等”。</strong>
      </div>
      ${button("推门回家", "start", "primary-btn intro-start")}
    </section>
  `;
}

function gameView() {
  return `
    <section class="phone-shell game-shell scene-${state.scene} move-${state.transition} ${state.paused ? "paused" : ""} ${state.mainHintActive ? "main-hint-active" : ""} ${state.sleepTransition ? "sleep-transition" : ""}">
      <header class="hud">
        <div class="hud-top">
          <strong>《先坐一下》</strong>
          <button class="clock" data-action="clockThought" aria-label="游戏内时间 ${formatTime(state.virtualMinutes)}">${formatTime(state.virtualMinutes)}</button>
          <button class="pause-btn" data-action="togglePause" aria-label="暂停">暂停</button>
        </div>
        <div class="hud-lower">
          <button class="main-thought ${state.mainHintActive ? "active" : ""}" data-action="showMainHint" data-thought="${currentMainThought(state)}" aria-label="当前念头：${currentMainThought(state)}。点击查看方向">
            <span class="thought-pin" aria-hidden="true"></span>
            <span class="thought-copy"><small>脑内便签 · 点一下会指路</small><strong>${currentMainThought(state)}</strong></span>
            <i aria-hidden="true">›</i>
          </button>
          ${statusView()}
        </div>
      </header>
      <section class="stage" aria-label="${SCENE_TITLES[state.scene] || "场景"}">
        <div class="scene-viewport">
          ${sceneView()}
          ${handsView()}
          ${state.sleepTransition ? sleepOverlayView() : ""}
          ${state.phase === "ending" ? endingView() : ""}
          ${choicePanelView()}
          ${handSwapPanelView()}
        </div>
      </section>
      <footer class="narration" aria-live="polite" aria-atomic="true"><p>${state.narration}</p></footer>
      ${state.paused ? pauseView() : ""}
    </section>
  `;
}

function statusView() {
  const awakeLabel = state.awake <= 20 ? "眼皮打架" : state.awake < 45 ? "开始犯困" : "精神还在";
  const comfortLabel = state.comfort >= 70 ? "不想动了" : state.comfort >= 40 ? "有点舒服" : "还好";
  return `
    <div class="status-cluster" aria-label="当前状态">
      <div class="status-meter awake-meter">
        <span><b>清醒度</b><em>${awakeLabel}</em><strong>${state.awake}</strong></span>
        <progress max="100" value="${state.awake}">${state.awake}</progress>
      </div>
      <div class="status-meter comfort-meter">
        <span><b>舒适度</b><em>${comfortLabel}</em><strong>${state.comfort}</strong></span>
        <progress max="100" value="${state.comfort}">${state.comfort}</progress>
      </div>
    </div>
  `;
}

function sleepOverlayView() {
  return `
    <div class="sleep-layer" role="status" aria-live="assertive">
      <div class="sleep-shade sleep-shade-top"></div>
      <p>眼皮慢慢合上了。</p>
      <div class="sleep-shade sleep-shade-bottom"></div>
    </div>
  `;
}

function sceneView() {
  const views = {
    entry: entryScene,
    living: livingScene,
    dressing: dressingScene,
    phone: phoneScene,
    sofa: sofaScene,
    parcel: parcelScene,
    fridge: fridgeScene,
    closet: closetScene,
    mirror: mirrorScene,
    bathdoor: bathdoorScene,
  };
  return (views[state.scene] || entryScene)();
}

function nav(label, action, className) {
  const cue = shouldCueNavigation(action) ? "main-cue" : "";
  return button(label, action, `nav-chip ${cue} ${className || ""}`);
}

function mainObjective() {
  if (!state.bagPlaced) return { item: "bag", scene: "entry", hotspot: "bag" };
  if (!state.heldItems.includes("clothes")) return itemObjective("clothes", "closet");
  if (!state.heldItems.includes("towel")) return itemObjective("towel", "closet");
  return { item: "bathdoor", scene: "dressing", hotspot: "bathdoor" };
}

function itemObjective(item, fallback) {
  const location = state.itemLocations[item] || fallback;
  if (location === "table") return { item, scene: "living", hotspot: item };
  if (location === "sofa") return { item, scene: "sofa", hotspot: `dropped-${item}` };
  if (["entry", "living", "dressing"].includes(location)) return { item, scene: location, hotspot: `dropped-${item}` };
  return { item, scene: "closet", hotspot: item === "clothes" ? "clothes-choice" : item };
}

function shouldCueHotspot(id) {
  const objective = mainObjective();
  if (state.scene === objective.scene) {
    if (objective.hotspot === "clothes-choice") return ["oldshirt", "pajamas", "newpajamas"].includes(id);
    return id === objective.hotspot;
  }
  if (state.scene === "dressing" && objective.scene === "closet") return id === "closet";
  if (state.scene === "living" && objective.scene === "sofa") return id === "sofa";
  return false;
}

function shouldCueNavigation(action) {
  const objective = mainObjective();
  const closeScenes = ["phone", "sofa", "parcel", "fridge", "closet", "mirror", "bathdoor"];
  if (closeScenes.includes(state.scene)) {
    if (state.scene === objective.scene) return false;
    return action === "back" || action === "standUp";
  }
  const order = ["entry", "living", "dressing"];
  const targetScene = objective.scene === "closet" ? "dressing" : objective.scene === "sofa" ? "living" : objective.scene;
  const here = order.indexOf(state.scene);
  const target = order.indexOf(targetScene);
  if (here < 0 || target < 0 || here === target) return false;
  return action === `go:${order[here + Math.sign(target - here)]}`;
}

function sceneSvg(content, label) {
  return `<svg class="scene-art" viewBox="0 0 390 560" role="img" aria-label="${label}">${content}</svg>`;
}

function roomBase(kind) {
  return `
    <defs>
      <linearGradient id="${kind}-wall" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#f8d9d6" />
        <stop offset="1" stop-color="#f2c9c8" />
      </linearGradient>
      <linearGradient id="${kind}-floor" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#e4bd91" />
        <stop offset="1" stop-color="#c99068" />
      </linearGradient>
      <filter id="${kind}-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="2" flood-color="#7d4d3a" flood-opacity=".18" />
      </filter>
    </defs>
    <rect width="390" height="560" fill="url(#${kind}-wall)" />
    <path d="M0 292 H390 V560 H0 Z" fill="url(#${kind}-floor)" />
    <path d="M0 292 H390" fill="none" stroke="#8b6251" stroke-width="4" opacity=".72" />
    <path d="M0 299 H390" fill="none" stroke="#fff3de" stroke-width="4" opacity=".72" />
    <g fill="none" stroke="#9a684f" stroke-width="1.35" opacity=".25">
      <path d="M36 560 L78 299 M117 560 L137 299 M198 560 L197 299 M279 560 L257 299 M360 560 L317 299" />
      <path d="M0 358 H390 M0 431 H390 M0 506 H390" />
    </g>
    <g fill="#fff7e8" opacity=".18">
      <path d="M28 47 q8 -12 16 0 q-8 12 -16 0z M179 86 q7 -11 15 0 q-7 11 -15 0z M338 39 q8 -12 16 0 q-8 12 -16 0z" />
    </g>
  `;
}

function entryArtworkLegacy() {
  const parcelOpen = state.parcelOpened
    ? `<g class="entry-parcel-open">
        <ellipse cx="305" cy="421" rx="55" ry="17" fill="#7b4d35" opacity=".14" />
        <path d="M258 365 l54 -18 l47 25 l-63 18 z" fill="#f7c98a" />
        <path d="M296 390 l63 -18 l12 55 l-67 22 z" fill="#d98e59" />
        <path d="M258 365 l38 25 l8 59 l-45 -25 z" fill="#e7a96e" />
        <path d="M271 357 l24 -35 l21 29 M339 366 l33 -29 l-6 37 M295 350 l42 -28 l20 39" fill="#f0bd78" />
        <path d="M276 389 l22 14 l42 -13" fill="none" stroke="#9b6043" stroke-width="2.2" />
        <path d="M293 376 h44" stroke="#fff1bb" stroke-width="7" opacity=".35" />
        <path d="M319 407 q18 -10 33 2 q-13 16 -34 10z" fill="#fff7e8" opacity=".78" />
      </g>`
    : `<g class="entry-parcel-closed">
        <ellipse cx="306" cy="424" rx="54" ry="16" fill="#7b4d35" opacity=".14" />
        <path d="M256 366 l78 -8 l24 35 l-77 17 z" fill="#f1b976" />
        <path d="M281 410 l77 -17 l2 49 l-82 16 z" fill="#d9915e" />
        <path d="M256 366 l25 44 l-3 48 l-29 -47 z" fill="#e8a469" />
        <path d="M295 364 l36 40 l-1 39" fill="none" stroke="#bf7650" stroke-width="6" opacity=".65" />
        <rect x="305" y="391" width="36" height="22" rx="5" fill="#fff7e8" transform="rotate(-7 323 402)" />
        <path d="M313 400 h17 M312 407 h23" stroke="#a98468" stroke-width="1.8" />
        <path d="M265 382 q28 13 71 6" fill="none" stroke="#fff1bb" stroke-width="6" opacity=".34" />
      </g>`;
  return sceneSvg(`
    ${roomBase("entry")}
    <g stroke="#6a463b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <g class="entry-wall-shelf">
        <path d="M205 102 h132" fill="none" stroke-width="4" />
        <path d="M216 70 v32 h18 V64 h18 v38 h16 V77 h19 v25" fill="#d7c8e9" />
        <path d="M302 81 q19 -22 36 0 v21 h-36z" fill="#f3e8c8" />
        <path d="M306 78 q-13 -30 8 -38 q4 24 1 38 M318 78 q4 -32 25 -29 q-7 24 -19 31 M315 74 q-12 -20 -27 -14 q7 17 21 22" fill="#77aa79" />
      </g>
      <path d="M18 92 h151 q10 0 10 10 v255 q0 10 -10 10 H18z" fill="#f6c59d" opacity=".36" />
      <path d="M42 126 q0 -67 61 -67 q62 0 62 67 v214 H42 Z" fill="#f0ac7c" filter="url(#entry-soft)" />
      <path d="M59 144 q0 -48 44 -48 q44 0 44 48 v170 H59 Z" fill="#ffd8aa" opacity=".55" />
      <path d="M61 177 h84 M61 252 h84 M102 97 v217" fill="none" opacity=".38" />
      <rect x="119" y="217" width="19" height="28" rx="9" fill="#f8d96b" />
      <circle cx="128" cy="231" r="4" fill="#fff7e8" />
      <path d="M22 367 q76 -28 151 5 q10 48 -2 111 q-65 24 -150 1 q-14 -59 1 -117z" fill="#ffdbe3" filter="url(#entry-soft)" />
      <path d="M34 390 q55 14 126 -3 M29 433 q70 15 139 -6 M89 371 v115" fill="none" stroke="#8fd2e5" stroke-width="10" opacity=".38" />
      <g class="shoe-cabinet" filter="url(#entry-soft)">
        <path d="M107 386 h137 q10 0 10 10 v91 q0 10 -10 10 H107 q-10 0 -10 -10 v-91 q0 -10 10 -10z" fill="#d59262" />
        <path d="M100 424 h151 M100 462 h151 M164 386 v111" fill="none" opacity=".78" />
        <rect x="119" y="400" width="35" height="14" rx="7" fill="#fff2bb" />
        <rect x="185" y="401" width="42" height="14" rx="7" fill="#bdebdc" />
        <path d="M130 444 q-29 -12 -53 6 q17 24 65 13 q10 -12 -12 -19z" fill="#ef786d" />
        <path d="M202 445 q31 -13 59 6 q-19 24 -66 12 q-10 -12 7 -18z" fill="#f8d96b" />
        <path d="M122 476 q24 -12 54 0 M190 476 q29 -12 48 5" fill="none" stroke="#fff6c9" stroke-width="6" opacity=".54" />
      </g>
      <g class="entry-bag-art" filter="url(#entry-soft)" transform="translate(68 90) scale(.7)">
        <ellipse cx="181" cy="452" rx="61" ry="19" fill="#7b4d35" opacity=".18" />
        <path d="M133 330 q48 -25 96 10 q12 55 2 112 q-42 31 -103 1 q-12 -65 5 -123z" fill="#a987e8" />
        <path d="M151 324 q21 -39 60 0" fill="none" stroke-width="5" />
        <path d="M148 358 q40 20 80 0 M151 397 h73" fill="none" stroke="#7b5ab8" stroke-width="3" opacity=".58" />
        <rect x="157" y="384" width="47" height="43" rx="8" fill="#d9c5ff" />
        <circle cx="220" cy="363" r="10" fill="#f58c9b" />
        <path d="M137 348 q26 8 57 4" fill="none" stroke="#fff7e8" stroke-width="6" opacity=".35" />
        <path d="M222 349 l35 13 l-9 56 l-37 -16z" fill="#fff7e8" />
        <path d="M232 372 h14 M229 384 h16 M226 396 h11" />
        <path d="M225 351 q-12 -21 8 -32" fill="none" stroke="#f8d96b" stroke-width="3" />
      </g>
      ${parcelOpen}
      <g class="umbrella-stand" filter="url(#entry-soft)">
        <path d="M321 346 q30 -23 56 2 l-9 94 h-39z" fill="#a8ded1" />
        <path d="M335 348 q-15 45 -4 83 M359 347 q16 46 4 85" fill="none" opacity=".62" />
        <path d="M337 306 q-20 33 6 62 M362 300 q22 36 -1 71" fill="none" stroke="#8d70ce" stroke-width="5" />
        <path d="M329 306 q13 -16 28 0 q-13 18 -28 0z" fill="#f58c9b" />
        <path d="M352 298 q13 -16 27 1 q-14 17 -27 -1z" fill="#f8d96b" />
      </g>
      <g class="wall-small-things">
        <path d="M289 48 q24 8 35 31 q-27 18 -67 3 q9 -26 32 -34z" fill="#ffe48d" filter="url(#entry-soft)" />
        <path d="M289 83 v39" fill="none" />
        <rect x="257" y="152" width="67" height="56" rx="5" fill="#fff2b5" transform="rotate(-8 290 180)" />
        <path d="M267 170 h40 M265 184 h45 M266 198 h26" transform="rotate(-8 290 180)" />
        <path d="M310 153 q7 -12 17 0 q-9 12 -17 0z" fill="#f58c9b" />
      </g>
    </g>
  `, "玄关里有门、鞋柜、包、工牌、快递和雨伞桶");
}

function sceneImage(src, label, className) {
  return `<img class="scene-art scene-illustration ${className || ""}" src="${src}" alt="${label}" draggable="false">`;
}

function entryArtwork() {
  return sceneImage("assets/scenes/entry-room.jpg", "温暖的出租屋玄关，门边放着鞋柜、包、工牌、快递和雨伞", "entry-illustration");
}

function livingArtworkLegacy() {
  const tv = state.tvOn
    ? `<g class="living-tv-on">
        <rect x="69" y="58" width="105" height="63" rx="8" fill="#fff7e8" stroke="#6a463b" stroke-width="2.2"/>
        <path d="M79 69 q24 -18 49 8 q14 -14 35 -4" fill="none" stroke="#f58c9b" stroke-width="5" opacity=".65"/>
        <circle cx="99" cy="92" r="9" fill="#f8d96b" stroke="#6a463b" stroke-width="2"/>
        <path d="M138 92 h22 M137 103 h17" stroke="#8fd2e5" stroke-width="4"/>
      </g>`
    : "";
  const food = state.fridgeChecked
    ? `<g class="food-on-table" stroke="#6a463b" stroke-width="2">
        <rect x="177" y="391" width="36" height="20" rx="6" fill="#fff7e8"/>
        <path d="M181 396 h27" stroke="#f58c9b" />
        <circle cx="243" cy="398" r="13" fill="#f8d96b"/>
        <path d="M235 395 q9 -8 18 0" fill="none" stroke="#fff7e8" stroke-width="4"/>
      </g>`
    : "";
  return sceneSvg(`
    ${roomBase("living")}
    ${tv}
    <g stroke="#6a463b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <g class="living-gallery">
        <rect x="160" y="42" width="54" height="69" fill="#fff8eb" />
        <rect x="168" y="50" width="38" height="51" fill="#8fd2e5" />
        <path d="M174 92 q13 -29 27 0" fill="#9fbe82" />
        <circle cx="192" cy="65" r="8" fill="#f8d96b" />
        <rect x="224" y="61" width="43" height="49" fill="#fff8eb" transform="rotate(4 245 85)" />
        <path d="M235 92 q10 -34 20 0" fill="none" stroke="#ef8898" stroke-width="5" />
      </g>
      <g class="living-bookcase" filter="url(#living-soft)">
        <path d="M3 119 h58 v176 H3z" fill="#90b89d" />
        <path d="M10 129 h44 v48 H10z M10 184 h44 v48 H10z M10 239 h44 v47 H10z" fill="#f6ddb9" />
        <path d="M15 166 v-27 h8 v27 M25 166 v-34 h10 v34 M38 166 v-24 h11 v24" fill="#d6a8d7" />
        <path d="M15 218 v-28 h9 v28 M27 218 v-35 h9 v35 M39 218 v-25 h10 v25" fill="#78bcc1" />
        <path d="M14 270 q17 -29 35 0" fill="#f5cd66" />
      </g>
      <g class="living-window" filter="url(#living-soft)">
        <rect x="37" y="76" width="100" height="77" rx="14" fill="#c9f4ff" />
        <path d="M87 76 v77 M37 115 h100" fill="none" opacity=".72" />
        <path d="M24 69 q29 5 41 18 v93 q-29 8 -49 -8 q10 -49 8 -103z M138 69 q-29 5 -41 18 v93 q30 8 50 -8 q-11 -49 -9 -103z" fill="#f8a7b3" />
        <path d="M33 101 q16 12 31 0 M112 103 q15 12 29 0" fill="none" stroke="#fff6c9" stroke-width="4" />
      </g>
      <g class="floor-lamp" filter="url(#living-soft)">
        <path d="M282 92 h48 q9 0 9 9 v55 h-66 v-55 q0 -9 9 -9z" fill="#ffe48d" />
        <path d="M305 156 v132" fill="none" stroke-width="3.5" />
        <path d="M264 288 h88" />
        <path d="M286 111 q20 -11 40 2" fill="none" stroke="#fff7e8" stroke-width="5" opacity=".55" />
      </g>
      <g class="fridge-art" filter="url(#living-soft)">
        <rect x="307" y="229" width="64" height="169" rx="18" fill="#eaffff" />
        <path d="M307 306 h64 M354 321 v51" />
        <path d="M322 255 q7 -11 16 0 q-8 12 -16 0z" fill="#f58c9b" />
        <path d="M346 257 l7 8 l10 -3 l-5 10 l6 8 l-11 -1 l-7 8 l-2 -11 l-10 -4 l10 -5z" fill="#f8d96b" />
        <rect x="324" y="329" width="22" height="18" rx="3" fill="#ffdbe3" />
        <path d="M324 335 h22" />
      </g>
      <path d="M43 408 q143 -47 302 8 l-17 105 q-135 31 -278 -2z" fill="#f5e5c8" stroke="#a97962" stroke-width="1.8" />
      <path d="M70 430 q112 -30 242 1 M63 467 q126 -29 261 2 M111 410 l-21 111 M180 399 l-5 128 M251 405 l13 116" fill="none" stroke="#e4aeb8" stroke-width="6" opacity=".58" />
      <path d="M46 288 q17 -76 130 -80 q103 -4 133 76 v97 q-118 35 -246 1 q-11 -55 -17 -94z" fill="#83cbb4" filter="url(#living-soft)" />
      <path d="M69 296 q39 16 94 2 M192 295 q47 17 92 -4" fill="none" stroke="#58aa98" stroke-width="5" opacity=".6" />
      <path d="M81 261 h91 q13 0 13 13 v50 q0 13 -13 13 H81 q-13 0 -13 -13 v-50 q0 -13 13 -13z" fill="#ffe08b" />
      <path d="M100 277 q31 -12 61 4" fill="none" stroke="#fff7e8" stroke-width="6" opacity=".55" />
      <path d="M207 257 h63 q11 0 11 11 v50 q0 11 -11 11 h-63 q-11 0 -11 -11 v-50 q0 -11 11 -11z" fill="#ffdce2" />
      <path d="M218 275 q19 -7 39 2" fill="none" stroke="#fff7e8" stroke-width="5" opacity=".55" />
      ${state.sofaSat ? `<path d="M189 312 q46 21 91 -8" fill="none" stroke="#f58c9b" stroke-width="8" opacity=".78"/>` : ""}
      <g class="coffee-table" filter="url(#living-soft)">
        <ellipse cx="199" cy="399" rx="104" ry="42" fill="#d08b5a" />
        <ellipse cx="199" cy="384" rx="98" ry="33" fill="#edaa70" />
        <path d="M121 410 v49 M279 409 v49" stroke="#a06446" stroke-width="5" />
        <path d="M123 382 q73 17 153 0" fill="none" stroke="#fff1bb" stroke-width="6" opacity=".32" />
      </g>
      <g class="table-clutter">
        <path d="M212 330 l86 13 l-10 48 l-88 -13z" fill="#d6c3ff" />
        <path d="M224 342 h44 M221 356 h51 M219 370 h31" />
        <path d="M92 349 q28 -22 60 2 q-4 31 -51 31 q-20 -10 -9 -33z" fill="#fff7e8" />
        <path d="M129 361 q17 -13 31 2" fill="none" />
        <path d="M154 379 l30 8 l-8 50 l-31 -10z" fill="#3e3450" />
        <path d="M163 393 h11" stroke="#8fd2e5" stroke-width="6" />
        <path d="M229 416 l62 8 l-8 27 l-63 -7z" fill="#49364a" />
        <circle cx="244" cy="432" r="4" fill="#f7d15c" />
        <circle cx="269" cy="434" r="4" fill="#f58c9b" />
        <path d="M289 388 l58 15 l-9 46 l-59 -14z" fill="#f58c9b" />
        <path d="M297 402 h35 M294 418 h42" stroke="#fff7c7" />
        <path d="M44 408 q28 -18 62 -4" fill="none" stroke-width="3" />
        <path d="M68 397 q25 8 24 30" fill="none" stroke="#fff7e8" stroke-width="6" />
        <path d="M52 437 q12 -8 23 2 q-9 14 -24 4z M83 436 q12 -8 23 2 q-9 14 -24 4z" fill="#fff7e8" stroke-width="2" />
        ${food}
      </g>
      <g class="living-plant" filter="url(#living-soft)">
        <path d="M338 245 h42 l-6 50 q-16 12 -31 0z" fill="#f4c4c8" />
        <path d="M357 250 q-7 -48 -27 -52 q-4 26 19 48 M359 250 q7 -57 28 -61 q5 30 -19 57 M356 244 q-30 -37 -43 -22 q13 27 39 31" fill="#78aa79" />
      </g>
    </g>
  `, "客厅里有沙发、茶几、手机、水杯、遥控器、电脑、耳机、零食包装和冰箱");
}

function dressingArtworkLegacy() {
  const laundry = state.laundryStarted
    ? `<g class="laundry-running">
        <path d="M191 431 q38 -27 83 3" fill="none" stroke="#f58c9b" stroke-width="8" opacity=".55"/>
        <circle cx="239" cy="431" r="14" fill="none" stroke="#8fd2e5" stroke-width="4" opacity=".6"/>
      </g>`
    : "";
  return sceneSvg(`
    ${roomBase("dress")}
    <g stroke="#6a463b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <g class="dress-wall-details">
        <rect x="202" y="36" width="69" height="49" fill="#fff8eb" />
        <path d="M212 74 q13 -31 25 -2 q11 -31 24 2" fill="#a8cf9b" />
        <path d="M294 78 h77" stroke-width="4" />
        <path d="M311 78 q-10 -28 8 -33 q8 20 1 33 M326 78 q5 -29 22 -27 q-4 22 -15 29" fill="#78aa79" />
      </g>
      <g class="closet-art" filter="url(#dress-soft)">
        <path d="M22 124 h156 q11 0 11 11 v318 q0 11 -11 11 H22z" fill="#c99067" />
        <path d="M36 145 h57 v128 H36z M109 145 h60 v128 h-60z M36 287 h133 v73 H36z M36 374 h133 v71 H36z" fill="#f4bd80" opacity=".82" />
        <path d="M100 124 v340 M48 199 h113 M47 287 h122 M46 360 h124" fill="none" opacity=".78" />
        <path d="M52 169 q16 21 36 0 M122 169 q15 21 33 0" fill="none" stroke="#fff1bb" stroke-width="4" />
        <path d="M58 178 v67 q18 11 34 0 v-67z" fill="#83cbb4" />
        <path d="M118 177 v71 q20 11 38 -2 v-69z" fill="#f58c9b" />
        <path d="M47 316 h42 q7 0 7 7 v25 H47z" fill="#fff7e8" />
        <path d="M104 309 l53 9 l-8 35 l-52 -9z" fill="#f8d96b" />
        <path d="M58 393 q34 -19 79 0 v42 H58z" fill="#d6c3ff" />
        <path d="M147 382 q15 22 1 49" fill="#fff7e8" />
        <circle cx="86" cy="275" r="5" fill="#f8d96b" />
        <circle cx="123" cy="275" r="5" fill="#f8d96b" />
      </g>
      <g class="mirror-art" filter="url(#dress-soft)">
        <path d="M198 116 q0 -50 43 -50 q45 0 45 50 v102 q0 12 -12 12 h-64 q-12 0 -12 -12z" fill="#d8f8ff" />
        <path d="M208 98 q24 -20 51 -8" fill="none" stroke="#fff" stroke-width="7" opacity=".78" />
        <path d="M216 134 q16 -11 35 2 M215 157 h43" fill="none" stroke="#9bdce9" stroke-width="3" opacity=".48" />
        <path d="M189 130 q-20 11 -29 36 q24 12 43 -5z" fill="#f58c9b" />
        <path d="M290 145 q20 11 29 37 q-24 11 -44 -6z" fill="#f8d96b" />
        <rect x="204" y="236" width="73" height="15" rx="7" fill="#f4bd80" />
      </g>
      <g class="bath-door-art" filter="url(#dress-soft)">
        <path d="M302 185 q0 -58 47 -58 q47 0 47 58 v255 h-94z" fill="#fffdf5" />
        <path d="M316 205 q21 -18 52 -8" fill="none" stroke="#fff" stroke-width="8" opacity=".7" />
        <path d="M303 186 q21 -41 45 -41 q24 0 45 41" fill="none" stroke="#f8d96b" stroke-width="8" opacity=".45" />
        <path d="M302 437 h94" />
        <circle cx="373" cy="315" r="7" fill="#f8d96b" />
        <path d="M326 263 q19 -14 39 0 M327 284 q18 -12 36 0" fill="none" stroke="#eadfcb" stroke-width="4" />
      </g>
      <path d="M48 426 q139 -47 302 5 l-12 99 q-147 27 -286 -2z" fill="#f8e8d2" stroke="#a97962" stroke-width="1.8" />
      <path d="M73 450 q118 -29 250 0 M66 491 q138 -28 272 1" fill="none" stroke="#b7d7c7" stroke-width="8" opacity=".74" />
      <g class="dressing-floor-clutter">
        <path d="M73 340 l84 -11 l17 43 l-85 16z" fill="#83cbb4" />
        <path d="M93 351 h38 M95 363 h30" stroke="#fff7e8" stroke-width="4" opacity=".55" />
        <path d="M72 393 l98 14 l-12 50 l-98 -15z" fill="#f8d96b" />
        <path d="M90 411 q25 8 56 0" fill="none" stroke="#fff7e8" stroke-width="5" opacity=".55" />
        <path d="M169 378 q63 -37 120 8 l-18 52 q-49 11 -107 -7z" fill="#ffd5a3" />
        <path d="M196 389 q20 20 45 0 M188 415 h70" fill="none" stroke="#d69266" stroke-width="3" opacity=".45" />
        <path d="M249 405 h70 v74 h-70z" fill="#a987e8" />
        <path d="M260 420 q24 14 48 0 M260 444 h48" fill="none" stroke="#d9c5ff" stroke-width="4" />
        <path d="M178 419 q23 -20 58 -6 v48 h-62z" fill="#f6a8b1" />
        <circle cx="205" cy="438" r="8" fill="#fff7e8" />
        <path d="M88 256 l66 -8 l8 45 l-67 10z" fill="#fff7e8" />
        <path d="M98 273 h46 M98 285 h32" />
        <path d="M65 301 h84 v34 H65z" fill="#83cbb4" />
        <path d="M75 315 h61" stroke="#f8d96b" stroke-width="12" />
        <path d="M49 456 q20 -12 38 4 q-14 20 -43 9z" fill="#fff7e8" />
      </g>
      ${laundry}
    </g>
  `, "换衣区有衣柜、镜子、浴室门、洗衣篮和散落衣物");
}

function livingArtwork() {
  const phone = state.itemLocations.phone === "table" && !state.heldItems.includes("phone")
    ? `<svg class="living-phone-prop" viewBox="0 0 72 120" aria-hidden="true">
        <defs><filter id="phone-shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#3f2924" flood-opacity=".28"/></filter></defs>
        <g filter="url(#phone-shadow)" transform="rotate(-9 36 60)">
          <rect x="6" y="3" width="60" height="114" rx="13" fill="#5b4549" stroke="#5c3e35" stroke-width="3"/>
          <rect x="10" y="8" width="52" height="102" rx="10" fill="#d9c8ee"/>
          <rect x="15" y="15" width="42" height="84" rx="7" fill="#fbecf1"/>
          <path d="M21 33 q15 -14 30 0 M19 51 h34 M19 62 h24" fill="none" stroke="#9ac9bd" stroke-width="4" stroke-linecap="round"/>
          <circle cx="36" cy="105" r="3" fill="#f7dfb7"/>
          <circle cx="26" cy="22" r="4" fill="#ef8f9e"/>
          <path d="M48 16 l3 5 l6 1 l-4 4 l1 6 l-6 -3 l-5 3 l1 -6 l-4 -4 l6 -1z" fill="#f2c766"/>
          <path d="M17 12 q14 -7 27 0" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
        </g>
      </svg>`
    : "";
  return `${sceneImage("assets/scenes/living-room.jpg", "有生活痕迹的客厅，沙发前的茶几放着水杯、电脑、耳机、零食和遥控器", "living-illustration")}${phone}`;
}

function dressingArtwork() {
  return sceneImage("assets/scenes/dressing-room.jpg", "换衣区里有打开的衣柜、镜子、洗衣篮、散落衣物和透出暖光的浴室门", "dressing-illustration");
}

function entryScene() {
  return `
    <div class="scene-card entry-main">
      ${entryArtwork()}
      ${droppedItems("entry")}
      ${hotspot("doorLock", "门锁", "inspect:doorLock", "entry-door-lock")}
      ${hotspot("bag", "包", "inspect:bag", "entry-bag")}
      ${hotspot("shoes", "鞋子", "inspect:shoes", "entry-shoes")}
      ${hotspot("badge", "工牌", "inspect:badge", "entry-badge")}
      ${hotspot("parcel", "快递", "inspect:parcel", "entry-parcel")}
      ${nav("去客厅 ›", "go:living", "to-living")}
    </div>
  `;
}

function livingScene() {
  return `
    <div class="scene-card living-main">
      ${livingArtwork()}
      ${droppedItems("living")}
      ${hotspot("sofa", "沙发", "inspect:sofa", "living-sofa")}
      ${state.itemLocations.phone === "table" && !state.heldItems.includes("phone") ? hotspot("phone", `手机${unreadBadge()}`, "inspect:phone", "living-phone") : ""}
      ${state.itemLocations.cup === "table" && !state.heldItems.includes("cup") ? hotspot("cup", "水杯", "inspect:cup", "living-cup") : ""}
      ${hotspot("remote", "遥控器", "inspect:remote", "living-remote")}
      ${hotspot("fridge", "冰箱", "inspect:fridge", "living-fridge")}
      ${nav("‹ 回玄关", "go:entry", "to-entry")}
      ${nav("去换衣区 ›", "go:dressing", "to-dressing")}
    </div>
  `;
}

function dressingScene() {
  return `
    <div class="scene-card dressing-main">
      ${dressingArtwork()}
      ${droppedItems("dressing")}
      ${hotspot("closet", "衣柜", "inspect:closet", "dress-closet")}
      ${hotspot("mirror", "镜子", "inspect:mirror", "dress-mirror")}
      ${hotspot("laundry", "洗衣篮", "inspect:laundry", "dress-laundry")}
      ${hotspot("bathdoor", "浴室门", "inspect:bathdoor", "dress-bath")}
      ${nav("‹ 回客厅", "go:living", "to-living-back")}
    </div>
  `;
}

function phoneScene() {
  const content = state.phoneView === "home" ? phoneHome() : phoneDetail(state.phoneView);
  return `
    <div class="backdrop-blur"></div>
    <div class="phone-close first-person-close">
      ${nav("‹ 放下手机", "back", "back-link")}
      <div class="phone-device">
        <div class="phone-top">${formatTime(state.virtualMinutes)}</div>
        ${content}
      </div>
    </div>
  `;
}

function phoneHome() {
  return `<div class="phone-home notification-center">
    <p class="phone-greeting">晚上好。你本来只想看一眼。</p>
    <div class="notification-stack">
      ${phoneNotice("friend", "朋友消息", "我刚翻到我们以前那张照片哈哈", "友")}
      ${phoneNotice("work", "工作群", "今晚的表格不急，明早看也行。", "群")}
    </div>
    <div class="phone-quick-grid">
      <button class="phone-quick album-quick" data-action="phone:album"><i>照</i><span>三年前的夏天</span><small>${state.phoneAlbumIndex + 1}/3</small></button>
      <button class="phone-quick video-quick" data-action="phone:video"><i>播</i><span>接着看</span><small>${state.phoneVideoIndex + 1}/3</small></button>
    </div>
    <button class="phone-search-shortcut" data-action="phone:search"><span>⌕</span>${state.phoneSearchStage ? "雨衣电影 演员 现在" : "搜索点什么"}</button>
  </div>`;
}

function phoneNotice(key, label, preview, icon) {
  const read = state.phoneRead[key];
  return `<button class="phone-notice ${read ? "read" : "unread"}" data-action="phone:${key}"><i>${icon}</i><span><b>${label}</b><small>${preview}</small></span><em>${read ? "已读" : "刚刚"}</em></button>`;
}

function phoneDetail(view) {
  const step = state.phoneSteps[view] || 0;
  const back = `<button class="phone-inside-back" data-action="phoneHome">‹ 返回</button>`;
  const screens = {
    work: `${back}<section class="phone-page chat-page"><h3>工作群 <small>6 人</small></h3>
      <div class="chat-bubble incoming">今晚的表格不急，明早看也行。</div>
      ${step > 0 ? `<div class="chat-bubble incoming late">补充一下：格式参考上次那份。</div>${state.phoneWorkReacted ? `<div class="chat-reaction">收到 ✓</div><div class="phone-end">没有更多新消息</div>` : `<button class="phone-thought compact" data-action="phoneWorkReact">回一个“收到”</button>`}` : `<button class="phone-thought" data-action="phoneAdvance:work">看看“不急”后面还有什么</button>`}
    </section>`,
    friend: `${back}<section class="phone-page chat-page"><h3>小莹 <small>刚刚</small></h3>
      <div class="chat-bubble incoming">我刚翻到我们以前那张照片哈哈</div>
      <div class="chat-bubble incoming late">就是穿黄色雨衣那次，你还留着吗？</div>
      ${friendReplyView()}
    </section>`,
    album: `${back}<section class="phone-page album-page"><h3>三年前的夏天 <small>${state.phoneAlbumIndex + 1}/3</small></h3>
      <div class="album-swipe-surface" data-phone-swipe="album" tabindex="0" aria-label="相册照片，可左右滑动">${albumCard(state.phoneAlbumIndex)}</div>
      <div class="album-controls"><button data-action="phoneAlbumMove:-1" ${state.phoneAlbumIndex === 0 ? "disabled" : ""}>‹ 上一张</button><span>左右滑动照片</span><button data-action="phoneAlbumMove:1" ${state.phoneAlbumIndex === 2 ? "disabled" : ""}>下一张 ›</button></div>
      ${state.phonePhotoDetails.actor ? `<button class="phone-thought accent" data-action="phone:search">这个人现在怎么样了？</button>` : ""}
    </section>`,
    search: `${back}<section class="phone-page search-page"><h3>搜索</h3><div class="search-box">${state.phoneSearchStage ? "雨衣电影 演员 现在" : "雨衣电影 演员"}<span></span></div>
      <button class="search-result interactive" data-action="phoneSearchAdvance"><b>${state.phoneSearchStage ? "原来那部电影已经是三年前" : "雨衣电影 主演是谁"}</b><p>${state.phoneSearchStage ? "主演最近好像参加了一个很奇怪的节目。" : "大家还在搜：黄色雨衣、夏天、路人演员。"}</p></button>
      ${state.phoneSearchStage > 0 ? `<button class="search-result interactive" data-action="phoneSearchAdvance"><b>大家都在看的采访片段</b><p>“我真的只是下楼买杯咖啡。”</p></button>` : ""}
      ${state.phoneSearchStage >= 2 ? `<button class="phone-thought accent" data-action="phone:video">看看那个片段</button>` : `<p class="search-hint">点一下搜索结果，问题会自己长出下一个问题。</p>`}
    </section>`,
    video: `${back}<section class="phone-page video-page"><div class="video-counter">${state.phoneVideoIndex + 1}/3</div><div class="video-swipe-surface" data-phone-swipe="video" tabindex="0" aria-label="短视频，可上下滑动">${videoCard(state.phoneVideoIndex)}</div>
      <div class="video-actions"><button class="heart-btn ${state.phoneLiked[`video-${state.phoneVideoIndex}`] ? "liked" : ""}" data-action="phoneLike:video-${state.phoneVideoIndex}" aria-label="喜欢">♥</button>${state.phoneVideoIndex < 2 ? `<button class="next-video" data-action="phoneVideoNext:1">再看一个 ↑</button>` : `<button class="next-video done" data-action="phoneHome">到这里就没有了</button>`}</div>
    </section>`,
  };
  return `<div class="phone-detail">${screens[view] || screens.work}</div>`;
}

function friendReplyView() {
  if (!state.phoneReply) return `<div class="reply-choices" aria-label="选择回复">
    <button data-action="phoneReply:laugh">哈哈哈哈你居然还记得</button>
    <button data-action="phoneReply:remember">你怎么还记得这件事</button>
    <button data-action="phoneReply:find">等下，我去找那张照片</button>
  </div>`;
  const replies = {
    laugh: "哈哈哈哈你居然还记得",
    remember: "你怎么还记得这件事",
    find: "等下，我去找那张照片",
  };
  return `<div class="chat-bubble outgoing">${replies[state.phoneReply]}</div><div class="chat-bubble incoming late">我当然记得，你的伞当时整个翻过去了。</div><button class="phone-thought accent" data-action="phone:album">找一下那张照片</button>`;
}

function albumCard(step) {
  const cards = [
    ["photo-rain", "黄色雨衣、突然的大雨，还有一把撑反的伞。", "umbrella", "撑反的伞"],
    ["photo-food", "那家店已经关了，但照片里的薯条还很脆。", "fries", "照片里的薯条"],
    ["photo-star", "等等，后面路过的人是不是那个演员？", "actor", "照片后面的路人"],
  ];
  const [kind, text, detail, label] = cards[Math.min(step, 2)];
  const seen = state.phonePhotoDetails[detail];
  return `<div class="album-card ${kind} ${seen ? "detail-seen" : ""}"><div class="photo-art"><i></i><b></b><em></em><button class="photo-detail-target target-${detail}" data-action="phonePhotoDetail:${detail}" aria-label="查看${label}"><span>${seen ? "看过了 ✓" : "点这里看看"}</span></button></div><p>${text}</p></div>`;
}

function videoCard(step) {
  const cards = [
    ["coffee", "演员认真解释：我真的只是下楼买咖啡。"],
    ["octopus", "冷知识：章鱼为什么不需要八条裤子？"],
    ["toast", "三分钟把吐司切成小花，第一步是拥有耐心。"],
  ];
  const [kind, text] = cards[Math.min(step, 2)];
  return `<button class="video-card ${kind} ${state.phoneVideoPaused ? "paused" : ""}" data-action="phoneVideoToggle" aria-label="${state.phoneVideoPaused ? "继续播放" : "暂停视频"}"><div class="video-illustration"><i></i><b></b><em>${state.phoneVideoPaused ? "▶" : "Ⅱ"}</em></div><p>${text}</p></button>`;
}

function sofaSceneLegacy() {
  return `
    <div class="sofa-close first-person-close ${state.sofaLied ? "lying" : ""}">
      ${nav("‹ 站起来", "standUp", "back-link")}
      ${sceneSvg(`
        <defs><filter id="sofaSoft"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="#6a463b" flood-opacity=".2"/></filter></defs>
        <rect width="390" height="560" fill="#eac8c8"/>
        <path d="M0 300 h390 v260 H0z" fill="#c99670"/>
        <path d="M0 304 h390" stroke="#6a463b" stroke-width="3"/>
        <g stroke="#6a463b" stroke-width="2" stroke-linejoin="round">
          <rect x="139" y="45" width="76" height="70" fill="#fff8ea"/>
          <rect x="149" y="55" width="56" height="50" fill="#9fcfd4"/>
          <circle cx="180" cy="72" r="10" fill="#f2cf70"/>
          <path d="M157 99 q19 -35 40 0" fill="#8fae82"/>
          <path d="M238 88 h101" stroke-width="5"/>
          <path d="M261 87 q-8 -33 11 -38 q9 23 1 38 M278 87 q6 -36 25 -31 q-5 25 -18 32 M291 87 q15 -23 31 -9 q-11 18 -27 17" fill="#82aa7b"/>
          <path d="M45 75 h58 q10 0 10 10 v53 H35 V85 q0 -10 10 -10z" fill="#f4d77d"/>
          <path d="M74 138 v64 M48 202 h53" fill="none" stroke-width="4"/>
        </g>
        <g stroke="#6a463b" stroke-width="2.2" stroke-linejoin="round" filter="url(#sofaSoft)">
          <path d="M-10 105 q61 -43 123 4 q82 -48 167 2 q61 -39 120 5 v218 q-194 38 -410 0z" fill="#8fbfaf"/>
          <path d="M18 151 q45 -35 91 1 v127 q-43 21 -91 0z" fill="#f1d77b"/>
          <path d="M281 152 q47 -34 91 4 v125 q-44 20 -91 0z" fill="#d7c7eb"/>
          <path d="M28 171 q35 -15 70 0 M291 172 q34 -15 68 1" fill="none" stroke="#fff8ea" stroke-width="6" opacity=".55"/>
          <ellipse cx="266" cy="340" rx="105" ry="43" fill="#d9a075"/>
          <ellipse cx="266" cy="328" rx="100" ry="35" fill="#edc094"/>
          <path d="M188 356 v77 M341 356 v77" stroke="#8d604c" stroke-width="7"/>
          <path d="M221 289 l35 3 l-3 51 l-36 -4z" fill="#51465e"/>
          <path d="M226 299 h23" stroke="#9ee4e8" stroke-width="7"/>
          <path d="M288 304 l57 8 l-5 25 l-58 -8z" fill="#62586b"/>
          <circle cx="301" cy="320" r="3" fill="#f2d271"/><circle cx="329" cy="323" r="3" fill="#ee91a0"/>
        </g>
        <g class="sofa-pov" stroke="#6a463b" stroke-width="2.2" stroke-linejoin="round">
          <path d="M70 425 q58 -50 123 -5 l20 140 H45z" fill="#627c8d"/>
          <path d="M320 425 q-58 -50 -123 -5 l-20 140 h168z" fill="#627c8d"/>
          <path class="sofa-blanket-art" d="M88 409 q104 -55 214 2 l17 149 H72z" fill="#d8c9ed"/>
          <path d="M97 436 q93 -39 195 1 M90 478 q104 -34 211 2" fill="none" stroke="#fff8ea" stroke-width="8" opacity=".55"/>
          <path d="M132 419 q-38 10 -47 48 M260 416 q43 13 50 52" fill="none" stroke="#b09bc8" stroke-width="3"/>
        </g>
      `, "坐在沙发上的第一人称视角，能看见膝盖、毯子、抱枕和茶几")}
      ${hotspot("blanket", "毯子", "lieSofa", "sofa-blanket-label")}
      ${hotspot("pillow", "抱枕", "lieSofa", "sofa-pillow-label")}
      ${!state.heldItems.includes("phone") ? hotspot("phone", "手机", "go:phone", "sofa-phone-label") : ""}
      ${hotspot("remote", "遥控器", "egg:remote", "sofa-remote-label")}
      ${hotspot("table", "茶几", "inspect:sofaTable", "sofa-table-label")}
    </div>
  `;
}

function sofaScene() {
  const phone = !state.heldItems.includes("phone") && state.itemLocations.phone !== "hand"
    ? `<svg class="sofa-phone-prop" viewBox="0 0 72 120" aria-hidden="true">
        <g transform="rotate(-8 36 60)"><rect x="6" y="3" width="60" height="114" rx="13" fill="#5b4549" stroke="#5c3e35" stroke-width="3"/><rect x="11" y="9" width="50" height="99" rx="9" fill="#f7ddea"/><path d="M18 30 q15 -13 31 0 M18 47 h36 M18 60 h24" fill="none" stroke="#8fc8b8" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="19" r="4" fill="#ef8f9e"/><path d="M48 16 l3 5 l6 1 l-4 4 l1 6 l-6 -3 l-5 3 l1 -6 l-4 -4 l6 -1z" fill="#f2c766"/></g>
      </svg>` : "";
  return `
    <div class="sofa-close illustrated-close first-person-close ${state.sofaLied ? "lying" : ""} ${state.sofaSlept ? "sofa-slept" : ""}">
      ${nav("‹ 站起来", "standUp", "back-link")}
      ${sceneImage("assets/scenes/sofa-close.jpg", "坐在柔软沙发上的第一人称视角，膝盖盖着毯子，茶几上放着电脑、水杯、耳机、零食和遥控器", "closeup-illustration")}
      ${droppedItems("sofa")}
      ${phone}
      ${hotspot("blanket", "毯子", state.sofaLied ? "inspect:sofaRest" : "lieSofa", "sofa-blanket-label")}
      ${hotspot("pillow", "抱枕", state.sofaLied ? "inspect:sofaRest" : "lieSofa", "sofa-pillow-label")}
      ${!state.heldItems.includes("phone") ? hotspot("phone", "手机", "go:phone", "sofa-phone-label") : ""}
      ${hotspot("remote", "遥控器", "egg:remote", "sofa-remote-label")}
      ${hotspot("table", "茶几", "inspect:sofaTable", "sofa-table-label")}
    </div>
  `;
}

function parcelScene() {
  return `
    <div class="parcel-close first-person-close ${state.parcelBrushed ? "brush-held" : ""} ${state.parcelBagTidied ? "bag-tidied" : ""} ${state.parcelBrushed && !state.parcelBagTidied ? "parcel-next-step" : ""}">
      ${nav("‹ 放下快递", "back", "back-link parcel-back")}
      ${parcelArtwork()}
      ${!state.parcelBrushed ? hotspot("brush", "迷你清洁刷", "parcelPanel:brush", "parcel-brush-label") : ""}
      ${!state.parcelBrushed ? hotspot("heads", "替换刷头", "parcelPanel:brush", "parcel-heads-label") : ""}
      ${!state.parcelBagTidied ? hotspot("wrapper", "包装袋", "parcelPanel:bag", "parcel-bag-label") : ""}
      ${state.parcelBrushed && state.parcelBagTidied ? hotspot("parcelDone", "收拾好了", "inspect:parcelDone", "parcel-done-label") : ""}
      ${parcelPanel()}
    </div>
  `;
}

function parcelArtworkLegacy() {
  return `
    <svg class="parcel-art" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label="打开的快递箱里放着一套迷你电动清洁刷">
      <defs>
        <linearGradient id="woodGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#f6bf76" />
          <stop offset="1" stop-color="#d99057" />
        </linearGradient>
        <linearGradient id="boxOuter" x1="0" x2="1">
          <stop offset="0" stop-color="#f5c47f" />
          <stop offset="1" stop-color="#ce7e4e" />
        </linearGradient>
        <linearGradient id="boxInner" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#ffe7b6" />
          <stop offset="1" stop-color="#bd7650" />
        </linearGradient>
        <linearGradient id="skinParcel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#ffd3a1" />
          <stop offset="1" stop-color="#efae72" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="5" flood-color="#7b4d35" flood-opacity="0.28" />
        </filter>
      </defs>

      <g class="parcel-floor-layer">
        <rect width="390" height="560" fill="url(#woodGrad)" />
        <path d="M0 70 C74 84 129 61 205 76 S324 100 390 78" fill="none" stroke="#8e563c" stroke-width="4" opacity=".35" />
        <path d="M0 224 C79 239 136 217 212 229 S323 252 390 229" fill="none" stroke="#8e563c" stroke-width="4" opacity=".34" />
        <path d="M0 421 C83 438 152 411 239 424 S334 452 390 426" fill="none" stroke="#8e563c" stroke-width="5" opacity=".42" />
        <path d="M22 105 q174 -55 340 9 q18 130 0 302 q-155 70 -340 2 q-23 -162 0 -313z" fill="#ffdbe3" stroke="#5a3d36" stroke-width="3" opacity=".98" />
        <path d="M48 136 C120 117 201 123 342 157 M35 196 C139 169 249 178 360 211 M32 292 C137 264 246 270 360 307 M43 376 C131 348 244 352 350 390" fill="none" stroke="#8fd2e5" stroke-width="19" opacity=".65" />
        <path d="M83 179 q8 -15 21 0 q-11 15 -21 0z M286 167 q7 -12 18 0 q-9 13 -18 0z M63 333 q6 -10 15 0 q-7 11 -15 0z" fill="#fff7e8" stroke="#5a3d36" stroke-width="2" opacity=".72" />
        <path d="M326 21 q41 13 64 47 v56 q-38 11 -86 -3 q3 -63 22 -100z" fill="#b88265" stroke="#5a3d36" stroke-width="4" opacity=".55" />
        <path d="M0 144 L48 154 L45 401 L0 391 Z" fill="#bd815f" stroke="#5a3d36" stroke-width="4" opacity=".58" />
        <ellipse cx="47" cy="503" rx="41" ry="17" fill="#f6b68a" stroke="#5a3d36" stroke-width="3" transform="rotate(14 47 503)" opacity=".88" />
        <ellipse cx="342" cy="504" rx="42" ry="17" fill="#f6b68a" stroke="#5a3d36" stroke-width="3" transform="rotate(-13 342 504)" opacity=".88" />
        <path d="M48 499 q14 -7 30 3 M323 501 q15 -8 31 2" fill="none" stroke="#fff0bf" stroke-width="5" stroke-linecap="round" />
      </g>

      <ellipse class="box-contact-shadow" cx="197" cy="388" rx="152" ry="44" fill="#6f422e" opacity=".24" />

      <g class="box-back-flaps" filter="url(#softShadow)">
        <path d="M96 246 L49 188 L139 164 L181 234 Z" fill="#e5a768" stroke="#5a3d36" stroke-width="4" />
        <path d="M294 246 L341 190 L250 164 L211 234 Z" fill="#d78f59" stroke="#5a3d36" stroke-width="4" />
        <path d="M123 173 L267 173 L234 238 L156 238 Z" fill="#f5c989" stroke="#5a3d36" stroke-width="4" />
        <path d="M154 171 q42 15 86 0" fill="none" stroke="#fff2bd" stroke-width="8" opacity=".48" />
        <path d="M87 215 q21 -10 43 -8 M264 205 q27 6 45 24" fill="none" stroke="#9b6043" stroke-width="3" opacity=".42" />
      </g>

      <g class="box-interior">
        <path d="M83 232 L307 232 L283 414 L108 414 Z" fill="url(#boxInner)" stroke="#5a3d36" stroke-width="4" />
        <path d="M114 263 L276 263 L256 362 L131 365 Z" fill="#7b4634" opacity=".19" />
        <path d="M103 249 q87 24 184 0" fill="none" stroke="#fff0bd" stroke-width="5" opacity=".38" />
        <path d="M96 237 L109 410 M296 237 L282 410" stroke="#a76545" stroke-width="3" opacity=".43" />
      </g>

      <g class="box-items ${state.parcelBrushed ? "brush-is-gone" : ""} ${state.parcelBagTidied ? "bag-is-gone" : ""}">
        <g class="cleaner-kit">
          <path d="M104 259 L248 245 q18 -2 23 16 L287 342 q4 18 -15 21 L126 377 q-19 2 -23 -16 L88 282 q-4 -19 16 -23z" fill="#d9c5ff" stroke="#5a3d36" stroke-width="4" opacity=".82" />
          <path d="M111 271 L265 255" stroke="#fff" stroke-width="9" opacity=".4" />
          <path d="M113 356 q70 18 157 -9" fill="none" stroke="#866dc5" stroke-width="3" opacity=".34" />
          <g class="cleaner-brush-core">
            <path d="M139 319 q30 -48 84 -36 q28 6 26 35 q-2 29 -36 29 l-83 -5 q-13 -1 -16 -9 q-3 -11 25 -14z" fill="#83cbb4" stroke="#5a3d36" stroke-width="4" />
            <path d="M222 291 q27 8 27 28 q0 21 -32 28" fill="none" stroke="#4f907f" stroke-width="8" stroke-linecap="round" />
            <rect x="176" y="301" width="22" height="10" rx="5" fill="#fff7e8" stroke="#5a3d36" stroke-width="2" />
          </g>
          <circle cx="252" cy="282" r="17" fill="#f58c9b" stroke="#5a3d36" stroke-width="3" />
          <circle cx="264" cy="329" r="16" fill="#f8d96b" stroke="#5a3d36" stroke-width="3" />
          <path d="M121 338 L176 343 L171 374 L116 368 Z" fill="#fff7e8" stroke="#5a3d36" stroke-width="3" />
          <path d="M130 348 L164 351 M128 358 L162 361" stroke="#a987e8" stroke-width="2" stroke-linecap="round" />
          <path d="M112 282 q6 -10 13 0 q-7 10 -13 0z M253 350 l6 10 l11 -4 l-5 11 l7 8 l-12 -1 l-6 10 l-3 -12 l-11 -2 l9 -7z" fill="#fff1a7" stroke="#5a3d36" stroke-width="2" />
          <circle cx="141" cy="275" r="4" fill="#fff" opacity=".85" />
          <circle cx="222" cy="354" r="5" fill="#fff" opacity=".55" />
          <circle cx="282" cy="304" r="4" fill="#fff" opacity=".55" />
        </g>
        <g class="parcel-wrapper">
          <path d="M244 350 q49 -16 83 14 q-20 42 -79 35 q-24 -21 -4 -49z" fill="#fff7e8" stroke="#5a3d36" stroke-width="4" opacity=".72" />
          <path d="M260 364 q24 -7 45 7 M256 386 q27 5 50 -6" fill="none" stroke="#8fd2e5" stroke-width="3" opacity=".58" />
          <circle cx="309" cy="362" r="7" fill="#f58c9b" opacity=".78" />
        </g>
      </g>

      <g class="parcel-hands">
        <g class="parcel-hand parcel-left-hand">
          <path d="M45 448 L111 425 L137 535 L56 558 Z" fill="#f58c9b" stroke="#5a3d36" stroke-width="4" />
          <path d="M54 455 L116 436" stroke="#fff7e8" stroke-width="5" stroke-linecap="round" opacity=".7" />
          <path d="M59 372 q3 -43 42 -55 q45 -13 72 21 q20 26 0 60 q-13 22 -48 17 l-48 -8 q-25 -5 -18 -35z" fill="url(#skinParcel)" stroke="#5a3d36" stroke-width="4" />
          <path d="M150 361 q27 5 29 28 q1 25 -31 31 q-26 4 -35 -18" fill="#f1b77d" stroke="#5a3d36" stroke-width="4" />
          <path d="M91 354 q28 -12 54 7" fill="none" stroke="#d68b59" stroke-width="3" stroke-linecap="round" />
          <path d="M97 337 q25 -9 48 5" fill="none" stroke="#ffd8a8" stroke-width="8" stroke-linecap="round" opacity=".52" />
        </g>
        <g class="parcel-hand parcel-right-hand">
          <path d="M334 449 L270 426 L247 535 L327 558 Z" fill="#ffd9e0" stroke="#5a3d36" stroke-width="4" />
          <path d="M326 457 L266 438" stroke="#fff7e8" stroke-width="5" stroke-linecap="round" opacity=".7" />
          <path d="M333 373 q-7 -44 -47 -55 q-47 -12 -72 26 q-18 27 4 61 q16 22 50 14 l47 -11 q26 -7 18 -35z" fill="url(#skinParcel)" stroke="#5a3d36" stroke-width="4" />
          <path d="M239 365 q-27 6 -27 31 q0 24 33 28 q27 2 34 -21" fill="#f1b77d" stroke="#5a3d36" stroke-width="4" />
          <path d="M300 356 q-26 -10 -53 8" fill="none" stroke="#d68b59" stroke-width="3" stroke-linecap="round" />
          <path d="M252 340 q25 -9 48 5" fill="none" stroke="#ffd8a8" stroke-width="8" stroke-linecap="round" opacity=".5" />
          <path d="M286 383 l31 -8" stroke="#d69b65" stroke-width="7" stroke-linecap="round" />
          <path d="M296 380 l10 -3" stroke="#fff0cf" stroke-width="4" stroke-linecap="round" />
        </g>
      </g>

      <g class="brush-in-hand">
        <path d="M51 419 L114 404 L126 514 L49 532 Z" fill="#f58c9b" stroke="#5a3d36" stroke-width="4" />
        <path d="M69 375 q29 -18 59 -2 q23 13 15 38 q-8 25 -40 19 l-38 -7 q-23 -7 -16 -28 q4 -12 20 -20z" fill="url(#skinParcel)" stroke="#5a3d36" stroke-width="4" />
        <path d="M87 355 L120 362 q15 3 17 17 q2 16 -13 20 L81 388 q-15 -5 -13 -19 q2 -14 19 -14z" fill="#83cbb4" stroke="#5a3d36" stroke-width="4" />
        <rect x="99" y="367" width="16" height="8" rx="4" fill="#fff7e8" stroke="#5a3d36" stroke-width="2" />
        <circle cx="126" cy="377" r="12" fill="#f58c9b" stroke="#5a3d36" stroke-width="3" />
        <path d="M116 381 q-16 -8 -31 2" fill="none" stroke="#e29c67" stroke-width="4" stroke-linecap="round" />
      </g>

      <g class="box-front">
        <path d="M74 326 L316 326 L286 439 L104 439 Z" fill="url(#boxOuter)" stroke="#5a3d36" stroke-width="5" />
        <path d="M170 328 L213 328 L207 438 L164 438 Z" fill="#f2cc99" opacity=".64" />
        <path d="M98 352 h194" stroke="#8a5b42" stroke-width="4" stroke-dasharray="9 8" opacity=".78" />
        <path d="M101 335 q64 16 132 3" fill="none" stroke="#fff2bd" stroke-width="8" opacity=".34" />
        <path d="M86 333 l-18 55 M307 333 l21 52" stroke="#9b6043" stroke-width="3" opacity=".4" />
        <rect x="229" y="361" width="48" height="27" rx="6" fill="#fff7e8" stroke="#5a3d36" stroke-width="3" transform="rotate(-5 253 374)" />
        <circle cx="270" cy="364" r="7" fill="#f58c9b" />
        <path d="M243 374 h20 M243 381 h27" stroke="#b8896d" stroke-width="2" stroke-linecap="round" />
        <path d="M123 409 q6 -13 16 0 q-9 12 -16 0z" fill="#f58c9b" stroke="#5a3d36" stroke-width="2" />
      </g>
    </svg>
  `;
}

function parcelArtwork() {
  let file = "parcel-default.jpg";
  if (state.parcelBrushed && state.parcelBagTidied) file = "parcel-complete.jpg";
  else if (state.parcelBrushed) file = "parcel-brush-held.jpg";
  else if (state.parcelBagTidied) file = "parcel-bag-tidied.jpg";
  return `<img class="parcel-art parcel-illustration" src="assets/scenes/${file}" alt="打开的快递箱里放着迷你电动清洁刷、替换刷头和包装袋" draggable="false">`;
}

function parcelPanel() {
  if (!state.parcelPanel) return "";
  if (state.parcelPanel === "brush") {
    return `
      <section class="parcel-action-panel" role="dialog" aria-label="迷你清洁刷">
        <h2>迷你清洁刷</h2>
        <p>这么小，真的有用吗？</p>
        <div>
          ${button("拿起来试试", "takeParcelBrush", "sheet-btn primary")}
          ${button("先放回去", "closeParcelPanel", "sheet-btn")}
        </div>
      </section>
    `;
  }
  return `
    <section class="parcel-action-panel" role="dialog" aria-label="包装袋">
      <h2>包装袋</h2>
      <p>这个袋子看起来应该被立刻扔掉。</p>
      <div>
        ${button("顺手收拾", "tidyParcelBag", "sheet-btn primary")}
        ${button("先堆在旁边", "closeParcelPanel", "sheet-btn")}
      </div>
    </section>
  `;
}

function fridgeSceneLegacy() {
  return `
    <div class="fridge-close first-person-close">
      ${nav("‹ 关上冰箱", "back", "back-link")}
      ${sceneSvg(`
        <defs><filter id="fridgeGlow"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#c9f5ff" flood-opacity=".8"/></filter></defs>
        <rect width="390" height="560" fill="#dff5f4"/>
        <path d="M38 45 h314 v474 H38z" fill="#f8ffff" stroke="#6a463b" stroke-width="2.2" filter="url(#fridgeGlow)"/>
        <path d="M55 122 h280 M55 272 h280 M55 422 h280" stroke="#91cbd1" stroke-width="5"/>
        <path d="M55 125 h280 M55 275 h280 M55 425 h280" stroke="#fff" stroke-width="4" opacity=".8"/>
        <g stroke="#6a463b" stroke-width="2" stroke-linejoin="round">
          <path d="M87 167 h54 l-5 82 H92z" fill="#f2a0a8"/><path d="M95 151 h38 v20 H95z" fill="#fff6d8"/><path d="M104 183 h18 v43 h-18z" fill="#fff7e8"/>
          <path d="M205 183 q43 -28 78 4 l-8 53 q-31 18 -66 0z" fill="#f5dfab"/><path d="M213 191 q31 12 61 0" fill="none"/>
          <path d="M82 329 h34 v77 H82z" fill="#e6c45f"/><path d="M122 318 h31 v88 h-31z" fill="#e58b72"/><path d="M161 339 h28 v67 h-28z" fill="#8ebda0"/><path d="M91 347 h17 M131 340 h13 M168 358 h14"/>
          <path d="M231 327 l71 -12 l9 76 l-72 12z" fill="#f4b4c3"/><path d="M244 341 h48 M242 357 h52 M247 374 h34" fill="none"/>
          <g class="fridge-cold-hand"><path d="M4 470 q33 -28 69 2 q18 17 5 45 H4z" fill="#f2b57c"/><path d="M386 470 q-33 -28 -69 2 q-18 17 -5 45 h74z" fill="#f2b57c"/></g>
        </g>
        <path d="M0 0 h45 v560 H0z M345 0 h45 v560 h-45z" fill="#c9e7e5" stroke="#6a463b" stroke-width="2.2"/>
      `, "打开的冰箱里有饮料、剩饭、调味料和外卖券")}
      ${hotspot("drink", "临期饮料", "inspect:drink", "fridge-drink")}
      ${hotspot("leftovers", "剩饭", "inspect:leftovers", "fridge-leftovers")}
      ${hotspot("sauce", "调味料", "inspect:sauce", "fridge-sauce")}
      ${hotspot("coupon", "外卖券", "inspect:coupon", "fridge-coupon")}
    </div>
  `;
}

function fridgeScene() {
  return `
    <div class="fridge-close illustrated-close first-person-close ${Object.keys(state.fridgeUsed).map((item) => `used-${item}`).join(" ")}">
      ${nav("‹ 关上冰箱", "back", "back-link")}
      ${sceneImage("assets/scenes/fridge-close.jpg", "打开的冰箱里有临期草莓饮料、剩饭、调味料和外卖券", "closeup-illustration")}
      ${hotspot("drink", "临期饮料", "inspect:drink", "fridge-drink")}
      ${hotspot("leftovers", "剩饭", "inspect:leftovers", "fridge-leftovers")}
      ${hotspot("sauce", "调味料", "inspect:sauce", "fridge-sauce")}
      ${hotspot("coupon", "外卖券", "inspect:coupon", "fridge-coupon")}
    </div>
  `;
}

function closetSceneLegacy() {
  return `
    <div class="closet-close first-person-close">
      ${nav("‹ 关闭衣柜", "back", "back-link")}
      ${sceneSvg(`
        <rect width="390" height="560" fill="#e7c19a"/>
        <path d="M20 44 h350 v486 H20z" fill="#b77f5e" stroke="#6a463b" stroke-width="2.4"/>
        <path d="M36 62 h318 v448 H36z" fill="#f2d4aa" stroke="#6a463b" stroke-width="2"/>
        <path d="M55 141 h280" stroke="#6a463b" stroke-width="5"/>
        <g stroke="#6a463b" stroke-width="2" stroke-linejoin="round">
          <path d="M79 141 q18 18 36 0 M174 141 q18 18 36 0 M267 141 q18 18 36 0" fill="none"/>
          <path d="M70 159 q18 -18 36 0 l20 29 l-16 15 v122 q-25 13 -52 0 V203 l-16 -15z" fill="#94c6b6"/>
          <path d="M162 159 q18 -18 36 0 l22 27 l-16 17 v122 q-26 13 -54 0 V203 l-15 -17z" fill="#f2cf70"/>
          <path d="M255 159 q18 -18 36 0 l22 27 l-16 17 v122 q-26 13 -54 0 V203 l-15 -17z" fill="#c9b7e8"/>
          <path d="M68 188 q25 13 49 0 M160 190 q27 14 52 0 M253 188 q25 14 51 0" fill="none" stroke="#fff8ea" stroke-width="5" opacity=".55"/>
          <path d="M51 352 h288 v122 H51z" fill="#dca779"/>
          <path d="M70 378 h125 v44 H70z" fill="#f8fbef"/><path d="M70 389 h125 M70 405 h125" stroke="#addce4" stroke-width="8"/>
          <path d="M235 391 q34 -21 70 2 q-8 37 -62 31 q-21 -12 -8 -33z" fill="#f2cb69"/>
          <path d="M43 476 q49 -24 103 4 M246 479 q50 -24 101 1" fill="none" stroke="#9a6d51" stroke-width="3" opacity=".45"/>
        </g>
        <path d="M0 0 h26 v560 H0z M364 0 h26 v560 h-26z" fill="#c38b66" stroke="#6a463b" stroke-width="2.2"/>
      `, "打开的衣柜里挂着旧 T 恤、睡衣，搁板上有毛巾和袜子")}
      ${hotspot("oldshirt", "宽松旧 T", "inspect:oldshirt", "closet-old")}
      ${hotspot("pajamas", "成套睡衣", "inspect:pajamas", "closet-pajamas")}
      ${hotspot("newpajamas", "没穿过的睡衣", "inspect:newpajamas", "closet-new")}
      ${!state.heldItems.includes("towel") ? hotspot("towel", "毛巾", "inspect:towel", "closet-towel") : ""}
      ${!state.heldItems.includes("sock") ? hotspot("sock", "落单袜子", "inspect:sock", "closet-sock") : ""}
    </div>
  `;
}

function closetLooseItems() {
  const towel = state.itemLocations.towel === "closet" && !state.heldItems.includes("towel")
    ? `<img class="closet-loose-item closet-loose-towel" src="assets/scenes/closet-towel.png" alt="" draggable="false">` : "";
  const sock = state.itemLocations.sock === "closet" && !state.heldItems.includes("sock")
    ? `<img class="closet-loose-item closet-loose-sock" src="assets/scenes/closet-sock.png" alt="" draggable="false">` : "";
  if (!towel && !sock) return "";
  return `<div class="closet-loose-items" aria-hidden="true">${towel}${sock}</div>`;
}

function closetScene() {
  return `
    <div class="closet-close illustrated-close first-person-close ${state.selectedOutfit ? `selected-${state.selectedOutfit}` : ""}">
      ${nav("‹ 关闭衣柜", "back", "back-link")}
      ${sceneImage("assets/scenes/closet-close.jpg", "打开的木衣柜里挂着宽松旧 T 恤、成套睡衣和没穿过的新睡衣", "closeup-illustration")}
      ${closetLooseItems()}
      ${hotspot("oldshirt", `宽松旧 T${state.selectedOutfit === "oldshirt" ? " ✓" : ""}`, "inspect:oldshirt", "closet-old")}
      ${hotspot("pajamas", `成套睡衣${state.selectedOutfit === "pajamas" ? " ✓" : ""}`, "inspect:pajamas", "closet-pajamas")}
      ${hotspot("newpajamas", `没穿过的睡衣${state.selectedOutfit === "newpajamas" ? " ✓" : ""}`, "inspect:newpajamas", "closet-new")}
      ${!state.heldItems.includes("towel") ? hotspot("towel", "毛巾", "inspect:towel", "closet-towel") : ""}
      ${!state.heldItems.includes("sock") ? hotspot("sock", "落单袜子", "inspect:sock", "closet-sock") : ""}
    </div>
  `;
}

function mirrorSceneLegacy() {
  return `
    <div class="mirror-close first-person-close">
      ${nav("‹ 离开镜子", "back", "back-link")}
      ${sceneSvg(`
        <rect width="390" height="560" fill="#edcfcf"/>
        <g stroke="#6a463b" stroke-width="2.3" stroke-linejoin="round">
          <path d="M54 74 q0 -48 141 -48 q141 0 141 48 v420 H54z" fill="#d4a36f"/>
          <path d="M70 88 q0 -39 125 -39 q125 0 125 39 v388 H70z" fill="#dff4f3"/>
          <path d="M82 105 q55 -45 107 -9" fill="none" stroke="#fff" stroke-width="9" opacity=".7"/>
          <path d="M107 207 q5 -98 88 -98 q87 0 94 98 q-31 -34 -54 -43 q-63 32 -128 43z" fill="#493932"/>
          <path d="M128 190 q62 -38 128 0 v124 q-24 67 -64 69 q-45 -4 -64 -69z" fill="#f3bd87"/>
          <path d="M141 258 q16 -10 32 1 M214 259 q17 -10 33 1" fill="none" stroke="#66504a" stroke-width="4"/>
          <path d="M144 270 q15 9 29 0 M217 271 q15 9 29 0" fill="none" stroke="#b48676" stroke-width="5" opacity=".58"/>
          <circle cx="228" cy="302" r="6" fill="#e98484"/>
          <path d="M167 332 q27 16 54 0" fill="none"/>
          <path class="mirror-hand-art" d="M275 371 q37 -24 66 8 q20 23 3 58 q-22 34 -76 5 q-20 -36 7 -71z" fill="#f2b57c"/>
          <path d="M293 387 q19 -8 35 4" fill="none" stroke="#ffd7a7" stroke-width="7" opacity=".55"/>
          <path d="M49 497 h292" stroke-width="7"/>
        </g>
      `, "镜子里只映出凌乱刘海、额头、黑眼圈和伸过去的手")}
      ${hotspot("bangs", "刘海", "inspect:bangs", "mirror-bangs")}
      ${hotspot("eyes", "黑眼圈", "inspect:eyes", "mirror-eyes")}
      ${hotspot("pimple", "痘痘", "inspect:pimple", "mirror-pimple")}
      ${hotspot("bathhint", "浴室方向", "inspect:bathhint", "mirror-bath")}
    </div>
  `;
}

function mirrorScene() {
  return `
    <div class="mirror-close illustrated-close first-person-close ${state.mirrorUsed.bangs ? "bangs-done" : ""} ${state.mirrorUsed.eyes ? "eyes-done" : ""} ${state.mirrorUsed.pimple ? "pimple-done" : ""}">
      ${nav("‹ 离开镜子", "back", "back-link")}
      ${sceneImage("assets/scenes/mirror-close.jpg", "镜子里只映出凌乱刘海、疲惫的眼睛和正在整理头发的手", "closeup-illustration")}
      ${hotspot("bangs", "刘海", "inspect:bangs", "mirror-bangs")}
      ${hotspot("eyes", "黑眼圈", "inspect:eyes", "mirror-eyes")}
      ${hotspot("pimple", "痘痘", "inspect:pimple", "mirror-pimple")}
      ${hotspot("bathhint", "浴室方向", "inspect:bathhint", "mirror-bath")}
    </div>
  `;
}

function bathdoorSceneLegacy() {
  const ready = state.heldItems.includes("clothes") && state.heldItems.includes("towel");
  return `
    <div class="bath-close first-person-close">
      ${nav("‹ 回换衣区", "back", "back-link")}
      ${sceneSvg(`
        <defs><filter id="bathGlow"><feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#ffe59a" flood-opacity=".65"/></filter></defs>
        <rect width="390" height="560" fill="#e8ceca"/>
        <path d="M45 82 q0 -54 150 -54 q150 0 150 54 v478 H45z" fill="#b48969" stroke="#6a463b" stroke-width="2.4"/>
        <path class="bath-door-panel" d="M65 92 q0 -42 130 -42 q130 0 130 42 v443 H65z" fill="#fffaf0" stroke="#6a463b" stroke-width="2.3" filter="url(#bathGlow)"/>
        <path d="M93 150 q100 -41 204 0 M93 278 q101 -38 204 0 M93 408 q100 -39 204 0" fill="none" stroke="#eadfc8" stroke-width="5"/>
        <circle cx="287" cy="324" r="12" fill="#f2cf70" stroke="#6a463b" stroke-width="2.2"/>
        <path d="M65 526 h260" stroke="#ffe69c" stroke-width="12" opacity=".8"/>
        <g class="bath-hand-art" stroke="#6a463b" stroke-width="2.2">
          <path d="M-5 445 q42 -49 87 -8 q27 25 14 69 q-17 46 -101 31z" fill="#f2b57c"/>
          <path d="M61 445 q36 -13 48 15 q10 26 -27 46" fill="#efaa70"/>
          <path d="M18 453 q25 -14 48 3" fill="none" stroke="#ffd6a4" stroke-width="8" opacity=".58"/>
          <path d="M0 512 l73 -8 l8 56 H0z" fill="#ef9aab"/>
        </g>
      `, "第一人称站在浴室门前，一只手正准备推门")}
      ${ready ? button("推门进去", "enterBath", "push-bath") : ""}
    </div>
  `;
}

function bathHeldItems() {
  const clothes = state.heldItems.includes("clothes") ? `<g class="bath-clothes" transform="translate(45 15) rotate(-5 70 70)"><path d="M32 35 l27 -20 h34 l28 20 l-15 28 l-13 -8 v74 H56 V55 l-13 8z" fill="#91d3bd" stroke="#684a43" stroke-width="3"/><path d="M59 16 q17 20 34 0 M64 67 h25 M64 82 h25" fill="none" stroke="#fff3dc" stroke-width="5" stroke-linecap="round"/><path d="M94 96 q8 -6 15 2" fill="none" stroke="#d77e93" stroke-width="3"/></g>` : "";
  const towel = state.heldItems.includes("towel") ? `<g class="bath-towel" transform="translate(55 74) rotate(7 65 40)"><path d="M14 8 h104 q9 0 9 9 v57 q0 9 -9 9 H14 q-9 0 -9 -9 V17 q0 -9 9 -9z" fill="#d5c7e9" stroke="#684a43" stroke-width="3"/><path d="M23 24 h94 M23 43 h94 M23 62 h94" stroke="#fff7e8" stroke-width="7" opacity=".8"/><path d="M25 76 v9 M39 76 v9 M53 76 v9 M67 76 v9 M81 76 v9 M95 76 v9 M109 76 v9" stroke="#a795c6" stroke-width="2"/></g>` : "";
  if (!clothes && !towel) return "";
  return `<svg class="bath-held-items" viewBox="0 0 220 235" aria-hidden="true"><path class="bath-left-sleeve" d="M-8 159 q38 -35 79 -8 l38 84 H-8z" fill="#ef9bab" stroke="#684a43" stroke-width="4"/><path d="M7 173 l73 -20" stroke="#fff5e5" stroke-width="7" opacity=".65"/><path class="bath-left-palm" d="M61 120 q30 -30 64 -8 q25 17 16 49 q-9 30 -48 29 q-45 -2 -48 -30 q-2 -22 16 -40z" fill="#f3b77d" stroke="#684a43" stroke-width="4"/>${clothes}${towel}<path d="M75 139 q26 -13 51 2" fill="none" stroke="#d99162" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function bathdoorScene() {
  const ready = state.bagPlaced && state.heldItems.includes("clothes") && state.heldItems.includes("towel");
  return `
    <div class="bath-close illustrated-close first-person-close handle-press-${state.bathHandlePresses % 2}">
      ${nav("‹ 回换衣区", "back", "back-link")}
      ${sceneImage("assets/scenes/bathdoor-close.jpg", "第一人称站在透出暖光的浴室门前，右手正准备按下门把手", "closeup-illustration")}
      ${bathHeldItems()}
      ${hotspot("bathHandle", ready ? "推门进去" : "门把手", "bathHandle", "bath-handle-hotspot")}
    </div>
  `;
}

function handSwapPanelView() {
  const pending = state.pendingPickup;
  if (!pending) return "";
  const wantedName = itemName(pending.item);
  return `
    <div class="swap-layer">
      <section class="hand-swap-panel" role="dialog" aria-modal="true" aria-labelledby="swap-title" aria-describedby="swap-wanted">
        <header class="swap-header">
          <div>
            <h2 id="swap-title">手上已经拿满了</h2>
            <p id="swap-wanted">想拿：<strong>${wantedName}</strong></p>
          </div>
          ${button("×", "cancelPickup", "swap-close", `关闭换手面板`)}
        </header>
        <div class="swap-options">
          ${swapChoice(0, "左手", wantedName)}
          ${swapChoice(1, "右手", wantedName)}
        </div>
        ${button("先不拿", "cancelPickup", "swap-cancel")}
      </section>
    </div>
  `;
}

function swapChoice(index, side, wantedName) {
  const item = state.heldItems[index];
  if (!item) return "";
  const currentName = itemName(item);
  return `
    <button class="swap-card" data-action="dropForPending:${index}" aria-label="放下${side}的${currentName}，拿起${wantedName}">
      <span class="swap-side">${side}</span>
      <span class="swap-item-art held-prop held-${item}" aria-hidden="true"></span>
      <strong>${currentName}</strong>
      <small>放下${currentName}<br>拿起${wantedName}</small>
    </button>
  `;
}

function handsView() {
  if (["phone", "parcel", "sofa", "fridge", "closet", "mirror", "bathdoor"].includes(state.scene) || state.phase === "ending") return "";
  const left = state.heldItems[0];
  const right = state.heldItems[1];
  return `
    <div class="first-hands" aria-label="第一人称双手">
      <div class="hand-slot left-hand ${left ? `holding holding-${left}` : "empty"}">${handItem(left, "左手")}</div>
      <div class="hand-slot right-hand ${right ? `holding holding-${right}` : "empty"}">${handItem(right, "右手")}</div>
    </div>
  `;
}

function handItem(item, side) {
  const index = side === "左手" ? 0 : 1;
  const prop = item ? `<span class="held-prop held-${item}" aria-hidden="true"><i></i><b></b></span>` : "";
  const action = item ? `<button data-action="dropHand:${index}" aria-label="放下${side}的${itemName(item)}"></button>` : "";
  return `${handIllustration(side)}${prop}${action}`;
}

function handIllustration(side) {
  const isLeft = side === "左手";
  const transform = isLeft ? "" : `transform="translate(120 0) scale(-1 1)"`;
  const bandage = isLeft ? "" : `
    <g class="cartoon-bandage" transform="translate(64 69) rotate(-13)">
      <rect x="0" y="0" width="25" height="9" rx="4.5" fill="#f7d7a8" stroke="#735044" stroke-width="1.4"/>
      <rect x="9" y="1.5" width="8" height="6" rx="2" fill="#fff0cf"/>
    </g>`;
  return `
    <svg class="hand-illustration cartoon-hand" viewBox="0 0 120 158" aria-hidden="true">
      <g ${transform}>
        <path class="cartoon-sleeve" d="M18 158 L23 112 Q29 101 43 99 L82 102 Q94 108 98 124 L104 158 Z"/>
        <path class="cartoon-cuff" d="M21 117 Q57 106 97 120 L95 137 Q58 124 19 136 Z"/>
        <path class="cartoon-palm" d="M30 111 C24 99 26 82 33 70 C36 64 39 62 43 64 C47 66 47 71 45 78 L42 86 C44 72 47 50 52 34 C54 27 59 24 64 26 C69 28 69 34 67 41 L63 62 C66 48 69 30 74 23 C78 18 84 19 87 23 C90 27 88 33 86 39 L80 62 C84 50 88 37 93 34 C98 31 103 34 104 39 C105 43 102 49 100 55 L91 84 C98 78 105 75 110 79 C116 84 112 94 105 102 C96 114 87 123 72 127 C54 131 38 124 30 111 Z"/>
        <path class="cartoon-thumb" d="M91 84 C101 75 110 75 114 81 C118 88 111 99 101 106 C94 111 88 104 89 96 Z"/>
        <path class="cartoon-finger-line" d="M63 62 Q61 73 60 82 M80 62 Q77 73 76 83 M43 78 Q40 89 41 97"/>
        <path class="cartoon-highlight" d="M51 43 Q54 32 60 31"/>
        ${bandage}
      </g>
    </svg>`;
}

function droppedItems(location) {
  return Object.entries(state.itemLocations)
    .filter(([, place]) => place === location)
    .filter(([item]) => !state.heldItems.includes(item))
    .map(([item], index) => `<button class="dropped-item dropped-${item} drop-${index} ${shouldCueHotspot(`dropped-${item}`) ? "main-cue" : ""}" data-action="inspect:dropped-${item}" aria-label="捡起${itemName(item)}"><i></i><b></b><span>${itemName(item)}</span></button>`)
    .join("");
}

function unreadBadge() {
  return state.phoneNotificationSeen ? "" : `<b class="badge99">99+</b>`;
}

function choicePanelView() {
  if (!state.choicePanel) return "";
  const panel = optionPanels()[state.choicePanel];
  if (!panel) return "";
  return `
    <section class="choice-panel" role="dialog" aria-label="${panel.title}">
      <div>
        <h2>${panel.title}</h2>
        <p>${panel.line}</p>
      </div>
      <div class="choice-actions">
        ${panel.options.map((option, index) => button(option.label, `choose:${state.choicePanel}:${index}`, `choice-btn ${option.primary ? "primary" : ""}`)).join("")}
      </div>
    </section>
  `;
}

function optionPanels() {
  const maybeDone = (key) => state.eventLog.some((event) => event.key === key);
  const droppedPanels = {};
  ["phone", "clothes", "towel", "cup", "sock", "trashBag"].forEach((item) => {
    droppedPanels[`dropped-${item}`] = {
      title: itemName(item),
      line: `${itemName(item)}还留在刚才放下的位置。`,
      options: [
        { label: "重新拿起来", primary: true, actions: [{ type: "pickupDropped", item }] },
        { label: "先放这里", actions: [] },
      ],
    };
  });
  return Object.assign(droppedPanels, {
    doorLock: {
      title: "门锁",
      line: "手已经离开门把了，但脑子还在门口站了一会儿。",
      options: [
        { label: "再拧一下确认", primary: true, actions: [{ type: "egg", egg: "doorLock" }] },
        { label: "看一眼猫眼", actions: [smallEvent("peephole", "看了一眼猫眼", 1, "猫眼外面安静得像一张小截图。")] },
        { label: "算了，已经锁好了", actions: [] },
      ],
    },
    bag: {
      title: "包",
      line: state.bagPlaced ? "包已经瘫在玄关，像比你更早下班。" : "肩带还挂在身上，肩膀正在申请离线。",
      options: [
        { label: "放在玄关", primary: true, actions: [{ type: "placeBag" }] },
        { label: "拎去沙发旁", actions: [smallEvent("bag-sofa", "把包拎到沙发旁", 2, "包被挪到沙发旁边，像也想先坐一下。")] },
        { label: "继续背着", actions: [] },
      ],
    },
    shoes: {
      title: "鞋子",
      line: "鞋尖朝着两个不同的人生方向。",
      options: [
        { label: "随便踢到旁边", primary: true, actions: [{ type: "egg", egg: "shoes" }] },
        { label: "认真摆整齐", actions: [smallEvent("shoes-neat", "认真摆好了鞋", 2, "鞋子被摆整齐了，玄关忽然显得很会生活。")] },
        { label: "先不管它", actions: [] },
      ],
    },
    badge: {
      title: "工牌",
      line: "身体到家了，工牌还在坚持营业。",
      options: [
        { label: "摘下来放柜子上", primary: true, actions: [{ type: "egg", egg: "badge" }] },
        { label: "擦一下再收好", actions: [smallEvent("badge-wipe", "擦了一下工牌", 2, "你擦了一下工牌，照片里的自己看起来也累。")] },
        { label: "继续挂着", actions: [] },
      ],
    },
    parcel: {
      title: "快递",
      line: "胶带翘起一点点，像在主动打招呼。",
      options: [
        { label: "现在拆开", primary: true, actions: [{ type: "go", scene: "parcel" }] },
        { label: "看一眼物流信息", actions: [smallEvent("parcel-track", "看了一眼物流信息", 3, "物流信息显示它今天已经比你更努力。")] },
        { label: "晚点再说", actions: [] },
      ],
    },
    sofa: {
      title: "沙发",
      line: "靠垫歪得刚刚好，看起来不像巧合。",
      options: [
        { label: "先坐一下", primary: true, actions: [{ type: "go", scene: "sofa" }] },
        { label: "拍一拍靠垫", actions: [smallEvent("sofa-cushion", "拍了拍靠垫", 2, "靠垫被拍蓬松了，诱惑力没有降低。")] },
        { label: "先站着", actions: [] },
      ],
    },
    sofaRest: {
      title: "沙发深处",
      line: state.sofaBlanketPulled ? "毯子已经盖好，茶几上的东西看起来更远了。" : "毯子停在膝盖边，差一点就能把今晚包起来。",
      options: [
        { label: state.sofaBlanketPulled ? "毯子已经盖好了" : "把毯子拉高一点", primary: !state.sofaBlanketPulled, actions: [{ type: "pullBlanket" }] },
        { label: "看看茶几", actions: [{ type: "panelEvent", key: "sofa-table-look", label: "躺着研究了一会儿茶几", minutes: 2, line: "从这个角度看，茶几上的每件东西都像下一件事。", once: true }] },
        { label: "站起来", actions: [{ type: "standUp" }] },
      ],
    },
    sofaWake: {
      title: "刚才是不是睡着了？",
      line: "睁眼时，房间已经换了一种安静。毯子还暖着，时钟没有停。",
      options: [
        { label: "坐起来", primary: true, actions: [{ type: "wakeSitUp" }] },
        { label: "看看几点了", actions: [{ type: "clockThought" }] },
        { label: "再缓一会儿", actions: [{ type: "sofaWakeRest" }] },
      ],
    },
    sofaTable: {
      title: "茶几",
      line: "从沙发里看过去，每一样东西都像下一件顺手的事。",
      options: [
        { label: "拿起手机", primary: true, actions: [{ type: "go", scene: "phone" }] },
        { label: state.tvOn ? "电视已经开着了" : "按一下遥控器", actions: [{ type: "egg", egg: "remote" }] },
        { label: "还是站起来", actions: [{ type: "standUp" }] },
      ],
    },
    phone: {
      title: "手机",
      line: "屏幕亮了一下。它看起来知道你回来了。",
      options: [
        { label: "看看消息", primary: true, actions: [{ type: "go", scene: "phone" }] },
        { label: "翻过来扣着", actions: [smallEvent("phone-face-down", "把手机扣在桌上", 1, "手机被扣在桌上，存在感仍然很强。")] },
        { label: "先不碰", actions: [] },
      ],
    },
    cup: {
      title: "水杯",
      line: "杯子里还剩一点水，像一个很小的提醒。",
      options: [
        { label: "喝一口", primary: true, actions: [{ type: "egg", egg: "cup" }] },
        { label: "拿去接满", actions: [smallEvent("cup-refill", "把水杯接满", 3, "水杯被接满，桌面显得可靠了一点。")] },
        { label: "先放着", actions: [] },
      ],
    },
    remote: {
      title: "遥控器",
      line: "它横在茶几边缘，像在假装自己不是入口。",
      options: [
        { label: "开着当背景音", primary: true, actions: [{ type: "egg", egg: "remote" }] },
        { label: "按一下静音键", actions: [smallEvent("remote-mute", "按了一下静音键", 1, "遥控器咔哒一声，屋里还是很安静。")] },
        { label: "先不管", actions: [] },
      ],
    },
    fridge: {
      title: "冰箱",
      line: "门缝里透出一点冷光，像在说只是看看也行。",
      options: [
        { label: "打开看看", primary: true, actions: [{ type: "go", scene: "fridge" }] },
        { label: "摸一下门把", actions: [smallEvent("fridge-handle", "摸了一下冰箱门把", 1, "门把有点凉，深夜食欲非常具体。")] },
        { label: "先关心洗澡", actions: [] },
      ],
    },
    closet: {
      title: "衣柜",
      line: "柜门合着，但衣服已经从缝隙里透露态度。",
      options: [
        { label: "打开衣柜", primary: true, actions: [{ type: "go", scene: "closet" }] },
        { label: "先摸摸布料", actions: [smallEvent("closet-touch", "摸了摸衣柜边的衣服", 1, "布料软软的，像一个低声建议。")] },
        { label: "等一下", actions: [] },
      ],
    },
    mirror: {
      title: "镜子",
      line: "你本来只是路过，镜子却很认真。",
      options: [
        { label: "凑近看看", primary: true, actions: [{ type: "go", scene: "mirror" }] },
        { label: "整理一下刘海", actions: [{ type: "mirror", part: "bangs" }] },
        { label: "先离开", actions: [] },
      ],
    },
    laundry: {
      title: "洗衣篮",
      line: "这些衣服看起来刚好够洗一锅，这很危险。",
      options: [
        { label: "顺手洗了", primary: true, actions: [{ type: "laundry" }] },
        { label: "找找落单袜子", actions: [{ type: "egg", egg: "sock" }] },
        { label: "今天先洗自己", actions: [] },
      ],
    },
    clothes: {
      title: "换洗衣物",
      line: "干净衣服叠得不算好，但足够让洗澡这件事成立。",
      options: [
        { label: "拿起来", primary: true, actions: [{ type: "pickup", item: "clothes", kind: "main" }] },
        { label: "重新叠一下", actions: [smallEvent("fold-clothes", "重新叠了一下衣服", 3, "衣服被叠得稍微像样了一点。")] },
        { label: "先放着", actions: [] },
      ],
    },
    towel: {
      title: "毛巾",
      line: "毛巾搭在一边，看起来比你更接近浴室。",
      options: [
        { label: "拿起来", primary: true, actions: [{ type: "pickup", item: "towel", kind: "main" }] },
        { label: "抖一下", actions: [smallEvent("shake-towel", "抖了一下毛巾", 1, "毛巾蓬了一点，像刚睡醒。")] },
        { label: "先不拿", actions: [] },
      ],
    },
    bathdoor: {
      title: "浴室门",
      line: "门缝透出一点暖光。水汽在里面等着。",
      options: [
        { label: "走近门口", primary: true, actions: [{ type: "go", scene: "bathdoor" }] },
        { label: "听一下热水器", actions: [smallEvent("listen-heater", "听了听热水器", 1, "热水器在墙里低低地响。")] },
        { label: "先退一步", actions: [] },
      ],
    },
    bathHandle: {
      title: "浴室门",
      line: state.narration,
      options: [
        state.bagPlaced
          ? { label: "回换衣区看看", primary: true, actions: [{ type: "back" }] }
          : { label: "回玄关放包", primary: true, actions: [{ type: "go", scene: "entry" }] },
        { label: "再听一下热水器", actions: [{ type: "panelEvent", key: "listen-heater-close", label: "在门口听了听热水器", minutes: 1, line: "热水器在墙里低低地响，暖光还从门缝里透出来。", once: true }] },
        { label: "先松开门把", actions: [] },
      ],
    },
    parcelDone: {
      title: "打开的纸箱",
      line: "刷子拿出来了，包装袋也收好了。纸箱终于没有新的建议。",
      options: [
        { label: "用刷子扫一下箱角", primary: true, actions: [{ type: "panelEvent", key: "parcel-corner", label: "顺手刷了纸箱角", minutes: 2, line: "纸屑被刷成一小堆。迷你刷子的确有一点用。", once: true }] },
        { label: "放下快递", actions: [{ type: "back" }] },
      ],
    },
    parcelBrushFollowup: {
      title: "刷子已经拿起来了",
      line: "开关轻轻震了一下。纸箱里还留着两个刷头和一团包装袋。",
      options: [
        { label: "看看替换刷头", primary: true, actions: [{ type: "inspectParcelHeads" }] },
        { label: "顺手收包装袋", actions: [{ type: "tidyParcelBag" }] },
        { label: "先放下快递", actions: [{ type: "back" }] },
      ],
    },
    drink: fridgeItem("drink", "临期饮料", "瓶身上的日期看起来很有故事。"),
    leftovers: fridgeItem("leftovers", "剩饭", "盒盖上有一点水汽，像一句没说完的话。"),
    sauce: fridgeItem("sauce", "调味料", "瓶瓶罐罐站得很整齐，只有你不是。"),
    coupon: fridgeItem("coupon", "外卖券", "优惠券贴在门上，态度非常积极。"),
    oldshirt: closetItem("oldshirt", "宽松旧 T", "它看起来软到没有立场。"),
    pajamas: closetItem("pajamas", "成套睡衣", "这套睡衣明显更像今晚的正解。"),
    newpajamas: closetItem("newpajamas", "没穿过的睡衣", "吊牌还在，像一个未完成的理想生活。"),
    sock: {
      title: "落单袜子",
      line: "它看起来像一条很重要的线索。",
      options: [
        { label: "捡起来", primary: true, actions: [{ type: "egg", egg: "sock" }] },
        { label: "放回衣柜角落", actions: [smallEvent("sock-corner", "把袜子放回角落", 1, "袜子回到角落，继续保持神秘。")] },
        { label: "先不管", actions: [] },
      ],
    },
    bangs: mirrorItem("刘海", "刘海显然有自己的计划。", "bangs"),
    eyes: mirrorItem("黑眼圈", "黑眼圈很诚实，但没有发表意见。", "eyes"),
    pimple: mirrorItem("痘痘", "它不大，但存在感精准。", "pimple"),
    bathhint: mirrorItem("浴室方向", "镜子边缘映着浴室门。", "bath"),
  });

  function smallEvent(key, label, minutes, line) {
    return { type: "panelEvent", key, label, minutes, line, once: true };
  }

  function fridgeItem(id, title, line) {
    return {
      title,
      line,
      options: [
        { label: state.fridgeUsed[id] ? "已经看过了" : "拿近看看", primary: !state.fridgeUsed[id], actions: [{ type: "fridgeItem", item: id }] },
        { label: id === "drink" ? "检查日期" : id === "leftovers" ? "掀开盒盖" : id === "sauce" ? "顺手排整齐" : "算算满减", actions: [{ type: "fridgeItem", item: id }] },
        { label: "关上冰箱", actions: [{ type: "back" }] },
      ],
    };
  }

  function closetItem(id, title, line) {
    return {
      title,
      line,
      options: [
        { label: "拿来当睡衣", primary: true, actions: [{ type: "selectClothes", outfit: id }] },
        { label: "再比较一下", actions: [smallEvent(`closet-${title}`, `比较了${title}`, 2, "你认真比较了一下，衣柜显得更复杂了。")] },
        { label: "先挂回去", actions: [] },
      ],
    };
  }

  function mirrorItem(title, line, part) {
    return {
      title,
      line,
      options: [
        { label: "看仔细一点", primary: true, actions: [{ type: "mirror", part }] },
        { label: "假装没看见", actions: [] },
      ],
    };
  }
}

function pauseView() {
  return `
    <div class="pause-layer">
      <section class="pause-card" role="dialog" aria-modal="true">
        <h2>暂停</h2>
        <p>本局不会保存，刷新会重新回家。</p>
        ${state.pauseHint ? `<p class="hint-line">${state.pauseHint}</p>` : ""}
        ${button("我好像忘了要做什么", "pauseHint", "sheet-btn")}
        ${button("继续", "togglePause", "sheet-btn primary")}
        ${button("重新开始", "restart", "sheet-btn")}
      </section>
    </div>
  `;
}

function endingView() {
  const quieted = [
    state.phoneRead && Object.keys(state.phoneRead).length ? "手机暗下去" : "",
    state.tvOn ? "电视静音" : "",
    state.laundryStarted ? "洗衣机退到门外" : "",
  ].filter(Boolean);
  return `
    <div class="ending-layer" role="status" aria-live="assertive">
      <div class="ending-doorway" aria-hidden="true">
        <div class="ending-door left"></div>
        <div class="ending-door right"></div>
        <div class="ending-warmth"></div>
        <div class="water-line w1"></div>
        <div class="water-line w2"></div>
        <div class="steam s1"></div>
        <div class="steam s2"></div>
      </div>
      ${quieted.length ? `<div class="quieted-things">${quieted.map((label) => `<span>${label}</span>`).join("")}</div>` : ""}
      <p>门合上了，外面的东西都安静下来。</p>
    </div>
  `;
}

function resultView() {
  const summary = resultSummary(state);
  const events = summary.detours.length
    ? summary.detours.map((event) => `<li>${event.label}</li>`).join("")
    : "<li>没有先完成别的事情。</li>";
  return `
    <section class="phone-shell result-screen">
      <article class="receipt">
        <p class="kicker">今晚行为小票</p>
        <h1>${summary.title}</h1>
        <dl>
          <div><dt>原计划洗澡时间</dt><dd>${summary.planned}</dd></div>
          <div><dt>实际进入浴室时间</dt><dd>${summary.actual}</dd></div>
          <div><dt>从回家到现在</dt><dd>${summary.elapsedMinutes} 分钟</dd></div>
          <div><dt>顺手完成</dt><dd>${summary.completedCount} 件事</dd></div>
          ${summary.longestDetour ? `<div><dt>待得最久</dt><dd>${summary.longestDetour.label} · ${summary.longestDetour.minutes} 分钟</dd></div>` : ""}
          <div><dt>今晚称号</dt><dd>${summary.badge}</dd></div>
        </dl>
        <h2>在此之前，你：</h2>
        <ol>${events}</ol>
        <p>${summary.ending}</p>
        <div class="result-actions">
          ${button("再回一次家", "restart", "primary-btn")}
          ${button("结束游戏", "endGame", "ghost-btn")}
        </div>
      </article>
    </section>
  `;
}

function closedView() {
  return `
    <section class="phone-shell closed-screen">
      <div class="cover-art small" aria-hidden="true">
        <div class="cover-wall"></div><div class="cover-floor"></div><div class="cover-door"></div>
      </div>
      <h1>今晚到这里就好。</h1>
      <p>门后有水汽和暖光。</p>
      ${button("再回一次家", "restart", "primary-btn")}
    </section>
  `;
}

function restoreFocus() {
  if (!lastFocus) return;
  const element = app.querySelector(lastFocus);
  if (element) element.focus({ preventScroll: true });
  lastFocus = null;
}

function choosePanelOption(panelId, index) {
  const panel = optionPanels()[panelId];
  const option = panel && panel.options[index];
  dispatch({ type: "closeChoice" });
  if (!option) return;
  option.actions.forEach((action) => dispatch(action));
}

// 主线上的物品点一下就直接完成，三选一面板只留给“诱惑”类热点
function directMainAction(panel) {
  if (panel === "bag" && !state.bagPlaced) return { type: "placeBag" };
  if (panel === "closet") return { type: "go", scene: "closet" };
  if (panel === "towel" && !state.heldItems.includes("towel")) return { type: "pickup", item: "towel", kind: "main" };
  if (panel === "bathdoor") return { type: "go", scene: "bathdoor" };
  if (panel === "dropped-clothes" || panel === "dropped-towel") return { type: "pickupDropped", item: panel.replace("dropped-", "") };
  return null;
}

function performAction(action) {
  if (action.startsWith("go:")) dispatch({ type: "go", scene: action.split(":")[1] });
  else if (action.startsWith("inspect:")) {
    const panel = action.split(":")[1];
    const direct = directMainAction(panel);
    if (direct) dispatch(direct);
    else dispatch({ type: "openChoice", panel });
  }
  else if (action.startsWith("choose:")) {
    const [, panelId, index] = action.split(":");
    choosePanelOption(panelId, Number(index));
  }
  else if (action.startsWith("phone:")) dispatch({ type: "phone", thread: action.split(":")[1] });
  else if (action.startsWith("phoneAdvance:")) dispatch({ type: "phoneAdvance", view: action.split(":")[1] });
  else if (action.startsWith("phoneReply:")) dispatch({ type: "phoneReply", reply: action.split(":")[1] });
  else if (action.startsWith("phoneAlbumMove:")) dispatch({ type: "phoneAlbumMove", direction: Number(action.split(":")[1]) });
  else if (action.startsWith("phonePhotoDetail:")) dispatch({ type: "phonePhotoDetail", detail: action.split(":")[1] });
  else if (action.startsWith("phoneVideoNext:")) dispatch({ type: "phoneVideoNext", direction: Number(action.split(":")[1]) });
  else if (action.startsWith("phoneLike:")) dispatch({ type: "phoneLike", id: action.split(":")[1] });
  else if (action.startsWith("parcelPanel:")) dispatch({ type: "parcelPanel", panel: action.split(":")[1] });
  else if (action.startsWith("pickup:")) dispatch({ type: "pickup", item: action.split(":")[1], kind: "main" });
  else if (action.startsWith("egg:")) dispatch({ type: "egg", egg: action.split(":")[1] });
  else if (action.startsWith("mirror:")) dispatch({ type: "mirror", part: action.split(":")[1] });
  else if (action.startsWith("dropHand:")) dispatch({ type: "dropHand", index: Number(action.split(":")[1]) });
  else if (action.startsWith("dropForPending:")) dispatch({ type: "dropForPending", index: Number(action.split(":")[1]) });
  else dispatch({ type: action });
}

app.addEventListener("click", (event) => {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;
  if (actionNode.dataset.busy === "true") return;
  const action = actionNode.dataset.action;
  const shouldAnimate = actionNode.classList.contains("hotspot") && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!shouldAnimate || !actionNode.animate) {
    performAction(action);
    return;
  }

  actionNode.dataset.busy = "true";
  actionNode.classList.add("interacting");
  const motion = actionNode.animate(
    [
      { transform: "scale(1)", filter: "brightness(1)" },
      { transform: "scale(1.035)", filter: "brightness(1.12)" },
      { transform: "scale(1)", filter: "brightness(1)" },
    ],
    { duration: 180, easing: "cubic-bezier(.22,.8,.24,1)" },
  );
  const finishInteraction = () => {
    delete actionNode.dataset.busy;
    actionNode.classList.remove("interacting");
    performAction(action);
  };
  if (motion.finished && typeof motion.finished.then === "function") {
    motion.finished.then(finishInteraction, finishInteraction);
  } else {
    window.setTimeout(finishInteraction, 180);
  }
});

let phoneSwipe = null;

app.addEventListener("pointerdown", (event) => {
  const surface = event.target.closest("[data-phone-swipe]");
  if (!surface) return;
  phoneSwipe = { surface: surface.dataset.phoneSwipe, x: event.clientX, y: event.clientY };
});

app.addEventListener("pointerup", (event) => {
  if (!phoneSwipe) return;
  const start = phoneSwipe;
  phoneSwipe = null;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (start.surface === "album" && Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy)) {
    dispatch({ type: "phoneAlbumMove", direction: dx < 0 ? 1 : -1 });
  }
  if (start.surface === "video" && Math.abs(dy) >= 42 && Math.abs(dy) > Math.abs(dx)) {
    dispatch({ type: "phoneVideoNext", direction: dy < 0 ? 1 : -1 });
  }
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const swipeSurface = target && typeof target.closest === "function" ? target.closest("[data-phone-swipe]") : null;
  if (swipeSurface && swipeSurface.dataset.phoneSwipe === "album" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    dispatch({ type: "phoneAlbumMove", direction: event.key === "ArrowRight" ? 1 : -1 });
    return;
  }
  if (swipeSurface && swipeSurface.dataset.phoneSwipe === "video" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    dispatch({ type: "phoneVideoNext", direction: event.key === "ArrowUp" ? 1 : -1 });
    return;
  }
  if (event.key === "Escape") {
    if (state.paused) dispatch({ type: "togglePause" });
    else if (state.pendingPickup) dispatch({ type: "cancelPickup" });
    else if (state.choicePanel) dispatch({ type: "closeChoice" });
    else if (state.parcelPanel) dispatch({ type: "closeParcelPanel" });
    else if (state.scene !== "entry" && state.scene !== "living" && state.scene !== "dressing") dispatch({ type: "back" });
  }
});

render();
})();
