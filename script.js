const SYSTEMS = {
  a: {
    title: "(a) Components of a negative-feedback control system",
    nodes: [
      "Deviation in controlled variable",
      "Sensor",
      "Integrator",
      "Effector(s)",
      "Compensatory response",
      "Controlled variable restored to normal",
      "Negative feedback to shut off the system responsible for the response"
    ],
    links: [
      "detected by",
      "informs",
      "sends instructions to",
      "brings about",
      "results in",
      "leads to"
    ]
  },

  b: {
    title: "(b) Negative-feedback control of room temperature",
    nodes: [
      "🌬️ Fall in room temperature below set point",
      "🌡️ Thermometer",
      "🎛️ Thermostat",
      "🔥 Furnace",
      "♨️ ↑ Heat output",
      "🌡️⬆️ Increase in room temperature to set point",
      "⛔♨️ Negative feedback shuts off the heating response"
    ],
    links: []
  },

  c: {
    title: "(c) Negative-feedback control of body temperature",
    nodes: [
      "🥶 Fall in body temperature below set point",
      "🧠🌡️ Temperature-monitoring nerve cells",
      "🎛️🧠 Temperature control center",
      "💪 Skeletal muscles (and other effectors)",
      "🥶♨️ ↑ Heat production through shivering and other means",
      "🌡️⬆️ Increase in body temperature to set point",
      "⛔♨️ Negative feedback shuts off the heat-producing response"
    ],
    links: []
  }
};

const state = {
  system: "a",
  placements: {},
  selectedItem: null,
  dragItem: null,
  retriesUsed: 0,
  checkedOnce: false,
  retryMode: false,
  activityLocked: false,
  wrongSlotKeys: []
};

const els = {
  tabs: [...document.querySelectorAll(".system-tab")],
  activityTitle: document.getElementById("activityTitle"),
  flowChart: document.getElementById("flowChart"),
  conceptBank: document.getElementById("conceptBank"),
  linkBank: document.getElementById("linkBank"),
  linkPanel: document.getElementById("linkPanel"),
  checkBtn: document.getElementById("checkBtn"),
  resetBtn: document.getElementById("resetBtn"),
  retryBtn: document.getElementById("retryBtn"),
  hintBtn: document.getElementById("hintBtn"),
  retryText: document.getElementById("retryText"),
  workspace: document.querySelector(".workspace"),
  messageBox: document.getElementById("messageBox"),
  progressText: document.getElementById("progressText"),
  feedbackLoop: document.getElementById("feedbackLoop"),
  dropHint: document.getElementById("dropHint"),
  summaryPanel: document.getElementById("summaryPanel")
};

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Randomize bank labels on every load/reset/system change.
// The extra checks prevent the bank from accidentally appearing in the
// correct sequence or repeating the immediately previous arrangement.
function randomizedBankOrder(items, bankType) {
  if (items.length < 2) return [...items];

  const originalSignature = items.map(item => item.index).join(",");
  const storageKey = `negativeFeedback:${state.system}:${bankType}:lastOrder`;

  let previousSignature = "";
  try {
    previousSignature = localStorage.getItem(storageKey) || "";
  } catch (_) {
    // The activity still works if browser storage is blocked.
  }

  let candidate = [...items];
  let candidateSignature = originalSignature;

  for (let attempt = 0; attempt < 20; attempt++) {
    candidate = shuffle(items);
    candidateSignature = candidate.map(item => item.index).join(",");

    if (candidateSignature !== originalSignature && candidateSignature !== previousSignature) {
      break;
    }
  }

  // Guaranteed fallback for the extremely unlikely case that repeated
  // shuffles keep producing a disallowed order.
  if (candidateSignature === originalSignature || candidateSignature === previousSignature) {
    candidate = [...items.slice(1), items[0]];
    candidateSignature = candidate.map(item => item.index).join(",");

    if (candidateSignature === previousSignature && items.length > 2) {
      candidate = [...items.slice(2), ...items.slice(0, 2)];
      candidateSignature = candidate.map(item => item.index).join(",");
    }
  }

  try {
    localStorage.setItem(storageKey, candidateSignature);
  } catch (_) {
    // Ignore storage errors; the shuffled order is still used.
  }

  return candidate;
}

