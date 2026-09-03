/**
 * Bear Tank Simulation - File 3: Gear Planner Logic
 * Updated for the new 3-Column Char Sheet Layout
 */

var ITEM_ID_MAP = {};

async function loadDatabase() {
    console.log("[Debug] loadDatabase gestartet.");
    if (typeof showProgress === 'function') showProgress("Loading Database...");
    
    try {
        console.log("[Debug] Versuche Daten zu laden...");
        
        // KORREKTUR: items.jsonl aufrufen
        const [rItems, rEnchants] = await Promise.all([
            fetch('data/items.jsonl').catch(e => { console.warn("[Debug] Fetch Items fehlgeschlagen:", e); return { ok: false }; }),
            fetch('data/enchants.json').catch(e => { console.warn("[Debug] Fetch Enchants fehlgeschlagen:", e); return { ok: false }; })
        ]);
        
        // --- JSONL Parsing ---
        // if (rItems && rItems.ok) {
        //    const text = await rItems.text();
        //    ITEM_DB = text.split('\n')
        //        .filter(line => line.trim() !== '') // Leere Zeilen überspringen
        //        .map(line => JSON.parse(line));
        //    console.log("[Debug] items.jsonl geladen. Anzahl:", ITEM_DB.length);
        //} else {
        //    console.warn("[Debug] items.jsonl konnte nicht geladen werden.");
        //    ITEM_DB = [];
        //}
        // 1. JSONL einlesen: Als Text laden, in Zeilen aufteilen und jede Zeile parsen
        const itemsText = await rItems.text();
        const items = itemsText
            .split(/\r?\n/) // Berücksichtigt Windows (\r\n) und Linux (\n) Zeilenumbrüche
            .filter(line => line.trim() !== '') // Leere Zeilen (z.B. am Ende der Datei) ignorieren
            .map(line => JSON.parse(line)); // Jede einzelne Zeile als JSON parsen

        // ---> NEU: Dynamische Trennung von Instances und Raids <---
        const raidList = [
            "Blackwing Lair", 
            "Emerald Sanctum", 
            "Lower Karazhan Halls", 
            "Molten Core", 
            "Naxxramas",
            "Onyxia's Lair", 
            "Ruins of Ahn'Qiraj", 
            "Temple of Ahn'Qiraj", 
            "Timbermaw Hold", 
            "Upper Karazhan Halls", 
            "Zul'Gurub"
        ];

        items.forEach(item => {
            if (item.sources) {
                item.sources.forEach(src => {
                    // Wenn es als Instance deklariert ist, aber in der Raid-Liste steht -> Kategorie ändern
                    if (src.category === "Instances" && raidList.includes(src.subCategory)) {
                        src.category = "Raids";
                    }
                });
            }
        });
        
        // --- Normales JSON Parsing für Enchants ---
        if (rEnchants && rEnchants.ok) {
            ENCHANT_DB = await rEnchants.json();
        } else {
            ENCHANT_DB = [];
        }

        
        ITEM_DB = items.filter(i => {
            return true;
        });

        // Build Map for O(1) lookup
        ITEM_ID_MAP = {};
        ITEM_DB.forEach(i => { ITEM_ID_MAP[i.id] = i; });

        // ---> NEU: Dynamische Baumstruktur für den globalen Quellen-Filter erstellen
        if (typeof initSourceTree === "function") initSourceTree();
        // <---
        
        console.log("[Debug] Datenbank vorbereitet. Rufe initGearPlannerUI auf...");
        if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
        
    } catch (e) {
        console.error("[Debug] Kritischer Fehler im try-Block von loadDatabase:", e);
        if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
    } finally { 
        if (typeof hideProgress === 'function') hideProgress(); 
    }
}

