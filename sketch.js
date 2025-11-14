let offense;
let blockers = [];
let receivers = [];
let defenders = [];
let ballCarrier;
let ballSnapped = false;
let qbMoveCount = 0;
let defenderMoveToggle = true;

// Down & distance
let currentDown = 1;
let yardsToGo = 10;
let startX = 1; // line of scrimmage at series start
let tackledThisDown = false; // only allow one tackle-increment per down

let cellSize = 40;
let yardsPerCell = 5;
let fieldYards = 100;
let fieldCols = fieldYards / yardsPerCell;
let fieldRows = 9;
let fieldWidth = fieldCols * cellSize;
let fieldHeight = fieldRows * cellSize;

let gameOver = false;
let touchdown = false;

function setFormationAtLOS() {
  // Reset per-down flags/state
  ballSnapped = false;
  qbMoveCount = 0;
  defenderMoveToggle = true;
  receiverStep = [0, 0];
  blockerStep = [0, 0, 0];

  // Clamp LOS within field
  const los = constrain(startX, 0, fieldCols - 1);

  // Offense (QB on LOS middle row)
  offense = createVector(los, 4);

  // Blockers just ahead of LOS
  blockers = [
    createVector(constrain(los + 1, 0, fieldCols - 1), 4),
    createVector(constrain(los + 1, 0, fieldCols - 1), 3),
    createVector(constrain(los + 1, 0, fieldCols - 1), 5)
  ];

  // Receivers just behind LOS
  receivers = [
    createVector(constrain(los - 1, 0, fieldCols - 1), 3),
    createVector(constrain(los - 1, 0, fieldCols - 1), 5)
  ];

  // Defenders reset relative to LOS
  const defOffsets = [
    { dx: 3, y: 3 }, { dx: 3, y: 4 }, { dx: 3, y: 5 },
    { dx: 5, y: 3 }, { dx: 5, y: 5 }, { dx: 7, y: 4 }
  ];
  defenders = defOffsets.map(o =>
    createVector(constrain(los + o.dx, 0, fieldCols - 1), o.y)
  );

  // Ball starts with the center blocker pre-snap
  ballCarrier = blockers[0];
}

// Routes
let receiverRoutes = [
  [{ dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }],
  [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }]
];
let blockerRoutes = [
  [{ dx: 1, dy: 0 }, { dx: 1, dy: 0 }],
  [{ dx: 1, dy: -1 }, { dx: 1, dy: 0 }],
  [{ dx: 1, dy: 1 }, { dx: 1, dy: 0 }]
];
let receiverStep = [0, 0];
let blockerStep = [0, 0, 0];

function setup() {
  const c = createCanvas(fieldWidth, fieldHeight);
  if (c.parent) c.parent('game'); // attach to <main id="game"> if available

  // Initialize formation at the starting LOS
  setFormationAtLOS();
}

function draw() {
  background(0);
  drawField();
  drawPlayers();
  drawTracker();
  checkCollision();

  if (gameOver) {
    fill(touchdown ? color(0, 255, 0) : color(255, 0, 0));
    textSize(32);
    text(
      touchdown ? "TOUCHDOWN!" : "TURNOVER ON DOWNS",
      fieldWidth / 2 - 150,
      fieldHeight / 2
    );
    noLoop();
  }
}

function drawTracker() {
  fill(255);
  textSize(16);
  let yardsGained = ballSnapped ? ballCarrier.x - startX : 0;
  let yardsLeft = max(0, yardsToGo - yardsGained);
  text(`Down: ${currentDown}`, fieldWidth - 120, 20);
  text(`To Go: ${yardsLeft}`, fieldWidth - 120, 40);
}

function drawField() {
  fill(0, 128, 0);
  noStroke();
  rect(0, 0, fieldWidth, fieldHeight);

  stroke(255);
  for (let x = 0; x < fieldWidth; x += cellSize) line(x, 0, x, fieldHeight);
  for (let y = 0; y < fieldHeight; y += cellSize) line(0, y, fieldWidth, y);

  fill(50, 150, 50);
  noStroke();
  rect((fieldCols - 1) * cellSize, 0, cellSize, fieldHeight);

  fill(255);
  textSize(16);
  text("TD", (fieldCols - 1) * cellSize + 10, 20);

  // Markers: Line of Scrimmage (LOS) and First Down line
  const losCol = constrain(startX, 0, fieldCols - 1);
  const firstDownCol = constrain(startX + yardsToGo, 0, fieldCols - 1);

  // LOS marker (cyan)
  stroke(0, 200, 255);
  strokeWeight(3);
  line(losCol * cellSize, 0, losCol * cellSize, fieldHeight);

  // First down marker (yellow)
  stroke(255, 215, 0);
  strokeWeight(3);
  line(firstDownCol * cellSize, 0, firstDownCol * cellSize, fieldHeight);

  // Reset stroke for other drawings
  strokeWeight(1);
}

