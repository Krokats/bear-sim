/**
 * Bear Tank Simulation - File 4: UI Manager
 * Drag & Drop Builder and Application Logic
 */

// ============================================================================
// STUBS & HELPERS
// ============================================================================
function recalcItemScores() { if (typeof initGearPlannerUI === 'function') initGearPlannerUI(); }
function closeItemModal() { document.getElementById("itemSelectorModal").classList.add("hidden"); }

// Hilfsfunktion für das DB-Slot Mapping
function getDbSlots(uiSlotName) {
    if (uiSlotName.includes("Finger") || uiSlotName.includes("Ring")) return ["Finger"];
    if (uiSlotName.includes("Trinket")) return ["Trinket"];
    if (uiSlotName === "Main Hand" || uiSlotName === "Weapon") return ["One-hand", "Two-hand", "Main Hand"];
    if (uiSlotName === "Off Hand") return ["Held In Off-Hand", "Shield"];
    if (uiSlotName === "Idol") return ["Relic", "Idol"];
    return [uiSlotName]; // Fallback für Head, Neck, Chest etc.
}


// --- NEU: Globale Variablen für den Waffen-Filter ---
var MH_FILTER_ONE = true;
var MH_FILTER_TWO = true;

// Helper für das rote Leuchten des Buttons
function getFilterBtnStyle(isActive) {
    return isActive 
        ? "background: var(--rage-red); color: #fff; border-color: var(--rage-red); box-shadow: 0 0 8px rgba(229,57,53,0.4);" 
        : "";
}

// Toggle-Funktion für die Buttons
window.toggleMHFilter = function(type) {
    if (type === 'one') MH_FILTER_ONE = !MH_FILTER_ONE;
    if (type === 'two') MH_FILTER_TWO = !MH_FILTER_TWO;
    
    // Optik der Buttons live anpassen
    var btnOne = document.getElementById("btn_filter_one");
    var btnTwo = document.getElementById("btn_filter_two");
    
    if (btnOne) btnOne.style.cssText = getFilterBtnStyle(MH_FILTER_ONE);
    if (btnTwo) btnTwo.style.cssText = getFilterBtnStyle(MH_FILTER_TWO);
    
    // Liste sofort filtern
    filterItemList();
};

var currentItemSort = 'ep';

function openItemSelector(slotName, sortOverride) {
    if (sortOverride) currentItemSort = sortOverride;

    var modal = document.getElementById("itemSelectorModal");
    var listContainer = document.getElementById("modalItemList");
    var title = document.getElementById("modalTitle");
    
    if(!modal || !listContainer) return;
    
    title.innerText = "Select Item: " + slotName;
    listContainer.innerHTML = "";
    
    var currentItemId = GEAR_SELECTION[slotName] || 0;
    var currentScore = calculateItemScore(ITEM_ID_MAP[currentItemId], slotName);
    
    // Slot Mapping anwenden
    var allowedDbSlots = getDbSlots(slotName);
    
    var validItems = ITEM_DB.filter(i => {
        if (!allowedDbSlots.includes(i.slot)) return false;
        if (i.unique) {
            for (var eqSlot in GEAR_SELECTION) {
                if (eqSlot !== slotName && GEAR_SELECTION[eqSlot] === i.id) return false;
            }
        }

        // --- SOURCE FILTER LOGIK ---
        let isSourceEnabled = false;
        if (!i.sources || i.sources.length === 0) {
            isSourceEnabled = WORLD_DROPS_ENABLED;
        } else {
            // Checkt, ob mindestens EINE Quelle des Items im Filter aktiv ist
            isSourceEnabled = i.sources.some(function(src) {
                let cat = src.category || "Unknown";
                let sub = src.subCategory || "Unknown";
                let det = src.detail || "";
                
                if (SOURCE_TREE[cat] && SOURCE_TREE[cat][sub] && SOURCE_TREE[cat][sub][det] !== undefined) {
                    return SOURCE_TREE[cat][sub][det] === true;
                }
                return true;
            });
        }

        return isSourceEnabled;
    });

    validItems.sort((a, b) => {
        var scoreA = calculateItemScore(a, slotName);
        var scoreB = calculateItemScore(b, slotName);
        return scoreB[currentItemSort] - scoreA[currentItemSort];
    });

    function getBtnStyle(sortType) {
        return currentItemSort === sortType 
            ? "background: var(--rage-red); color: #fff; border-color: var(--rage-red); box-shadow: 0 0 8px rgba(229,57,53,0.4);" 
            : "";
    }
    
    // Extra Filter für Waffen
    var extraFilters = "";
    if (slotName === "Main Hand") {
        extraFilters = `
            <div style="display:flex; gap:10px; padding: 6px 10px; background:rgba(0,0,0,0.3); border-bottom:1px solid #333; justify-content: center; align-items: center;">
                <span style="color:#aaa; font-size:0.8rem; font-weight:bold; margin-right:5px;">Filter:</span>
                <button id="btn_filter_one" class="btn-mini" style="${getFilterBtnStyle(MH_FILTER_ONE)}" onclick="toggleMHFilter('one')">One-Hand / Main Hand</button>
                <button id="btn_filter_two" class="btn-mini" style="${getFilterBtnStyle(MH_FILTER_TWO)}" onclick="toggleMHFilter('two')">Two-Hand</button>
            </div>
        `;
    }

    var html = `
        <div style="position: sticky; top: -10px; z-index: 10; background: var(--card-bg); margin: -10px -10px 10px -10px; border-bottom: 1px solid #333; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
            <div style="display:flex; gap:10px; padding:10px; border-bottom:1px solid #333; background:rgba(0,0,0,0.4);">
                <button class="btn-mini" style="${getBtnStyle('ep')}" onclick="openItemSelector('${slotName}', 'ep')">Sort: EP</button>
                <button class="btn-mini" style="${getBtnStyle('tep')}" onclick="openItemSelector('${slotName}', 'tep')">Sort: TEP</button>
                <button class="btn-mini" style="${getBtnStyle('mep')}" onclick="openItemSelector('${slotName}', 'mep')">Sort: MEP</button>
            </div>
            ${extraFilters}
            <div class="modal-list-item" onclick="selectItem('${slotName}', 0)" style="padding: 10px; cursor: pointer; display: flex; transition: background 0.2s;" onmouseover="this.style.background='#2a2a2a'" onmouseout="this.style.background='transparent'">
                <div style="flex:1; color: #aaa; font-weight: bold; text-align: center;">Unequip / None</div>
            </div>
        </div>`;

    function formatDiff(val, label) {
        if (val > 0) return `<span style="color:#a5d6a7; font-weight:bold;">(+${val.toFixed(1)} ${label})</span>`;
        if (val < 0) return `<span style="color:#ef5350;">(${val.toFixed(1)} ${label})</span>`;
        return `<span style="color:#888;">(= 0 ${label})</span>`;
    }

    validItems.forEach(item => {
        var score = calculateItemScore(item, slotName);
        var diffStr = "";
        if (currentItemId !== 0) {
            var diffEp = score.ep - currentScore.ep;
            var diffTep = score.tep - currentScore.tep;
            var diffMep = score.mep - currentScore.mep;
            diffStr = `<div style="margin-top: 5px; font-size: 0.85rem;">
                           ${formatDiff(diffEp, 'EP')} 
                           <span style="font-size:0.75rem; color:#666; margin-left: 5px;">[ ${formatDiff(diffTep, 'TEP')} | ${formatDiff(diffMep, 'MEP')} ]</span>
                       </div>`;
        }

        var qClass = "q" + (item.quality || 1);
        var iconUrl = getIconUrl(item.icon);
        
        html += `<div class="modal-list-item" data-slot="${item.slot || ''}" onclick="selectItem('${slotName}', ${item.id})" 
                    onmouseenter="showTooltip(event, ${item.id}, 'item')" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)"
                    style="padding: 10px; border-bottom: 1px solid #333; cursor: pointer; display: flex; align-items: center;">
                    <img src="${iconUrl}" style="width:36px; height:36px; border-radius:4px; margin-right:12px; border: 1px solid #444;">
                    <div style="flex:1;">
                        <div style="display:flex; align-items:center; margin-bottom: 2px;">
                            <strong class="${qClass}" style="font-size: 0.95rem;">${item.name}</strong>
                        </div>
                        <div style="font-size:0.8rem; color:#888;">
                            EP: <span style="color:#ffb74d; font-weight:bold;">${score.ep.toFixed(1)}</span> <span style="font-size:0.7rem; color:#666;">(TEP: ${score.tep.toFixed(1)} | MEP: ${score.mep.toFixed(1)})</span>
                        </div>
                        ${diffStr}
                    </div>
                 </div>`;
    });

    listContainer.innerHTML = html;
    modal.classList.remove("hidden");
    filterItemList();
}

function filterItemList() {
    var input = document.getElementById("itemSearchInput");
    if (!input) return;
    
    var filter = input.value.toLowerCase();
    var listContainer = document.getElementById("modalItemList");
    var items = listContainer.getElementsByClassName("modal-list-item");

    var hasWeaponFilter = document.getElementById("btn_filter_one") !== null;

    for (var i = 0; i < items.length; i++) {
        if (items[i].innerText.includes("Unequip / None")) {
            items[i].style.display = "flex";
            continue;
        }

        var text = items[i].textContent || items[i].innerText;
        var itemSlot = items[i].getAttribute("data-slot") || "";
        
        var matchText = text.toLowerCase().indexOf(filter) > -1;
        var matchSlot = true;

        if (hasWeaponFilter) {
            if (itemSlot === "Two-hand") {
                matchSlot = MH_FILTER_TWO;
            } else if (itemSlot === "One-hand" || itemSlot === "Main Hand") {
                matchSlot = MH_FILTER_ONE;
            }
        }

        if (matchText && matchSlot) {
            items[i].style.display = "flex"; 
        } else {
            items[i].style.display = "none";
        }
    }
}


// ============================================================================
// TOOLTIP LOGIC
// ============================================================================
function getItemColor(quality) {
    var colors = {
        0: '#9d9d9d', // Poor
        1: '#ffffff', // Common
        2: '#1eff00', // Uncommon
        3: '#0070dd', // Rare
        4: '#a335ee', // Epic
        5: '#ff8000', // Legendary
        6: '#e6cc80'  // Artifact
    };
    return colors[quality] || '#ffffff';
}