function initGearPlannerUI() {
    var leftCol = document.getElementById('charLeftCol');
    var rightCol = document.getElementById('charRightCol');
    var bottomRow = document.getElementById('charBottomRow');
    
    if (!leftCol || !rightCol || !bottomRow) return;

    leftCol.innerHTML = "";
    rightCol.innerHTML = "";
    bottomRow.innerHTML = "";

    function createSlot(slotName) {
        var itemId = GEAR_SELECTION[slotName] || 0;
        var enchantId = ENCHANT_SELECTION[slotName] || 0;
        
        var item = ITEM_ID_MAP[itemId];
        var enchant = (ENCHANT_DB && ENCHANT_DB.length > 0) ? ENCHANT_DB.find(e => e.id == enchantId) : null;

        var iconUrl = item ? getIconUrl(item.icon) : "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
        var itemName = item ? item.name : slotName;
        var qClass = item ? "q" + item.quality : "q0";
        
        var scoreObj = calculateItemScore(item, slotName);
        var scoreStr = item ? "EP: " + scoreObj.ep.toFixed(1) : "Empty";
        
        var isTrinket = slotName.toLowerCase().includes("trinket");
        var enchStr = enchant ? enchant.name : "+ Enchant";
        var enchColor = enchant ? "#1eff00" : "#555";

        // Wenn es ein Trinket ist, den Klick-Event entfernen und Text ausgrauen
        var enchantHtml = isTrinket 
            ? `<span style="color:#444; cursor:not-allowed;" title="Trinkets cannot be enchanted">-</span>`
            : `<span style="color:${enchColor}; cursor:pointer;" onclick="openEnchantSelector('${slotName}')">${enchStr}</span>`;

        // Datenbank-Link generieren (nur wenn ein Item angelegt ist)
        var dbLink = item ? `<a href="https://octowow.st/db/?item=${item.id}" target="_blank" style="text-decoration:none; margin-left:6px; font-size:0.8rem; pointer-events:auto;" title="Open in OctoWoW Database" onclick="event.stopPropagation();">🔗</a>` : '';

        return `
            <div class="char-slot">
                <div class="slot-icon ${qClass}" onclick="openItemSelector('${slotName}')" 
                     onmouseenter="showTooltip(event, ${item ? item.id : 0})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)">
                    <img src="${iconUrl}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div class="slot-info">
                    <div style="display:flex; align-items:center;">
                        <div class="slot-name ${qClass}" onclick="openItemSelector('${slotName}')"
                             onmouseenter="showTooltip(event, ${item ? item.id : 0})" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)"
                             style="cursor:pointer; flex:1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                             ${itemName}
                        </div>
                        ${dbLink}
                    </div>
                    <div class="slot-stats">
                        <span title="TEP: ${scoreObj.tep.toFixed(1)} | MEP: ${scoreObj.mep.toFixed(1)}">${scoreStr}</span>
                        ${enchantHtml}
                    </div>
                </div>
            </div>
        `;
    }

    SLOT_LAYOUT.left.forEach(slot => { leftCol.innerHTML += createSlot(slot); });
    SLOT_LAYOUT.right.forEach(slot => { rightCol.innerHTML += createSlot(slot); });
    SLOT_LAYOUT.bottom.forEach(slot => { bottomRow.innerHTML += createSlot(slot); });

    calculateGearStats();
}

function getIconUrl(iconName) {
    if (!iconName) return "https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg";
    var cleanName = iconName.replace(/\\/g, "/").split("/").pop().replace(/\.jpg|\.png/g, "").toLowerCase();
    return "data/wow-icons/" + cleanName + ".jpg";
}

function calculateItemScore(item, slotNameOverride) {
    if (!item) return { ep: 0, tep: 0, mep: 0 };
    
    // TEP Weights
    var wAP = parseFloat(document.getElementById("weight_ap")?.value || 1.0);
    var wStr = parseFloat(document.getElementById("weight_str")?.value || 2.2);
    var wAgi = parseFloat(document.getElementById("weight_agi")?.value || 1.57);
    var wCrit = parseFloat(document.getElementById("weight_crit")?.value || 25.8);
    var wHit = parseFloat(document.getElementById("weight_hit")?.value || 36.1);
    var wHaste = parseFloat(document.getElementById("weight_haste")?.value || 26.6);
    var wArp = parseFloat(document.getElementById("weight_arp")?.value || 0.5);

    // MEP Weights
    var wArmor = parseFloat(document.getElementById("weight_armor")?.value || 0.33);
    var wSta = parseFloat(document.getElementById("weight_sta")?.value || 2.2);
    var wDef = parseFloat(document.getElementById("weight_def")?.value || 0.46);
    var wDodge = parseFloat(document.getElementById("weight_dodge")?.value || 0);

    var tep = 0;
    var mep = 0;
    var e = item.effects || {};

    // Base Stats aus dem Root, Effekte aus .effects - exakt wie beim Gear
    tep += (item.strength || 0) * wStr;
    tep += (item.agility || 0) * wAgi; 
    tep += (e.attackPower || 0) * wAP;
    tep += (e.crit || 0) * wCrit;
    tep += (e.Hit || 0) * wHit;
    tep += (e.attackSpeed || 0) * wHaste;
    tep += (e.armorPen || 0) * wArp;

    mep += (item.armor || 0) * wArmor;
    mep += (item.stamina || 0) * wSta;
    mep += (e.defense || 0) * wDef;
    mep += (e.dodge || 0) * wDodge;

    return { ep: (tep + mep), tep: tep, mep: mep };
}