function setMessage(text, type = "neutral") {
  els.messageBox.className = `message ${type}`;
  els.messageBox.textContent = text;
}

function currentData() {
  return SYSTEMS[state.system];
}

function retriesLeft() {
  return Math.max(0, 5 - state.retriesUsed);
}

function updateRetryUI() {
  const left = retriesLeft();
  els.retryText.textContent = left === 1 ? "1 retry available" : `${left} retries available`;

  const canRetry =
    state.checkedOnce &&
    !state.activityLocked &&
    !state.retryMode &&
    state.wrongSlotKeys.length > 0 &&
    left > 0;

  els.retryBtn.classList.toggle("hidden-control", !canRetry);
  els.retryBtn.textContent = `Retry Wrong Options (${left} left)`;

  els.workspace.classList.toggle(
    "attempt-locked",
    state.checkedOnce && !state.retryMode && state.wrongSlotKeys.length > 0
  );
}

function makeItemId(type, index) {
  return `${type}-${index}`;
}

function clearSelection() {
  state.selectedItem = null;
  document.querySelectorAll(".drag-card").forEach(card => {
    card.classList.remove("selected");
  });
}

function canRearrange() {
  return !state.activityLocked && (!state.checkedOnce || state.retryMode);
}

function itemFromBankCard(button) {
  return {
    id: button.dataset.itemId,
    type: button.dataset.type,
    index: Number(button.dataset.index),
    text: button.textContent,
    originSlotKey: null
  };
}

function createBankCard(type, index, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drag-card";
  button.draggable = true;
  button.dataset.type = type;
  button.dataset.index = String(index);
  button.dataset.itemId = makeItemId(type, index);
  button.textContent = text;

  button.addEventListener("dragstart", event => {
    if (!canRearrange() || button.classList.contains("placed")) {
      event.preventDefault();
      return;
    }

    state.dragItem = itemFromBankCard(button);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", button.dataset.itemId);
  });

  button.addEventListener("dragend", () => {
    state.dragItem = null;
    document.querySelectorAll(".drop-slot").forEach(slot => slot.classList.remove("drag-over"));
    document.querySelectorAll(".item-bank").forEach(bank => bank.classList.remove("bank-drop-over"));
  });

  button.addEventListener("click", () => {
    if (!canRearrange() || button.classList.contains("placed")) return;

    clearSelection();
    state.selectedItem = itemFromBankCard(button);
    button.classList.add("selected");
    setMessage(`Selected: ${text}. Now click a matching flow-chart position.`);
  });

  return button;
}

function createArrow() {
  const arrow = document.createElement("div");
  arrow.className = "arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↓";
  return arrow;
}

function slotKey(type, index) {
  return `${type}-slot-${index}`;
}

function resetSlot(slot) {
  slot.textContent = slot.dataset.placeholder;
  slot.classList.remove("filled", "correct", "incorrect", "locked");
  slot.draggable = false;
}

function returnItemToBank(item) {
  const card = document.querySelector(`[data-item-id="${item.id}"]`);
  if (card) {
    card.classList.remove("placed");
    card.draggable = true;
  }
}

function markItemPlaced(item) {
  const card = document.querySelector(`[data-item-id="${item.id}"]`);
  if (card) {
    card.classList.add("placed");
    card.draggable = false;
  }
}

function getPlacement(slotKeyValue) {
  return state.placements[slotKeyValue] || null;
}

function removePlacement(slotKeyValue, returnToBank = true) {
  const item = state.placements[slotKeyValue];
  const slot = document.querySelector(`[data-slot-key="${slotKeyValue}"]`);

  if (!item) return null;

  delete state.placements[slotKeyValue];
  if (slot) resetSlot(slot);
  if (returnToBank) returnItemToBank(item);

  return item;
}

