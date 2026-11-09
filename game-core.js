(function () {
const START_HOUR = 20;
const START_MINUTE = 30;
const MAX_HANDS = 2;

const ITEMS = {
  phone: "手机",
  clothes: "换洗衣物",
  towel: "毛巾",
  cup: "水杯",
  sock: "落单袜子",
  trashBag: "垃圾袋",
};

const MAIN_SCENES = ["entry", "living", "dressing"];
const CLOSE_SCENES = ["phone", "sofa", "parcel", "fridge", "closet", "mirror", "bathdoor"];

const SCENE_TITLES = {
  entry: "玄关",
  living: "客厅",
  dressing: "换衣区",
  phone: "手机",
  sofa: "沙发",
  parcel: "快递",
  fridge: "冰箱内部",
  closet: "衣柜内部",
  mirror: "镜子",
  bathdoor: "浴室门口",
};

const PHONE_THREADS = {
  work: { minutes: 2, label: "看了工作群", line: "工作群跳出来一条「不急」的消息。通常这两个字很急。" },
  friend: { minutes: 3, label: "打开朋友消息", line: "朋友说起一张旧照片。你感觉相册里应该还找得到。" },
  album: { minutes: 3, label: "打开三年前的相册", line: "照片一张接一张，手指已经开始替脑子做决定。" },
  search: { minutes: 3, label: "打开搜索", line: "搜索框非常认真地等着一个原本不重要的问题。" },
  video: { minutes: 8, label: "看了第一条短视频", line: "视频结束得很干脆，下一条看起来很无辜。" },
};

function initialState() {
  return {
    phase: "intro",
    scene: "entry",
    previousScene: null,
    paused: false,
    pauseHintLevel: 0,
    pauseHint: "",
    mainHintActive: false,
    awake: 55,
    comfort: 20,
    bagPlaced: false,
    heldItems: [],
    itemLocations: {
      phone: "table",
      clothes: "closet",
      towel: "closet",
      cup: "table",
      sock: "closet",
      trashBag: "trash",
    },
    phoneRead: {},
    phoneView: "home",
    phoneSteps: {},
    phoneLiked: {},
    phoneReply: null,
    phoneAlbumIndex: 0,
    phonePhotoDetails: {},
    phoneSearchStage: 0,
    phoneVideoIndex: 0,
    phoneVideoPaused: false,
    phoneWorkReacted: false,
    phoneNotificationSeen: false,
    sofaSat: false,
    sofaLied: false,
    sofaBlanketPulled: false,
    sofaSlept: false,
    sleepTransition: false,
    parcelOpened: false,
    parcelBrushed: false,
    parcelPanel: null,
    choicePanel: null,
    parcelBagTidied: false,
    fridgeOpened: false,
    fridgeChecked: false,
    fridgeUsed: {},
    closetOpened: false,
    selectedOutfit: null,
    laundryStarted: false,
    mirrorUsed: {},
    bathHandlePresses: 0,
    eggUsed: {},
    tvOn: false,
    naturalThoughts: 0,
    memoryEchoShown: false,
    branchStatus: {
      phone: false,
      sofa: false,
      parcel: false,
      fridge: false,
      laundry: false,
    },
    branchOrigins: {
      phone: null,
      sofa: null,
      parcel: null,
      fridge: null,
      laundry: null,
    },
    pendingPickup: null,
    virtualMinutes: 0,
    eventLog: [],
    narration: "今天好累。回家洗个澡就睡觉吧。",
    transition: "still",
  };
}

function cloneState(state) {
  return {
    ...state,
    heldItems: [...state.heldItems],
    itemLocations: { ...state.itemLocations },
    phoneRead: { ...state.phoneRead },
    phoneSteps: { ...state.phoneSteps },
    phoneLiked: { ...state.phoneLiked },
    phonePhotoDetails: { ...state.phonePhotoDetails },
    fridgeUsed: { ...state.fridgeUsed },
    mirrorUsed: { ...state.mirrorUsed },
    eggUsed: { ...state.eggUsed },
    branchStatus: { ...state.branchStatus },
    branchOrigins: { ...state.branchOrigins },
    eventLog: state.eventLog.map((event) => ({ ...event })),
    pendingPickup: state.pendingPickup ? { ...state.pendingPickup } : null,
  };
}

function formatTime(minutesAfterStart) {
  const total = START_HOUR * 60 + START_MINUTE + minutesAfterStart;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function hasHeld(state, item) {
  return state.heldItems.includes(item);
}

function itemName(item) {
  return ITEMS[item] || item;
}

function missingMainItems(state) {
  const missing = [];
  if (!state.bagPlaced) missing.push("bag");
  if (!hasHeld(state, "clothes")) missing.push("clothes");
  if (!hasHeld(state, "towel")) missing.push("towel");
  return missing;
}

function currentMainThought(state) {
  if (!state.bagPlaced) return "先把包放下";
  if (!hasHeld(state, "clothes")) return "找件换洗衣服";
  if (!hasHeld(state, "towel")) return "再拿一条毛巾";
  return "去浴室";
}

function currentNeedText(state) {
  if (!missingMainItems(state).length) return "东西好像齐了。门那边有一点热水器的声音。";
  if (!state.bagPlaced) return "肩带还挂在身上。好像应该先把包放回玄关。";
  if (!hasHeld(state, "clothes")) return "好像还少了换洗衣物。";
  return "好像还少了一件洗完以后会用到的东西。";
}

function itemPlaceText(state, item) {
  if (hasHeld(state, item)) return `${itemName(item)}在手上`;
  const place = {
    entry: "玄关",
    living: "客厅",
    dressing: "换衣区",
    closet: "衣柜里",
    sofa: "沙发旁",
    table: "茶几上",
    parcel: "纸箱旁",
    floor: "地上",
  }[state.itemLocations[item]] || "房间里";
  return `${itemName(item)}在${place}`;
}

function reducer(current, action) {
  const state = cloneState(current);

  if (state.phase === "closed" && action.type !== "restart") return state;
  if (state.paused && !["togglePause", "restart", "pauseHint", "hideMainHint"].includes(action.type)) return state;
  if (state.sleepTransition && !["wakeFromSofa", "restart"].includes(action.type)) return state;

  switch (action.type) {
    case "start":
      return {
        ...initialState(),
        phase: "playing",
        scene: "entry",
        narration: "门在身后合上，屋里安静了一秒。",
      };
    case "restart":
      return initialState();
    case "togglePause":
      state.paused = !state.paused;
      return state;
    case "openChoice":
      state.choicePanel = action.panel || null;
      return state;
    case "closeChoice":
      state.choicePanel = null;
      return state;
    case "panelEvent":
      state.choicePanel = null;
      if (action.once && hasEvent(state, action.key)) return narrate(state, action.repeatLine || "这件小事刚刚已经处理过了。");
      return addEvent(state, action.kind || "detour", action.key, action.label, action.minutes || 0, action.line);
    case "pauseHint":
      return pauseHint(state);
    case "showMainHint":
      state.mainHintActive = true;
      return narrate(state, mainHintLine(state));
    case "hideMainHint":
      state.mainHintActive = false;
      return state;
    case "endGame":
      state.phase = "closed";
      state.narration = "门后有水汽和暖光。今晚到这里就好。";
      return state;
    case "go":
      return goScene(state, action.scene);
    case "back":
      return backScene(state);
    case "closeScene":
      return closeScene(state);
    case "placeBag":
      state.choicePanel = null;
      if (state.bagPlaced) return narrate(state, "包已经在玄关地上，像一块刚下班的石头。");
      state.bagPlaced = true;
      addEvent(state, "main", "place-bag", "把包放到玄关", 1, "手把包放到玄关，肩膀终于不用继续上班。");
      return applyStatusDelta(state, 0, 4);
    case "pickup":
      return pickupItem(state, action.item, action.kind || "main");
    case "pickupDropped":
      state.choicePanel = null;
      if (state.itemLocations[action.item] === "hand") return state;
      return pickupItem(state, action.item, action.kind || (action.item === "clothes" || action.item === "towel" ? "main" : "detour"));
    case "selectClothes":
      state.choicePanel = null;
      state.selectedOutfit = action.outfit || "pajamas";
      return pickupItem(state, "clothes", "main");
    case "dropHand":
      return dropHand(state, action.index);
    case "dropForPending":
      return completePendingPickup(state, action.index);
    case "cancelPickup":
      state.pendingPickup = null;
      return narrate(state, "手上这点秩序先保持原样。");
    case "phone":
      return phoneAction(state, action.thread);
    case "phoneHome":
      state.phoneView = "home";
      return state;
    case "phoneAdvance":
      return phoneAdvance(state, action.view);
    case "phoneReply":
      return phoneReply(state, action.reply);
    case "phoneWorkReact":
      return phoneWorkReact(state);
    case "phoneAlbumMove":
      state.phoneAlbumIndex = Math.max(0, Math.min(2, state.phoneAlbumIndex + Number(action.direction || 0)));
      state.phoneView = "album";
      return state;
    case "phonePhotoDetail":
      return phonePhotoDetail(state, action.detail);
    case "phoneSearchAdvance":
      return phoneSearchAdvance(state);
    case "phoneVideoNext":
      return phoneVideoNext(state, Number(action.direction || 1));
    case "phoneVideoToggle":
      state.phoneVideoPaused = !state.phoneVideoPaused;
      return state;
    case "phoneLike":
      if (!state.phoneLiked[action.id]) state.phoneLiked[action.id] = true;
      return state;
    case "sitSofa":
      if (state.sofaSat) return narrate(state, "身体已经知道这张沙发的轮廓。");
      state.sofaSat = true;
      addEvent(state, "detour", "sofa-sit", "坐进沙发", 10, "视线低了一截，沙发把你稳稳接住。");
      applyStatusDelta(state, -10, 20);
      return checkSleepTrigger(state);
    case "lieSofa":
      if (state.sofaLied) return narrate(state, "再往后仰，天花板也没有给出新建议。");
      state.sofaLied = true;
      addEvent(state, "detour", "sofa-lie", "在沙发上躺了一会儿", 15, "镜头慢慢后仰，毯子滑到膝盖上。");
      applyStatusDelta(state, -15, 20);
      return checkSleepTrigger(state);
    case "pullBlanket":
      state.choicePanel = null;
      if (state.sofaBlanketPulled) return narrate(state, "毯子已经盖好了，再拉只会露出另一边。");
      state.sofaBlanketPulled = true;
      addEvent(state, "detour", "sofa-blanket", "把毯子拉到身上", 4, "毯子被拉高一点，站起来这件事忽然需要重新考虑。");
      applyStatusDelta(state, -20, 20);
      return checkSleepTrigger(state);
    case "wakeFromSofa":
      if (!state.sleepTransition || state.sofaSlept) return state;
      state.sleepTransition = false;
      state.sofaSlept = true;
      state.awake = 48;
      state.comfort = 72;
      addEvent(state, "detour", "sofa-sleep", "在沙发上睡着了一会儿", 45, "睁眼时，房间已经换了一种安静。");
      state.choicePanel = "sofaWake";
      completeBranch(state, "sofa");
      return state;
    case "wakeSitUp":
      state.choicePanel = null;
      state.sofaLied = false;
      return narrate(state, "你慢慢坐起来，毯子还搭在腿上。");
    case "sofaWakeRest":
      state.choicePanel = null;
      if (hasEvent(state, "sofa-wake-rest")) return narrate(state, "刚才已经缓过一会儿了。再躺下去大概会忘记今晚是哪一天。");
      addEvent(state, "detour", "sofa-wake-rest", "醒来后又缓了一会儿", 5, "你没有继续睡，只是让意识在沙发边缘坐了一会儿。");
      return applyStatusDelta(state, -3, 2);
    case "standUp":
      state.scene = "living";
      state.previousScene = null;
      state.transition = "rise";
      completeBranch(state, "sofa");
      narrate(state, "你站起来了，房间又恢复到正常高度。");
      return maybeMemoryEcho(state);
    case "tearParcel":
      if (state.parcelOpened) return narrate(state, "胶带已经开了，纸箱保持着被研究过的姿势。");
      state.parcelOpened = true;
      addEvent(state, "detour", "parcel-open", "拆开快递", 5, "纸箱打开了，里面似乎还有点东西。");
      return applyStatusDelta(state, 3, 2);
    case "parcelPanel":
      state.parcelPanel = action.panel || null;
      if (action.panel === "brush") return narrate(state, "这么小，真的有用吗？");
      if (action.panel === "bag") return narrate(state, "这个袋子看起来应该被立刻扔掉。");
      return state;
    case "closeParcelPanel":
      state.parcelPanel = null;
      return narrate(state, "纸箱里面似乎还有点东西。");
    case "takeParcelBrush":
      state.parcelPanel = null;
      if (!state.parcelOpened || state.parcelBrushed) return narrate(state, "迷你清洁刷已经离开包装盒，姿势很认真。");
      state.parcelBrushed = true;
      addEvent(state, "detour", "parcel-brush", "拿起迷你清洁刷试了一下", 10, "刷柄被握进手里，拇指刚好压住开关。");
      applyStatusDelta(state, 4, 6);
      if (state.parcelBagTidied) {
        completeBranch(state, "parcel");
        state.choicePanel = "parcelDone";
      } else {
        state.choicePanel = "parcelBrushFollowup";
      }
      return state;
    case "inspectParcelHeads":
      if (!state.parcelOpened || !state.parcelBrushed) return narrate(state, "两个替换刷头还整齐地卡在包装盒里。");
      if (hasEvent(state, "parcel-heads")) return narrate(state, "两个刷头已经比较过了：一个适合台面，一个适合缝隙。");
      addEvent(state, "detour", "parcel-heads", "比较了两个替换刷头", 3, "草莓粉适合台面，柠檬黄看起来更像会认真对付缝隙。");
      applyStatusDelta(state, 1, 2);
      return state;
    case "tidyParcelBag":
      state.parcelPanel = null;
      if (!state.parcelOpened || state.parcelBagTidied) return narrate(state, "包装袋已经被收到一边。");
      state.parcelBagTidied = true;
      addEvent(state, "detour", "parcel-bag", "收拾了包装袋", 3, "包装袋被顺手团起来，纸箱旁边清爽了一点。");
      applyStatusDelta(state, 0, 2);
      if (state.parcelBrushed) {
        completeBranch(state, "parcel");
        state.choicePanel = "parcelDone";
      }
      return state;
    case "brushGap":
      return reducer(state, { type: "takeParcelBrush" });
    case "openFridge":
      if (state.fridgeOpened) return narrate(state, "冷光还在，食物们保持原位。");
      state.fridgeOpened = true;
      addEvent(state, "detour", "fridge-open", "打开冰箱看了一眼", 3, "冰箱门打开，蓝白色冷光照到手背上。");
      return applyStatusDelta(state, 2, 0);
    case "checkFridge":
      if (!state.fridgeOpened || state.fridgeChecked) return narrate(state, "保质期已经检查过了，冰箱很配合。");
      state.fridgeChecked = true;
      return addEvent(state, "detour", "fridge-check", "检查冰箱保质期", 12, "临期饮料让事情自然升级成一次小型审查。");
    case "fridgeItem":
      state.choicePanel = null;
      return fridgeItemAction(state, action.item);
    case "openCloset":
      state.closetOpened = true;
      return narrate(state, "衣柜门打开，几件衣服用不同方式看着你。");
    case "laundry":
      if (state.laundryStarted) return narrate(state, "洗衣机还在转，像一件已经答应下来的事。");
      state.laundryStarted = true;
      state.branchOrigins.laundry = state.scene;
      completeBranch(state, "laundry");
      addEvent(state, "detour", "laundry-start", "启动了一锅洗衣机", 15, "洗衣篮里的衣服刚好够一锅，这句话本身就很危险。");
      return applyStatusDelta(state, -5, 8);
    case "mirror":
      return mirrorAction(state, action.part);
    case "egg":
      return eggAction(state, action.egg);
    case "clockThought":
      return clockThought(state);
    case "bathHandle":
      state.bathHandlePresses += 1;
      if (hasHeld(state, "clothes") && hasHeld(state, "towel")) return enterBath(state);
      state.choicePanel = "bathHandle";
      return bathdoorLine(state);
    case "enterBath":
      return enterBath(state);
    case "finishEnding":
      if (state.phase === "ending") state.phase = "result";
      return state;
    default:
      return state;
  }
}

function narrate(state, line) {
  state.narration = line;
  return state;
}

function goScene(state, scene) {
  state.choicePanel = null;
  if (!SCENE_TITLES[scene]) return state;
  if (scene === "phone") {
    const from = state.scene;
    state.branchOrigins.phone = from;
    state.phoneNotificationSeen = true;
    if (!hasHeld(state, "phone") && state.heldItems.length >= MAX_HANDS) {
      state.pendingPickup = { item: "phone", kind: "detour", targetScene: "phone", sourceScene: from };
      return narrate(state, "手上好像已经拿满了。");
    }
    pickupItem(state, "phone", "detour", { silent: true, stay: true });
    state.previousScene = from;
    state.scene = "phone";
    state.phoneView = "home";
    state.transition = "push";
    return narrate(state, "手机从画面底部举到眼前，客厅变成一片柔软的背景。");
  }
  if (scene === "sofa") {
    state.branchOrigins.sofa = state.branchOrigins.sofa || "living";
    state.scene = "sofa";
    state.previousScene = "living";
    state.transition = "drop";
    return state.sofaSat ? narrate(state, "沙发视角里，茶几比刚才近了一点。") : reducer(state, { type: "sitSofa" });
  }
  if (scene === "fridge" && !state.fridgeOpened) {
    state.branchOrigins.fridge = state.branchOrigins.fridge || "living";
    state.scene = "fridge";
    state.previousScene = "living";
    state.transition = "door-open";
    return reducer(state, { type: "openFridge" });
  }
  state.previousScene = CLOSE_SCENES.includes(scene) ? state.scene : null;
  state.scene = scene;
  state.transition = MAIN_SCENES.includes(scene) ? "slide" : "push";
  if (scene === "parcel") {
    state.branchOrigins.parcel = state.branchOrigins.parcel || "entry";
    if (!state.parcelOpened) {
      state.parcelOpened = true;
      addEvent(state, "detour", "parcel-open", "拆开快递", 5, "纸箱里面似乎还有点东西。");
      return applyStatusDelta(state, 3, 2);
    }
    return narrate(state, "纸箱里面似乎还有点东西。");
  }
  if (scene === "closet") return reducer(state, { type: "openCloset" });
  if (scene === "mirror") return narrate(state, "镜子里只看见刘海、额头和伸过去的手。");
  if (scene === "bathdoor") return bathdoorLine(state);
  return state;
}

function backScene(state) {
  state.choicePanel = null;
  if (state.scene === "sofa") return reducer(state, { type: "standUp" });
  if (state.scene === "fridge") {
    if (Object.keys(state.fridgeUsed).length || state.fridgeChecked) completeBranch(state, "fridge");
    state.scene = state.branchOrigins.fridge || "living";
  }
  else if (state.scene === "closet" || state.scene === "mirror" || state.scene === "bathdoor") state.scene = "dressing";
  else if (state.scene === "phone") {
    if (Object.keys(state.phoneRead).length) completeBranch(state, "phone");
    state.scene = state.branchOrigins.phone || state.previousScene || "living";
    state.phoneView = "home";
  }
  else if (state.scene === "parcel") {
    if (state.parcelOpened && (state.parcelBrushed || state.parcelBagTidied)) completeBranch(state, "parcel");
    state.scene = state.branchOrigins.parcel || "entry";
  }
  else state.scene = state.previousScene || "entry";
  state.previousScene = null;
  state.transition = "pull";
  return maybeMemoryEcho(state);
}

function closeScene(state) {
  return backScene(state);
}

function pauseHint(state) {
  state.pauseHintLevel += 1;
  if (state.pauseHintLevel === 1) state.pauseHint = "好像和浴室有关。";
  else if (state.pauseHintLevel === 2) state.pauseHint = "也许可以去换衣区看看。";
  else state.pauseHint = currentNeedText(state);
  return state;
}

function mainHintLine(state) {
  if (!state.bagPlaced) return "包还在玄关。肩带压着肩膀，存在感很明确。";
  if (!hasHeld(state, "clothes")) return `${itemPlaceText(state, "clothes")}。先把它拿到手里。`;
  if (!hasHeld(state, "towel")) return `${itemPlaceText(state, "towel")}。浴室那边还等着它。`;
  return "东西齐了。换衣区那扇透着暖光的门就在前面。";
}

function addEvent(state, kind, key, label, minutes, line) {
  state.virtualMinutes += minutes;
  state.narration = line;
  state.eventLog.push({ kind, key, label, minutes, after: formatTime(state.virtualMinutes) });
  return state;
}

function applyStatusDelta(state, awakeDelta, comfortDelta) {
  state.awake = Math.max(0, Math.min(100, state.awake + awakeDelta));
  state.comfort = Math.max(0, Math.min(100, state.comfort + comfortDelta));
  return state;
}

function checkSleepTrigger(state) {
  if (
    state.scene === "sofa" &&
    !state.sofaSlept &&
    !state.sleepTransition &&
    state.awake <= 20 &&
    state.comfort >= 60
  ) {
    state.sleepTransition = true;
    state.choicePanel = null;
    state.narration = "毯子暖得刚刚好。眼皮慢慢失去了讨论的兴趣。";
  }
  return state;
}

function hasEvent(state, key) {
  return state.eventLog.some((event) => event.key === key);
}

function pickupItem(state, item, kind, options) {
  const opts = options || {};
  if (hasHeld(state, item)) return opts.silent ? state : narrate(state, `${itemName(item)}已经在手上。`);
  if (state.heldItems.length >= MAX_HANDS) {
    const sourceScene = state.scene;
    state.pendingPickup = { item, kind, sourceScene };
    return narrate(state, "手上好像已经拿满了。");
  }
  state.heldItems.push(item);
  state.itemLocations[item] = "hand";
  if (opts.silent) return state;
  const isMain = item === "clothes" || item === "towel";
  const eventKey = `pickup-${item}`;
  const lines = {
    clothes: "手从衣柜里拿出换洗衣物，布料软软地搭在掌心。",
    towel: "毛巾被抽出来，浴室这件事突然变得更具体。",
    cup: "水杯到了手里。你想起今天确实没怎么喝水。",
    sock: "落单袜子被捡起来，它像一条很重要的线索。",
    phone: "手机亮起来，手指已经知道要往哪里点。",
    trashBag: "垃圾袋被提起来，分量很诚实。",
  };
  if (hasEvent(state, eventKey)) return narrate(state, lines[item] || `拿起${itemName(item)}。`);
  addEvent(state, isMain ? "main" : "detour", eventKey, `拿起${itemName(item)}`, isMain ? 1 : item === "sock" ? 4 : 2, lines[item] || `拿起${itemName(item)}。`);
  return isMain ? applyStatusDelta(state, 0, 2) : state;
}

function dropHand(state, index) {
  const item = state.heldItems[index];
  if (!item) return state;
  state.heldItems.splice(index, 1);
  state.itemLocations[item] = dropLocation(state.scene);
  return narrate(state, `${itemName(item)}被放在${dropPlaceText(state.itemLocations[item])}。`);
}

function completePendingPickup(state, index) {
  const pending = state.pendingPickup;
  state.pendingPickup = null;
  if (!pending) return state;
  const droppedItem = state.heldItems[index];
  if (!droppedItem) return state;
  const targetScene = pending.targetScene;
  const sourceScene = pending.sourceScene || state.scene;
  state.heldItems.splice(index, 1);
  state.itemLocations[droppedItem] = dropLocation(sourceScene);
  pickupItem(state, pending.item, pending.kind);
  if (index === 0 && state.heldItems.length === 2) {
    state.heldItems = [state.heldItems[1], state.heldItems[0]];
  }
  if (targetScene === "phone" && hasHeld(state, "phone")) {
    state.previousScene = sourceScene;
    state.scene = "phone";
    state.transition = "push";
    return narrate(state, "手机终于被举到眼前，背景安静地退后。");
  }
  return state;
}

function dropLocation(scene) {
  if (scene === "entry" || scene === "parcel") return "entry";
  if (scene === "dressing" || scene === "closet" || scene === "mirror" || scene === "bathdoor") return "dressing";
  if (scene === "sofa") return "sofa";
  return "living";
}

function dropPlaceText(location) {
  return { entry: "玄关地面", living: "茶几边", dressing: "换衣区地面", sofa: "沙发边" }[location] || "旁边";
}

function phoneAction(state, thread) {
  const item = PHONE_THREADS[thread];
  if (!item) return state;
  state.phoneView = thread;
  if (state.phoneRead[thread]) return state;
  const readCount = Object.keys(state.phoneRead).length;
  state.phoneRead[thread] = true;
  const eventKey = thread === "video" ? "phone-video-0" : `phone-${thread}`;
  addEvent(state, "detour", eventKey, item.label, item.minutes, item.line);
  return readCount < 2 ? applyStatusDelta(state, 4, 1) : applyStatusDelta(state, -5, 2);
}

function phoneAdvance(state, view) {
  const limits = { work: 1 };
  if (!limits[view] && limits[view] !== 0) return state;
  const current = state.phoneSteps[view] || 0;
  state.phoneSteps[view] = Math.min(current + 1, limits[view]);
  return state;
}

function phoneReply(state, reply) {
  const replies = {
    laugh: { label: "回了一个大笑", line: "你回了好几个哈哈。对面很快又发来一句：你还留着那张照片吗？" },
    remember: { label: "问起那张旧照片", line: "你问她怎么还记得。对面说：因为那天你的伞整个翻过去了。" },
    find: { label: "答应找那张照片", line: "你说等一下去找。相册图标立刻变得很有吸引力。" },
  };
  const selected = replies[reply];
  if (!selected) return state;
  state.phoneView = "friend";
  if (state.phoneReply) return narrate(state, "那句话已经发出去了，对面还留着正在输入的省略号。");
  state.phoneReply = reply;
  addEvent(state, "detour", "phone-reply", selected.label, 3, selected.line);
  return applyStatusDelta(state, 2, 2);
}

function phoneWorkReact(state) {
  state.phoneView = "work";
  if (state.phoneWorkReacted) return narrate(state, "那个收到表情还安静地待在消息下面。");
  state.phoneWorkReacted = true;
  addEvent(state, "detour", "phone-work-react", "在工作群回了一个收到", 1, "一个小小的收到出现在群里。今晚的工作暂时没有继续长大。");
  return applyStatusDelta(state, 1, 1);
}

function phonePhotoDetail(state, detail) {
  const details = {
    umbrella: { label: "放大看了撑反的伞", minutes: 3, line: "伞骨全翻过去了。你忽然想起当时两个人笑到根本没躲雨。" },
    fries: { label: "放大看了照片里的薯条", minutes: 3, line: "那家店已经关了，但照片里的薯条看起来仍然很脆。" },
    actor: { label: "认出了照片里的路人", minutes: 4, line: "等等，后面路过的人好像真的是那个演员。搜索框突然有了用途。" },
  };
  const selected = details[detail];
  if (!selected) return state;
  state.phoneView = "album";
  if (state.phonePhotoDetails[detail]) return narrate(state, selected.line);
  state.phonePhotoDetails[detail] = true;
  addEvent(state, "detour", `phone-photo-${detail}`, selected.label, selected.minutes, selected.line);
  return applyStatusDelta(state, -2, 3);
}

function phoneSearchAdvance(state) {
  state.phoneView = "search";
  if (state.phoneSearchStage >= 2) return narrate(state, "搜索结果已经走到了那个采访片段面前。");
  state.phoneSearchStage += 1;
  const stage = state.phoneSearchStage;
  addEvent(
    state,
    "detour",
    `phone-search-${stage}`,
    stage === 1 ? "查了照片里的演员" : "顺着评论找到了采访片段",
    4,
    stage === 1 ? "名字补全后，近况、采访和旧电影一起挤进了结果页。" : "一条评论提到一个采访片段。现在不看反而像少做了一步。",
  );
  return applyStatusDelta(state, -4, 2);
}

function phoneVideoNext(state, direction) {
  state.phoneView = "video";
  const next = Math.max(0, Math.min(2, state.phoneVideoIndex + direction));
  if (next === state.phoneVideoIndex) return state;
  state.phoneVideoIndex = next;
  state.phoneVideoPaused = false;
  const key = `phone-video-${next}`;
  if (hasEvent(state, key)) return state;
  const labels = ["看了第一条短视频", "看了章鱼冷知识", "看了吐司小花教程"];
  addEvent(state, "detour", key, labels[next], 5, next === 2 ? "视频教你把吐司切成小花。第一步是拥有耐心。" : "下一条内容和刚才完全无关，但手指还是停了下来。");
  return applyStatusDelta(state, -6, 3);
}

function mirrorAction(state, part) {
  const data = {
    bangs: { minutes: 3, label: "整理了一下刘海", line: "刘海显然有自己的计划，手伸过去调整了一下。" },
    eyes: { minutes: 2, label: "看了看黑眼圈", line: "黑眼圈很诚实，但没有发表意见。" },
    pimple: { minutes: 3, label: "研究了一颗痘痘", line: "你本来只是路过镜子，事情却变得具体。" },
    bath: { minutes: 0, label: "", line: "镜子边缘映着浴室门，暖光在门缝里晃了一下。" },
  }[part];
  if (!data) return state;
  if (part === "bath") return narrate(state, data.line);
  if (state.mirrorUsed[part]) return narrate(state, "镜子已经给过这一段反馈了。");
  state.mirrorUsed[part] = true;
  addEvent(state, "detour", `mirror-${part}`, data.label, data.minutes, data.line);
  const deltas = { bangs: [1, 3], eyes: [-2, 0], pimple: [2, 0] }[part];
  return applyStatusDelta(state, deltas[0], deltas[1]);
}

function fridgeItemAction(state, item) {
  const data = {
    drink: { minutes: 5, label: "研究了临期饮料", line: "日期还来得及，瓶子被认真放到最显眼的位置。" },
    leftovers: { minutes: 4, label: "检查了剩饭", line: "盒盖掀开一条缝。闻起来仍然像昨天做出的决定。" },
    sauce: { minutes: 6, label: "整理了调味料", line: "高矮瓶子排成一列，冰箱突然有了一点秩序。" },
    coupon: { minutes: 3, label: "看了外卖优惠券", line: "满减门槛算完以后，突然也没有那么优惠了。" },
  }[item];
  if (!data) return state;
  if (state.fridgeUsed[item]) return narrate(state, "这件东西刚刚已经研究得足够仔细了。");
  state.fridgeUsed[item] = true;
  if (item === "drink") state.fridgeChecked = true;
  addEvent(state, "detour", `fridge-${item}`, data.label, data.minutes, data.line);
  const deltas = {
    drink: [12, 2],
    leftovers: [-2, 6],
    sauce: [0, 5],
    coupon: [2, 1],
  }[item];
  return applyStatusDelta(state, deltas[0], deltas[1]);
}

function eggAction(state, egg) {
  const data = {
    doorLock: { minutes: 2, label: "确认了门锁", line: "你已经锁过了。但手还是又确认了一次。" },
    shoes: { minutes: 3, label: "检查了鞋子", line: "另一只袜子去了一个更自由的地方。" },
    badge: { minutes: 2, label: "摘下工牌", line: "身体下班了，工牌还不愿意承认。" },
    cup: { hold: "cup" },
    remote: { minutes: 8, label: "打开电视当背景音", line: "开着当背景音，应该不算看电视。" },
    laundry: { action: "laundry" },
    sock: { hold: "sock" },
    trash: { hold: "trashBag" },
  }[egg];
  if (!data) return state;
  if (data.action) return reducer(state, { type: data.action });
  if (data.hold) return pickupItem(state, data.hold, "detour");
  if (state.eggUsed[egg]) return narrate(state, "这件小事已经被你认真处理过一次了。");
  state.eggUsed[egg] = true;
  if (egg === "remote") state.tvOn = true;
  return addEvent(state, "detour", `egg-${egg}`, data.label, data.minutes, data.line);
}

function clockThought(state) {
  return narrate(state, "时钟安静地显示着现在。");
}

function quietThought(state) {
  return state;
}

function completeBranch(state, branch) {
  if (Object.prototype.hasOwnProperty.call(state.branchStatus, branch)) state.branchStatus[branch] = true;
  return state;
}

function maybeMemoryEcho(state) {
  const completed = Object.values(state.branchStatus).filter(Boolean).length;
  if (completed < 2 || state.memoryEchoShown || !MAIN_SCENES.includes(state.scene)) return state;
  state.memoryEchoShown = true;
  state.naturalThoughts += 1;
  return narrate(state, "……我刚刚是不是准备做什么来着？");
}

function bathdoorLine(state) {
  if (!state.bagPlaced) return narrate(state, "肩带还挂在身上。总不能背着包进去洗澡。");
  if (!hasHeld(state, "clothes") && !hasHeld(state, "towel")) return narrate(state, "手压上门把，才发现两只手空得有点可疑。");
  if (!hasHeld(state, "clothes")) return narrate(state, "总不能洗完再穿回今天上班的衣服。");
  if (!hasHeld(state, "towel")) return narrate(state, "好像还少了一件洗完以后会用到的东西。");
  return narrate(state, "门缝透出暖光，一只手已经搭上门把。");
}

function enterBath(state) {
  if (!state.bagPlaced || !hasHeld(state, "clothes") || !hasHeld(state, "towel")) return bathdoorLine(state);
  state.phase = "ending";
  state.transition = "forward";
  return addEvent(state, "main", "enter-bath", "推门进入浴室", 2, "手推开浴室门，外面的声音忽然都退远了。");
}

function resultSummary(state) {
  const detours = state.eventLog.filter((event) => event.kind === "detour");
  const longestDetour = longestDetourSummary(detours);
  return {
    title: "你终于走进浴室了。",
    planned: "20:35",
    actual: formatTime(state.virtualMinutes),
    elapsedMinutes: state.virtualMinutes,
    completedCount: detours.length,
    longestDetour,
    detours,
    badge: titleForRun(state, detours),
    ending: detours.length ? "你没有忘记洗澡。你只是先完成了一些别的事情。" : "今天这一步，走得很顺。",
  };
}

function longestDetourSummary(detours) {
  if (!detours.length) return null;
  const groups = {};
  const names = {
    phone: "手机里的那条路",
    sofa: "沙发里的那条路",
    parcel: "快递里的那条路",
    fridge: "冰箱里的那条路",
    laundry: "洗衣服这件事",
    mirror: "镜子前的一小会儿",
  };
  detours.forEach((event) => {
    const key = event.key.split("-")[0];
    if (!groups[key]) groups[key] = { key, label: names[key] || "房间里的生活小事", minutes: 0 };
    groups[key].minutes += event.minutes;
  });
  return Object.values(groups).sort((a, b) => b.minutes - a.minutes)[0];
}

function titleForRun(state, detours) {
  if (!detours.length) return "今天顺路洗了个澡";
  const totals = {};
  detours.forEach((event) => {
    const key = event.key.split("-")[0];
    totals[key] = (totals[key] || 0) + event.minutes;
  });
  const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  if (top === "phone") return "旧照片搜索专家";
  if (top === "sofa") return "沙发低空飞行员";
  if (top === "parcel") return state.parcelBrushed ? "桌缝临时维护员" : "快递开箱观察员";
  if (top === "fridge") return "深夜保质期审查员";
  if (top === "laundry") return "洗衣机启动见证人";
  return "生活细节巡查员";
}

window.ShowerGame = {
  CLOSE_SCENES,
  ITEMS,
  MAIN_SCENES,
  PHONE_THREADS,
  SCENE_TITLES,
  currentMainThought,
  currentNeedText,
  formatTime,
  initialState,
  itemName,
  itemPlaceText,
  reducer,
  resultSummary,
};
})();