function calculateGearStats() {
    var raceSel = document.getElementById("char_race");
    var raceName = raceSel ? raceSel.value : "Tauren";
    var race = RACE_STATS[raceName] || RACE_STATS["Tauren"];

    var bonus = { str: 0, agi: 0, sta: 0, attackPower: 0, crit: 0, hit: 0, attackSpeed: 0, armor: 0, defense: 0, dodge: 0 ,armorPen: 0};
    
    for (var slot in GEAR_SELECTION) {
        var id = GEAR_SELECTION[slot];
        if (id && ITEM_ID_MAP[id]) {
            var item = ITEM_ID_MAP[id];
            var e = item.effects || {};
            bonus.str += (item.strength || 0); 
            bonus.agi += (item.agility || 0); 
            bonus.sta += (item.stamina || 0);
            bonus.armor += (item.armor || 0) + (e.armor || 0);
            bonus.attackPower += (e.attackPower || 0); 
            bonus.crit += (e.crit || 0); 
            bonus.hit += (e.Hit || 0);
            bonus.defense += (e.defense || 0); 
            bonus.dodge += (e.dodge || 0);
            bonus.attackSpeed = (bonus.attackSpeed || 0) + (e.attackSpeed || 0);
            bonus.armorPen = (bonus.armorPen || 0) + (e.armorPen || 0);
        }
    }

    // --- NEUER CODE: Enchants mitrechnen ---
    var enchantArmor = 0;
    for (var slot in ENCHANT_SELECTION) {
        var enchId = ENCHANT_SELECTION[slot];
        if (enchId && ENCHANT_DB && ENCHANT_DB.length > 0) {
            var ench = ENCHANT_DB.find(x => x.id == enchId);
            if (ench) {
                var e = ench.effects || {};
                // Jetzt lesen wir die Base-Stats korrekt aus dem Root-Objekt des Enchants
                bonus.str += (ench.strength || 0); 
                bonus.agi += (ench.agility || 0); 
                bonus.sta += (ench.stamina || 0);
                enchantArmor += (ench.armor || 0) + (e.armor || 0);

                // Attack Power, Crit etc. aus dem effects Objekt
                bonus.attackPower += (e.attackPower || 0); 
                bonus.crit += (e.crit || 0); 
                bonus.hit += (e.Hit || 0);
                bonus.attackSpeed += (e.attackSpeed || 0); 
                bonus.defense += (e.defense || 0); 
                bonus.dodge += (e.dodge || 0);
                bonus.armorPen = (bonus.armorPen || 0) + (e.armorPen || 0);
            }
        }
    }

    // --- NEU: Set-Zählung & Spezifische Passive Boni ---
    var setCounts = {};
    for (var slot in GEAR_SELECTION) {
        var id = GEAR_SELECTION[slot];
        if (id && ITEM_ID_MAP[id] && ITEM_ID_MAP[id].setName) {
            var sName = ITEM_ID_MAP[id].setName;
            setCounts[sName] = (setCounts[sName] || 0) + 1;
        }
    }
    // Set-Boni (Stats)
    if (setCounts["Dreamwalker Harness"] >= 2) bonus.dodge += 2;
    if (setCounts["Warlord's Sanctuary"] >= 6) bonus.attackPower += 40;
    if (setCounts["Convergence of the Elements"] >= 3) bonus.hit += 1;
    
    // (Annahme: Mojo / Overlord sind als Set-Namen oder in den Items hinterlegt)
    if (setCounts["Major Mojo Infusion"] >= 2) bonus.attackPower += 30;
    if (setCounts["Overlord's Resolution"] >= 2) bonus.dodge += 1;

    // --- NEU: Consumables & Buffs ---
    var consStr = 0, consAgi = 0, consSta = 0, consAP = 0, consCrit = 0, consHaste = 0;
    var flatArmor = enchantArmor, flatHP = 0; // Skalieren nicht mit Bären-Multiplikatoren

    // Exclusives via Dropdown
    var dWeapon = document.getElementById("consum_weapon")?.value;
    if (dWeapon === "consecrated") consAP += 100;
    if (dWeapon === "elemental") consCrit += 2;

    var dZg = document.getElementById("consum_zg")?.value;
    var hasZanza = false;
    if (dZg === "spirit") { consSta += 50; hasZanza = true; }

    var dBlasted = document.getElementById("consum_blasted")?.value;
    if (dBlasted === "scorpok") consAgi += 25;
    if (dBlasted === "roids") consStr += 25;
    if (dBlasted === "lungjuice" && !hasZanza) consSta += 25; // Stacking Rule: Kein Lung Juice wenn Zanza aktiv

    var dAp = document.getElementById("consum_ap_buff")?.value;
    if (dAp === "firewater" || dAp === "blackroot") consAP += 35;
    if (dAp === "juju_might") consAP += 40;

    var dFood = document.getElementById("consum_food")?.value;
    if (dFood === "dumplings") consStr += 20;
    if (dFood === "telabim") consHaste += 2;
    if (dFood === "mushroom") consSta += 25;
    if (dFood === "berry") consAgi += 10;

    var dAlcohol = document.getElementById("consum_alcohol")?.value;
    if (dAlcohol === "merlot") consSta += 25;
    if (dAlcohol === "rumsey") consSta += 15;
    if (dAlcohol === "gordok") consSta += 10;

    // Checkboxes (Stackable)
    if (getVal("consum_flask_titan")) flatHP += 1200;
    if (getVal("consum_elixir_mongoose")) { consAgi += 25; consCrit += 2; }
    if (getVal("consum_elixir_fortitude")) flatHP += 120;
    if (getVal("consum_elixir_defense")) flatArmor += 450;
    if (getVal("consum_crystal_ward")) flatArmor += 200;
    if (getVal("consum_juju_power")) consStr += 30;
    if (getVal("consum_stoneshield")) flatArmor += 2000;

    // Addiere zur Basis-Bonus Rechnung (Str/Agi/Sta skalieren mit Kings!)
    bonus.str += consStr;
    bonus.agi += consAgi;
    bonus.sta += consSta;
    bonus.attackPower += consAP;
    bonus.crit += consCrit;
    bonus.attackSpeed = (bonus.attackSpeed || 0) + consHaste;

    if (getVal("buff_motw")) { bonus.str += 16; bonus.agi += 16; bonus.sta += 16; flatArmor += 384; }
    if (getVal("buff_might")) bonus.attackPower += 240;
    
    // NEU: Implementierung der fehlenden Turtle WoW Raid-Buffs
    if (getVal("buff_bs")) bonus.attackPower += 290;
    if (getVal("buff_fortitude")) bonus.sta += 70;
    if (getVal("buff_bloodpact")) bonus.sta += 38;
    if (getVal("buff_tsa")) bonus.attackPower += 100;
    if (getVal("buff_goa_totem")) bonus.agi += 88;

    var kingsMult = getVal("buff_kings") ? 1.10 : 1.0;

    var finalStr = Math.floor((bonus.str + race.str) * kingsMult);
    var finalAgi = Math.floor((bonus.agi + race.agi) * kingsMult); 
    

    var t = typeof TALENT_CONFIG !== 'undefined' ? TALENT_CONFIG : {};
    var hotwMult = 1.0 + ((t.heartOfTheWild || 0) * 0.04); // 4/8/12/16/20%
    var finalSta = Math.floor((bonus.sta + race.sta) * kingsMult * hotwMult);

    var taurenMod = raceName === "Tauren" ? 1.05 : 1.0;
    var direBearFlatHP = 1240;
    if (setCounts["Dreamwalker Harness"] >= 6) direBearFlatHP = Math.floor(direBearFlatHP * 1.25);
    var finalHP = Math.floor(race.baseHp + (((finalSta - race.sta) * 10) + direBearFlatHP) * taurenMod) + flatHP;

    var thVal = [0, 0.03, 0.06, 0.10][t.thickHide || 0] || 0;
    var armorMultiplier = 4.6 * (1.0 + thVal); // 4.6 Base + Thick Hide
    var finalArmor = Math.floor((bonus.armor * armorMultiplier) + (finalAgi * 2)) + flatArmor;
    
    var arr3_6_10 = [0, 0.03, 0.06, 0.10];
    var predMod = 1.0 + (arr3_6_10[t.predatoryStrikes || 0] || 0);
    var finalAP = Math.floor((160 + (finalStr * 2) + bonus.attackPower + 180) * predMod);

    var finalDefense = 300 + bonus.defense;
    var swiftnessDodge = (t.feralSwiftness || 0) * 2.0; // 2/4% Dodge
    var finalDodge = race.dodge + (finalAgi / 20.0) + ((finalDefense - 300) * 0.04) + bonus.dodge + swiftnessDodge;
    
    var sharpClawsCrit = (t.sharpenedClaws || 0) * 2.0; // 2/4/6%
    var lotpCrit = (t.leaderOfThePack || 0) * 3.0; // 3%
    var finalCrit = race.crit + (finalAgi / 20.0) + bonus.crit + sharpClawsCrit + lotpCrit; 
    
    // Natural Weapons (1/2/3% Hit in Turtle WoW)
    var finalHit = bonus.hit + (t.naturalWeapons || 0);
    var finalHaste = bonus.attackSpeed || 0;
    var finalArp = bonus.armorPen || 0;

    var isManual = document.getElementById("manual_stats") ? document.getElementById("manual_stats").checked : false;
    
    function updateInput(id, val, isPct) {
        var el = document.getElementById(id);
        if (!el) return;
        el.disabled = !isManual;
        if (!isManual) el.value = isPct ? val.toFixed(2) : Math.floor(val);
    }

    updateInput("stat_str", finalStr, false); updateInput("stat_agi", finalAgi, false); updateInput("stat_sta", finalSta, false);
    updateInput("stat_hp", finalHP, false); updateInput("stat_armor", finalArmor, false); updateInput("stat_defense", finalDefense, false);
    updateInput("stat_ap", finalAP, false); updateInput("stat_dodge", finalDodge, true); updateInput("stat_crit", finalCrit, true);
    updateInput("stat_hit", finalHit, true); updateInput("stat_haste", finalHaste, true); updateInput("stat_arp", finalArp, false);

    if(document.getElementById("gp_gs")) document.getElementById("gp_gs").innerText = Math.floor(finalHP + finalArmor + finalAP);
    if(document.getElementById("gp_str")) document.getElementById("gp_str").innerText = finalStr;
    if(document.getElementById("gp_agi")) document.getElementById("gp_agi").innerText = finalAgi;
    if(document.getElementById("gp_sta")) document.getElementById("gp_sta").innerText = finalSta;
    if(document.getElementById("gp_armor")) document.getElementById("gp_armor").innerText = finalArmor;
    if(document.getElementById("gp_hp")) document.getElementById("gp_hp").innerText = finalHP;
    if(document.getElementById("gp_def")) document.getElementById("gp_def").innerText = finalDefense;
    if(document.getElementById("gp_dodge")) document.getElementById("gp_dodge").innerText = finalDodge.toFixed(1) + "%";
    if(document.getElementById("gp_ap")) document.getElementById("gp_ap").innerText = finalAP;
    if(document.getElementById("gp_crit")) document.getElementById("gp_crit").innerText = finalCrit.toFixed(1) + "%";
    if(document.getElementById("gp_haste")) document.getElementById("gp_haste").innerText = finalHaste.toFixed(1) + "%";
    if(document.getElementById("gp_arp")) document.getElementById("gp_arp").innerText = finalArp;

    var hitEl = document.getElementById("gp_hit");
    if(hitEl) {
        hitEl.innerText = finalHit.toFixed(1) + "%";
        // NEU: Bei über 8% wird die Textfarbe auf das definierte "Rage Red" gesetzt, ansonsten weiß
        hitEl.style.color = finalHit > 8 ? "var(--rage-red)" : "#fff";
    }

    // --- NEU: Berechnung der Total EP (TEP & MEP) für das Current Gear Panel ---
    var wAP = parseFloat(document.getElementById("weight_ap")?.value || 1.0);
    var wStr = parseFloat(document.getElementById("weight_str")?.value || 2.2);
    var wAgi = parseFloat(document.getElementById("weight_agi")?.value || 1.57);
    var wCrit = parseFloat(document.getElementById("weight_crit")?.value || 25.8);
    var wHit = parseFloat(document.getElementById("weight_hit")?.value || 36.1);
    var wHaste = parseFloat(document.getElementById("weight_haste")?.value || 26.6);
    var wArp = parseFloat(document.getElementById("weight_arp")?.value || 0.5);

    var wArmor = parseFloat(document.getElementById("weight_armor")?.value || 0.33);
    var wSta = parseFloat(document.getElementById("weight_sta")?.value || 2.2);
    var wDef = parseFloat(document.getElementById("weight_def")?.value || 0.46);
    var wDodge = parseFloat(document.getElementById("weight_dodge")?.value || 0);

    // Wir nutzen das "bonus" Objekt (Gear + Enchants ohne Rassen-Base-Stats), um den echten Gear-Score zu ermitteln
    var gearTEP = (bonus.str * wStr) + (bonus.agi * wAgi) + (bonus.attackPower * wAP) + 
                  (bonus.crit * wCrit) + (bonus.hit * wHit) + ((bonus.attackSpeed||0) * wHaste) + ((bonus.armorPen||0) * wArp);
    
    var gearMEP = (bonus.armor * wArmor) + (bonus.sta * wSta) + (bonus.defense * wDef) + (bonus.dodge * wDodge);
    var gearEP = gearTEP + gearMEP;

    if(document.getElementById("gp_gs")) document.getElementById("gp_gs").innerText = gearEP.toFixed(0);
    if(document.getElementById("gp_tep")) document.getElementById("gp_tep").innerText = gearTEP.toFixed(0);
    if(document.getElementById("gp_mep")) document.getElementById("gp_mep").innerText = gearMEP.toFixed(0);

    // --- NEU: Robustes Checkbox-Update ---
    function setUIDetected(id, isActive) {
        var el = document.getElementById(id);
        if (el) el.checked = isActive;
    }

    // 1. Reset: Zuerst alle Checkboxen deaktivieren (wichtig beim Ausziehen von Items!)
    var uiElements = [
        "ui_set_veneran", "ui_set_ursa3", "ui_set_ursa5", "ui_set_stormrage5",
        "ui_set_dreamwalker6", "ui_set_dreamwalker8", "ui_set_cenarion3",
        "ui_item_obsidian", "ui_item_hoj", "ui_item_slayers", "ui_item_spider",
        "ui_item_grail", "ui_item_tooth", "ui_item_mossheart", "ui_item_whip",
        "ui_item_horn", "ui_ench_surrender", "idol_brutality"
    ];
    uiElements.forEach(id => setUIDetected(id, false));

    // 2. Set-Boni Check
    setUIDetected("ui_set_veneran", setCounts["Veneran's Sanctuary"] >= 6);
    setUIDetected("ui_set_ursa3", setCounts["Rage of the Ursa"] >= 3);
    setUIDetected("ui_set_ursa5", setCounts["Rage of the Ursa"] >= 5);
    setUIDetected("ui_set_stormrage5", setCounts["Stormrage Harness"] >= 5);
    setUIDetected("ui_set_dreamwalker6", setCounts["Dreamwalker Harness"] >= 6);
    setUIDetected("ui_set_dreamwalker8", setCounts["Dreamwalker Harness"] >= 8);
    setUIDetected("ui_set_cenarion3", setCounts["Cenarion Harness"] >= 3);

    // 3. Item Check
    Object.values(GEAR_SELECTION).forEach(gid => {
        if (!gid || !ITEM_ID_MAP[gid]) return;
        var n = ITEM_ID_MAP[gid].name.toLowerCase();
        
        if (n.includes("obsidian scale")) setUIDetected("ui_item_obsidian", true);
        if (n.includes("hand of justice")) setUIDetected("ui_item_hoj", true);
        if (n.includes("slayer's crest")) setUIDetected("ui_item_slayers", true);
        if (n.includes("kiss of the spider")) setUIDetected("ui_item_spider", true);
        if (n.includes("grail of forgotten memories")) setUIDetected("ui_item_grail", true);
        if (n.includes("tooth of the packlord")) setUIDetected("ui_item_tooth", true);
        if (n.includes("mossheart's heart")) setUIDetected("ui_item_mossheart", true);
        if (n.includes("lasher's whip")) setUIDetected("ui_item_whip", true);
        if (n.includes("horn of engryss")) setUIDetected("ui_item_horn", true);
        if (n.includes("idol of brutality")) setUIDetected("idol_brutality", true);
    });

    // 4. Enchant Check
    Object.values(ENCHANT_SELECTION).forEach(eid => {
        if (!eid || !ENCHANT_DB || ENCHANT_DB.length === 0) return;
        var ench = ENCHANT_DB.find(e => e.id == eid);
        if (ench && ench.name.toLowerCase().includes("surrender to madness")) {
            setUIDetected("ui_ench_surrender", true);
        }
    });

    // Am Ende das Update fürs Damage-Scaling (wie vorher)
    updateDamageScaling();
}