function showTooltip(e, id, type = 'item') {
    if (!id || id === 0) return;

    if (type === 'enchant') {
        return showEnchantTooltip(e, id);
    }

    var item = ITEM_ID_MAP[id];
    if (!item) return;

    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.display = "block";

    var qualityColor = getItemColor(item.quality);
    var iconUrl = getIconUrl(item.icon);

    var html = '<div class="tt-header"><div class="tt-icon-small" style="background-image:url(\'' + iconUrl + '\')"></div><div style="flex:1"><div class="tt-name" style="color:' + qualityColor + '; font-size:1.1rem; font-weight:bold;">' + item.name + '</div></div></div>';

    if (item.requiredLevel) html += '<div style="color: #ffffff;">Requires Level ' + item.requiredLevel + '</div>';

    if (item.slot) {
        html += '<div style="color: #ffffff; display:flex; justify-content:space-between;">';
        html += '<span>' + item.slot + '</span>';
        var typeText = item.armorType || item.weaponType || "";
        if (typeText) html += '<span>' + typeText + '</span>';
        html += '</div>';
    }

    if (item.armor) html += '<div style="color: #ffffff;">' + item.armor + ' Armor</div>';

    // STATS 
    var statsHtml = '';
    if (item.stamina) statsHtml += '<div style="color: #ffffff;">+' + item.stamina + ' Stamina</div>';
    if (item.intellect) statsHtml += '<div style="color: #ffffff;">+' + item.intellect + ' Intellect</div>';
    if (item.spirit) statsHtml += '<div style="color: #ffffff;">+' + item.spirit + ' Spirit</div>';
    if (item.agility) statsHtml += '<div style="color: #ffffff;">+' + item.agility + ' Agility</div>';
    if (item.strength) statsHtml += '<div style="color: #ffffff;">+' + item.strength + ' Strength</div>';
    
    if (statsHtml !== '') {
        html += '<div style="margin-top: 5px;"></div>';
        html += statsHtml;
    }

    // RESISTS 
    var resHtml = '';
    if (item.fireRes) resHtml += '<div style="color: #ffffff;">+' + item.fireRes + ' Fire Resistance</div>';
    if (item.natureRes) resHtml += '<div style="color: #ffffff;">+' + item.natureRes + ' Nature Resistance</div>';
    if (item.frostRes) resHtml += '<div style="color: #ffffff;">+' + item.frostRes + ' Frost Resistance</div>';
    if (item.shadowRes) resHtml += '<div style="color: #ffffff;">+' + item.shadowRes + ' Shadow Resistance</div>';
    if (item.arcaneRes) resHtml += '<div style="color: #ffffff;">+' + item.arcaneRes + ' Arcane Resistance</div>';

    if (resHtml !== '') {
        html += '<div style="margin-top: 5px;"></div>';
        html += resHtml;
    }

    // EFFECTS 
    var effectsHtml = '';
    if (item.effects) {
        var eff = item.effects;
        if (eff.custom && Array.isArray(eff.custom)) {
            eff.custom.forEach(function (line) {
                effectsHtml += '<div style="color: #1eff00;">' + line + '</div>';
            });
        }
        if (eff.attackPower && effectsHtml.indexOf("Attack Power") === -1) effectsHtml += '<div style="color: #1eff00;">Equip: +' + eff.attackPower + ' Attack Power.</div>';
        if (eff.crit && effectsHtml.indexOf("critical strike") === -1) effectsHtml += '<div style="color: #1eff00;">Equip: Improves your chance to get a critical strike by ' + eff.crit + '%.</div>';
        if (eff.Hit && effectsHtml.indexOf("hit") === -1) effectsHtml += '<div style="color: #1eff00;">Equip: Improves your chance to hit by ' + eff.Hit + '%.</div>';
        if (eff.dodge && effectsHtml.indexOf("dodge") === -1) effectsHtml += '<div style="color: #1eff00;">Equip: Increases your chance to dodge by ' + eff.dodge + '%.</div>';
        if (eff.defense && effectsHtml.indexOf("Defense") === -1) effectsHtml += '<div style="color: #1eff00;">Equip: Increased Defense +' + eff.defense + '.</div>';
    }

    if (effectsHtml !== '') {
        html += '<div style="margin-top: 5px;"></div>';
        html += effectsHtml;
    }

    // SET INFO
    if (item.setName) {
        html += '<div style="margin-top: 5px;"></div>';
        
        var siblings = ITEM_DB.filter(function (i) { return i.setName === item.setName; });
        var equippedCount = 0;
        for (var slot in GEAR_SELECTION) {
            var gid = GEAR_SELECTION[slot];
            if (gid && (typeof gid === 'number' || typeof gid === 'string') && gid != 0) {
                var gItem = ITEM_ID_MAP[gid];
                if (gItem && gItem.setName === item.setName) equippedCount++;
            }
        }
        
        html += '<div style="color: #ffd100;">' + item.setName + ' (' + equippedCount + '/' + siblings.length + ')</div>';
        
        siblings.forEach(function (sItem) {
            var isEquipped = false;
            for (var slot in GEAR_SELECTION) {
                if (GEAR_SELECTION[slot] == sItem.id) isEquipped = true;
            }
            var color = isEquipped ? '#e0e0e0' : '#808080';
            html += '<div style="color:' + color + '; margin-left:10px;">' + sItem.name + '</div>';
        });
        
        html += '<div style="margin-top: 5px;"></div>';
        
        if (item.setBonuses) {
            if (typeof item.setBonuses === 'object' && !Array.isArray(item.setBonuses)) {
                var keys = Object.keys(item.setBonuses).sort(function (a, b) { return a - b });
                keys.forEach(function (thresholdStr) {
                    var threshold = parseInt(thresholdStr);
                    var bonusData = item.setBonuses[thresholdStr];
                    var isActive = (equippedCount >= threshold);
                    
                    var color = isActive ? '#1eff00' : '#808080'; 

                    if (bonusData.custom && Array.isArray(bonusData.custom)) {
                        bonusData.custom.forEach(function (c) { html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + c + '</div>'; });
                    }
                    else {
                        var parts = [];
                        if (bonusData.attackPower) parts.push("+" + bonusData.attackPower + " AP");
                        if (bonusData.crit) parts.push(bonusData.crit + "% Crit");
                        if (parts.length > 0) html += '<div style="color:' + color + '">(' + threshold + ') Set: ' + parts.join(", ") + '</div>';
                    }
                });
            } else if (Array.isArray(item.setBonuses)) {
                item.setBonuses.forEach(function (bonusText) {
                    var threshold = 0;
                    var match = bonusText.match(/^(\d+)|\((\d+)\)/);
                    if (match) threshold = parseInt(match[1] || match[2]);
                    var isActive = (threshold > 0) ? (equippedCount >= threshold) : false;
                    var color = isActive ? '#1eff00' : '#808080';
                    html += '<div style="color:' + color + '">' + bonusText + '</div>';
                });
            }
        }
    }

    // EP FOOTER
    var score = calculateItemScore(item, item.slot || 'Item');
    html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin:8px 0;">';
    html += '<div style="color:#ffb74d; font-weight:bold; font-size: 0.95rem;">Total EP: ' + score.ep.toFixed(1) + '</div>';
    html += '<div style="font-size:0.8rem; color:#aaa;">TEP: <span style="color:#ef5350;">' + score.tep.toFixed(1) + '</span> | MEP: <span style="color:#90caf9;">' + score.mep.toFixed(1) + '</span></div>';

    // Source Info 
    if (item.sources && item.sources.length > 0) {
        html += '<div class="tt-spacer"></div>';
        html += '<div class="tt-white" style="color: #00ccff;">Sources:</div>';
        
        item.sources.forEach(function(src) {
            var srcText = "";
            if (src.category) srcText += src.category;
            if (src.subCategory) srcText += (srcText ? " > " : "") + src.subCategory;
            if (src.detail) srcText += (srcText ? " > " : "") + src.detail;
            
            html += '<div class="tt-white" style="margin-left:10px; color: #88ccff;">' + srcText + '</div>';
        });
    }

    tt.innerHTML = html;
    moveTooltip(e);
}

// Enchant Tooltip 
function showEnchantTooltip(e, enchantId) {
    if (!enchantId || enchantId === 0) return;
    var ench = (typeof ENCHANT_DB !== 'undefined' ? ENCHANT_DB : []).find(x => x.id == enchantId);
    if (!ench) return;

    var tt = document.getElementById("wowTooltip");
    if (!tt) return;
    tt.style.display = "block";

    var html = '<div class="tt-header"><div style="flex:1"><div class="tt-name" style="color:#1eff00; font-weight:bold; font-size:1.1rem;">' + ench.name + '</div></div></div>';
    html += '<div style="color: #ffffff;">Enchant</div>';
    html += '<div style="margin-top: 5px;"></div>';

    if (ench.text) {
        html += '<div style="color: #1eff00;">' + ench.text + '</div>';
    } else if (ench.effects) {
        var ef = ench.effects;
        if (ef.spellPower) html += '<div style="color: #1eff00;">+' + ef.spellPower + ' Spell Power</div>';
        if (ef.intellect) html += '<div style="color: #1eff00;">+' + ef.intellect + ' Intellect</div>';
        if (ef.attackPower) html += '<div style="color: #1eff00;">+' + ef.attackPower + ' Attack Power</div>';
        if (ef.stamina) html += '<div style="color: #1eff00;">+' + ef.stamina + ' Stamina</div>';
        if (ef.strength) html += '<div style="color: #1eff00;">+' + ef.strength + ' Strength</div>';
        if (ef.agility) html += '<div style="color: #1eff00;">+' + ef.agility + ' Agility</div>';
    }

    var score = calculateItemScore(ench, 'Enchant');
    html += '<hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin:8px 0;">';
    html += '<div style="color:#ffb74d; font-weight:bold; font-size: 0.95rem;">Total EP: ' + score.ep.toFixed(1) + '</div>';
    html += '<div style="font-size:0.8rem; color:#aaa;">TEP: <span style="color:#ef5350;">' + score.tep.toFixed(1) + '</span> | MEP: <span style="color:#90caf9;">' + score.mep.toFixed(1) + '</span></div>';

    tt.innerHTML = html;
    moveTooltip(e);
}

function moveTooltip(e) {
    var tt = document.getElementById("wowTooltip");
    if (!tt) return;

    tt.style.position = "fixed";

    var width = tt.offsetWidth;
    var height = tt.offsetHeight;

    var x = e.clientX + 15;
    var y = e.clientY + 15;

    if (x + width > window.innerWidth) {
        x = e.clientX - width - 15;
    }

    if (y + height > window.innerHeight) {
        var yUp = e.clientY - height - 15;
        if (yUp < 0) {
            y = 10; 
        } else {
            y = yUp;
        }
    }

    tt.style.left = x + "px";
    tt.style.top = y + "px";
}

function hideTooltip() {
    var tt = document.getElementById("wowTooltip");
    if (tt) tt.style.display = "none";
}