function drawPlayers() {
  textSize(32);

  // QB
  fill(0, 255, 0);
  text("O", offense.x * cellSize + 10, offense.y * cellSize + 30);

  // Blockers
  fill(0, 255, 255);
  blockers.forEach(b => text("O", b.x * cellSize + 10, b.y * cellSize + 30));

  // Receivers
  fill(0, 0, 255);
  receivers.forEach(r => text("O", r.x * cellSize + 10, r.y * cellSize + 30));

  // Defense
  fill(255, 0, 0);
  defenders.forEach(d => text("X", d.x * cellSize + 10, d.y * cellSize + 30));

  // Ball
  fill(255, 255, 0);
  ellipse(
    ballCarrier.x * cellSize + cellSize / 2,
    ballCarrier.y * cellSize + cellSize / 2,
    10, 10
  );
}

function keyPressed() {
  if (gameOver) return;

  // Snap (SPACE)
  if (!ballSnapped && key === ' ') {
    ballCarrier = offense;
    ballSnapped = true;
    tackledThisDown = false; // reset for new down
    return false; // prevent page scroll on Space
  }

  // QB move
  if (ballSnapped && ballCarrier === offense) {
    let dx = 0, dy = 0;

    if (keyCode === LEFT_ARROW  || key === 'a') dx = -1;
    if (keyCode === RIGHT_ARROW || key === 'd') dx =  1;
    if (keyCode === UP_ARROW    || key === 'w') dy = -1;
    if (keyCode === DOWN_ARROW  || key === 's') dy =  1;

    if (dx !== 0 || dy !== 0) {
      offense.x = constrain(offense.x + dx, 0, fieldCols - 1);
      offense.y = constrain(offense.y + dy, 0, fieldRows - 1);
      ballCarrier = offense;

      moveReceivers();
      if (++qbMoveCount >= 3) moveBlockers();
      moveDefenders();
    }
  }

  // Pass
  if (keyCode === TAB && ballSnapped) {
    attemptPass();
    return false; // prevent browser focus shift
  }
}

function moveReceivers() {
  receivers.forEach((r, i) => {
    if (receiverStep[i] < receiverRoutes[i].length) {
      let s = receiverRoutes[i][receiverStep[i]++];
      r.x = constrain(r.x + s.dx, 0, fieldCols - 1);
      r.y = constrain(r.y + s.dy, 0, fieldRows - 1);
    }
  });
}

function moveBlockers() {
  blockers.forEach((b, i) => {
    if (blockerStep[i] < blockerRoutes[i].length) {
      let s = blockerRoutes[i][blockerStep[i]++];
      b.x = constrain(b.x + s.dx, 0, fieldCols - 1);
      b.y = constrain(b.y + s.dy, 0, fieldRows - 1);
    }
  });
}

function moveDefenders() {
  if (!defenderMoveToggle) {
    defenderMoveToggle = true;
    return;
  }
  defenderMoveToggle = false;

  defenders.forEach(d => {
    let dx = ballCarrier.x - d.x;
    let dy = ballCarrier.y - d.y;
    let nextX = d.x, nextY = d.y;

    if (abs(dx) > abs(dy)) nextX += dx > 0 ? 1 : -1;
    else if (dy !== 0)     nextY += dy > 0 ? 1 : -1;

    let blocked = blockers.some(b => b.x === nextX && b.y === nextY);
    if (!blocked) {
      d.x = constrain(nextX, 0, fieldCols - 1);
      d.y = constrain(nextY, 0, fieldRows - 1);
    }
  });
}

function checkCollision() {
  // Touchdown?
  if (ballCarrier.x === fieldCols - 1) {
    gameOver = true;
    touchdown = true;
    return;
  }

  let yardsGained = ballCarrier.x - startX;

  // First down?
  if (yardsGained >= yardsToGo) {
    currentDown = 1;
    startX += yardsToGo;
    yardsToGo = 10;
    tackledThisDown = false; // clear tackle-flag on new first down
    setFormationAtLOS();
    return;
  }

  // Tackle = end of down
  let wasTackled = defenders.some(d => d.x === ballCarrier.x && d.y === ballCarrier.y);

  if (wasTackled && !tackledThisDown) {
    tackledThisDown = true;

    if (currentDown < 4) {
      currentDown++;
      yardsToGo -= yardsGained;
      startX = ballCarrier.x;
      setFormationAtLOS();
    } else {
      gameOver = true; // turnover on 4th
    }
  }
}

function attemptPass() {
  for (let r of receivers) {
    if (abs(r.x - offense.x) <= 3 && r.y === offense.y) {
      offense.set(r.x, r.y);
      ballCarrier = offense;
      return;
    }
  }
}