// ============================================================================
// SOURCE FILTER LOGIC (Global Multi-Level Menu)
// ============================================================================
var SOURCE_TREE = {};
var WORLD_DROPS_ENABLED = true;

function initSourceTree() {
    SOURCE_TREE = {};
    WORLD_DROPS_ENABLED = true;

    ITEM_DB.forEach(item => {
        if (!item.sources || item.sources.length === 0) {
            // World drop
        } else {
            item.sources.forEach(src => {
                let cat = src.category || "Unknown";
                let sub = src.subCategory || "Unknown";
                let det = src.detail || ""; 

                if (!SOURCE_TREE[cat]) SOURCE_TREE[cat] = {};
                if (!SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub] = {};
                if (SOURCE_TREE[cat][sub][det] === undefined) {
                    SOURCE_TREE[cat][sub][det] = true; // Default: Alles ist anwählbar
                }
            });
        }
    });
    // Menü nur noch EINMAL bauen, statt bei jedem Klick!
    buildSourceMenuDOM(); 
}

function buildSourceMenuDOM() {
    var root = document.getElementById("sourceMenuRoot");
    if (!root) return;
    root.innerHTML = "";

    // 1. Checkbox für World Drops
    root.appendChild(createMenuItem("World Drops / Other", WORLD_DROPS_ENABLED, "world", null, null, null, false));

    // 2. Checkboxen für dynamische Kategorien
    Object.keys(SOURCE_TREE).sort().forEach(cat => {
        let catNode = createMenuItem(cat, isCategoryChecked(cat), "cat", cat, null, null, true);

        let subMenu = document.createElement("ul");
        subMenu.className = "submenu";

        Object.keys(SOURCE_TREE[cat]).sort().forEach(sub => {
            let subNode = createMenuItem(sub, isSubCategoryChecked(cat, sub), "sub", cat, sub, null, true);

            let detMenu = document.createElement("ul");
            detMenu.className = "submenu";

            Object.keys(SOURCE_TREE[cat][sub]).sort().forEach(det => {
                let label = det === "" ? "General / None" : det;
                let detNode = createMenuItem(label, SOURCE_TREE[cat][sub][det], "det", cat, sub, det, false);
                detMenu.appendChild(detNode);
            });

            subNode.appendChild(detMenu);
            subMenu.appendChild(subNode);
        });

        catNode.appendChild(subMenu);
        root.appendChild(catNode);
    });
}