function createSlot(type, index) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = `drop-slot ${type === "node" ? "node-slot" : "link-slot"}`;
  slot.dataset.type = type;
  slot.dataset.index = String(index);
  slot.dataset.slotKey = slotKey(type, index);
  slot.dataset.placeholder = type === "node"
    ? "CONCEPT BOX — drop here"
    : "LINKING PHRASE — drop here";
  slot.textContent = slot.dataset.placeholder;
  slot.draggable = false;

  slot.addEventListener("dragstart", event => {
    if (!canRearrange() || slot.classList.contains("locked")) {
      event.preventDefault();
      return;
    }

    const item = getPlacement(slot.dataset.slotKey);
    if (!item) {
      event.preventDefault();
      return;
    }

    state.dragItem = {
      ...item,
      originSlotKey: slot.dataset.slotKey
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  });

  slot.addEventListener("dragend", () => {
    state.dragItem = null;
    document.querySelectorAll(".drop-slot").forEach(s => s.classList.remove("drag-over"));
    document.querySelectorAll(".item-bank").forEach(bank => bank.classList.remove("bank-drop-over"));
  });

  slot.addEventListener("dragover", event => {
    if (!canRearrange() || slot.classList.contains("locked")) return;
    if (!state.dragItem || state.dragItem.type !== slot.dataset.type) return;

    event.preventDefault();
    slot.classList.add("drag-over");
  });

  slot.addEventListener("dragleave", () => {
    slot.classList.remove("drag-over");
  });

  slot.addEventListener("drop", event => {
    event.preventDefault();
    slot.classList.remove("drag-over");

    if (!canRearrange() || slot.classList.contains("locked") || !state.dragItem) return;
    placeItem(slot, state.dragItem);
  });

  slot.addEventListener("click", () => {
    if (state.activityLocked || slot.classList.contains("locked")) return;

    if (state.checkedOnce && !state.retryMode) {
      setMessage(
        retriesLeft() > 0
          ? `Use “Retry Wrong Options” to revise the incorrect choices. ${retriesLeft()} ${retriesLeft() === 1 ? "retry" : "retries"} left.`
          : "No retries remain for this activity.",
        retriesLeft() > 0 ? "warning" : "error"
      );
      return;
    }

    if (state.selectedItem) {
      placeItem(slot, state.selectedItem);
      return;
    }

    const existing = getPlacement(slot.dataset.slotKey);
    if (existing) {
      removePlacement(slot.dataset.slotKey, true);
      updateProgress();
      setMessage("Item returned to its bank. You can drag it again.");
    }
  });

  return slot;
}

function placeItem(slot, incomingItem) {
  if (!canRearrange() || slot.classList.contains("locked")) return;

  if (slot.dataset.type !== incomingItem.type) {
    const needed = slot.dataset.type === "node" ? "concept box" : "linking phrase";
    setMessage(`This position needs a ${needed}.`, "warning");
    return;
  }

  const targetKey = slot.dataset.slotKey;
  const originKey = incomingItem.originSlotKey || null;

  if (originKey === targetKey) {
    return;
  }

  const displaced = getPlacement(targetKey);

  // Remove the dragged item from its previous flow-chart position, if any.
  if (originKey && getPlacement(originKey)?.id === incomingItem.id) {
    removePlacement(originKey, false);
  } else {
    // It came from the bank; make sure no older duplicate placement remains.
    for (const [key, placement] of Object.entries(state.placements)) {
      if (placement.id === incomingItem.id) {
        removePlacement(key, false);
        break;
      }
    }
  }

  // If target was occupied:
  // - while moving from another flow slot, swap the displaced item into the old position;
  // - while moving from the bank, return displaced item to its bank.
  if (displaced) {
    delete state.placements[targetKey];

    if (originKey) {
      const originSlot = document.querySelector(`[data-slot-key="${originKey}"]`);
      if (originSlot) {
        state.placements[originKey] = { ...displaced, originSlotKey: undefined };
        originSlot.textContent = displaced.text;
        originSlot.classList.add("filled");
        originSlot.classList.remove("correct", "incorrect", "locked");
        originSlot.draggable = true;
        markItemPlaced(displaced);
      }
    } else {
      returnItemToBank(displaced);
    }
  }

  const storedItem = {
    id: incomingItem.id,
    type: incomingItem.type,
    index: Number(incomingItem.index),
    text: incomingItem.text
  };

  state.placements[targetKey] = storedItem;
  slot.textContent = storedItem.text;
  slot.classList.add("filled");
  slot.classList.remove("correct", "incorrect", "locked");
  slot.draggable = true;

  markItemPlaced(storedItem);
  clearSelection();
  updateProgress();
  setMessage("Moved successfully. You can keep rearranging items until you are ready to check.");
}