function selectItem(slotName, itemId) {
    GEAR_SELECTION[slotName] = itemId;

    if (itemId !== 0 && ITEM_ID_MAP[itemId]) {
        var item = ITEM_ID_MAP[itemId];
        
        if (slotName === "Main Hand" && item.slot === "Two-hand") {
            GEAR_SELECTION["Off Hand"] = 0;
        } else if (slotName === "Off Hand") {
            var mhId = GEAR_SELECTION["Main Hand"];
            if (mhId && ITEM_ID_MAP[mhId] && ITEM_ID_MAP[mhId].slot === "Two-hand") {
                GEAR_SELECTION["Main Hand"] = 0; 
            }
        }
    }

    closeItemModal();
    initGearPlannerUI(); 
}

// ============================================================================
// ENCHANT SELECTOR MODAL
// ============================================================================

function openEnchantSelector(slotName, sortOverride) {
    if (sortOverride) currentItemSort = sortOverride;

    var modal = document.getElementById("enchantSelectorModal");
    var listContainer = document.getElementById("modalEnchantList");
    var title = document.getElementById("enchantModalTitle");
    
    if(!modal || !listContainer) return;
    
    title.innerText = "Select Enchant: " + slotName;
    listContainer.innerHTML = "";
    
    var allowedDbSlots = getDbSlots(slotName);
    var validEnchants = ENCHANT_DB.filter(e => allowedDbSlots.includes(e.slot));

    validEnchants.sort((a, b) => {
        var scoreA = calculateItemScore(a, slotName);
        var scoreB = calculateItemScore(b, slotName);
        return scoreB[currentItemSort] - scoreA[currentItemSort];
    });

    function getBtnStyle(sortType) {
        return currentItemSort === sortType 
            ? "background: var(--rage-red); color: #fff; border-color: var(--rage-red); box-shadow: 0 0 8px rgba(229,57,53,0.4);" 
            : "";
    }

    var html = `
        <div style="position: sticky; top: -10px; z-index: 10; background: var(--card-bg); margin: -10px -10px 10px -10px; border-bottom: 1px solid #333; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
            <div style="display:flex; gap:10px; padding:10px; border-bottom:1px solid #333; background:rgba(0,0,0,0.3);">
                <button class="btn-mini" style="${getBtnStyle('ep')}" onclick="openEnchantSelector('${slotName}', 'ep')">Sort: EP</button>
                <button class="btn-mini" style="${getBtnStyle('tep')}" onclick="openEnchantSelector('${slotName}', 'tep')">Sort: TEP</button>
                <button class="btn-mini" style="${getBtnStyle('mep')}" onclick="openEnchantSelector('${slotName}', 'mep')">Sort: MEP</button>
            </div>
            <div class="modal-list-item" onclick="selectEnchant('${slotName}', 0)" style="padding: 10px; cursor: pointer; display: flex; transition: background 0.2s;" onmouseover="this.style.background='#2a2a2a'" onmouseout="this.style.background='transparent'">
                <div style="flex:1; color: #aaa; font-weight: bold; text-align: center;">Remove Enchant / None</div>
            </div>
        </div>`;

    validEnchants.forEach(ench => {
        var score = calculateItemScore(ench, slotName);
        var qClass = "q" + (ench.quality || 2);
        var iconUrl = ench.icon ? getIconUrl(ench.icon) : "https://wow.zamimg.com/images/wow/icons/large/trade_engraving.jpg";
        
        html += `<div class="modal-list-item" onclick="selectEnchant('${slotName}', ${ench.id})" 
                    onmouseenter="showTooltip(event, ${ench.id}, 'enchant')" onmouseleave="hideTooltip()" onmousemove="moveTooltip(event)"
                    style="padding: 10px; border-bottom: 1px solid #333; cursor: pointer; display: flex; align-items: center;">
                    <img src="${iconUrl}" style="width:36px; height:36px; border-radius:4px; margin-right:12px; border: 1px solid #444;">
                    <div style="flex:1;">
                        <div style="display:flex; align-items:center; margin-bottom: 2px;">
                            <strong class="${qClass}" style="font-size: 0.95rem;">${ench.name}</strong>
                        </div>
                        <div style="font-size:0.8rem; color:#888;">
                            EP: <span style="color:#ffb74d; font-weight:bold;">${score.ep.toFixed(1)}</span> <span style="font-size:0.7rem; color:#666;">(TEP: ${score.tep.toFixed(1)} | MEP: ${score.mep.toFixed(1)})</span>
                        </div>
                    </div>
                 </div>`;
    });

    listContainer.innerHTML = html;
    modal.classList.remove("hidden");
}

function selectEnchant(slotName, enchantId) {
    ENCHANT_SELECTION[slotName] = enchantId;
    closeEnchantModal();
    initGearPlannerUI(); 
}

function closeItemModal() { document.getElementById("itemSelectorModal").classList.add("hidden"); }
function closeEnchantModal() { document.getElementById("enchantSelectorModal").classList.add("hidden"); }


// ============================================================================
// SIDEBAR & MULTI-SIM MANAGEMENT
// ============================================================================
var IS_LOADING = false;

function renderSidebar() {
    var sb = document.getElementById("sidebar");
    if (!sb) return;
    sb.innerHTML = "";

    var btnOv = document.createElement("div");
    btnOv.className = "sidebar-btn btn-overview" + (CURRENT_VIEW === 'comparison' ? " active" : "");
    btnOv.innerHTML = "☰";
    btnOv.title = "Simulation Overview";
    btnOv.onclick = function () { showComparisonView(); };
    sb.appendChild(btnOv);

    var sep = document.createElement("div");
    sep.className = "sidebar-separator";
    sb.appendChild(sep);

    SIM_LIST.forEach(function (sim, idx) {
        var btn = document.createElement("div");
        btn.className = "sidebar-btn" + (CURRENT_VIEW !== 'comparison' && ACTIVE_SIM_INDEX === idx ? " active" : "");

        var label = sim.name;
        if (label.length > 2 && isNaN(label)) {
            label = label.substring(0, 2).toUpperCase();
        }

        btn.innerText = (idx + 1).toString(); 
        btn.title = sim.name;
        btn.onclick = function () { switchSim(idx); };
        sb.appendChild(btn);
    });

    var btnAdd = document.createElement("div");
    btnAdd.className = "sidebar-btn btn-add";
    btnAdd.innerText = "+";
    btnAdd.title = "Add Simulation";
    btnAdd.onclick = function () { addSim(); };
    sb.appendChild(btnAdd);
}

function addSim(isInit) {
    var id = Date.now();
    var newName = "Simulation " + (SIM_LIST.length + 1);

    var newConfig = {};
    var newGear = {};
    var newEnchants = {};

    if (!isInit && SIM_LIST.length > 0) {
        newConfig = getCurrentConfigFromUI();
        newGear = JSON.parse(JSON.stringify(GEAR_SELECTION));
        newEnchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
    } else {
        newConfig = typeof getSimInputs === "function" ? getSimInputs() : {};
    }

    var newSim = new SimObject(id, newName);
    newSim.config = newConfig;
    newSim.gear = newGear;
    newSim.enchants = newEnchants;

    SIM_LIST.push(newSim);
    switchSim(SIM_LIST.length - 1);
}

function switchSim(index, skipSave) {
    if (index < 0 || index >= SIM_LIST.length) return;

    if (!skipSave && !IS_LOADING && CURRENT_VIEW === 'single' && SIM_LIST[ACTIVE_SIM_INDEX]) {
        saveCurrentState();
    }

    ACTIVE_SIM_INDEX = index;
    CURRENT_VIEW = 'single';
    SIM_DATA = SIM_LIST[index];

    if (SIM_DATA && SIM_DATA.config) {
        applyConfigToUI(SIM_DATA.config, SIM_DATA.gear, SIM_DATA.enchants);
    }

    var nameInput = document.getElementById("simName");
    if (nameInput) nameInput.value = SIM_DATA.name;

    var compView = document.getElementById("comparisonView");
    var singleView = document.getElementById("singleSimView");
    if (compView) compView.classList.add("hidden");
    if (singleView) singleView.classList.remove("hidden");

    renderSidebar();

    var resArea = document.getElementById("resultsArea");
    var placeholder = document.getElementById("simPlaceholder");

    if (!SIM_DATA.results) {
        if(resArea) resArea.classList.add("hidden");
        if(placeholder) placeholder.classList.remove("hidden");
        
        if(document.getElementById("res_tps")) document.getElementById("res_tps").innerText = "0.0";
        if(document.getElementById("res_ehp")) document.getElementById("res_ehp").innerText = "0";
        if(document.getElementById("res_dtps")) document.getElementById("res_dtps").innerText = "0.0";
        if(document.getElementById("res_dps")) document.getElementById("res_dps").innerText = "0.0";
        if(document.getElementById("logTableBody")) document.getElementById("logTableBody").innerHTML = "";
    } else {
        if(placeholder) placeholder.classList.add("hidden");
        if(resArea) resArea.classList.remove("hidden");
        if (typeof renderResults === 'function') renderResults();
    }
    
    var wRes = document.getElementById("weightResults");
    if (wRes) {
        if (SIM_DATA.weightResultsHTML) {
            wRes.innerHTML = SIM_DATA.weightResultsHTML;
            wRes.classList.remove("hidden");
            window.latestSimWeights = SIM_DATA.latestSimWeights; 
        } else {
            wRes.innerHTML = "";
            wRes.classList.add("hidden");
            window.latestSimWeights = null;
        }
    }
}

function deleteSim(index) {
    if (SIM_LIST.length <= 1) {
        if(typeof showToast === 'function') showToast("Cannot delete the last simulation.");
        return;
    }
    
    if (confirm("Delete " + SIM_LIST[index].name + "?")) {
        SIM_LIST.splice(index, 1);
        if (ACTIVE_SIM_INDEX >= SIM_LIST.length) ACTIVE_SIM_INDEX = SIM_LIST.length - 1;
        
        if (CURRENT_VIEW === 'comparison') {
            renderComparisonTable();
            renderSidebar();
        } else {
            switchSim(ACTIVE_SIM_INDEX);
        }
    }
}

function updateSimName() {
    var el = document.getElementById("simName");
    if (el && SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].name = el.value;
        renderSidebar(); 
    }
}

// ============================================================================
// COMPARISON VIEW LOGIC
// ============================================================================

function showComparisonView() {
    if (CURRENT_VIEW === 'single' && SIM_LIST[ACTIVE_SIM_INDEX]) {
        saveCurrentState();
    }

    CURRENT_VIEW = 'comparison';
    document.getElementById("singleSimView").classList.add("hidden");
    document.getElementById("comparisonView").classList.remove("hidden");

    renderComparisonTable();
    renderSidebar();
}