function createMenuItem(label, isChecked, type, cat, sub, det, hasSubmenu) {
    let li = document.createElement("li");
    if (hasSubmenu) li.className = "has-submenu";

    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "source-checkbox";
    cb.checked = isChecked;
    
    // Wir speichern die Art der Checkbox als Daten-Attribut im Element
    cb.dataset.type = type;
    if (cat !== null) cb.dataset.cat = cat;
    if (sub !== null) cb.dataset.sub = sub;
    if (det !== null) cb.dataset.det = det;

    cb.onclick = function(e) { e.stopPropagation(); }; 
    cb.onchange = function(e) {
        handleSourceChange(type, cat, sub, det, e.target.checked);
    };

    let span = document.createElement("span");
    span.innerText = label;

    li.onclick = function(e) {
        if (e.target !== cb) {
            e.stopPropagation();
            cb.checked = !cb.checked;
            handleSourceChange(type, cat, sub, det, cb.checked);
        }
    };

    li.appendChild(cb);
    li.appendChild(span);
    return li;
}

function handleSourceChange(type, cat, sub, det, isChecked) {
    // 1. Daten im Hintergrund updaten
    if (type === "world") {
        WORLD_DROPS_ENABLED = isChecked;
    } else if (type === "cat") {
        setCategory(cat, isChecked);
    } else if (type === "sub") {
        setSubCategory(cat, sub, isChecked);
    } else if (type === "det") {
        SOURCE_TREE[cat][sub][det] = isChecked;
    }

    // 2. Optische Darstellung (Haken) live anpassen OHNE das HTML zu löschen
    syncCheckboxesUI();
    
    // 3. Item Liste neu filtern, falls das Modal offen ist
    updateItemListsIfOpen();
}

