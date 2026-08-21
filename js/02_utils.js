/**
 * Bear Tank Simulation - File 2: Utilities
 * DOM Helpers & Robust UI Feedback
 */

function getVal(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    if (el.type === "checkbox") return el.checked ? 1 : 0;
    if (el.tagName === "SELECT") return el.value;
    return parseFloat(el.value) || 0;
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.innerText = text;
}

function showToast(msg) {
    var t = document.getElementById("toast");
    if (t) {
        if (window.toastTimer) clearTimeout(window.toastTimer);
        t.innerText = msg || "Action Successful!";
        t.classList.add("show");
        window.toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3000);
    }
}

// ============================================================================
// 2. ANIMATION STATE & ENGINE (BEAR TANK MELEE LOGIC)
// ============================================================================

var animCtx = null;
var animReqId = null;
var animProgress = 0;
var simOutcome = 'hit';
var simBossSprite = null; // Wird in showProgress befüllt

// 🚀 HIER IST DIE ÄNDERUNG: Vorher 4, jetzt 8 für doppelte Größe!
const ANIM_SCALE = 8; 

function initAnimCanvas() {
    var cvs = document.getElementById("animCanvas");
    if (cvs) animCtx = cvs.getContext("2d");
}

function drawSprite(sprite, startX, startY, customScale) {
    if (!animCtx || !sprite) return;
    var s = customScale || ANIM_SCALE;
    for (var y = 0; y < sprite.length; y++) {
        for (var x = 0; x < sprite[y].length; x++) {
            var color = sprite[y][x];
            if (color) {
                animCtx.fillStyle = color;
                animCtx.fillRect(startX + (x * s), startY + (y * s), s, s);
            }
        }
    }
}

function drawDiagonalText(textArr, startX, startY, spacingX, spacingY) {
    textArr.forEach(function(letterSprite, i) {
        // Text fix auf Größe 4 lassen, da er sonst bei Scale 8 gigantisch wird
        drawSprite(letterSprite, startX + (i * spacingX * 4), startY - (i * spacingY * 4), 4);
    });
}

function renderAnimationFrame(pct) {
    if (!animCtx) return;
    
    // --- SICHERHEITS-CHECK ---
    if (!window.SPRITES || !window.SPRITES.bear) {
        console.warn("Fehler: window.SPRITES.bear wurde nicht gefunden! Animation wird übersprungen.");
        return; 
    }
    // -------------------------

    var canvas = animCtx.canvas;
    
    // Clear & Background
    animCtx.clearRect(0, 0, canvas.width, canvas.height);
    var groundY = canvas.height - 20;
    animCtx.fillStyle = '#111'; // Ground
    animCtx.fillRect(0, groundY, canvas.width, 20);

    // Initial Positions (Angepasst für die neuen, großen Sprites)
    var startX = 15; 
    var endX = canvas.width - 100; // Boss weiter nach links, da er breiter ist
    
    // Fallback auf Dummy, falls Boss nicht geladen
    var activeBoss = simBossSprite || window.SPRITES.dummy; 

    var bearY = groundY - (window.SPRITES.bear.length * ANIM_SCALE) + 5; 
    var bossY = groundY - (activeBoss.length * ANIM_SCALE) + 5;

    // --- 1. BEAR MOVEMENT LOGIC (DASH) ---
    var curBearX = startX;
    var dashTargetX = endX - 85; // Bär stoppt genau vor der Nase des Bosses
    
    if (pct < 25) {
        var progress = pct / 25;
        curBearX = startX + (dashTargetX - startX) * progress;
    } else if (pct >= 25 && pct < 45) {
        curBearX = dashTargetX;
    } else if (pct >= 45 && pct < 70) {
        var progress = (pct - 45) / 25;
        curBearX = dashTargetX - (dashTargetX - startX) * progress;
    } else {
        curBearX = startX;
    }

    // --- 2. DRAW BOSS (With Shake) ---
    var bossShakeX = 0, bossShakeY = 0;
    if (pct >= 25 && pct < 40 && (simOutcome === 'hit' || simOutcome === 'crit')) {
        bossShakeX = (Math.random() * 6 - 3); // Stärkeres Wackeln für wuchtigere Hits
        bossShakeY = (Math.random() * 4 - 2);
    }
    drawSprite(activeBoss, endX + bossShakeX, bossY + bossShakeY);

    // --- 3. DRAW BEAR ---
    drawSprite(window.SPRITES.bear, curBearX, bearY);

    // --- 4. MELEE SWIPE EFFECT ---
    if (pct >= 25 && pct < 45 && (simOutcome === 'hit' || simOutcome === 'crit')) {
        var swipeX = endX - 25;
        var swipeY = bossY + 15;
        drawSprite(window.SPRITES.swipe, swipeX, swipeY, 6); // Swipe-Scale auf 6 fixiert
    }

    // --- 5. TEXT POPUPS ---
    if (pct >= 30) {
        var textStartX = endX - 10;
        var textStartY = (bossY - 15) - ((pct - 30) * 1.2); 
        
        var S = window.SPRITES;
        if (simOutcome === 'crit') {
            drawDiagonalText([S.txtC, S.txtR, S.txtI, S.txtT, S.txtEcl], textStartX, textStartY, 4, 2);
        } else if (simOutcome === 'miss') {
            drawDiagonalText([S.txtM, S.txtI, S.txtS, S.txtS], textStartX, textStartY, 4, 2);
        } else if (simOutcome === 'dodge') {
            drawDiagonalText([S.txtD, S.txtO, S.txtD, S.txtG, S.txtE], textStartX - 20, textStartY, 4, 2);
        } else if (simOutcome === 'parry') {
            drawDiagonalText([S.txtP, S.txtA, S.txtR, S.txtR, S.txtY], textStartX - 20, textStartY, 4, 2);
        }
    }
}