function getSavedStat(sim, id) {
    if (sim.config && sim.config[id] !== undefined) return sim.config[id];
    return "-";
}

function getGearShort(sim) {
    var count = Object.keys(sim.gear || {}).filter(k => sim.gear[k] !== 0).length;
    var sets = "";
    var c = sim.config || {};

    if (c.set_t05_4p) sets += "T0.5-4 ";
    if (c.set_cenarion_5p) sets += "T1-5 ";
    if (c.set_cenarion_8p) sets += "T1-8 ";
    if (c.set_genesis_3p) sets += "T2.5-3 ";
    if (c.set_genesis_5p) sets += "T2.5-5 ";
    if (c.set_talon_3p) sets += "T3-3 ";
    if (c.set_talon_5p) sets += "T3-5 ";

    if (c.trinket_earthstrike) sets += "ES ";
    if (c.trinket_drake_fang) sets += "DFT ";
    if (c.trinket_styleens) sets += "Styleen ";
    if (c.trinket_swarmguard) sets += "Swarm ";
    if (c.trinket_jomgabbar) sets += "Jom ";

    return count + " Items " + (sets ? "| " + sets : "");
}

function renderComparisonTable() {
    var tbody = document.getElementById("comparisonBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    SIM_LIST.forEach(function (sim, idx) {
        var r = sim.results;
        var c = sim.config || {};

        var tr = document.createElement("tr");

        var tps = "-", ehp = "-", dtps = "-", dps = "-";
        if (r) {
            var rView = r.avg; 
            if(rView) {
                tps = rView.tps ? rView.tps.toFixed(1) : "-";
                ehp = rView.ehp ? Math.floor(rView.ehp).toLocaleString() : "-";
                dtps = rView.dtps ? rView.dtps.toFixed(1) : "-";
                dps = rView.dps ? rView.dps.toFixed(1) : "-";
            }
        }

        var html = `
            <td class="text-left"><b style="color:var(--druid-orange); cursor:pointer;" onclick="switchSim(${idx})">${sim.name}</b></td>
            <td class="text-center">${c.simTime || 60}s</td>
            <td class="text-center">${c.simCount || 1000}</td>
            <td class="text-center">${getSavedStat(sim, 'stat_hp')}</td>
            <td class="text-center">${getSavedStat(sim, 'stat_armor')}</td>
            <td class="text-center">${getSavedStat(sim, 'stat_ap')}</td>
            <td class="text-center">${getSavedStat(sim, 'stat_crit')}%</td>
            <td class="text-center">${getSavedStat(sim, 'stat_hit')}%</td>
            <td class="text-center">${getSavedStat(sim, 'stat_dodge')}%</td>
            <td class="text-center">${c.enemy_level || 63}</td>
            <td class="text-left" style="font-size:0.75rem; color:#aaa;">${getGearShort(sim)}</td>
            <td style="text-align:right; color:#ef5350; font-weight:bold;">${tps}</td>
            <td style="text-align:right; color:#90caf9; font-weight:bold;">${ehp}</td>
            <td style="text-align:right; color:#ffb74d; font-weight:bold;">${dtps}</td>
            <td style="text-align:right; color:#a5d6a7; font-weight:bold;">${dps}</td>
            <td style="text-align:center; cursor:pointer; color:#f44336;" onclick="deleteSim(${idx})">✖</td>
        `;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function runAllSims() {
    showProgress("Initializing Batch Run...");
    var idx = 0;
    var total = SIM_LIST.length;

    function next() {
        if (idx >= total) {
            hideProgress();
            renderComparisonTable();
            return;
        }

        var sim = SIM_LIST[idx];

        try {
            applyConfigToUI(sim.config, sim.gear, sim.enchants);

            var progressEl = document.getElementById("progressText");
            if (progressEl) progressEl.innerText = "Simulating: " + (sim.name || ("Sim " + (idx + 1)));

            setTimeout(function () {
                var allResults = [];
                var cfg = getSimInputs();
                var iterations = cfg.simCount || 1000;
                var baseSeed = cfg.sim_seed || 1337;

                for (var i = 0; i < iterations; i++) {
                    cfg.sim_seed = baseSeed + i;
                    var captureLog = (i === Math.floor(iterations / 2));
                    allResults.push(runSingleSim(cfg, captureLog)); 
                }

                sim.results = aggregateBearBatchResults(allResults, cfg); 

                var pct = Math.floor(((idx + 1) / total) * 100);
                updateProgress(pct);

                idx++;
                setTimeout(next, 20); 
            }, 20);
        } catch (e) {
            console.error("Error in Sim " + idx, e);
            idx++;
            setTimeout(next, 20);
        }
    }

    setTimeout(next, 50);
}

function aggregateBearBatchResults(results, config) {
    var tpsArr = results.map(r => r.tps).sort((a, b) => a - b);
    var dpsArr = results.map(r => r.dps).sort((a, b) => a - b);
    var dtpsArr = results.map(r => r.dtps).sort((a, b) => a - b);
    var ehpArr = results.map(r => r.ehp).sort((a, b) => a - b);

    function getStats(arr) {
        if (arr.length === 0) return { min: 0, median: 0, max: 0, avg: 0 };
        var sum = arr.reduce((a, b) => a + b, 0);
        return {
            min: arr[Math.floor(arr.length * 0.05)] || 0,        
            median: arr[Math.floor(arr.length * 0.50)] || 0,     
            max: arr[Math.floor(arr.length * 0.95)] || 0,        
            avg: sum / arr.length                                
        };
    }
    
    var tpsStats = getStats(tpsArr);
    var dpsStats = getStats(dpsArr);
    var dtpsStats = getStats(dtpsArr);
    var ehpStats = getStats(ehpArr);

    var runWithLog = results.find(r => r.log && r.log.length > 0);

    var aggAbilityStats = {};
    results.forEach(r => {
        if (!r.abilityStats) return;
        for (var name in r.abilityStats) {
            if (!aggAbilityStats[name]) aggAbilityStats[name] = { count: 0, dmg: 0, crits: 0, glances: 0 };
            aggAbilityStats[name].count += r.abilityStats[name].count;
            aggAbilityStats[name].dmg += r.abilityStats[name].dmg;
            aggAbilityStats[name].crits += r.abilityStats[name].crits;
            aggAbilityStats[name].glances += r.abilityStats[name].glances;
        }
    });
    
    var numRuns = results.length;
    for (var name in aggAbilityStats) {
        aggAbilityStats[name].count /= numRuns;
        aggAbilityStats[name].dmg /= numRuns;
    }

    return {
        min: { tps: tpsStats.min, dps: dpsStats.min, dtps: dtpsStats.min, ehp: ehpStats.min },
        median: { tps: tpsStats.median, dps: dpsStats.median, dtps: dtpsStats.median, ehp: ehpStats.median }, 
        max: { tps: tpsStats.max, dps: dpsStats.max, dtps: dtpsStats.max, ehp: ehpStats.max },
        raw: { tps_arr: tpsArr, dps_arr: dpsArr },
        log: runWithLog ? runWithLog.log : [],
        abilities: aggAbilityStats,
        tables: { counters: {}, theory: { bear: {}, boss: {} } }
    };
}

// ============================================================================
// STATE MANAGEMENT (SAVE / LOAD)
// ============================================================================

function getCurrentConfigFromUI() {
    var cfg = {};
    CONFIG_IDS.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') cfg[id] = el.checked ? 1 : 0;
            else cfg[id] = parseFloat(el.value) || el.value;
        }
    });
    
    if (typeof CUSTOM_ROTATION !== 'undefined') {
        cfg.custom_rotation = JSON.parse(JSON.stringify(CUSTOM_ROTATION));
    }

    if (typeof TALENT_CONFIG !== 'undefined') {
        cfg.talents = JSON.parse(JSON.stringify(TALENT_CONFIG));
    }

    return cfg;
}

function saveCurrentState() {
    if (IS_LOADING) return;
    
    var compView = document.getElementById('comparisonView');
    if (compView && !compView.classList.contains('hidden')) return;

    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].config = getCurrentConfigFromUI();
        SIM_LIST[ACTIVE_SIM_INDEX].gear = JSON.parse(JSON.stringify(GEAR_SELECTION));
        SIM_LIST[ACTIVE_SIM_INDEX].enchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
        
        var nameInput = document.getElementById('simName');
        if (nameInput) SIM_LIST[ACTIVE_SIM_INDEX].name = nameInput.value;
    }
}

function applyConfigToUI(cfg, gearData, enchantData) {
    if (!cfg) return;
    IS_LOADING = true;

    try {
        for (var id in cfg) {
            if (id === 'custom_rotation' || id === 'talents') continue;
            var el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = (cfg[id] == 1);
                else el.value = cfg[id];
            }
        }

        GEAR_SELECTION = gearData ? JSON.parse(JSON.stringify(gearData)) : {};
        ENCHANT_SELECTION = enchantData ? JSON.parse(JSON.stringify(enchantData)) : {};

        if (cfg.custom_rotation && cfg.custom_rotation.steps) {
            CUSTOM_ROTATION = JSON.parse(JSON.stringify(cfg.custom_rotation));
        } else {
            CUSTOM_ROTATION = typeof PRESET_ROTATIONS !== 'undefined' ? JSON.parse(JSON.stringify(PRESET_ROTATIONS["standard_tank"])) : [];
        }
        if (typeof renderRotationBuilder === 'function') renderRotationBuilder();

        if (typeof initGearPlannerUI === 'function') initGearPlannerUI();

        if (typeof TALENT_CONFIG !== 'undefined') {
            var hasTalents = false;
            if (cfg.talents) {
                for (var k in cfg.talents) {
                    if (cfg.talents[k] > 0) hasTalents = true;
                }
            }

            if (hasTalents) {
                for (var key in TALENT_CONFIG) {
                    TALENT_CONFIG[key] = cfg.talents.hasOwnProperty(key) ? cfg.talents[key] : 0;
                }
                var tpSel = document.getElementById("talent_preset_select");
                if (tpSel) tpSel.value = ""; 
            } else {
                if (typeof TALENT_PRESETS !== 'undefined' && TALENT_PRESETS["Tank (11/35/5)"]) {
                    TALENT_CONFIG = JSON.parse(JSON.stringify(TALENT_PRESETS["Tank (11/35/5)"]));
                    var tpSel = document.getElementById("talent_preset_select");
                    if (tpSel) tpSel.value = "Tank (11/35/5)";
                }
            }
        }
        if (typeof renderTalentTree === 'function') renderTalentTree();
        
    } catch (e) {
        console.error("Error applying config:", e);
    } finally {
        IS_LOADING = false;
    }
}