function setupBankDropZone(bank, acceptedType) {
  bank.addEventListener("dragover", event => {
    if (!canRearrange() || !state.dragItem || state.dragItem.type !== acceptedType) return;
    event.preventDefault();
    bank.classList.add("bank-drop-over");
  });

  bank.addEventListener("dragleave", event => {
    if (!bank.contains(event.relatedTarget)) {
      bank.classList.remove("bank-drop-over");
    }
  });

  bank.addEventListener("drop", event => {
    event.preventDefault();
    bank.classList.remove("bank-drop-over");

    if (!canRearrange() || !state.dragItem || state.dragItem.type !== acceptedType) return;

    const originKey = state.dragItem.originSlotKey;
    if (originKey && getPlacement(originKey)?.id === state.dragItem.id) {
      removePlacement(originKey, true);
      updateProgress();
      setMessage(
        acceptedType === "node"
          ? "Concept box returned to the Concept Boxes bank."
          : "Linking phrase returned to the Linking Phrases bank."
      );
    }
  });
}

function updateProgress() {
  const data = currentData();
  const total = data.nodes.length + data.links.length;
  const placed = Object.keys(state.placements).length;
  els.progressText.textContent = `${placed} / ${total}`;
}

function lockCorrectSlots() {
  document.querySelectorAll(".drop-slot.correct").forEach(slot => {
    slot.classList.add("locked");
    slot.draggable = false;
  });
}

function unlockOpenSlots() {
  document.querySelectorAll(".drop-slot").forEach(slot => {
    if (!slot.classList.contains("correct")) {
      slot.classList.remove("locked");
      slot.draggable = slot.classList.contains("filled");
    }
  });
}

function finishActivityLocked() {
  state.activityLocked = true;
  state.retryMode = false;
  state.selectedItem = null;
  state.dragItem = null;
  clearSelection();

  document.querySelectorAll(".drop-slot").forEach(slot => {
    slot.classList.add("locked");
    slot.draggable = false;
  });

  document.querySelectorAll(".drag-card").forEach(card => {
    card.classList.add("disabled-card");
    card.draggable = false;
  });

  els.checkBtn.disabled = true;
  updateRetryUI();
}