function animLoop() {
    renderAnimationFrame(animProgress);
    animReqId = requestAnimationFrame(animLoop);
}

/**
 * Shows the modal progress overlay and STARTS the animation loop.
 */
function showProgress(text) {
    var el = document.getElementById("progressOverlay");
    if (el) {
        el.classList.remove("hidden");
        var t = document.getElementById("progressText");
        if (t) t.innerText = text;
        
        var f = document.getElementById("progressFill");
        if (f) f.style.width = "0%";

        if (!animCtx) initAnimCanvas();
        animProgress = 0;
        
        // --- Determine Selected Boss Sprite ---
        var bossSel = document.getElementById("enemy_boss_select");
        simBossSprite = SPRITES.dummy; // Fallback
        if (bossSel && typeof BOSS_PRESETS !== 'undefined') {
            var bossName = BOSS_PRESETS[bossSel.value]?.name || "";
            if (bossName.includes("Magmadar")) simBossSprite = SPRITES.magmadar;
            else if (bossName.includes("Onyxia")) simBossSprite = SPRITES.onyxia;
            else if (bossName.includes("Mandokir")) simBossSprite = SPRITES.mandokir;
            else if (bossName.includes("Lashlayer")) simBossSprite = SPRITES.lashlayer;
            else if (bossName.includes("Twin")) simBossSprite = SPRITES.twinemps;
            else if (bossName.includes("Patchwerk")) simBossSprite = SPRITES.patchwerk;
            else if (bossName.includes("Maexxna")) simBossSprite = SPRITES.maexxna;
        }

        // Randomize Cosmetic Melee Outcome
        var r = Math.random();
        if (r < 0.05) simOutcome = 'crit';
        else if (r < 0.1) simOutcome = 'dodge';
        else if (r < 0.15) simOutcome = 'parry';
        else if (r < 0.2) simOutcome = 'miss';
        else simOutcome = 'hit';

        if(animReqId) cancelAnimationFrame(animReqId);
        animLoop();
    }
}

/**
 * Updates the progress state. The animation loop reads this variable.
 */
function updateProgress(pct) {
    var el = document.getElementById("progressFill");
    if (el) el.style.width = pct + "%";
    animProgress = pct;
}

/**
 * Hides the progress overlay and STOPS the animation loop.
 */
function hideProgress() {
    setTimeout(function () {
        var el = document.getElementById("progressOverlay");
        if (el) el.classList.add("hidden");
        
        if(animReqId) cancelAnimationFrame(animReqId);
        animReqId = null;
    }, 200);
}