function getSimInputs() {
    var conf = {};
    document.querySelectorAll("input[type='checkbox'], input[type='number'], select").forEach(el => {
        if (el.id) {
            if (el.type === 'checkbox') conf[el.id] = el.checked ? 1 : 0;
            else if (el.type === 'number') conf[el.id] = parseFloat(el.value) || 0;
            else conf[el.id] = el.value; 
        }
    });
    conf.gear = JSON.parse(JSON.stringify(GEAR_SELECTION));
    conf.enchants = JSON.parse(JSON.stringify(ENCHANT_SELECTION));
    conf.rotation = JSON.parse(JSON.stringify(CUSTOM_ROTATION));
    
    if (typeof TALENT_CONFIG !== 'undefined') {
        conf.talents = JSON.parse(JSON.stringify(TALENT_CONFIG));
    } else {
        conf.talents = {};
    }
    
    return conf;
}

// ============================================================================
// UI INITIALIZATION
// ============================================================================
function setupUIListeners() {
    var statWeightsInputs = ["weight_str", "weight_agi", "weight_sta", "weight_crit", "weight_hit", "weight_dodge", "weight_ap", "weight_haste", "weight_arp", "weight_armor", "weight_def"];
    statWeightsInputs.forEach(id => {
        var el = document.getElementById(id);
        if(el) {
            el.addEventListener('change', function() {
                if (typeof recalcItemScores === 'function') recalcItemScores();
                saveCurrentState(); 
            });
        }
    });

    var statTriggerSelectors = [
        'select[id^="tal_"]',      
        'select[id^="consum_"]',   
        'input[id^="consum_"]',    
        'input[id^="buff_"]',
        'input[id^="debuff_"]',      
        '#enemy_armor',              
        '#stat_arp'                  
    ].join(', ');

    document.querySelectorAll(statTriggerSelectors).forEach(function(el) {
        el.addEventListener('change', function() {
            if (typeof calculateGearStats === 'function') calculateGearStats();
            updateBossArmorBar(); 
        });
    });

    var bossSel = document.getElementById("enemy_boss_select");
    if (bossSel) {
        bossSel.innerHTML = "";
        BOSS_PRESETS.forEach(function (boss, idx) {
            var opt = document.createElement("option");
            opt.value = idx;
            opt.text = boss.group + " - " + boss.name;
            bossSel.appendChild(opt);
        });
        bossSel.addEventListener('change', function () {
            var boss = BOSS_PRESETS[this.value];
            if (boss) {
                document.getElementById("enemy_level").value = boss.level;
                document.getElementById("enemy_armor").value = boss.armor;
                document.getElementById("boss_base_dmg").value = boss.baseDmg;
                document.getElementById("boss_attack_speed").value = boss.attackSpeed;
            }
        });
        bossSel.value = 1; 
        bossSel.dispatchEvent(new Event('change'));
    }

    var btnRun = document.getElementById("btn_run_sim");
    if (btnRun) {
        btnRun.addEventListener("click", function() {
            if(typeof runSimulation === 'function') runSimulation();
        });
    }

    var btnWeights = document.getElementById("btnWeights");
    if (btnWeights) {
        btnWeights.addEventListener("click", function() {
            if(typeof runStatWeights === 'function') runStatWeights();
        });
    }

    var manToggle = document.getElementById("manual_stats");
    if (manToggle) {
        manToggle.addEventListener('change', function() {
            if (typeof calculateGearStats === 'function') calculateGearStats();
        });
    }

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            switchResultView(this.getAttribute('data-view'));
        });
    });

    document.querySelectorAll("input, select").forEach(function (el) {
        el.addEventListener("change", function () {
            if (el.id === "itemSearchInput" || el.id === "simName") return;
            
            if (ACTIVE_SIM_INDEX >= 0 && SIM_LIST[ACTIVE_SIM_INDEX]) {
                saveCurrentState();
            }
        });
    });
    

    updateBossArmorBar();
    populatePresetDropdown();
    renderRotationBuilder();
    if(typeof populateGearPresets === 'function') populateGearPresets();
    if (typeof renderTalentPresetDropdown === 'function') renderTalentPresetDropdown();
    if (typeof renderTalentTree === 'function') renderTalentTree();
}

// ============================================================================
// DRAG & DROP ROTATION BUILDER
// ============================================================================
function renderRotationBuilder() {
    var toolbox = document.getElementById("rbSkillsList");
    var dropzone = document.getElementById("rbDropzone");
    if (!toolbox || !dropzone) return;

    toolbox.innerHTML = "";
    ROTATION_SKILLS.forEach(skill => {
        var el = document.createElement("div");
        el.className = "rb-skill";
        el.draggable = true;
        el.innerHTML = `<img src="${getIconUrl(skill.icon)}" class="rb-skill-icon"> ${skill.name}`;
        el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", skill.id); };
        toolbox.appendChild(el);
    });

    dropzone.innerHTML = "";
    if (!CUSTOM_ROTATION || !CUSTOM_ROTATION.steps || CUSTOM_ROTATION.steps.length === 0) {
        dropzone.innerHTML = `<div id="rbEmptyState" style="color:#666; text-align:center; padding:20px; font-style:italic;">Drag skills here from the left...</div>`;
    } else {
        CUSTOM_ROTATION.steps.forEach((step, stepIdx) => {
            var div = document.createElement("div");
            div.className = "rb-step" + (step.disabled ? " is-disabled" : "");
            
            var sk = ROTATION_SKILLS.find(s => s.id === step.skill) || { name: step.skill, icon: "inv_misc_questionmark" };
            
            var header = document.createElement("div");
            header.className = "rb-step-header";
            header.innerHTML = `
                <div class="rb-step-title">
                    <span class="rb-step-count">#${stepIdx + 1}</span>
                    <img src="${getIconUrl(sk.icon)}" class="rb-skill-icon"> ${sk.name}
                </div>
                <div>
                    <button class="rb-toggle-btn" onclick="moveStep(${stepIdx}, -1)">▲</button>
                    <button class="rb-toggle-btn" onclick="moveStep(${stepIdx}, 1)">▼</button>
                    <button class="rb-toggle-btn" onclick="toggleStepDisabled(${stepIdx})">🚫</button>
                    <button class="rb-delete-btn" onclick="deleteStep(${stepIdx})">✖</button>
                </div>
            `;
            div.appendChild(header);

            var condList = document.createElement("div");
            condList.className = "rb-conditions";
            step.conditions.forEach(function (cond, cIdx) {
                var cRow = document.createElement("div");
                cRow.className = "rb-condition-row";
                
                var typeSel = `<select onchange="updateCondType(${stepIdx}, ${cIdx}, this.value)">`;
                for (var k in CONDITION_TYPES) {
                    typeSel += `<option value="${k}" ${k === cond.type ? "selected" : ""}>${CONDITION_TYPES[k].label}</option>`;
                }
                typeSel += `</select>`;

                var spec = CONDITION_TYPES[cond.type];
                var targetSel = "";
                if (spec.type === "select") {
                    targetSel = `<select onchange="CUSTOM_ROTATION.steps[${stepIdx}].conditions[${cIdx}].target = this.value">`;
                    spec.options.forEach(opt => { targetSel += `<option value="${opt}" ${cond.target === opt ? "selected" : ""}>${opt}</option>`; });
                    targetSel += `</select>`;
                }

                var opSel = `<select onchange="CUSTOM_ROTATION.steps[${stepIdx}].conditions[${cIdx}].op = this.value">`;
                spec.ops.forEach(o => { opSel += `<option value="${o}" ${cond.op === o ? "selected" : ""}>${o}</option>`; });
                opSel += `</select>`;

                var valInp = `<input type="number" value="${cond.val || 0}" onchange="CUSTOM_ROTATION.steps[${stepIdx}].conditions[${cIdx}].val = parseFloat(this.value)">`;

                cRow.innerHTML = `<span style="color:#888;">AND</span> ${typeSel} ${targetSel} ${opSel} ${valInp} <button class="rb-delete-btn" onclick="deleteCondition(${stepIdx}, ${cIdx})">✖</button>`;
                condList.appendChild(cRow);
            });

            var addBtn = document.createElement("button");
            addBtn.className = "rb-add-condition";
            addBtn.innerText = "+ Add Condition";
            addBtn.onclick = function() { addCondition(stepIdx); };
            condList.appendChild(addBtn);

            div.appendChild(condList);
            dropzone.appendChild(div);
        });
    }

    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); };
    dropzone.ondragleave = (e) => { dropzone.classList.remove("drag-over"); };
    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        var skillId = e.dataTransfer.getData("text/plain");
        if (skillId) addRotationStep(skillId);
    };
}

// Action Handlers
function addRotationStep(skillId) {
    if (!CUSTOM_ROTATION.steps) CUSTOM_ROTATION.steps = [];
    CUSTOM_ROTATION.steps.push({ id: "custom_" + Date.now(), skill: skillId, conditions: [] });
    renderRotationBuilder();
}
function moveStep(idx, dir) {
    if (idx + dir < 0 || idx + dir >= CUSTOM_ROTATION.steps.length) return;
    var temp = CUSTOM_ROTATION.steps[idx];
    CUSTOM_ROTATION.steps[idx] = CUSTOM_ROTATION.steps[idx + dir];
    CUSTOM_ROTATION.steps[idx + dir] = temp;
    renderRotationBuilder();
}
function toggleStepDisabled(idx) {
    CUSTOM_ROTATION.steps[idx].disabled = !CUSTOM_ROTATION.steps[idx].disabled;
    renderRotationBuilder();
}
function deleteStep(idx) {
    CUSTOM_ROTATION.steps.splice(idx, 1);
    renderRotationBuilder();
}
function addCondition(stepIdx) {
    CUSTOM_ROTATION.steps[stepIdx].conditions.push({ type: "rage", op: ">=", val: 15 });
    renderRotationBuilder();
}
function deleteCondition(stepIdx, cIdx) {
    CUSTOM_ROTATION.steps[stepIdx].conditions.splice(cIdx, 1);
    renderRotationBuilder();
}
function updateCondType(stepIdx, cIdx, val) {
    var cond = CUSTOM_ROTATION.steps[stepIdx].conditions[cIdx];
    cond.type = val;
    cond.op = CONDITION_TYPES[val].ops[0];
    if (CONDITION_TYPES[val].type === "select") {
        cond.target = CONDITION_TYPES[val].options[0];
    } else {
        cond.target = null;
        cond.val = 0;
    }
    renderRotationBuilder();
}
function clearRotation() {
    CUSTOM_ROTATION.steps = [];
    renderRotationBuilder();
}