function syncCheckboxesUI() {
    let checkboxes = document.querySelectorAll(".source-checkbox");
    checkboxes.forEach(cb => {
        let type = cb.dataset.type;
        let cat = cb.dataset.cat;
        let sub = cb.dataset.sub;
        let det = cb.dataset.det;

        // Reset the indeterminate state before re-evaluating
        cb.indeterminate = false;

        if (type === "world") {
            cb.checked = WORLD_DROPS_ENABLED;
        } else if (type === "cat") {
            let checkedState = getCategoryCheckState(cat);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "sub") {
            let checkedState = getSubCategoryCheckState(cat, sub);
            cb.checked = checkedState.checked;
            cb.indeterminate = checkedState.indeterminate;
        } else if (type === "det") {
            cb.checked = SOURCE_TREE[cat][sub][det];
        }
    });
}

// --- NEUE HELPER FUNKTIONEN FÜR INDETERMINATE STATUS ---

// Returnt ein Objekt: { checked: boolean, indeterminate: boolean }
function getCategoryCheckState(cat) {
    let totalSubs = 0;
    let checkedSubs = 0;
    let hasIndeterminateSub = false;

    for (let sub in SOURCE_TREE[cat]) {
        totalSubs++;
        let subState = getSubCategoryCheckState(cat, sub);
        if (subState.checked) checkedSubs++;
        if (subState.indeterminate) hasIndeterminateSub = true;
    }

    if (totalSubs === 0) return { checked: false, indeterminate: false };

    if (checkedSubs === totalSubs && !hasIndeterminateSub) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedSubs === 0 && !hasIndeterminateSub) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