function positionFeedbackLoop() {
  const stage = document.querySelector(".flow-stage");
  const loop = els.feedbackLoop;
  const nodeSlots = [...els.flowChart.querySelectorAll(".node-slot")];
  const linkSlots = [...els.flowChart.querySelectorAll(".link-slot")];

  if (!stage || !loop || nodeSlots.length < 2) return;

  const stageRect = stage.getBoundingClientRect();
  const rectWithinStage = element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left - stageRect.left,
      right: rect.right - stageRect.left,
      top: rect.top - stageRect.top,
      bottom: rect.bottom - stageRect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left - stageRect.left + (rect.width / 2),
      centerY: rect.top - stageRect.top + (rect.height / 2)
    };
  };

  const first = rectWithinStage(nodeSlots[0]);
  const second = rectWithinStage(nodeSlots[1]);

  // In room/body-temperature maps, feedback originates from the
  // "restored to set point" box (second-last node), not the final
  // explanatory negative-feedback box.
  const sourceIndex = state.system === "a"
    ? nodeSlots.length - 1
    : Math.max(0, nodeSlots.length - 2);
  const source = rectWithinStage(nodeSlots[sourceIndex]);

  const branchReference = state.system === "a" && linkSlots[0]
    ? rectWithinStage(linkSlots[0])
    : {
        centerY: Math.round((first.bottom + second.top) / 2),
        right: Math.max(first.right, second.right)
      };

  const stageWidth = Math.ceil(stageRect.width);
  const stageHeight = Math.ceil(stageRect.height);

  // Keep every feedback line in the gutter to the RIGHT of the boxes.
  // Horizontal arms deliberately stop short of box borders.
  const clearGap = 14;
  const loopX = Math.min(stageWidth - 14, Math.max(first.right, second.right, source.right) + 48);
  const topY = Math.round(first.top + Math.min(18, first.height * 0.34));
  const branchY = Math.round(branchReference.centerY);
  const sourceY = Math.round(source.bottom + 18);

  const topStopX = Math.round(first.right + clearGap);
  const branchStopX = Math.round(Math.max(first.right, second.right) + clearGap);
  const sourceStartX = Math.round(source.right + clearGap);

  const bottomY = Math.min(stageHeight - 14, sourceY + 34);
  const corner = 18;

  // Main feedback loop: begins OUTSIDE the source box, turns in the gutter,
  // travels up the right side, then stops before the first box.
  const mainPath = [
    `M ${sourceStartX} ${sourceY}`,
    `L ${loopX - corner} ${sourceY}`,
    `Q ${loopX} ${sourceY} ${loopX} ${sourceY - corner}`,
    `L ${loopX} ${topY + corner}`,
    `Q ${loopX} ${topY} ${loopX - corner} ${topY}`,
    `L ${topStopX} ${topY}`
  ].join(" ");

  // Secondary inhibitory arm, also kept completely outside the boxes.
  const branchPath = `M ${loopX} ${branchY} L ${branchStopX} ${branchY}`;

  const showBottomLabel = state.system !== "a";

  loop.innerHTML = `
    <svg class="feedback-svg" width="${stageWidth}" height="${stageHeight}" viewBox="0 0 ${stageWidth} ${stageHeight}" aria-hidden="true">
      <path d="${mainPath}" fill="none" stroke="#ff1687" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="${branchPath}" fill="none" stroke="#ff1687" stroke-width="4" stroke-linecap="round"></path>
    </svg>
    <div class="feedback-relieves">relieves</div>
    ${showBottomLabel ? '<div class="feedback-bottom-label">(negative feedback)</div>' : ''}
  `;

  const relieves = loop.querySelector('.feedback-relieves');
  const bottomLabel = loop.querySelector('.feedback-bottom-label');
  if (relieves) {
    relieves.style.left = `${Math.max(topStopX + 2, loopX - 54)}px`;
    relieves.style.top = `${Math.max(4, topY - 20)}px`;
  }

  if (bottomLabel) {
    bottomLabel.style.left = `${Math.max(18, source.left + 28)}px`;
    bottomLabel.style.top = `${source.bottom + 8}px`;
  }

  loop.dataset.system = state.system;
}