function populatePresetDropdown() {
    var sel = document.getElementById("rotation_preset_select");
    if (!sel) return;
    sel.innerHTML = "";
    var optGrp1 = document.createElement("optgroup");
    optGrp1.label = "Standard Presets";
    for (var k in PRESET_ROTATIONS) {
        var o = document.createElement("option"); o.value = "pre_" + k; o.text = PRESET_ROTATIONS[k].name;
        optGrp1.appendChild(o);
    }
    sel.appendChild(optGrp1);
}

// ============================================================================
// RESULT RENDERING
// ============================================================================

var CURRENT_RESULT_VIEW = 'median'; 

function switchResultView(view) {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    var btn = document.querySelector(`.view-btn[data-view="${view}"]`);
    if (btn) btn.classList.add('active');
    
    CURRENT_RESULT_VIEW = view;
    renderResults();
}

var chartInstances = {};

function renderResults() {
    if (!SIM_DATA || !SIM_DATA.results) return;
    var viewObj = SIM_DATA.results[CURRENT_RESULT_VIEW]; 
    if (!viewObj) return;

    var resArea = document.getElementById("resultsArea");
    var placeholder = document.getElementById("simPlaceholder");
    if(placeholder) placeholder.classList.add("hidden");
    if(resArea) resArea.classList.remove("hidden");

    var deathBanner = document.getElementById("deathBanner");
    if (deathBanner) {
        var dEvent = SIM_DATA.results.deathEvent; 
        
        if (dEvent) {
            document.getElementById("deathTime").innerText = dEvent.time.toFixed(1);
            document.getElementById("deathType").innerText = dEvent.type;
            document.getElementById("deathDmg").innerText = Math.floor(dEvent.damage).toLocaleString();
            deathBanner.classList.remove("hidden");
        } else {
            deathBanner.classList.add("hidden");
        }
    }

    document.getElementById("res_tps").innerText = (viewObj.tps || 0).toFixed(1);
    document.getElementById("res_ehp").innerText = Math.floor(viewObj.ehp || 0).toLocaleString();
    document.getElementById("res_dtps").innerText = (viewObj.dtps || 0).toFixed(1);
    document.getElementById("res_dps").innerText = (viewObj.dps || 0).toFixed(1);

    if (SIM_DATA.results.min && SIM_DATA.results.max && SIM_DATA.results.median) {
        var minData = SIM_DATA.results.min;
        var maxData = SIM_DATA.results.max;
        var medData = SIM_DATA.results.median;

        var btnMin = document.querySelector('.view-btn[data-view="min"]');
        var btnMed = document.querySelector('.view-btn[data-view="median"]');
        var btnMax = document.querySelector('.view-btn[data-view="max"]');
        
        if(btnMin) btnMin.innerText = "5% (" + minData.tps.toFixed(1) + " TPS)";
        if(btnMed) btnMed.innerText = "Median (" + medData.tps.toFixed(1) + " TPS)";
        if(btnMax) btnMax.innerText = "95% (" + maxData.tps.toFixed(1) + " TPS)";
    }

    if (SIM_DATA.results.raw) {
        var highlightValsTps = { min: minData.tps, median: medData.tps, max: maxData.tps };
        var highlightValsDps = { min: minData.dps, median: medData.dps, max: maxData.dps };
        
        renderChart("tpsChart", SIM_DATA.results.raw.tps_arr, "rgba(229, 57, 53, 0.25)", "TPS", highlightValsTps, CURRENT_RESULT_VIEW);
        renderChart("dpsChart", SIM_DATA.results.raw.dps_arr, "rgba(255, 152, 0, 0.25)", "DPS", highlightValsDps, CURRENT_RESULT_VIEW);
    }

    if (viewObj.abilities) {
        renderAbilityStatsTable(viewObj.abilities, SIM_DATA.config.simTime);
    }

    if (SIM_DATA.results.tables) {
        renderAttackTables(SIM_DATA.results.tables);
    }
    
    if (SIM_DATA.results.log) {
        renderCombatLog(SIM_DATA.results.log);
    }
}

function renderChart(canvasId, dataArr, baseColor, label, highlightVals, activeView) {
    var ctx = document.getElementById(canvasId);
    if (!ctx || !dataArr || dataArr.length === 0) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    var globalMin = Infinity;
    var globalMax = -Infinity;
    var dataKey = (label === "TPS") ? "tps_arr" : "dps_arr";
    
    SIM_LIST.forEach(function(sim) {
        if (sim.results && sim.results.raw && sim.results.raw[dataKey]) {
            var sMin = Math.min(...sim.results.raw[dataKey]);
            var sMax = Math.max(...sim.results.raw[dataKey]);
            if (sMin < globalMin) globalMin = sMin;
            if (sMax > globalMax) globalMax = sMax;
        }
    });
    
    if (globalMin === Infinity || globalMax === -Infinity) {
        globalMin = Math.min(...dataArr);
        globalMax = Math.max(...dataArr);
    }
    
    var min = globalMin;
    var max = globalMax;
    
    var range = max - min;
    if (range === 0) range = 10;
    min = Math.max(0, min - (range * 0.05));
    max = max + (range * 0.05);

    var buckets = 40;
    var step = (max - min) / buckets;
    if (step === 0) step = 1;

    var counts = new Array(buckets).fill(0);
    var labels = new Array(buckets);
    dataArr.forEach(val => {
        var b = Math.floor((val - min) / step);
        if (b >= buckets) b = buckets - 1;
        if (b < 0) b = 0; 
        counts[b]++;
    });
    
    for(let i = 0; i < buckets; i++) {
        labels[i] = (min + (i * step)).toFixed(0);
    }

    var bgColors = new Array(buckets).fill(baseColor);
    
    if (highlightVals) {
        function getBucketIndex(val) {
            var b = Math.floor((val - min) / step);
            if (b >= buckets) b = buckets - 1;
            if (b < 0) b = 0;
            return b;
        }

        var idxMin = getBucketIndex(highlightVals.min);
        var idxMed = getBucketIndex(highlightVals.median);
        var idxMax = getBucketIndex(highlightVals.max);

        bgColors[idxMin] = "rgba(255, 255, 255, 0.4)";
        bgColors[idxMed] = "rgba(255, 255, 255, 0.4)";
        bgColors[idxMax] = "rgba(255, 255, 255, 0.4)";

        if (activeView === 'min') {
            bgColors[idxMin] = "#90caf9";
        } else if (activeView === 'max') {
            bgColors[idxMax] = "#90caf9";
        } else { 
            bgColors[idxMed] = "#ffd700";
        }
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Frequency',
                data: counts,
                backgroundColor: bgColors,
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 250 
            },
            scales: {
                x: { ticks: { color: '#888', maxTicksLimit: 8 }, grid: { display: false } },
                y: { ticks: { color: '#888' }, grid: { color: '#333' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(context) { return label + ': ' + context[0].label; },
                        label: function(context) { return 'Count: ' + context.parsed.y; }
                    }
                }
            }
        }
    });
}

function renderAttackTables(tablesData) {
    var cBear = tablesData.counters.bearWhite;
    var cYellow = tablesData.counters.bearYellow || { swings: 0, misses: 0, dodges: 0, parries: 0, crits: 0, hits: 0 };
    var cBoss = tablesData.counters.boss;

    function getPctRaw(count, total) { return total > 0 ? (count / total) * 100 : 0; }
    
    function buildStackedBar(dataPoints) {
        var htmlBar = `<div class="stacked-bar-wrapper">`;
        var htmlLegend = `<div class="stacked-bar-legend">`;
        
        dataPoints.forEach(dp => {
            if (dp.width > 0) {
                htmlBar += `<div class="stacked-bar-segment" style="width: ${dp.width}%; background: ${dp.color};" title="${dp.label}: ${dp.width.toFixed(1)}%">${dp.width >= 4 ? dp.width.toFixed(1) + '%' : ''}</div>`;
                htmlLegend += `<div class="legend-item"><div class="legend-color" style="background: ${dp.color};"></div>${dp.label} (${dp.width.toFixed(1)}%)</div>`;
            }
        });
        
        htmlBar += `</div>`;
        htmlLegend += `</div>`;
        return htmlBar + htmlLegend;
    }

    var bearPoints = [
        { label: "Miss", width: getPctRaw(cBear.misses, cBear.swings), color: "#aaa" },
        { label: "Dodge", width: getPctRaw(cBear.dodges, cBear.swings), color: "#90caf9" },
        { label: "Parry", width: getPctRaw(cBear.parries, cBear.swings), color: "#ce93d8" },
        { label: "Glancing", width: getPctRaw(cBear.glances, cBear.swings), color: "#ffcc80" },
        { label: "Crit", width: getPctRaw(cBear.crits, cBear.swings), color: "#ffb74d" },
        { label: "Hit", width: getPctRaw(cBear.hits, cBear.swings), color: "rgba(255,255,255,0.2)" }
    ];

    var yellowPoints = [
        { label: "Miss", width: getPctRaw(cYellow.misses, cYellow.swings), color: "#aaa" },
        { label: "Dodge", width: getPctRaw(cYellow.dodges, cYellow.swings), color: "#90caf9" },
        { label: "Parry", width: getPctRaw(cYellow.parries, cYellow.swings), color: "#ce93d8" },
        { label: "Crit", width: getPctRaw(cYellow.crits, cYellow.swings), color: "#ffb74d" },
        { label: "Hit", width: getPctRaw(cYellow.hits, cYellow.swings), color: "rgba(255,255,255,0.2)" }
    ];

    var bossPoints = [
        { label: "Miss", width: getPctRaw(cBoss.misses, cBoss.swings), color: "#aaa" },
        { label: "Dodge", width: getPctRaw(cBoss.dodges, cBoss.swings), color: "#90caf9" },
        { label: "Crush", width: getPctRaw(cBoss.crushes, cBoss.swings), color: "#ef5350" },
        { label: "Crit", width: getPctRaw(cBoss.crits, cBoss.swings), color: "#e57373" },
        { label: "Hit", width: getPctRaw(cBoss.hits, cBoss.swings), color: "rgba(255,255,255,0.2)" }
    ];

    var htmlCombined = 
        `<div style="margin-bottom: 5px; font-size: 0.8rem; color:#aaa; font-weight: bold;">WHITE HITS (Auto Attack / Extra Attacks)</div>` +
        buildStackedBar(bearPoints) +
        `<div style="margin-top: 15px; margin-bottom: 5px; font-size: 0.8rem; color:#aaa; font-weight: bold;">YELLOW HITS (Maul, Swipe, Savage Bite)</div>` +
        buildStackedBar(yellowPoints);

    document.getElementById("attackTableBody").innerHTML = htmlCombined;
    document.getElementById("mitigationTableBody").innerHTML = buildStackedBar(bossPoints);
}