function getSubCategoryCheckState(cat, sub) {
    let totalDets = 0;
    let checkedDets = 0;

    for (let det in SOURCE_TREE[cat][sub]) {
        totalDets++;
        if (SOURCE_TREE[cat][sub][det]) checkedDets++;
    }

    if (totalDets === 0) return { checked: false, indeterminate: false };

    if (checkedDets === totalDets) {
        return { checked: true, indeterminate: false }; // Alle an
    } else if (checkedDets === 0) {
        return { checked: false, indeterminate: false }; // Alle aus
    } else {
        return { checked: false, indeterminate: true }; // Teilweise
    }
}

function isCategoryChecked(cat) {
    return getCategoryCheckState(cat).checked;
}
function isSubCategoryChecked(cat, sub) {
    return getSubCategoryCheckState(cat, sub).checked;
}

function setCategory(cat, val) {
    for (let sub in SOURCE_TREE[cat]) setSubCategory(cat, sub, val);
}
function setSubCategory(cat, sub, val) {
    for (let det in SOURCE_TREE[cat][sub]) SOURCE_TREE[cat][sub][det] = val;
}

function updateItemListsIfOpen() {
    var modal = document.getElementById("itemSelectorModal");
    if (modal && !modal.classList.contains("hidden")) {
        // Da openItemSelector validItems generiert, rufen wir dies statt filterItemList auf
        var currentSlotTitle = document.getElementById("modalTitle").innerText.replace("Select Item: ", "");
        openItemSelector(currentSlotTitle, currentItemSort);
    }
}