function render() {
  const data = currentData();

  state.placements = {};
  state.selectedItem = null;
  state.dragItem = null;
  state.retriesUsed = 0;
  state.checkedOnce = false;
  state.retryMode = false;
  state.activityLocked = false;
  state.wrongSlotKeys = [];

  els.checkBtn.disabled = false;
  els.retryBtn.classList.add("hidden-control");
  els.workspace.classList.remove("attempt-locked");
  els.summaryPanel.classList.add("hidden-control");
  els.summaryPanel.innerHTML = "";

  els.activityTitle.textContent = data.title;
  els.flowChart.innerHTML = "";
  els.conceptBank.innerHTML = "";
  els.linkBank.innerHTML = "";

  const hasLinks = data.links.length > 0;
  els.linkPanel.classList.toggle("hidden-control", !hasLinks);
  els.workspace.classList.toggle("no-links", !hasLinks);
  els.dropHint.textContent = hasLinks
    ? "Large blue boxes = concepts · small gold pills = linking phrases"
    : "Large blue boxes = concepts";

  data.nodes.forEach((_, nodeIndex) => {
    els.flowChart.appendChild(createSlot("node", nodeIndex));

    if (data.links.length > 0 && nodeIndex < data.links.length) {
      els.flowChart.appendChild(createArrow());
      els.flowChart.appendChild(createSlot("link", nodeIndex));
      els.flowChart.appendChild(createArrow());
    } else if (data.links.length === 0 && nodeIndex < data.nodes.length - 1) {
      els.flowChart.appendChild(createArrow());
    }
  });

  const nodeItems = data.nodes.map((text, index) => ({ text, index }));
  randomizedBankOrder(nodeItems, "concepts").forEach(item => {
    els.conceptBank.appendChild(createBankCard("node", item.index, item.text));
  });

  const linkItems = data.links.map((text, index) => ({ text, index }));
  randomizedBankOrder(linkItems, "links").forEach(item => {
    els.linkBank.appendChild(createBankCard("link", item.index, item.text));
  });

  updateProgress();
  updateRetryUI();
  els.feedbackLoop.dataset.system = state.system;
  els.feedbackLoop.classList.add("hidden");
  positionFeedbackLoop();
  setMessage("Build the concept map. You may freely move items between the banks and the flow chart before checking.");

  els.tabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.system === state.system);
  });
}

function checkAnswers() {
  if (state.activityLocked) return;

  const data = currentData();
  const total = data.nodes.length + data.links.length;
  const placedCount = Object.keys(state.placements).length;

  if (placedCount < total) {
    setMessage(
      `You have placed ${placedCount} of ${total} items. Complete all flow-chart positions first.`,
      "warning"
    );
    return;
  }

  let correct = 0;
  state.wrongSlotKeys = [];

  els.feedbackLoop.classList.add("hidden");

  document.querySelectorAll(".drop-slot").forEach(slot => {
    slot.classList.remove("correct", "incorrect");

    const item = getPlacement(slot.dataset.slotKey);
    if (!item) return;

    const isCorrect = Number(item.index) === Number(slot.dataset.index);
    slot.classList.add(isCorrect ? "correct" : "incorrect");

    if (isCorrect) {
      correct++;
      slot.classList.add("locked");
      slot.draggable = false;
    } else {
      state.wrongSlotKeys.push(slot.dataset.slotKey);
      slot.classList.remove("locked");
      slot.draggable = false;
    }
  });

  state.checkedOnce = true;
  state.retryMode = false;
  lockCorrectSlots();

  if (correct === total) {
    els.feedbackLoop.dataset.system = state.system;
    positionFeedbackLoop();
    els.feedbackLoop.classList.remove("hidden");
    state.wrongSlotKeys = [];

    setMessage(
      `Excellent! The complete ${data.title.toLowerCase()} concept map is correct. The negative-feedback loop is now shown.`,
      "success"
    );

    showSummary();

    document.querySelectorAll(".drop-slot").forEach(slot => {
      slot.classList.add("locked");
      slot.draggable = false;
    });

    document.querySelectorAll(".drag-card").forEach(card => {
      card.classList.add("disabled-card");
      card.draggable = false;
    });

    els.checkBtn.disabled = true;
    updateRetryUI();
    return;
  }

  const left = retriesLeft();

  if (left > 0) {
    setMessage(
      `${correct} of ${total} positions are correct. Correct answers are locked. Use “Retry Wrong Options” to revise only the wrong answers. ${left} ${left === 1 ? "retry" : "retries"} left.`,
      "error"
    );
    updateRetryUI();
  } else {
    setMessage(
      `${correct} of ${total} positions are correct. No retries remain, so the activity is now locked.`,
      "error"
    );
    finishActivityLocked();
  }
}