function renderAbilityStatsTable(abilityData, simTime) {
    var tb = document.getElementById("abilityStatsBody");
    if (!tb) return;
    
    var thead = tb.previousElementSibling;
    if (thead) {
        thead.innerHTML = `
            <tr>
                <th class="text-left">Ability</th>
                <th class="text-right">Total Dmg</th>
                <th class="text-right">DPS</th>
                <th class="text-right">Casts</th>
                <th class="text-right">Hit %</th>
                <th class="text-right">Crit %</th>
                <th class="text-right">Glance %</th>
                <th class="text-right">Miss %</th>
                <th class="text-right">Dodge %</th>
                <th class="text-right">Parry %</th>
            </tr>
        `;
    }

    tb.innerHTML = "";

    var totalSimDmg = 0;
    var rows = [];

    for (var k in abilityData) {
        totalSimDmg += abilityData[k].dmg;
    }

    for (var key in abilityData) {
        var a = abilityData[key];
        
        if (a.count === 0 && a.dmg === 0 && key !== "Auto Attack") continue;

        var dps = a.dmg / simTime;
        
        var hitPct = (a.count > 0) ? ((a.hits || 0) / a.count) * 100 : 0;
        var critPct = (a.count > 0) ? ((a.crits || 0) / a.count) * 100 : 0;
        var glancePct = (a.count > 0) ? ((a.glances || 0) / a.count) * 100 : 0;
        var missPct = (a.count > 0) ? ((a.misses || 0) / a.count) * 100 : 0;
        var dodgePct = (a.count > 0) ? ((a.dodges || 0) / a.count) * 100 : 0;
        var parryPct = (a.count > 0) ? ((a.parries || 0) / a.count) * 100 : 0;

        var color = "#fff";
        if (key === "Maul" || key === "Swipe" || key === "Savage Bite") color = "#ffd700"; 
        if (key === "Thorns" || key === "Retribution Items") color = "#a5d6a7"; 
        if (key === "Obsidian Explosion") color = "#ff7043"; 
        if (key === "Lifesteal (Heal)") color = "#f48fb1"; 

        rows.push({
            name: key, dmg: a.dmg, dps: dps, count: a.count,
            hit: hitPct, crit: critPct, glance: glancePct,
            miss: missPct, dodge: dodgePct, parry: parryPct,
            color: color
        });
    }

    rows.sort((a, b) => b.dmg - a.dmg);

    rows.forEach(r => {
        var tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="text-left" style="color:${r.color}; font-weight:bold;">${r.name}</td>
            <td class="text-right">${Math.floor(r.dmg).toLocaleString()}</td>
            <td class="text-right" style="color:var(--text-muted);">${r.dps.toFixed(1)}</td>
            <td class="text-right">${r.count}</td>
            <td class="text-right" style="color:#fff;">${r.hit.toFixed(1)}%</td>
            <td class="text-right" style="color:#ffb74d;">${r.crit.toFixed(1)}%</td>
            <td class="text-right" style="color:#ffcc80;">${r.glance.toFixed(1)}%</td>
            <td class="text-right" style="color:#aaa;">${r.miss.toFixed(1)}%</td>
            <td class="text-right" style="color:#90caf9;">${r.dodge.toFixed(1)}%</td>
            <td class="text-right" style="color:#ce93d8;">${r.parry.toFixed(1)}%</td>
        `;
        tb.appendChild(tr);
    });
}
// ============================================================================
// COMBAT LOG 
// ============================================================================

var LOG_DATA = [];
var FILTERED_LOG_DATA = []; 
var LOG_PAGE = 1;
const LOG_PER_PAGE = 50;
var LOG_BUFF_KEYS = [];

function renderCombatLog(log) {
    LOG_DATA = log || [];
    LOG_PAGE = 1;

    var allKeys = new Set();
    LOG_DATA.forEach(e => {
        if (e.activeBuffs) {
            Object.keys(e.activeBuffs).forEach(k => allKeys.add(k));
        }
    });
    LOG_BUFF_KEYS = Array.from(allKeys).sort();

    if (typeof filterCombatLog === 'function') {
        filterCombatLog();
    } else {
        FILTERED_LOG_DATA = [...LOG_DATA];
        updateLogView();
    }
}

window.filterCombatLog = function() {
    var input = document.getElementById("logSearchInput");
    if (!input) return;
    var searchStr = input.value.toLowerCase();
    
    if (!searchStr) {
        FILTERED_LOG_DATA = [...LOG_DATA];
    } else {
        FILTERED_LOG_DATA = LOG_DATA.filter(e => {
            var rowText = [
                e.time.toFixed(2),
                e.event || "",
                e.ability || "",
                e.result || "",
                e.dmg > 0 ? Math.floor(e.dmg) : "",
                e.threat > 0 ? Math.floor(e.threat) : "",
                e.hp || "",
                e.hpChange || "",
                e.rage !== undefined ? Math.floor(e.rage) : "",
                e.rageChange !== undefined ? Math.floor(e.rageChange) : "",
                e.armor || "",
                e.ap || "",
                e.haste !== undefined ? e.haste.toFixed(1) + "%" : "",
                e.arp || "",
                e.info || ""
            ];
            
            LOG_BUFF_KEYS.forEach(key => {
                if (e.activeBuffs && e.activeBuffs[key] !== undefined) {
                    rowText.push(e.activeBuffs[key]);
                }
            });
            
            return rowText.join(" ").toLowerCase().includes(searchStr);
        });
    }
    LOG_PAGE = 1; 
    updateLogView();
};

function updateLogView() {
    var container = document.getElementById("logTableHeader");
    if (container) {
        let headerHtml = `
            <th style="text-align:left;">Time</th>
            <th style="text-align:left;">Event</th>
            <th style="text-align:left;">Ability</th>
            <th style="text-align:left;">Result</th>
            <th style="text-align:right;">Damage</th>
            <th style="text-align:right;">Threat</th>
            <th style="text-align:right;">HP</th>
            <th style="text-align:right;">+/- HP</th>
            <th style="text-align:right;">Rage</th>
            <th style="text-align:right;">+/- Rage</th>
            <th style="text-align:right;">Armor</th>
            <th style="text-align:right;">AP</th>
            <th style="text-align:right;">Haste</th>
            <th style="text-align:right;">ArP</th>`;

        LOG_BUFF_KEYS.forEach(key => {
            headerHtml += `<th style="text-align:center;">${key}</th>`;
        });

        headerHtml += `<th style="text-align:left; padding-left:10px;">Info</th>`;
        container.innerHTML = headerHtml;
    }

    var tb = document.getElementById("logTableBody");
    if (!tb) return;
    tb.innerHTML = "";

    if (FILTERED_LOG_DATA.length === 0) {
        tb.innerHTML = "<tr><td colspan='100%' style='color:#888; text-align:center; padding:15px;'>No log entries match your search (or log is empty).</td></tr>";
        var pageLabel = document.getElementById("logPageLabel");
        if (pageLabel) pageLabel.innerText = "Page 1 / 1";
        return;
    }

    var start = (LOG_PAGE - 1) * LOG_PER_PAGE;
    var slice = FILTERED_LOG_DATA.slice(start, start + LOG_PER_PAGE);

    slice.forEach(e => {
        var tr = document.createElement("tr");

        if (e.event === "Damage Taken") {
            tr.style.backgroundColor = "rgba(229, 57, 53, 0.15)"; 
        } else if (e.ability === "Auto Attack" || e.ability === "Extra Attack") {
            tr.style.backgroundColor = "rgba(255, 255, 255, 0.05)"; 
        } else if (["Maul", "Swipe", "Savage Bite"].includes(e.ability)) {
            tr.style.backgroundColor = "rgba(255, 215, 0, 0.15)"; 
        } else if (e.event === "Buff" || e.event === "Proc" || e.event === "Debuff") {
            tr.style.backgroundColor = "rgba(197, 134, 192, 0.2)"; 
        } else if (e.event === "Avoidance") {
            tr.style.backgroundColor = "rgba(144, 202, 249, 0.15)"; 
        }

        var rChangeStyle = e.rageChange > 0 ? "color:#ef5350; font-weight:bold;" : (e.rageChange < 0 ? "color:#ccc;" : "");
        var hpChangeStyle = e.hpChange > 0 ? "color:#66bb6a; font-weight:bold;" : (e.hpChange < 0 ? "color:#ef5350;" : "");

        var html = `
            <td style="text-align:left; padding:4px 8px; border-bottom:1px solid #333;">${e.time.toFixed(2)}</td>
            <td style="text-align:left; padding:4px 8px; border-bottom:1px solid #333;">${e.event}</td>
            <td style="font-weight:bold; text-align:left; padding:4px 8px; border-bottom:1px solid #333;">${e.ability}</td>
            <td style="text-align:left; padding:4px 8px; border-bottom:1px solid #333;">${e.result || ""}</td>
            <td style="text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.dmg > 0 ? Math.floor(e.dmg) : ""}</td>
            <td style="color:var(--rage-red); text-align:right; font-weight:bold; padding:4px 8px; border-bottom:1px solid #333;">${e.threat > 0 ? Math.floor(e.threat) : ""}</td>
            <td style="color:#a5d6a7; text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.hp || ""}</td>
            <td style="${hpChangeStyle} text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.hpChange ? (e.hpChange > 0 ? "+"+e.hpChange : e.hpChange) : ""}</td>
            <td style="color:#ef5350; text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.rage !== undefined ? Math.floor(e.rage) : ""}</td>
            <td style="${rChangeStyle} text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.rageChange ? (e.rageChange > 0 ? "+"+Math.floor(e.rageChange) : Math.floor(e.rageChange)) : ""}</td>
            <td style="color:#90caf9; text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.armor || ""}</td> 
            <td style="text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.ap || ""}</td>
            <td style="text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.haste !== undefined ? e.haste.toFixed(1) + "%" : ""}</td>
            <td style="text-align:right; padding:4px 8px; border-bottom:1px solid #333;">${e.arp || ""}</td>
        `;

        LOG_BUFF_KEYS.forEach(key => {
            var val = (e.activeBuffs && e.activeBuffs[key] !== undefined) ? e.activeBuffs[key] : "";
            html += `<td style="color:#c586c0; text-align:center; padding:4px 8px; border-bottom:1px solid #333; font-weight:bold;">${val}</td>`;
        });

        html += `<td style="color:#777; font-size:0.75rem; text-align:left; padding-left:10px; border-bottom:1px solid #333;">${e.info || ""}</td>`;

        tr.innerHTML = html;
        tb.appendChild(tr);
    });

    var pageLabel = document.getElementById("logPageLabel");
    if (pageLabel) {
        var maxPages = Math.ceil(FILTERED_LOG_DATA.length / LOG_PER_PAGE);
        if (maxPages === 0) maxPages = 1;
        pageLabel.innerText = "Page " + LOG_PAGE + " / " + maxPages;
    }
}

window.nextLogPage = function() {
    if (LOG_PAGE * LOG_PER_PAGE < FILTERED_LOG_DATA.length) { LOG_PAGE++; updateLogView(); }
};

window.prevLogPage = function() {
    if (LOG_PAGE > 1) { LOG_PAGE--; updateLogView(); }
};

function updateDamageScaling() {
    const tb = document.getElementById("scalingTableBody");
    if (!tb) return;

    const ap = getVal("stat_ap");

    const t = typeof TALENT_CONFIG !== 'undefined' ? TALENT_CONFIG : {};
    const arr3_6_10 = [0, 0.03, 0.06, 0.10];
    const arr7_14_20 = [0, 0.07, 0.14, 0.20];
    
    const tNatWep = 1.0 + (arr3_6_10[t.naturalWeapons || 0] || 0); 
    const tPredStrikes = 1.0 + (arr7_14_20[t.predatoryStrikes || 0] || 0); 
    const tFeralInstinct = 1.0 + ((t.feralInstinct || 0) * 0.05);

    const avgBase = 209; 
    const baseAP = 300; 

    const dmgAuto = (avgBase + 0.175 * (ap - baseAP)) * tNatWep;
    const dmgMaul = (dmgAuto + 128) * tPredStrikes;
    const dmgSavageBite = ((dmgAuto * 0.80) + 30) * tPredStrikes;
    const dmgSwipe = (94 + 0.038 * (ap - baseAP)) * tPredStrikes * tNatWep;
    const dmgThorns = 18; 

    const threatAuto = 1.30 * tFeralInstinct;
    const threatMaul = 1.95 * tFeralInstinct;
    const threatSwipe = 1.75 * tFeralInstinct;
    const threatSavageBite = 2.60 * tFeralInstinct;
    const threatThorns = 1.30 * tFeralInstinct; 

    const abilities = [
        {
            name: "Auto Attack",
            formula: `(209 + 17.5% * (AP - 300)) * NatWep`,
            dmg: dmgAuto,
            threatMod: threatAuto,
        },
        {
            name: "Maul",
            formula: `(Auto-Attack + 128) * PredStrikes`,
            dmg: dmgMaul,
            threatMod: threatMaul,
        },
        {
            name: "Swipe (per Target)",
            formula: `(94 + 3.8% * (AP - 300)) * PredStrikes * NatWep`,
            dmg: dmgSwipe,
            threatMod: threatSwipe,
        },
        {
            name: "Savage Bite",
            formula: `(Auto-Attack * 80% + 30) * PredStrikes`,
            dmg: dmgSavageBite,
            threatMod: threatSavageBite,
        },
        {
            name: "Thorns (Buff)",
            formula: `18 Flat Nature Damage`,
            dmg: dmgThorns,
            threatMod: threatThorns,
        }
    ];

    tb.innerHTML = "";
    abilities.forEach(a => {
        const finalThreat = a.dmg * a.threatMod;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="text-left" style="font-weight:600; color:#fff;">${a.name}</td>
            <td class="text-left scaling-formula-preview" style="color:#aaa;">${a.formula}</td>
            <td class="text-right" style="color:var(--druid-orange); font-weight:700;">${a.dmg.toFixed(1)}</td>
            <td class="text-right" style="color:#90caf9;">${a.threatMod.toFixed(2)}x</td>
            <td class="text-right" style="color:var(--rage-red); font-weight:700; font-size:1.05rem;">${finalThreat.toFixed(1)}</td>
        `;
        tb.appendChild(tr);
    });
}