function toggleSourceMenu(e) {
    if(e) e.stopPropagation();
    var menu = document.getElementById("sourceMenuRoot");
    menu.style.display = (menu.style.display === "none" || menu.style.display === "") ? "block" : "none";
}

document.addEventListener("click", function(e) {
    var menu = document.getElementById("sourceMenuRoot");
    var btn = document.getElementById("sourceMenuBtn");
    if (menu && menu.style.display === "block") {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.style.display = "none";
        }
    }
});

// ============================================================================
// PHASE PRESET LOGIC
// ============================================================================
function applyPhasePreset(phase) {
    if (!SOURCE_TREE) return;

    // Reset all to false first
    WORLD_DROPS_ENABLED = false;
    for (let cat in SOURCE_TREE) {
        for (let sub in SOURCE_TREE[cat]) {
            for (let det in SOURCE_TREE[cat][sub]) {
                SOURCE_TREE[cat][sub][det] = false;
            }
        }
    }

    if (phase === "all") {
        WORLD_DROPS_ENABLED = true;
        for (let cat in SOURCE_TREE) {
            for (let sub in SOURCE_TREE[cat]) {
                for (let det in SOURCE_TREE[cat][sub]) {
                    SOURCE_TREE[cat][sub][det] = true;
                }
            }
        }
    } else {
        WORLD_DROPS_ENABLED = true;
        let allowedRaids = [];
        let p = parseInt(phase);
        
        if (p >= 0) allowedRaids.push("Lower Karazhan Halls", "Onyxia's Lair", "Molten Core");
        if (p >= 1) allowedRaids.push("Zul'Gurub");
        if (p >= 2) allowedRaids.push("Blackwing Lair");
        if (p >= 3) allowedRaids.push("Emerald Sanctum");
        if (p >= 4) allowedRaids.push("Ruins of Ahn'Qiraj", "Temple of Ahn'Qiraj");
        if (p >= 5) allowedRaids.push("Timbermaw Hold");
        if (p >= 6) allowedRaids.push("Naxxramas");
        if (p >= 7) allowedRaids.push("Upper Karazhan Halls");

        for (let cat in SOURCE_TREE) {
            for (let sub in SOURCE_TREE[cat]) {
                if (cat === "Raids") {
                    if (allowedRaids.includes(sub)) {
                        for (let det in SOURCE_TREE[cat][sub]) {
                            SOURCE_TREE[cat][sub][det] = true;
                        }
                    }
                } else {
                    // Enable everything else (Crafting, PvP, Quests, Dungeons...)
                    for (let det in SOURCE_TREE[cat][sub]) {
                        SOURCE_TREE[cat][sub][det] = true;
                    }
                }
            }
        }
    }

    syncCheckboxesUI();
    updateItemListsIfOpen();
}