function startRetry() {
  if (
    state.activityLocked ||
    state.retryMode ||
    state.wrongSlotKeys.length === 0 ||
    retriesLeft() <= 0
  ) return;

  state.retriesUsed += 1;
  state.retryMode = true;

  const wrongKeys = [...state.wrongSlotKeys];

  wrongKeys.forEach(key => {
    const item = getPlacement(key);
    const slot = document.querySelector(`[data-slot-key="${key}"]`);

    if (item) returnItemToBank(item);
    delete state.placements[key];

    if (slot) {
      resetSlot(slot);
      slot.classList.remove("locked");
    }
  });

  state.wrongSlotKeys = [];
  unlockOpenSlots();
  updateProgress();
  updateRetryUI();

  const left = retriesLeft();
  setMessage(
    `Wrong items are back in their banks. You may freely drag and rearrange those items before checking again. ${left} ${left === 1 ? "retry" : "retries"} will remain after this round.`,
    "warning"
  );
}

const HINTS = {
  a: {
    nodes: [
      "Before anything can be corrected, what must first exist for the system to respond to?",
      "How does the system know that something has gone wrong in the first place?",
      "Once the problem is known, which part of the system decides what action to take?",
      "Knowing what to do is not enough — which part of the system actually carries out the correction?",
      "What do we call the action that works against the original deviation?",
      "What is the ultimate goal that the whole system is working towards?",
      "If the system kept running after the correction, what would happen? What prevents that?"
    ],
    links: [
      "The deviation has occurred — what is the very first thing that must happen to it?",
      "Once the problem is known, what kind of relationship exists between the detector and the decision-maker?",
      "A decision has been made — how does that decision reach the part that acts?",
      "The correction is now underway — what word describes the relationship between the action and its direct result?",
      "The corrective action has had an effect — what does that effect do to the original variable?",
      "The variable is now normal again — what does this restoration do to the system that caused it?"
    ]
  },
  b: {
    nodes: [
      "What is the very first event that sets this whole system into motion?",
      "How does the system in the room know what the current temperature actually is?",
      "Something must receive the temperature reading and decide what to do next — what is it?",
      "What is the physical device in the room that actually produces the heat?",
      "The device is now working — what is the immediate physical consequence of its activity?",
      "The correction has been happening for a while — what has changed in the room as a result?",
      "The room has reached its target — what must happen to the device producing the heat?"
    ],
    links: []
  },
  c: {
    nodes: [
      "What is the very first event that triggers this control system to respond?",
      "How does the body become aware that its temperature has fallen below normal?",
      "Something must receive the signal and coordinate the body's response — where does this happen?",
      "Which part of the body is primarily responsible for generating the extra heat?",
      "The body is now working to generate heat — what is the direct physiological outcome of this?",
      "The correction mechanism has been working — what has happened to the core temperature as a result?",
      "Temperature has returned to normal — what must now happen to the heat-generating response, and why?"
    ],
    links: []
  }
};