function updateBossArmorBar() {
    var baseArmor = parseFloat(document.getElementById("enemy_armor")?.value || 0);
    
    var debuffArmor = 0;
    if (document.getElementById("debuff_major_armor")?.checked) debuffArmor += 2550;
    if (document.getElementById("debuff_ff")?.checked) debuffArmor += 505;
    if (document.getElementById("debuff_cor")?.checked) debuffArmor += 640;
    if (document.getElementById("debuff_eskhandar")?.checked) debuffArmor += 250;
    
    var arp = parseFloat(document.getElementById("stat_arp")?.value || 0);
    
    var effectiveArmor = Math.max(0, baseArmor - debuffArmor - arp);
    
    var dr = effectiveArmor / (effectiveArmor + 400 + (85 * 60));
    var drPct = (dr * 100).toFixed(1);
    
    var valEl = document.getElementById("ui_boss_armor_val");
    var barEl = document.getElementById("ui_boss_dr_bar");
    var drEl = document.getElementById("ui_boss_dr_val");
    
    if (valEl) valEl.innerText = Math.floor(effectiveArmor);
    if (drEl) drEl.innerText = drPct + "%";
    if (barEl) barEl.style.width = drPct + "%";
}

function openOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.remove('hidden');
}

function closeOtherSimsModal() {
    var modal = document.getElementById('otherSimsModal');
    if (modal) modal.classList.add('hidden');
}

function openGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("Modal mit der ID 'gearPresetModal' wurde nicht gefunden!");
    }
}

function closeGearPresetModal() {
    var modal = document.getElementById('gearPresetModal');
    if (modal) modal.classList.add('hidden');
}

window.loadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel || !sel.value) { 
        if(typeof showToast === 'function') showToast("Please select a preset from the dropdown first."); 
        return; 
    }
    openGearPresetModal();
};

window.confirmLoadBiSPreset = function() {
    var sel = document.getElementById("bis_preset_select");
    if (!sel) return;
    var val = sel.value;

    var preset = null;
    if (val.startsWith("def_")) {
        var k = val.substring(4);
        preset = GEAR_PRESETS[k];
    } else if (val.startsWith("cus_")) {
        var k = val.substring(4);
        var custom = JSON.parse(localStorage.getItem("boomkin_sim_custom_gear") || "{}");
        preset = custom[k];
    }

    if (!preset) {
        closeGearPresetModal();
        return;
    }

    GEAR_SELECTION = {};
    ENCHANT_SELECTION = {};

    if (preset.gear) {
        for (var slot in preset.gear) {
            if (preset.gear[slot] !== 0 && preset.gear[slot] !== "") {
                GEAR_SELECTION[slot] = preset.gear[slot];
            }
        }
    }
    if (preset.enchants) {
        for (var slot in preset.enchants) {
            if (preset.enchants[slot] !== 0 && preset.enchants[slot] !== "") {
                ENCHANT_SELECTION[slot] = preset.enchants[slot];
            }
        }
    }

    if (typeof initGearPlannerUI === 'function') initGearPlannerUI();
    saveCurrentState();
    
    closeGearPresetModal();
    if(typeof showToast === 'function') showToast("Gear Preset loaded!");
};

document.addEventListener('keydown', function (e) {
    if (e.key === "Escape") {
        closeOtherSimsModal();
        closeGearPresetModal();
        if (typeof closeItemModal === 'function') closeItemModal();
        if (typeof closeEnchantModal === 'function') closeEnchantModal();
        if (typeof closeImportConfigModal === 'function') closeImportConfigModal();
    }
});

// ============================================================================
// EXPORT & IMPORT (URL & JSON STRINGS)
// ============================================================================

function exportSettings() {
    if (typeof saveCurrentState === 'function') saveCurrentState();
    
    // Komplettes Master-Objekt bauen
    var fullPayload = {
        config: SIM_LIST[ACTIVE_SIM_INDEX].config,
        gear: GEAR_SELECTION,
        enchants: ENCHANT_SELECTION,
        talents: TALENT_CONFIG,
        rotation: CUSTOM_ROTATION
    };
    
    var compressed = LZString.compressToEncodedURIComponent(JSON.stringify(fullPayload));
    var url = window.location.origin + window.location.pathname + "?build=" + compressed;
    
    navigator.clipboard.writeText(url).then(function() {
        if(typeof showToast === 'function') showToast("Full Sim URL copied to clipboard!");
    });
}

function importFromClipboard() {
    var modal = document.getElementById('importConfigModal');
    var textarea = document.getElementById('importConfigInput');
    if (modal && textarea) {
        textarea.value = ""; 
        modal.classList.remove('hidden');
        textarea.focus();
    }
}

function closeImportConfigModal() {
    var modal = document.getElementById('importConfigModal');
    if (modal) modal.classList.add('hidden');
}

function confirmImportConfig() {
    var textarea = document.getElementById('importConfigInput');
    if (!textarea) return;
    var input = textarea.value.trim();
    
    if (!input) {
        if(typeof showToast === 'function') showToast("Please paste a valid config string.");
        return;
    }

    if (ITEM_DB.length === 0) {
        alert("Database not loaded yet. Please wait a moment.");
        return;
    }

    var b64 = input;
    // Parameter auswerten
    if (input.includes("?build=")) { b64 = input.split("?build=")[1]; }
    else if (input.includes("?s=")) { b64 = input.split("?s=")[1]; }

    try {
        var json = null;
        if (typeof LZString !== 'undefined') {
            json = LZString.decompressFromEncodedURIComponent(b64);
        }
        if (!json) {
            try { json = atob(b64); } catch (e) { }
        }

        if (!json) throw new Error("Could not decode string");

        var data = JSON.parse(json);
        
        var newId = Date.now() + Math.floor(Math.random() * 1000);
        var simName = "Imported Build";
        if (data.config && data.config.simName) simName = data.config.simName + " (Imp)";
        
        var newSim = new SimObject(newId, simName);

        // Überprüfe ob es sich um das neue Master-Objekt handelt
        if (data.config && (data.gear || data.talents || data.rotation)) {
            newSim.config = data.config;
            newSim.gear = data.gear || {};
            newSim.enchants = data.enchants || {};
            
            // Packe Talente und Rotation mit in die config, 
            // damit applyConfigToUI() sie nativ verarbeiten kann
            if (data.talents) newSim.config.talents = data.talents;
            if (data.rotation) newSim.config.custom_rotation = data.rotation;
        } else {
            // Legacy Fallback (alte Save-Strings ohne Master-Struktur)
            if (Array.isArray(data)) {
                data = data[0]; // Erstes Array-Element bei Multi-Sims
            }
            if (data.d) {
                newSim.config = typeof unpackConfig === 'function' ? unpackConfig(data.d) : data.d;
            } else if (data.config) {
                newSim.config = data.config;
            } else {
                newSim.config = typeof unpackConfig === 'function' ? unpackConfig(data) : data;
            }
        }

        SIM_LIST.push(newSim);

        closeImportConfigModal();
        renderSidebar();
        switchSim(SIM_LIST.length - 1);
        if(typeof showToast === 'function') showToast("Imported successfully!");

    } catch (e) {
        console.error(e);
        alert("Invalid Config String! Make sure you copied the entire URL or Code.");
    }
}