const SUMMARIES = {
  a: {
    title: "What is negative feedback?",
    paragraphs: [
      "Negative feedback is the fundamental control mechanism that keeps the body's internal environment stable — a concept known as <strong>homeostasis</strong>. The word 'negative' does not mean harmful; it means the response <em>opposes</em> or <em>reverses</em> the original deviation.",
      "The system has four key components working in sequence: a <span class='summary-key'>Sensor</span> detects a deviation from normal, an <span class='summary-key'>Integrator</span> processes this information and issues instructions, one or more <span class='summary-key'>Effectors</span> carry out a corrective response, and finally the <span class='summary-key'>Controlled Variable</span> is restored to its set point.",
      "Crucially, once the variable returns to normal, the corrective response is switched off automatically — this is the 'negative feedback' that gives the mechanism its name. Without it, the system would overshoot and the body could not maintain stability."
    ]
  },
  b: {
    title: "Room temperature — a familiar model",
    paragraphs: [
      "The room-temperature example helps us understand negative feedback using everyday technology before applying it to physiology. When room temperature falls below the thermostat's set point, the <span class='summary-key'>thermometer</span> detects the drop and sends this information to the <span class='summary-key'>thermostat</span>.",
      "The thermostat (integrator) switches on the <span class='summary-key'>furnace</span> (effector), which produces heat. Once the room warms back to the set point, the thermostat receives negative feedback and switches the furnace off.",
      "Notice the parallel with biological systems: the thermostat is analogous to the hypothalamus, and the furnace is analogous to the body's heat-producing effectors such as skeletal muscles during shivering."
    ]
  },
  c: {
    title: "Body temperature — the biological application",
    paragraphs: [
      "The control of body temperature is one of the clearest examples of negative feedback in human physiology. The normal core temperature is approximately <strong>37°C</strong>. When it falls below this set point, <span class='summary-key'>temperature-monitoring nerve cells</span> detect the change and relay this to the <span class='summary-key'>temperature control centre</span> in the hypothalamus.",
      "The hypothalamus (integrator) sends motor signals to <span class='summary-key'>skeletal muscles</span>, causing them to contract and relax rapidly — a process we call <strong>shivering</strong>. This dramatically increases heat production and raises core temperature back to 37°C.",
      "Once normal temperature is restored, the hypothalamus receives negative feedback and the shivering response is switched off. Other effectors involved include cutaneous vasoconstriction and piloerection, all coordinated by the same hypothalamic control centre."
    ]
  }
};

let activeHintSlot = null;

function showHintForNextEmpty() {
  const data = currentData();
  const slots = [...document.querySelectorAll(".drop-slot")];

  document.querySelectorAll(".hint-bubble").forEach(b => b.remove());
  activeHintSlot = null;

  const emptySlot = slots.find(slot => !state.placements[slot.dataset.slotKey] && !slot.classList.contains("locked"));

  if (!emptySlot) {
    setMessage("All positions are filled — click Check Answer to see how you did!", "warning");
    return;
  }

  const type = emptySlot.dataset.type;
  const index = Number(emptySlot.dataset.index);
  const hintText = HINTS[state.system]?.[type === "node" ? "nodes" : "links"]?.[index];

  if (!hintText) return;

  const bubble = document.createElement("div");
  bubble.className = "hint-bubble";
  bubble.textContent = hintText;
  emptySlot.appendChild(bubble);
  activeHintSlot = emptySlot;

  setTimeout(() => {
    bubble.remove();
    activeHintSlot = null;
  }, 5000);

  setMessage("💡 Hint shown above the next empty slot for 5 seconds.");
}

function showSummary() {
  const summary = SUMMARIES[state.system];
  if (!summary) return;

  els.summaryPanel.classList.remove("hidden-control");
  els.summaryPanel.innerHTML = `
    <h3>✅ ${summary.title}</h3>
    ${summary.paragraphs.map(p => `<p>${p}</p>`).join("")}
  `;

  els.summaryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

setupBankDropZone(els.conceptBank, "node");
setupBankDropZone(els.linkBank, "link");

els.tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    state.system = tab.dataset.system;
    render();
  });
});

els.checkBtn.addEventListener("click", checkAnswers);
els.retryBtn.addEventListener("click", startRetry);
els.resetBtn.addEventListener("click", render);
els.hintBtn.addEventListener("click", showHintForNextEmpty);

render();

window.addEventListener("resize", positionFeedbackLoop);
