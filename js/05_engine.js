/**
 * Bear Tank Simulation - File 5: Simulation Engine & Math
 * Updated for Turtle WoW 1.18 (Dire Bear Tank)
 * Features:
 * - Exact Turtle WoW Scaling for Maul, Swipe, Savage Bite
 * - Omen of Clarity (Clearcasting) Logic
 * - Multiplicative Haste calculation
 * - Dynamic Armor Mitigation (No Cap) & Exact Threat Multipliers
 */

// ============================================================================
// SIMULATION ENTRY POINT
// ============================================================================

function runSimulation() {
    var config = getSimInputs();
    if (config.simCount < 1) config.simCount = 1;

    showProgress("Simulating Tank Combat...");

    // Seed-Vorbereitung (Analog zur Boomkin-Sim)
    var baseSeed = 0;
    // Wenn es ein UI-Feld für den Seed gibt, nutze es. Ansonsten nimm was zufälliges.
    var uiSeed = document.getElementById("rng_seed") ? document.getElementById("rng_seed").value : ""; 
    
    if (uiSeed && uiSeed.toString().trim().length > 0) {
        var str = uiSeed.toString().trim();
        for (var k = 0; k < str.length; k++) {
            baseSeed = ((baseSeed << 5) - baseSeed) + str.charCodeAt(k);
            baseSeed |= 0;
        }
    } else {
        baseSeed = Math.floor(Math.random() * 0xFFFFFFFF);
    }

    var allResults = [];
    var i = 0;
    var batchSize = 50; 
    var logCaptured = false;

    function processBatch() {
        try {
            var target = Math.min(config.simCount, i + batchSize);
            for (; i < target; i++) {
                // NEU: Seed pro Iteration hochzählen für Varianz
                config.sim_seed = baseSeed + i;
                
                // Determine if we should capture a detailed combat log for this run
                var captureLog = (!logCaptured && i === Math.floor(config.simCount / 2));
                if (captureLog) logCaptured = true;

                var simResult = runSingleSim(config, captureLog);
                allResults.push(simResult);
            }

            updateProgress((i / config.simCount) * 100);

            if (i < config.simCount) {
                requestAnimationFrame(processBatch);
            } else {
                finalizeSimulation(allResults, config);
            }
        } catch (err) {
            console.error("Simulation crashed:", err);
            hideProgress();
        }
    }
    
    requestAnimationFrame(processBatch);
}

function runSingleSim(config, captureLog) {
    var log = [];
    
    // KORREKTUR: Zwei getrennte RNG-Streams, damit Stat-Änderungen (z.B. Haste) 
    // den Boss nicht entsynchronisieren!
    var rngPlayer = new RNGHandler(config.sim_seed);
    var rngBoss = new RNGHandler(config.sim_seed + 1234567); // Fester Offset für den Boss

    // --- DYNAMIC STAT HELPERS ---
    function getHasteMult() {
        var hasteMult = 1.0;
        if (config.stat_haste > 0) hasteMult *= (1 + (config.stat_haste / 100));
        if (state.buffs.bloodFrenzyAS > 0) hasteMult *= 1.20;
        if (state.buffs.spider > 0) hasteMult *= 1.20; 
        if (config.consum_quickness && state.time <= 30.0) hasteMult *= 1.05;
        return hasteMult;
    }

    function getCurrentAP() {
        var ap = config.stat_ap;
        if (state.buffs.earthstrike > 0) ap += 280;
        if (state.buffs.jomgabbar > 0) {
            var ticks = Math.floor((20.0 - state.buffs.jomgabbar) / 2.0);
            ap += (65 + ticks * 17);
        }
        if (state.buffs.mightyRage > 0) ap += 120;
        if (state.buffs.slayersCrest > 0) ap += 260;
        if (state.buffs.ursaRoar > 0) ap += 50; 
        return ap;
    }

    function getCurrentArmor() {
        var currentArmor = config.stat_armor; // Basis Rüstung
        if (state.buffs.enrage > 0) currentArmor *= 0.84; 
        if (state.buffs.zhm > 0) {
            var zhmTicks = Math.floor((20.0 - state.buffs.zhm) / 2.0);
            currentArmor += (2000 - (zhmTicks * 200));
        }
        if (state.buffs.obsidianScale > 0 && state.obsidianScales > 0) {
            currentArmor += 600;
        }
        if (state.buffs.lionHorn > 0) {
            currentArmor += 250;
        }
        return Math.floor(currentArmor);
    }

    function logAction(time, event, ability, result, dmg, threat, hpChange, rageChange, info) {
        if (!captureLog) return;
        
        var activeBuffs = {};
        
        // Tracking der Proccs & Debuffs
        var track = ["enrage", "barkskin", "ancientBrutalityICD", "clearcasting", "earthstrike", "jomgabbar", "zhm", "mightyRage"];
        
        track.forEach(key => {
            var val = state.buffs[key];
            if (typeof val === 'number' && val > 0) {
                activeBuffs[key] = parseFloat(val.toFixed(1)); // Zahl (Restlaufzeit)
            } else if (typeof val === 'boolean' && val === true) {
                activeBuffs[key] = "✓"; // Boolean (Omen of Clarity ist aktiv)
            }
        });
        
        if (state.debuffs.faerieFire > 0) activeBuffs["faerieFire"] = parseFloat(state.debuffs.faerieFire.toFixed(1));
        if (state.debuffs.demoralizingRoar > 0) activeBuffs["demoRoar"] = parseFloat(state.debuffs.demoralizingRoar.toFixed(1));

        // Dynamische Werte exakt abgreifen
        var curAP = getCurrentAP(); 
        var curArmor = getCurrentArmor();
        var hasteMod = getHasteMult();

        log.push({
            time: time,
            event: event, 
            ability: ability,
            result: result,
            dmg: dmg,
            threat: threat,
            hp: config.stat_hp,
            hpChange: hpChange,
            rage: state.rage,
            rageChange: rageChange,
            armor: curArmor,
            ap: curAP,
            haste: ((hasteMod - 1) * 100),
            arp: config.stat_arp,
            activeBuffs: activeBuffs,
            info: info
        });
    }

    // --- STATE INITIALIZATION ---
    // Furor 5/5 gibt 10 Wut, Gift of Ferocity gibt 5 Wut
    var initialRage = 10;
    if (config.hasGiftOfFerocity || config.gear_gift_of_ferocity) initialRage += 5;

    var state = {
        time: 0,
        rage: initialRage,
        died: false,               
        deathEvent: null,
        threat: 0,
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,

        // NEU: Zähler für die Tabellen
        counters: {
            bearWhite: { swings: 0, misses: 0, dodges: 0, parries: 0, glances: 0, crits: 0, hits: 0 },
            boss: { swings: 0, misses: 0, dodges: 0, crits: 0, crushes: 0, hits: 0 }
        },
        
        // Cooldowns & Timers
        gcd: 0,
        savageBiteCD: 0,
        ursaStacks: 0,           
        dreamwalkerStacks: 0,    
        obsidianScales: 0,       
        feralChargeCD: 0,
        playerSwingTimer: 0, // Startet bei 0, damit der erste Hit sofort ausgeführt wird!
        bossSwingTimer: config.boss_attack_speed,   // Startet bei 0, damit der Boss sofort zuschlägt!
        
        // Attack Queue
        maulQueued: false,

        // Ancient Brutality Tracking
        abTicksLeft: 0,
        nextABTick: 0,

        // ... in state unter "nextABTick: 0," einfügen:
        nextFRTick: 0, // Frenzied Regeneration Tick Timer

        cooldowns: { trinketShared: 0, earthstrike: 0, jomgabbar: 0, zhm: 0, potion: 0, barkskin: 0, slayersCrest: 0, kissOfSpider: 0, frenziedRegen: 0 },
        buffs: { enrage: 0, barkskinCharges: 0, ancientBrutalityICD: 0, bloodFrenzyAS: 0, clearcasting: false, earthstrike: 0, jomgabbar: 0, zhm: 0, mightyRage: 0, slayersCrest: 0, spider: 0,
                 ursaRoar: 0, dreamwalkerDuration: 0, obsidianScale: 0,
                 lionHorn: 0, castellan: 0, forceOfWill: 0, frenziedRegen: 0 }, 
        debuffs: { faerieFire: 0, demoralizingRoar: 0 , giftOfArthas: 0},
        abilityStats: {},

        bossMechanicCD: 10.0, // Erster Einsatz der Fähigkeit nach 10 Sekunden
        bossBuffs: { frenzy: 0 },
        playerDebuffs: { mortalStrike: 0 }
    };



    // --- NEU: EFFECT DETECTION ---
    var effects = {
        idolBrutality: false, 
        critDmgRedPct: 0,
        savageBiteCostMod: 1.0,
        ffCooldownRed: 0,
        extraAttackChance: 0,
        leechPct: 0,
        ursa3p: false, ursa5p: false,
        dreamwalker8p: false,
        obsidianScale: false, lionHorn: false, shawlCastellan: false,
        mossheart: false, lashers: false, hornEngryss: false,
        forceOfWill: false, slayersCrest: false, kissOfSpider: false
    };

    var setCounts = {};
    for (var slot in config.gear) {
        var itemId = config.gear[slot];
        if (itemId && typeof ITEM_ID_MAP !== 'undefined' && ITEM_ID_MAP[itemId]) {
            var item = ITEM_ID_MAP[itemId];
            if (item.setName) setCounts[item.setName] = (setCounts[item.setName] || 0) + 1;
            
            // Einzel-Items prüfen
            if (item.name === "Idol of Brutality") effects.idolBrutality = true;
            if (item.name === "Champion's Insignia") effects.critDmgRedPct += 6;
            if (item.name === "Smuggled First War Insignia") effects.critDmgRedPct += 3;
            if (item.name === "Grail of Forgotten Memories") effects.leechPct += 3;
            if (item.name === "Tooth of the Packlord") effects.leechPct += 2;
            if (item.name === "Mossheart's Heart") effects.mossheart = true;
            if (item.name === "Lasher's Whip") effects.lashers = true;
            if (item.name === "Horn of Engryss") effects.hornEngryss = true;
            if (item.name === "Force of Will") effects.forceOfWill = true;
            if (item.name === "Hand of Justice") effects.extraAttackChance += 2;
            if (item.name === "Ignited Obsidian Scale") effects.obsidianScale = true;
            if (item.name === "The Lion Horn of Stormwind") effects.lionHorn = true;
            if (item.name === "Shawl of the Castellan") effects.shawlCastellan = true;
            
            // On-Use Trinkets
            if (item.name === "Slayer's Crest") effects.slayersCrest = true;
            if (item.name === "Kiss of the Spider") effects.kissOfSpider = true;
        }
    }

    // Extra Attack "Enchants" checken
    // (Annahme: Surrender to Madness wird als Enchant-Name hinterlegt)
    for (var slot in config.enchants) {
        var enchId = config.enchants[slot];
        if (enchId && typeof ENCHANT_DB !== 'undefined') {
            var ench = ENCHANT_DB.find(e => e.id == enchId);
            if (ench && ench.name === "Surrender to Madness") effects.extraAttackChance += 2;
        }
    }

    // Set-Boni auswerten (Mechaniken)
    if (setCounts["Veneran's Sanctuary"] >= 6) effects.critDmgRedPct += 6;
    if (setCounts["Warlord's Sanctuary"] >= 2) effects.critDmgRedPct += 3;
    if (setCounts["Combatant's Sanctuary"] >= 6) effects.critDmgRedPct += 3;
    if (setCounts["Rage of the Ursa"] >= 3) effects.ursa3p = true;
    if (setCounts["Rage of the Ursa"] >= 5) effects.ursa5p = true;
    if (setCounts["Stormrage Harness"] >= 5) effects.savageBiteCostMod = 0.5;
    if (setCounts["Stormrage Harness"] >= 8) effects.stormrage8p = true;
    if (setCounts["Dreamwalker Harness"] >= 8) effects.dreamwalker8p = true;
    if (setCounts["Cenarion Harness"] >= 3) effects.ffCooldownRed = 2.0;

    // Initialisiere Obsidian Scale (Startet mit 10 Schuppen)
    if (effects.obsidianScale) state.obsidianScales = 10;

    var maxTime = config.simTime;
    var timeStep = 0.05; // 50ms Engine Tick

    // --- TALENTS & MODIFIERS ---
    var feralInstinctMod = 1.15; 
    var natWepMod = 1.10; 
    var predStrikeDmgMod = 1.20; 
    var ferocityCostReduction = 5;

    // Base Threat Multipliers (multiplied by Feral Instinct)
    var threatMods = {
        auto: 1.30 * feralInstinctMod,
        maul: 1.95 * feralInstinctMod,
        swipe: 1.75 * feralInstinctMod,
        savageBite: 2.60 * feralInstinctMod,
        faerieFire: 108 * feralInstinctMod,
        demoRoar: 40 * feralInstinctMod
    };

    var bossLevel = config.enemy_level;
    var bossBaseDmg = config.boss_base_dmg;
    
    // Avoidance Table (Boss hits Bear)
    var bossMissChance = Math.max(0, 5.0 + ((config.stat_defense - (bossLevel * 5)) * 0.04));
    var bossDodgeChance = config.stat_dodge; 
    var bossCritChance = Math.max(0, 5.0 + ((bossLevel - 60) * 0.2) - ((config.stat_defense - (bossLevel * 5)) * 0.04));
    var bossCrushChance = (bossLevel > 62) ? 15.0 : 0; 

    // Player Attack Table (Bear hits Boss)
    var hitBonus = config.stat_hit;
    var missChance = Math.max(0, 8.0 - hitBonus); // Level 63 boss 8% hit cap
    var dodgeChance = 5.6; 
    var parryChance = 14.0; // Standard boss parry from front
    var critChance = Math.max(0, config.stat_crit - 4.8); // Crit suppression vs level 63

    // Mitigation
    var baseArmor = config.stat_armor;



    function getCurrentSwingTime() {
        return 2.5 / getHasteMult(); // 2.5 ist die Base Attack Speed vom Bären
    }


    // Initialize first swing timer
    //state.playerSwingTimer = getCurrentSwingTime();

    // ========================================================================
    // COMBAT LOOP
    // ========================================================================


    while (state.time <= maxTime) {
        
        // --- 1. HANDLE BUFFS & TICKS ---
        if (state.abTicksLeft > 0 && state.time >= state.nextABTick) {
            state.rage = Math.min(100, state.rage + 4); // TURTLE KORREKTUR: 4 Wut pro Tick
            state.abTicksLeft--;
            state.nextABTick = state.time + 1.0; 
            logAction(state.time, "Tick", "Ancient Brutality", "Tick", 0, 0, 0, 4, "4 Rage");
        }

        // --- NEU: Frenzied Regeneration Tick ---
        if (state.buffs.frenziedRegen > 0 && state.time >= state.nextFRTick) {
            var rageDrained = Math.min(10, state.rage); // Zieht max 10 Wut pro Sekunde
            state.rage -= rageDrained;
            
            // Turtle WoW Custom Scaling: 1 Wut = 8% der Gesamt-Ausdauer (Stamina)
            var healPerRage = config.stat_sta * 0.08;
            var healAmount = Math.floor(rageDrained * healPerRage);
            
            // Mortal Strike halbiert die Heilung!
            if (state.playerDebuffs.mortalStrike > 0) healAmount = Math.floor(healAmount * 0.5);

            if (healAmount > 0) {
                state.healingDone += healAmount;
                var healThreat = healAmount * 0.5 * feralInstinctMod; // Heilung erzeugt 0.5 Bedrohung
                state.threat += healThreat;
                logAction(state.time, "Tick", "Frenzied Regeneration", "Healed", healAmount, healThreat, healAmount, -rageDrained, "1 Rage = " + healPerRage.toFixed(1) + " HP");
            }
            state.nextFRTick = state.time + 1.0; 
        }

        // Timer für Boss & Player Debuffs herunterzählen
        if (state.bossBuffs.frenzy > 0) state.bossBuffs.frenzy -= timeStep;
        if (state.playerDebuffs.mortalStrike > 0) state.playerDebuffs.mortalStrike -= timeStep;
        if (state.bossMechanicCD > 0) state.bossMechanicCD -= timeStep;

        // --- 2. BOSS ATTACKS BEAR (DAMAGE TAKEN) ---

        // Helper-Funktion für Boss-Angriffe (damit Normal-Hits und Abilities die gleiche Rüstungslogik nutzen)
        function executeBossAttack(isAbility, abilityName, baseDamage) {
            var roll = rngBoss.nextFloat() * 100;
            var damage = baseDamage * (0.9 + rngBoss.nextFloat() * 0.2); 
            
            var demoRoarMod = (config.tal_flex === "aggression") ? 0.884 : 0.90;
            if (state.debuffs.demoralizingRoar > 0) damage *= demoRoarMod;

            if (!isAbility) state.counters.boss.swings++; 

            var curBossMiss = bossMissChance;
            var curBossDodge = bossDodgeChance;
            var curBossCrit = bossCritChance;

            if (state.buffs.castellan > 0) curBossDodge += 35.0;
            if (effects.stormrage8p && state.buffs.frenziedRegen > 0) {
                curBossMiss += (30 * 0.04);
                curBossDodge += (30 * 0.04);
                curBossCrit = Math.max(0, curBossCrit - (30 * 0.04));
            }

            var atkLabel = isAbility ? abilityName : "Boss Attack";

            if (roll < curBossMiss) {
                if (!isAbility) state.counters.boss.misses++; 
                logAction(state.time, "Avoidance", atkLabel, "MISS", 0, 0, 0, 0, "");
            } else if (roll < curBossMiss + curBossDodge) {
                if (!isAbility) state.counters.boss.dodges++; 
                logAction(state.time, "Avoidance", atkLabel, "DODGE", 0, 0, 0, 0, "");
                if (state.buffs.ancientBrutalityICD <= 0) {
                    state.abTicksLeft = 5;
                    state.nextABTick = state.time + 1.0; 
                    state.buffs.ancientBrutalityICD = 9.0;
                    logAction(state.time, "Proc", "Spirit of the Ancient", "Applied", 0, 0, 0, 0, "Ancient Brutality ICD triggered");
                }
            } else {
                var isCrit = false;
                var isCrush = false;
                
                // Abilities blockieren Crushing Blows, aber erlauben Crits
                var allowCrush = !isAbility && (bossCrushChance > 0);

                if (roll > 100 - curBossCrit) {
                    damage *= 2.0;
                    if (effects.critDmgRedPct > 0) damage *= (1.0 - (effects.critDmgRedPct / 100.0));
                    isCrit = true;
                    if (!isAbility) state.counters.boss.crits++; 
                } else if (allowCrush && roll > 100 - curBossCrit - bossCrushChance) {
                    damage *= 1.5;
                    isCrush = true;
                    if (!isAbility) state.counters.boss.crushes++; 
                } else {
                    if (!isAbility) state.counters.boss.hits++; 
                }

                var currentArmor = getCurrentArmor();
                var dr = currentArmor / (currentArmor + 400 + 85 * bossLevel);          
                var finalDamageTaken = Math.floor(damage * (1 - dr));

                if (state.buffs.dreamwalkerDuration > 0 && state.dreamwalkerStacks > 0) finalDamageTaken = Math.floor(finalDamageTaken * (1.0 - (0.02 * state.dreamwalkerStacks)));
                if (state.buffs.forceOfWill > 0) finalDamageTaken = Math.max(0, finalDamageTaken - 25);
                
                if (state.buffs.barkskinCharges > 0) {
                    finalDamageTaken = Math.floor(finalDamageTaken * 0.50);
                    state.buffs.barkskinCharges--;
                }

                state.damageTaken += finalDamageTaken;

                // One-Shot Detection
                if (finalDamageTaken >= config.stat_hp && !state.died) {
                    state.died = true;
                    var typeStr = isCrit ? "Critical Strike" : (isCrush ? "Crushing Blow" : "Melee Hit");
                    state.deathEvent = { time: state.time, type: typeStr + " (" + atkLabel + ")", damage: finalDamageTaken };
                }

                // Item Procs (When Struck)
                if (effects.lionHorn && rngBoss.nextFloat() * 100 < 1.0) { state.buffs.lionHorn = 30.0; logAction(state.time, "Proc", "Lion Horn", "Applied", 0, 0, 0, 0, "+250 Armor"); }
                if (effects.shawlCastellan && rngBoss.nextFloat() * 100 < 1.0) { state.buffs.castellan = 5.0; logAction(state.time, "Proc", "Shawl Castellan", "Applied", 0, 0, 0, 0, "+35% Dodge"); }
                if (effects.forceOfWill && rngBoss.nextFloat() * 100 < 1.0) { state.buffs.forceOfWill = 10.0; logAction(state.time, "Proc", "Force of Will", "Applied", 0, 0, 0, 0, "-25 Melee Dmg"); }
                
                if (state.buffs.obsidianScale > 0 && state.obsidianScales > 0) {
                    state.obsidianScales--;
                    if (state.obsidianScales === 0) {
                        state.buffs.obsidianScale = 0; state.damageDealt += 400; state.threat += 400;
                        if (!state.abilityStats["Obsidian Explosion"]) state.abilityStats["Obsidian Explosion"] = { count: 0, dmg: 0, crits: 0, glances: 0 };
                        state.abilityStats["Obsidian Explosion"].count++; state.abilityStats["Obsidian Explosion"].dmg += 400;
                        logAction(state.time, "Cast", "Obsidian Explosion", "Hit", 400, 400, 0, 0, "Scales depleted");
                    }
                }
                if (effects.obsidianScale && rngBoss.nextFloat() * 100 < 3.0) {
                    state.buffs.obsidianScale = 20.0; state.obsidianScales = 10;
                    logAction(state.time, "Proc", "Ignited Obsidian Scale", "Applied", 0, 0, 0, 0, "+600 Armor");
                }

                // Rage Calculation
                var rageConversion = 109.06;
                var rageGained = Math.floor((finalDamageTaken / rageConversion) * 2.5);
                state.rage = Math.min(100, state.rage + rageGained);

                var hitType = isCrit ? "CRIT" : (isCrush ? "CRUSH" : "HIT");
                logAction(state.time, "Damage Taken", atkLabel, hitType, finalDamageTaken, 0, -finalDamageTaken, rageGained, (dr*100).toFixed(1) + "% Mitigated");
                
                // Thorns & Retribution Items
                var thornsDmg = 18;
                var thornsThreat = thornsDmg * threatMods.auto; 
                state.damageDealt += thornsDmg; state.threat += thornsThreat;
                if (!state.abilityStats["Thorns"]) state.abilityStats["Thorns"] = { count: 0, dmg: 0, crits: 0, glances: 0 };
                state.abilityStats["Thorns"].count++; state.abilityStats["Thorns"].dmg += thornsDmg;

                if (config.consum_arthas && rngBoss.nextFloat() * 100 < 30.0) {
                    if (state.debuffs.giftOfArthas <= 0) logAction(state.time, "Proc", "Gift of Arthas", "Applied", 0, 0, 0, 0, "+8 phys dmg taken");
                    state.debuffs.giftOfArthas = 180.0;
                }

                var retriDmg = 0;
                if (effects.mossheart) retriDmg += 1;
                if (effects.lashers) retriDmg += 4;
                if (effects.hornEngryss) retriDmg += 4;
                
                if (retriDmg > 0) {
                    state.damageDealt += retriDmg;
                    if (!state.abilityStats["Retribution Items"]) state.abilityStats["Retribution Items"] = { count: 0, dmg: 0, crits: 0, glances: 0 };
                    state.abilityStats["Retribution Items"].count++; state.abilityStats["Retribution Items"].dmg += retriDmg;
                    logAction(state.time, "Cast", "Retribution Items", "Reflect", retriDmg, 0, 0, 0, "No Threat");
                }
                logAction(state.time, "Cast", "Thorns", "Reflect", thornsDmg, thornsThreat, 0, 0, "");
            }
        } // End Helper

        // 2.a BOSS MECHANIC TRIGGER (Spike Damage)
        var bossConfig = BOSS_PRESETS[config.enemy_boss_select];
        if (config.enemy_mechanics && bossConfig && state.bossMechanicCD <= 0) {
            var mechanic = bossConfig.mechanics;
            
            if (mechanic === "frenzy") {
                state.bossBuffs.frenzy = 8.0;
                state.bossMechanicCD = 15.0 + (rngBoss.nextFloat() * 5.0); // CD: 15-20s
                logAction(state.time, "Mechanic", "Boss Frenzy", "Applied", 0, 0, 0, 0, "+100% Attack Speed for 8s");
            } 
            else if (mechanic === "cleave") {
                executeBossAttack(true, "Cleave", bossBaseDmg + 500); // Cleave hat Flat Bonus Schaden
                state.bossMechanicCD = 8.0 + (rngBoss.nextFloat() * 4.0); // CD: 8-12s
            } 
            else if (mechanic === "mortal_strike") {
                executeBossAttack(true, "Mortal Strike", bossBaseDmg * 2.0); // 200% Waffenschaden
                state.playerDebuffs.mortalStrike = 5.0; // MS hemmt die Heilung für 5 Sekunden
                state.bossMechanicCD = 10.0 + (rngBoss.nextFloat() * 5.0); // CD: 10-15s
                logAction(state.time, "Debuff", "Mortal Strike", "Applied", 0, 0, 0, 0, "-50% Healing Received");
            }
        }

        // 2.b NORMAL BOSS ATTACK (White Hits)
        if (state.bossSwingTimer <= 0) {
            executeBossAttack(false, "Melee Swing", bossBaseDmg);
            
            // Swing Timer resetten - Frenzy verdoppelt die Angriffsgeschwindigkeit (Halbe Animationszeit)
            var bSpeed = config.boss_attack_speed;
            if (state.bossBuffs.frenzy > 0) bSpeed /= 2.0; 
            state.bossSwingTimer = bSpeed;
        }

        // --- 3. BEAR ABILITIES (INSTANTS & QUEUES) ---
        var canAct = state.gcd <= 0;

        for (var s = 0; s < config.rotation.steps.length; s++) {
            var step = config.rotation.steps[s];
            if (step.disabled) continue;

            // Check Conditions (Logik bleibt unverändert)
            var conditionsMet = true;
            for (var c = 0; c < step.conditions.length; c++) {
                var cond = step.conditions[c];
                var valToCheck = 0;
                if (cond.type === "rage") valToCheck = state.rage;
                if (cond.type === "time_elapsed") valToCheck = state.time;
                if (cond.type === "debuff_rem") valToCheck = state.debuffs[cond.target === "Faerie Fire" ? "faerieFire" : "demoralizingRoar"];
                
                if (cond.op === ">=" && !(valToCheck >= cond.val)) { conditionsMet = false; break; }
                if (cond.op === "<=" && !(valToCheck <= cond.val)) { conditionsMet = false; break; }
                if (cond.op === "==" && !(valToCheck == cond.val)) { conditionsMet = false; break; }
            }

            if (conditionsMet) {
                var isClearcast = state.buffs.clearcasting;

                // --- NON-GCD ABILITIES (Können IMMER gewirkt werden) ---
                if (step.skill === "Maul" && !state.maulQueued) {
                    var idolRed = effects.idolBrutality ? 3 : 0;
                    var maulCost = isClearcast ? 0 : Math.max(0, 15 - ferocityCostReduction - idolRed);
                    if (state.rage >= maulCost) {
                        state.maulQueued = true;
                    }
                }
                else if (step.skill === "Savage Bite" && state.savageBiteCD <= 0) {
                    var baseCost = 30 * effects.savageBiteCostMod; // 50% Reduktion durch Stormrage
                    var cost = isClearcast ? 0 : Math.max(0, baseCost - ferocityCostReduction);
                    if (state.rage >= cost) {
                        state.rage -= cost;
                        // NEU: Dreamwalker 8/8
                        if (effects.dreamwalker8p) {
                            state.dreamwalkerStacks = Math.min(4, state.dreamwalkerStacks + 1);
                            state.buffs.dreamwalkerDuration = 15.0;
                            logAction(state.time, "Proc", "Dreamwalker (8/8)", "Applied", 0, 0, 0, 0, state.dreamwalkerStacks + " Stacks (-" + (state.dreamwalkerStacks * 2) + "% Dmg Taken)");
                        }
                        
                        if (isClearcast) state.buffs.clearcasting = false;

                        var apDelta = Math.max(0, getCurrentAP() - 300);
                        var baseRoll = 178 + rngPlayer.nextFloat() * (241 - 178); // Varianz einfügen
                        var autoBase = (baseRoll + (0.175 * apDelta)) * natWepMod;
                        var biteDmg = ((autoBase * 0.80) + 30) * predStrikeDmgMod;

                        resolvePlayerAttack(biteDmg, "Savage Bite", threatMods.savageBite, missChance, dodgeChance, parryChance, critChance, config, state, logAction, cost === 0, cost, rngPlayer, effects);
                        state.savageBiteCD = 6.0;
                    }
                }
                else if (step.skill === "Enrage" && state.buffs.enrage <= 0) {
                    state.buffs.enrage = 10.0;
                    // Blood Frenzy 2/2 ist immer aktiv
                    state.rage = Math.min(100, state.rage + 10);
                        
                    var oldFullSwing = getCurrentSwingTime();
                    state.buffs.bloodFrenzyAS = 18.0; 
                    var newFullSwing = getCurrentSwingTime();
                        
                    var ratio = state.playerSwingTimer / oldFullSwing; 
                    state.playerSwingTimer = newFullSwing * ratio; 
                    
                    logAction(state.time, "Buff", "Enrage", "Applied", 0, 0, 0, 10, "Armor reduced, +10 Rage, +20% AS");
                }
                else if (step.skill === "Trinket 1" || step.skill === "Trinket 2") {
                    if (state.cooldowns.trinketShared <= 0) {
                        if (config.trinket_earthstrike && state.cooldowns.earthstrike <= 0) {
                            state.buffs.earthstrike = 20.0; state.cooldowns.earthstrike = 120.0; state.cooldowns.trinketShared = 10.0;
                            logAction(state.time, "Buff", "Earthstrike", "Activated", 0, 0, 0, 0, "+280 AP");
                        } else if (config.trinket_jomgabbar && state.cooldowns.jomgabbar <= 0) {
                            state.buffs.jomgabbar = 20.0; state.cooldowns.jomgabbar = 120.0; state.cooldowns.trinketShared = 10.0;
                            logAction(state.time, "Buff", "Jom Gabbar", "Activated", 0, 0, 0, 0, "Stacking AP");
                        } else if (config.trinket_zhm && state.cooldowns.zhm <= 0) {
                            state.buffs.zhm = 20.0; state.cooldowns.zhm = 120.0; state.cooldowns.trinketShared = 10.0;
                            logAction(state.time, "Buff", "ZHM", "Activated", 0, 0, 0, 0, "+2000 Armor");
                        } else if (effects.slayersCrest && state.cooldowns.slayersCrest <= 0) {
                            state.buffs.slayersCrest = 20.0; state.cooldowns.slayersCrest = 120.0; state.cooldowns.trinketShared = 10.0;
                            logAction(state.time, "Buff", "Slayer's Crest", "Activated", 0, 0, 0, 0, "+260 AP");
                        } else if (effects.kissOfSpider && state.cooldowns.kissOfSpider <= 0) {
                            state.buffs.spider = 15.0; state.cooldowns.kissOfSpider = 120.0; state.cooldowns.trinketShared = 10.0;
                            logAction(state.time, "Buff", "Kiss of the Spider", "Activated", 0, 0, 0, 0, "+20% Attack Speed");
                        }
                    }
                }
                else if (step.skill === "Potion" && state.cooldowns.potion <= 0) {
                    if (config.consum_mighty_rage) {
                        var rageGain = 45 + rngPlayer.nextFloat() * 30;
                        state.rage = Math.min(100, state.rage + rageGain);
                        state.buffs.mightyRage = 20.0; state.cooldowns.potion = 120.0;
                        logAction(state.time, "Buff", "Mighty Rage Potion", "Drank", 0, 0, 0, Math.floor(rageGain), "+60 Str");
                    }
                }

                // --- GCD ABILITIES (Blockieren sich gegenseitig) ---
                else if (canAct) {
                    // NEU: Beachte den Hard-Cooldown von Faerie Fire
                    if (step.skill === "Faerie Fire" && state.debuffs.faerieFire <= 0 && state.cooldowns.faerieFire <= 0) {
                        state.debuffs.faerieFire = 40.0;
                        state.cooldowns.faerieFire = 6.0 - effects.ffCooldownRed; // Cenarion 3/8 Bonus
                        logAction(state.time, "Cast", "Faerie Fire", "Applied", 0, threatMods.faerieFire, 0, 0, "-505 Armor");
                        state.gcd = 1.0; canAct = false; 
                    }
                    // NEU: Barkskin Cast
                    else if (step.skill.includes("Barkskin") && state.cooldowns.barkskin <= 0) {
                        state.buffs.barkskinCharges = 15;
                        state.cooldowns.barkskin = 600.0; // 10 min CD
                        logAction(state.time, "Cast", "Barkskin", "Applied", 0, 0, 0, 0, "50% DR for 15 hits");
                        state.gcd = 1.5; canAct = false;
                    }
                    // --- NEU: Frenzied Regeneration ---
                    else if (step.skill === "Frenzied Regeneration" && state.cooldowns.frenziedRegen <= 0) {
                        state.buffs.frenziedRegen = 10.0;
                        state.cooldowns.frenziedRegen = 180.0; // 3 Minuten Cooldown
                        state.nextFRTick = state.time + 1.0;
                        if (isClearcast) state.buffs.clearcasting = false; // Kann Clearcast verbrauchen
                        logAction(state.time, "Cast", "Frenzied Regeneration", "Applied", 0, 0, 0, 0, "Drains Rage for HP");
                        state.gcd = 1.5; canAct = false;
                    }
                    else if (step.skill === "Demoralizing Roar" && state.debuffs.demoralizingRoar <= 0) {
                        var cost = isClearcast ? 0 : 10;
                        if (state.rage >= cost) {
                            state.rage -= cost;
                            if (isClearcast) state.buffs.clearcasting = false;
                            state.debuffs.demoralizingRoar = 30.0;
                            logAction(state.time, "Cast", "Demoralizing Roar", "Applied", 0, threatMods.demoRoar, 0, -cost, isClearcast ? "Clearcast!" : "");
                            state.gcd = 1.5; canAct = false;
                        }
                    }
                    else if (step.skill === "Swipe") {
                        var idolRed = effects.idolBrutality ? 3 : 0;
                        var cost = isClearcast ? 0 : Math.max(0, 20 - ferocityCostReduction - idolRed);
                        if (state.rage >= cost) {
                            state.rage -= cost;
                            if (isClearcast) state.buffs.clearcasting = false;
                            var apDelta = Math.max(0, getCurrentAP() - 300);
                            var swipeDmg = (94 + (0.038 * apDelta)) * predStrikeDmgMod * natWepMod;
                            resolvePlayerAttack(swipeDmg, "Swipe", threatMods.swipe, missChance, dodgeChance, parryChance, critChance, config, state, logAction, isClearcast, cost, rngPlayer, effects);
                            state.gcd = 1.5; canAct = false;
                        }
                    }
                    else if (step.skill === "Feral Charge" && state.feralChargeCD <= 0) {
                        var cost = isClearcast ? 0 : 5;
                        if (state.rage >= cost) {
                            state.rage -= cost;
                            if (isClearcast) state.buffs.clearcasting = false;
                            resolvePlayerAttack(0, "Feral Charge", 1.0, missChance, dodgeChance, parryChance, critChance, config, state, logAction, isClearcast, cost, rngPlayer, effects);
                            state.feralChargeCD = 15.0;
                            state.gcd = 1.5; canAct = false;
                        }
                    }
                }
            }
        }

        // --- 4. PLAYER SWING (AUTO ATTACK / MAUL) ---
        if (state.playerSwingTimer <= 0) {
            var isClearcast = state.buffs.clearcasting;
            var maulCost = Math.max(0, 15 - ferocityCostReduction - (effects.idolBrutality ? 3 : 0));
            
            var isMaul = state.maulQueued && (state.rage >= maulCost || isClearcast); 
            
            var skillName = isMaul ? "Maul" : "Auto Attack";
            var thMod = isMaul ? threatMods.maul : threatMods.auto;
            var usedClearcast = false;
            var actualCost = 0; // NEU: Speichert die tatsächlichen Kosten dieses Schlags

            if (isMaul) {
                if (isClearcast) {
                    state.buffs.clearcasting = false;
                    usedClearcast = true;
                } else {
                    state.rage -= maulCost;
                    actualCost = maulCost; // NEU
                }
            }
            state.maulQueued = false;

            // Damage Formulas
            var apDelta = Math.max(0, getCurrentAP() - 300);
            var baseRoll = 178 + rngPlayer.nextFloat() * (241 - 178); // Varianz einfügen
            var autoDmg = (baseRoll + (0.175 * apDelta)) * natWepMod;
            var finalDmg = isMaul ? ((autoDmg + 128) * predStrikeDmgMod) : autoDmg;

            // NEU: Wir übergeben logAction und actualCost
            resolvePlayerAttack(finalDmg, skillName, thMod, missChance, dodgeChance, parryChance, critChance, config, state, logAction, usedClearcast, actualCost, rngPlayer, effects);

            // NEU: Reset Swing Timer dynamically.
            // += verhindert, dass wir die "überschüssige" negative Zeit bei 0.05s Ticks verlieren!
            state.playerSwingTimer += getCurrentSwingTime();
        }

        // --- TIME ADVANCEMENT ---
        state.time += timeStep;
        state.gcd -= timeStep;
        state.savageBiteCD -= timeStep;
        //state.feralChargeCD -= timeStep;
        state.playerSwingTimer -= timeStep;
        state.bossSwingTimer -= timeStep;

        for (var key in state.buffs) {
            if (typeof state.buffs[key] === "number" && state.buffs[key] > 0) {
                state.buffs[key] -= timeStep;
            }
            if (state.buffs.dreamwalkerDuration <= 0) state.dreamwalkerStacks = 0;
            if (state.buffs.obsidianScale <= 0) state.obsidianScales = 0;
        }
        for (var key in state.debuffs) {
            if (state.debuffs[key] > 0) {
                state.debuffs[key] -= timeStep;
            }
        }
        for (var key in state.cooldowns) {
            if (state.cooldowns[key] > 0) {
                state.cooldowns[key] -= timeStep;
            }
        }
    }

    // --- END OF COMBAT RUN ---
    var tps = state.threat / maxTime;
    var dps = state.damageDealt / maxTime;
    var dtps = Math.max(0, state.damageTaken - state.healingDone) / maxTime; // Netto DTPS!

    // Calculate EHP Metric
    var armorDR = baseArmor / (baseArmor + 400 + 85 * bossLevel);
    var ehp = config.stat_hp / (1 - armorDR);

    return {
        tps: tps,
        dps: dps,
        dtps: dtps,
        ehp: ehp,
        log: log,
        counters: state.counters,
        abilityStats: state.abilityStats,
        deathEvent: state.deathEvent
    };
}


// ============================================================================
// HELPER: RESOLVE PLAYER ATTACK (2-Roll System integriert)
// ============================================================================
function resolvePlayerAttack(baseDmg, skillName, threatMod, miss, dodge, parry, crit, config, state, logAction, wasClearcast, rageCost, rng, effects, isExtraAttack = false) {
    var roll = rng.nextFloat() * 100;
    var ccMsg = wasClearcast ? "Clearcast!" : "";

    // Initialisiere die Statistik für diese Fähigkeit (mit ALLEN Countern)
    if (!state.abilityStats[skillName]) {
        state.abilityStats[skillName] = { count: 0, dmg: 0, hits: 0, crits: 0, glances: 0, misses: 0, dodges: 0, parries: 0 };
    }
    // NEU: Jeder Versuch (Cast/Swing) zählt sofort als 1 Count!
    state.abilityStats[skillName].count++;
    
    // 1. Armor Mitigation of Boss
    var bossArmor = config.enemy_armor;
    if (config.debuff_major_armor) bossArmor -= 2550; 
    if (state.debuffs.faerieFire > 0) bossArmor -= 505;
    if (config.debuff_cor) bossArmor -= 640;
    if (config.debuff_eskhandar) bossArmor -= 250; 
    if (config.stat_arp) bossArmor -= config.stat_arp; 
    if (bossArmor < 0) bossArmor = 0;

    var dr = bossArmor / (bossArmor + 400 + 85 * 60);
    var finalDmg = Math.floor(baseDmg * (1 - dr));

    // NEU: Flat Damage Modifiers (Werden nach Armor-Mitigation addiert)
    if (state.debuffs.giftOfArthas > 0) finalDmg += 8;
    if (state.buffs.ursaRoar > 0) finalDmg += 25; // NEU: Ursa 5/6 gibt +25 Flat Physical Damage
    if (config.consum_bogling) finalDmg += 1;

    var isWhiteAttack = (skillName === "Auto Attack");

    // Hilfsfunktion für Parry-Haste des Bosses
    function triggerBossParryHaste() {
        var baseBossSpeed = config.boss_attack_speed;
        var minTimer = baseBossSpeed * 0.20;
        if (state.bossSwingTimer > minTimer) {
            var reducedTimer = state.bossSwingTimer - (baseBossSpeed * 0.40);
            state.bossSwingTimer = Math.max(minTimer, reducedTimer);
            logAction(state.time, "Mechanic", "Boss Parry Haste", "Applied", 0, 0, 0, 0, "Next swing in " + state.bossSwingTimer.toFixed(2) + "s");
        }
    }

    // Hilfsfunktion um Treffer (Hit/Crit/Glance) abzuhandeln
    function applySuccessfulHit(isCrit, isGlancing) {
        if (isGlancing) finalDmg = Math.floor(finalDmg * 0.65);
        if (isCrit) finalDmg *= 2;

        state.damageDealt += finalDmg;
        var threatGenerated = finalDmg * threatMod;
        state.threat += threatGenerated;

        // NEU: Stats sauber auf die Kategorien aufteilen
        state.abilityStats[skillName].dmg += finalDmg;
        if (isCrit) state.abilityStats[skillName].crits++;
        else if (isGlancing) state.abilityStats[skillName].glances++;
        else state.abilityStats[skillName].hits++;

        if (!state.abilityStats[skillName]) state.abilityStats[skillName] = { count: 0, dmg: 0, crits: 0, glances: 0 };
        state.abilityStats[skillName].count++;
        state.abilityStats[skillName].dmg += finalDmg;
        if (isCrit) state.abilityStats[skillName].crits++;
        if (isGlancing) state.abilityStats[skillName].glances++;

        var rageGained = 0;
        if (skillName === "Auto Attack") {
            rageGained = (finalDmg / 109.06) * 7.5; 
        }
        
        // Primal Fury (Immer 2/2 -> 5 Wut)
        if (isCrit) rageGained += 5; 
        
        state.rage = Math.min(100, state.rage + rageGained);
        var netRageChange = rageGained - rageCost;

        var hitType = isGlancing ? "GLANCE" : (isCrit ? "CRIT" : "HIT");
        logAction(state.time, "Cast", skillName, hitType, finalDmg, threatGenerated, 0, netRageChange, ccMsg);

        // Omen of Clarity (Immer 1/1 -> 10% Chance)
        if (rng.nextFloat() < 0.10) {
            state.buffs.clearcasting = true;
            logAction(state.time, "Proc", "Omen of Clarity", "Clearcasting", 0, 0, 0, 0, "Next ability is free.");
        }

        // CARNAGE (Immer 2/2 -> 5% Heal)
        if (["Maul", "Swipe", "Savage Bite"].includes(skillName)) {
            var healAmount = Math.floor(finalDmg * 0.05);
            if (state.playerDebuffs.mortalStrike > 0) healAmount = Math.floor(healAmount * 0.5); // NEU: MS Debuff

            if (healAmount > 0) {
                state.healingDone += healAmount;
                // Heilung generiert standardmäßig 0.5 Bedrohung pro Punkt, skaliert durch Feral Instinct (1.15)
                var healThreat = healAmount * 0.5 * 1.15; 
                state.threat += healThreat;
                logAction(state.time, "Heal", "Carnage", "Healed", healAmount, healThreat, healAmount, 0, "5% of " + skillName);
            }
        }

     // Item Leech (Grail / Tooth)
        if (effects.leechPct > 0) {
            var leechAmount = Math.floor(finalDmg * (effects.leechPct / 100.0));
            if (state.playerDebuffs.mortalStrike > 0) leechAmount = Math.floor(leechAmount * 0.5); // NEU: MS Debuff
            
            if (leechAmount > 0) {
            state.healingDone += leechAmount;
            if (!state.abilityStats["Lifesteal (Heal)"]) state.abilityStats["Lifesteal (Heal)"] = { count: 0, dmg: 0, hits: 0, crits: 0, glances: 0, misses: 0, dodges: 0, parries: 0 };
            state.abilityStats["Lifesteal (Heal)"].count++;
            state.abilityStats["Lifesteal (Heal)"].hits++;
            state.abilityStats["Lifesteal (Heal)"].dmg += leechAmount; // "dmg" wird hier für Heilung genutzt, damit es im UI auftaucht

            logAction(state.time, "Heal", "Lifesteal Item", "Healed", leechAmount, 0, leechAmount, 0, effects.leechPct + "% Leech");
        }
    }

        // NEU: Rage of the Ursa (3/6)
        if (effects.ursa3p && rng.nextFloat() * 100 < 5.0) {
            state.rage = Math.min(100, state.rage + 20);
            logAction(state.time, "Proc", "Rage of the Ursa (3/6)", "Triggered", 0, 0, 0, 20, "+20 Rage");
        }

        // NEU: Rage of the Ursa (5/6) - Annahme: Bei 20 Stacks Buff & Reset
        if (effects.ursa5p && isCrit) {
            state.ursaStacks++;
            if (state.ursaStacks >= 20) {
                state.ursaStacks = 0;
                state.buffs.ursaRoar = 10.0;
                logAction(state.time, "Proc", "Brooding Rage (Ursa 5/6)", "Activated", 0, 0, 0, 0, "+25 Phys Dmg, +25 Str");
            }
        }

        // NEU: Extra Attack Proc (Hand of Justice / Surrender to Madness)
        if (!isExtraAttack && effects.extraAttackChance > 0) {
            if (rng.nextFloat() * 100 < effects.extraAttackChance) {
                logAction(state.time, "Proc", "Extra Attack", "Triggered", 0, 0, 0, 0, effects.extraAttackChance + "% Chance");
                
                // Berechne den Basis-Schaden für einen normalen Auto-Attack
                var apDelta = Math.max(0, getCurrentAP() - 300);
                var baseRoll = 178 + rng.nextFloat() * (241 - 178);
                var autoBaseDmg = (baseRoll + (0.175 * apDelta)) * natWepMod;
                
                // Wir rufen resolvePlayerAttack erneut auf, aber markieren es als "Extra Attack"
                resolvePlayerAttack(autoBaseDmg, "Extra Attack", threatMods.auto, missChance, dodgeChance, parryChance, critChance, config, state, logAction, false, 0, rng, effects, true);
            }
        }
    }

    if (isWhiteAttack) {
        // ==========================================
        // 1-ROLL SYSTEM (Vanilla Auto Attacks)
        // ==========================================
        var chanceMiss = miss;
        var chanceDodge = chanceMiss + dodge;
        var chanceParry = chanceDodge + parry;
        var glancingChance = (config.enemy_level >= 63) ? 40.0 : 0;
        var chanceGlancing = chanceParry + glancingChance;
        var chanceCrit = chanceGlancing + crit;

        state.counters.bearWhite.swings++;
        
        if (roll < chanceMiss) {
            state.counters.bearWhite.misses++;
            state.abilityStats[skillName].misses++;
            logAction(state.time, "Avoidance", skillName, "MISS", 0, 0, 0, -rageCost, ccMsg);
        } else if (roll < chanceDodge) {
            state.counters.bearWhite.dodges++;
            state.abilityStats[skillName].dodges++;
            logAction(state.time, "Avoidance", skillName, "DODGED", 0, 0, 0, -rageCost, ccMsg);
        } else if (roll < chanceParry) {
            state.counters.bearWhite.parries++;
            state.abilityStats[skillName].parries++;
            logAction(state.time, "Avoidance", skillName, "PARRIED", 0, 0, 0, -rageCost, ccMsg);
            triggerBossParryHaste();
        } else if (roll < chanceGlancing) {
            state.counters.bearWhite.glances++;
            applySuccessfulHit(false, true);
        } else if (roll < chanceCrit) {
            state.counters.bearWhite.crits++;
            applySuccessfulHit(true, false);
        } else {
            state.counters.bearWhite.hits++;
            applySuccessfulHit(false, false);
        }
    } else {
        // ==========================================
        // 2-ROLL SYSTEM (Turtle WoW Yellow Hits)
        // ==========================================
        var chanceMiss = miss;
        var chanceDodge = chanceMiss + dodge;
        var chanceParry = chanceDodge + parry;

        if (roll < chanceMiss) {
            state.abilityStats[skillName].misses++;
            logAction(state.time, "Avoidance", skillName, "MISS", 0, 0, 0, -rageCost, ccMsg);
        } else if (roll < chanceDodge) {
            state.abilityStats[skillName].dodges++;
            logAction(state.time, "Avoidance", skillName, "DODGED", 0, 0, 0, -rageCost, ccMsg);
        } else if (roll < chanceParry) {
            state.abilityStats[skillName].parries++;
            logAction(state.time, "Avoidance", skillName, "PARRIED", 0, 0, 0, -rageCost, ccMsg);
            triggerBossParryHaste();
        } else {
            var roll2 = rng.nextFloat() * 100;
            var isCrit = (roll2 < crit);
            applySuccessfulHit(isCrit, false);
        }
    }
}

function finalizeSimulation(results, config) {
    var tpsArr = results.map(r => r.tps).sort((a, b) => a - b);
    var dpsArr = results.map(r => r.dps).sort((a, b) => a - b);
    var dtpsArr = results.map(r => r.dtps).sort((a, b) => a - b);
    var ehpArr = results.map(r => r.ehp).sort((a, b) => a - b);

    function getStats(arr) {
        if (arr.length === 0) return { min: 0, median: 0, max: 0, avg: 0 };
        var sum = arr.reduce((a, b) => a + b, 0);
        return {
            min: arr[Math.floor(arr.length * 0.05)] || 0,        // 5% (Bottom 5%)
            median: arr[Math.floor(arr.length * 0.50)] || 0,     // 50% (Median)
            max: arr[Math.floor(arr.length * 0.95)] || 0,        // 95% (Top 5%)
            avg: sum / arr.length                                // Bleibt für interne Berechnungen
        };
    }

    var tpsStats = getStats(tpsArr);
    var dpsStats = getStats(dpsArr);
    var dtpsStats = getStats(dtpsArr);
    var ehpStats = getStats(ehpArr);

    // KORREKTUR: Finde den exakten Durchlauf, der das Log aufgezeichnet hat!
    var runWithLog = results.find(r => r.log && r.log.length > 0);
    var finalLog = runWithLog ? runWithLog.log : [];

    // Zähler für die Tabellen aggregieren
    var aggCounters = {
        bearWhite: { swings: 0, misses: 0, dodges: 0, parries: 0, glances: 0, crits: 0, hits: 0 },
        boss: { swings: 0, misses: 0, dodges: 0, crits: 0, crushes: 0, hits: 0 }
    };

    results.forEach(r => {
        if (!r.counters) return;
        ['bearWhite', 'boss'].forEach(cat => {
            for (let k in r.counters[cat]) { aggCounters[cat][k] += r.counters[cat][k]; }
        });
    });

    // Theoretische Werte berechnen
    var bossLevel = config.enemy_level;
    var defDiff = config.stat_defense - (bossLevel * 5);
    var thBossMiss = Math.max(0, 5.0 + (defDiff * 0.04));
    var thBossDodge = config.stat_dodge;
    var thBossCrit = Math.max(0, 5.0 + ((bossLevel - 60) * 0.2) - (defDiff * 0.04));
    var thBossCrush = (bossLevel > 62) ? 15.0 : 0;
    var thBossHit = Math.max(0, 100 - thBossMiss - thBossDodge - thBossCrit - thBossCrush);

    var thBearMiss = Math.max(0, 8.0 - config.stat_hit);
    var thBearDodge = 5.6;
    var thBearParry = 14.0;
    var thBearGlance = (bossLevel >= 63) ? 40.0 : 0;
    var thBearCrit = Math.max(0, config.stat_crit - 4.8);
    var thBearHit = Math.max(0, 100 - thBearMiss - thBearDodge - thBearParry - thBearGlance - thBearCrit);

    // NEU: Sortiere ALLE Ergebnisse nach TPS, um die spezifischen Iterationen (Runs) zu greifen!
    var sortedByTps = results.slice().sort((a, b) => a.tps - b.tps);
    var run5 = sortedByTps[Math.floor(sortedByTps.length * 0.05)];
    var run50 = sortedByTps[Math.floor(sortedByTps.length * 0.50)];
    var run95 = sortedByTps[Math.floor(sortedByTps.length * 0.95)];

    var runWithDeath = results.find(r => r.deathEvent != null);
    var globalDeath = runWithDeath ? runWithDeath.deathEvent : null;

    // NEU: Speichere "abilities" als die Stats aus genau diesem einen Durchlauf!
    var finalResults = {
        min: { tps: tpsStats.min, dps: dpsStats.min, dtps: dtpsStats.min, ehp: ehpStats.min, abilities: (run5 ? run5.abilityStats : {}) },
        median: { tps: tpsStats.median, dps: dpsStats.median, dtps: dtpsStats.median, ehp: ehpStats.median, abilities: (run50 ? run50.abilityStats : {}) },
        max: { tps: tpsStats.max, dps: dpsStats.max, dtps: dtpsStats.max, ehp: ehpStats.max, abilities: (run95 ? run95.abilityStats : {}) },
        raw: { tps_arr: tpsArr, dps_arr: dpsArr },
        log: finalLog,
        deathEvent: globalDeath,
        tables: {
            counters: aggCounters,
            theory: {
                bear: { miss: thBearMiss, dodge: thBearDodge, parry: thBearParry, glance: thBearGlance, crit: thBearCrit, hit: thBearHit },
                boss: { miss: thBossMiss, dodge: thBossDodge, parry: 0, crush: thBossCrush, crit: thBossCrit, hit: thBossHit }
            }
        }
    };

    if (SIM_LIST[ACTIVE_SIM_INDEX]) {
        SIM_LIST[ACTIVE_SIM_INDEX].results = finalResults;
    }
    
    SIM_DATA = SIM_LIST[ACTIVE_SIM_INDEX];
    hideProgress();
    
    if (typeof renderResults === 'function') renderResults();
}


function runStatWeights() {
    var baseConfig = getSimInputs();
    var iters = 2000; // 2500 ist ein guter Kompromiss aus Speed und Genauigkeit mit Paired Seeding
    baseConfig.simCount = iters;

    // Basis RNG Seed (falls deine Engine das unterstützt, ansonsten läuft es über normales Random)
    var baseSeed = 1337; 

    // Wir definieren die Szenarien (Bonus-Stats)
    var scenarios = [
        { id: "base", name: "Baseline", mod: {}, ref: 1 },
        // Threat Stats
        { id: "ap", name: "+20 AP", mod: { stat_ap: 20 }, ref: 20 },
        { id: "str", name: "+10 Str", mod: { stat_str: 10 }, ref: 10 },
        { id: "agi", name: "+10 Agi", mod: { stat_agi: 10 }, ref: 10 },
        { id: "crit", name: "+1% Crit", mod: { stat_crit: 1 }, ref: 1 },
        { id: "hit", name: "+1% Hit", mod: { stat_hit: 1 }, ref: 1 },
        { id: "haste", name: "+5% Haste", mod: { stat_haste: 5 }, ref:5 },
        { id: "arp", name: "+100 ArP", mod: { stat_arp: 100 }, ref: 100 },
        // Mitigation Stats
        { id: "sta", name: "+10 Stamina", mod: { stat_sta: 10 }, ref: 10 },
        { id: "armor", name: "+100 Armor", mod: { item_armor: 100 }, ref: 100 }, 
        { id: "def", name: "+10 Defense", mod: { stat_defense: 10 }, ref: 10 },
        { id: "dodge", name: "+1% Dodge", mod: { stat_dodge: 1 }, ref: 1 }
    ];

    var baseRunData = []; // Speichert {tps, ehp, dtps} für JEDEN Durchlauf
    var calculatedDeltas = {}; // Speichert {mean, se} für TPS, EHP und DTPS pro Szenario

    var currentIdx = 0;
    var batchSize = 50;

    showProgress("Calculating Stat Weights...");

    function processNext() {
        if (currentIdx >= scenarios.length) {
            finalizeStatWeights(calculatedDeltas, scenarios);
            return;
        }

        var scen = scenarios[currentIdx];
        var pText = document.getElementById("progressText");
        if (pText) pText.innerText = "Simulating: " + scen.name;

        var cfg = JSON.parse(JSON.stringify(baseConfig));
        
        var cfg = JSON.parse(JSON.stringify(baseConfig));
        
        // Bären-Modifikatoren anwenden (Hardcoded für den permanenten 11/35/5 Build)
        var predMod = 1.10; // Predatory Strikes 3/3 (+10%)
        var hotwMod = 1.20; // Heart of the Wild 5/5 (+20%)
        var taurenMod = (cfg.char_race === "Tauren") ? 1.05 : 1.0;
        var thickHideMod = 4.784; // 4.6 Base + 0.184 von Thick Hide 3/3
        var kingsMod = cfg.buff_kings ? 1.10 : 1.0; // NEU: Blessing of Kings

        for (var k in scen.mod) {
            if (k === "stat_ap") {
                // Auch reine AP von Items skaliert mit Predatory Strikes!
                cfg.stat_ap += (scen.mod[k] * predMod);
            } 
            else if (k === "stat_str") {
                var gainedStr = scen.mod[k] * kingsMod;
                cfg.stat_str += gainedStr;
                cfg.stat_ap += (gainedStr * 2) * predMod;
            } 
            else if (k === "stat_agi") {
                var gainedAgi = scen.mod[k] * kingsMod;
                cfg.stat_agi += gainedAgi;
                cfg.stat_crit += (gainedAgi / 20.0);
                cfg.stat_dodge += (gainedAgi / 20.0);
                // Agility-Rüstung profitiert NICHT vom Dire Bear Multiplikator, sondern gibt flat 2 Armor
                cfg.stat_armor += (gainedAgi * 2);
            } 
            else if (k === "stat_sta") {
                var gainedSta = scen.mod[k] * kingsMod * hotwMod;
                cfg.stat_sta += gainedSta;
                cfg.stat_hp += (gainedSta * 10 * taurenMod);
            } 
            else if (k === "item_armor") {
                // Item Armor profitiert voll vom Bären-Multiplikator (Dire Bear + Thick Hide)
                cfg.stat_armor += (scen.mod[k] * thickHideMod);
            } 
            else if (k === "stat_defense") { 
                cfg.stat_defense += scen.mod[k];
                cfg.stat_dodge += (scen.mod[k] * 0.04);
            } 
            else {
                cfg[k] = (cfg[k] || 0) + scen.mod[k];
            }
        }

        var currentRunResults = [];
        var i = 0;

        function processBatch() {
            try {
                var target = Math.min(iters, i + batchSize);
                for (; i < target; i++) {
                    cfg.sim_seed = baseSeed + i; 
                    var res = runSingleSim(cfg, false);
                    
                    if (scen.id === "base") {
                        baseRunData.push({ tps: res.tps, ehp: res.ehp, dtps: res.dtps });
                    } else {
                        currentRunResults.push({ tps: res.tps, ehp: res.ehp, dtps: res.dtps });
                    }
                }

                var totalProgress = ((currentIdx * iters) + i) / (scenarios.length * iters);
                updateProgress(totalProgress * 100);

                if (i < iters) {
                    setTimeout(processBatch, 0);
                } else {
                    // Batch fertig, Differenzen (Deltas) für dieses Szenario berechnen
                    if (scen.id !== "base") {
                        calculateDeltaStats(scen.id, currentRunResults, baseRunData, scen.ref);
                    }
                    currentIdx++;
                    setTimeout(processNext, 0);
                }
            } catch (err) {
                console.error("Error in Stat Weights:", err);
                hideProgress();
            }
        }
        setTimeout(processBatch, 0);
    }

    // Berechnet Mean und Standard Error der Differenz (Paired Difference)
    function calculateDeltaStats(id, scenResults, baseData, refDivisor) {
        var n = scenResults.length;
        var sumDiffTps = 0, sumDiffEhp = 0, sumDiffDtps = 0;
        var diffsTps = [], diffsEhp = [], diffsDtps = [];

        for(var k=0; k<n; k++) {
            var dTps = (scenResults[k].tps - baseData[k].tps) / refDivisor;
            var dEhp = (scenResults[k].ehp - baseData[k].ehp) / refDivisor;
            var dDtps = (baseData[k].dtps - scenResults[k].dtps) / refDivisor; // Positiv = Schaden reduziert (besser)
            
            diffsTps.push(dTps); sumDiffTps += dTps;
            diffsEhp.push(dEhp); sumDiffEhp += dEhp;
            diffsDtps.push(dDtps); sumDiffDtps += dDtps;
        }

        function getStats(diffArray, sum) {
            var mean = sum / n;
            var sumSq = 0;
            for(var k=0; k<n; k++) { sumSq += Math.pow(diffArray[k] - mean, 2); }
            var variance = (n > 1) ? sumSq / (n - 1) : 0;
            return { mean: mean, se: Math.sqrt(variance) / Math.sqrt(n) };
        }

        calculatedDeltas[id] = {
            tps: getStats(diffsTps, sumDiffTps),
            ehp: getStats(diffsEhp, sumDiffEhp),
            dtps: getStats(diffsDtps, sumDiffDtps)
        };
    }

    processNext();
}

function finalizeStatWeights(deltas, scenarios) {
    hideProgress();

        // 1. Referenzwerte für die Normalisierung
    var refAP_TPS = deltas["ap"] ? Math.max(0.0001, deltas["ap"].tps.mean) : 0.0001;
    var refSta_EHP = deltas["sta"] ? Math.max(0.0001, deltas["sta"].ehp.mean) : 0.0001;
    var refDodge_DTPS = deltas["dodge"] ? Math.max(0.0001, deltas["dodge"].dtps.mean) : 0.0001;


    var ehpStats = ["sta", "armor", "def", "dodge", "agi"];

    
    // Stamina-Effekt pro 1 absoluten Punkt Stamina (da Szenario +10 Sta testet)
    var staEHPPerPoint = deltas["sta"] ? (deltas["sta"].ehp.mean / 10) / refSta_EHP : 1;
    
    // Dynamischer Stärke-Wert als Skalierungsanker (Item-Budget)
    var communityScale = 2.2;
    if (deltas["str"] && deltas["str"].tps.mean > 0) {
        communityScale = deltas["str"].tps.mean / refAP_TPS;
    }

    var combinedMEP = {};

    // Stamina MEP pro 1 Punkt Stamina
    combinedMEP.sta = 1.0 * communityScale; 
    
    // ACHTUNG: Die Werte in 'deltas' sind durch calculateDeltaStats BEREITS auf 1 Punkt normalisiert!
    // Die doppelte Teilung (/100 oder /10) wurde hier entfernt, damit die Werte nicht zu 0 runden.

    // Armor MEP pro 1 Punkt Rüstung
    if (deltas["armor"]) {
        var armorEHPPerPoint = deltas["armor"].ehp.mean / refSta_EHP;
        combinedMEP.armor = armorEHPPerPoint * communityScale;
    }

    // Dodge MEP pro 1 Prozentpunkt Dodge
    if (deltas["dodge"]) {
        var dodgeDTPSPerPct = deltas["dodge"].dtps.mean; 
        var dodgeMEP = (dodgeDTPSPerPct / refDodge_DTPS) * communityScale;
        var dodgeTEP = deltas["dodge"].tps.mean / refAP_TPS;
        combinedMEP.dodge = dodgeMEP + dodgeTEP;
    }

    // Defense MEP pro 1 Punkt Defense
    if (deltas["def"]) {
        var defDTPSPerPoint = deltas["def"].dtps.mean; 
        var defMEP = (defDTPSPerPoint / refDodge_DTPS) * communityScale;
        var defTEP = deltas["def"].tps.mean / refAP_TPS;
        combinedMEP.def = defMEP + defTEP;
    }

    // Agility MEP pro 1 Punkt Agi
    if (deltas["agi"]) {
        var agiEHPPerPoint = deltas["agi"].ehp.mean / refSta_EHP;
        var agiDTPSPerPoint = deltas["agi"].dtps.mean / refDodge_DTPS;
        combinedMEP.agi = (agiEHPPerPoint + agiDTPSPerPoint) * communityScale;
    }

    // AGI kombiniert berechnen (TEP + MEP)
    var tepAgi = deltas["agi"] ? (deltas["agi"].tps.mean / refAP_TPS) : 0;
    var mepAgi = combinedMEP["agi"] || 0;
    var totalAgi = tepAgi + mepAgi;

    // 3. Globale Variable speichern - Diese Werte fließen in den "Apply Weights" Button
    window.latestSimWeights = {
        ap: (deltas["ap"] ? deltas["ap"].tps.mean / refAP_TPS : 1),
        str: (deltas["str"] ? deltas["str"].tps.mean / refAP_TPS : 0),
        agi: totalAgi, // Hier speichern wir nun korrekt den summierten Totalwert!
        crit: (deltas["crit"] ? deltas["crit"].tps.mean / refAP_TPS : 0),
        hit: (deltas["hit"] ? deltas["hit"].tps.mean / refAP_TPS : 0),
        haste: (deltas["haste"] ? deltas["haste"].tps.mean / refAP_TPS : 0),
        arp: (deltas["arp"] ? deltas["arp"].tps.mean / refAP_TPS : 0),
        armor: (combinedMEP["armor"] || 0),
        sta: (combinedMEP["sta"] || 1),
        def: (combinedMEP["def"] || 0),
        dodge: (combinedMEP["dodge"] || 0)
    };

    // Helper: Rendert eine einzelne Stat-Box mit Standard-Fehler
    function renderBox(label, mean, se, color) {
        if (mean === undefined || isNaN(mean)) return '';
        var valColor = mean < 0 ? '#ef5350' : color;
        return `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px; font-weight:600;">1 ${label.toUpperCase()}</div>
                <div style="font-size:1.2rem; font-weight:bold; color:${valColor};">${mean.toFixed(2)}</div>
                <div style="font-size:0.7rem; color:#666; margin-top:2px;">± ${se.toFixed(2)}</div>
            </div>
        `;
    }

    var html = `<div style="display: flex; flex-direction: column; gap: 20px;">`;

    // --- KOMPAKTE ANSICHT (Total EP) ---
    html += `
        <div id="compactWeightsWrap" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding-bottom: 10px; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #fff; font-size: 1rem; text-transform: uppercase;">⚖️ Compact Stat Weights (Total EP)</h3>
                <button class="btn-mini" style="border-color:#aaa;" onclick="document.getElementById('compactWeightsWrap').classList.add('hidden'); document.getElementById('detailedWeightsWrap').classList.remove('hidden');">Show Detailed Analytics</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px;">
    `;

   // --- BERECHNUNG DER STANDARD-FEHLER (SE) FÜR DIE KOMPAKTE ANSICHT ---
    var combinedSE = {};
    
    // Stamina SE
    combinedSE.sta = deltas["sta"] ? (deltas["sta"].ehp.se / refSta_EHP) * communityScale : 0;
    
    // Armor SE
    if (deltas["armor"]) {
        combinedSE.armor = (deltas["armor"].ehp.se / refSta_EHP) * communityScale;
    }
    
    // Dodge SE (Kombiniert DTPS Mitigation + TEP)
    if (deltas["dodge"]) {
        combinedSE.dodge = (deltas["dodge"].dtps.se / refDodge_DTPS) * communityScale + (deltas["dodge"].tps.se / refAP_TPS);
    }
    
    // Defense SE (Kombiniert DTPS Mitigation + TEP)
    if (deltas["def"]) {
        combinedSE.def = (deltas["def"].dtps.se / refDodge_DTPS) * communityScale + (deltas["def"].tps.se / refAP_TPS);
    }
    
    // Agility SE (Kombiniert EHP + DTPS + TEP)
    if (deltas["agi"]) {
        var agiSE_EHP = deltas["agi"].ehp.se / refSta_EHP;
        var agiSE_DTPS = deltas["agi"].dtps.se / refDodge_DTPS;
        var agiSE_TEP = deltas["agi"].tps.se / refAP_TPS;
        combinedSE.agi = (agiSE_EHP + agiSE_DTPS) * communityScale + agiSE_TEP;
    }

    // Definition der kompakten Stats - Inklusive der .se (Standard Error) Eigenschaft
    var compactStats = [
        { id: "ap", label: "AP", val: window.latestSimWeights.ap, se: (deltas["ap"] ? deltas["ap"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "str", label: "STR", val: window.latestSimWeights.str, se: (deltas["str"] ? deltas["str"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "agi", label: "AGI", val: window.latestSimWeights.agi, se: (combinedSE.agi || 0), color: "#a5d6a7" },
        { id: "crit", label: "CRIT", val: window.latestSimWeights.crit, se: (deltas["crit"] ? deltas["crit"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "hit", label: "HIT", val: window.latestSimWeights.hit, se: (deltas["hit"] ? deltas["hit"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "haste", label: "HASTE", val: window.latestSimWeights.haste, se: (deltas["haste"] ? deltas["haste"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "arp", label: "ARP", val: window.latestSimWeights.arp, se: (deltas["arp"] ? deltas["arp"].tps.se / refAP_TPS : 0), color: "#fff" },
        { id: "armor", label: "ARMOR", val: window.latestSimWeights.armor, se: (combinedSE.armor || 0), color: "#90caf9" },
        { id: "sta", label: "STA", val: window.latestSimWeights.sta, se: (combinedSE.sta || 0), color: "#90caf9" },
        { id: "def", label: "DEF", val: window.latestSimWeights.def, se: (combinedSE.def || 0), color: "#90caf9" },
        { id: "dodge", label: "DODGE", val: window.latestSimWeights.dodge, se: (combinedSE.dodge || 0), color: "#90caf9" }
    ];

    compactStats.forEach(s => {
        if (s.val !== undefined && !isNaN(s.val)) {
            var displayColor = s.val < 0 ? '#ef5350' : s.color;
            // Der Div-Container wurde hier angepasst (display: flex...), um das Layout exakt an die Detail-Ansicht anzugleichen
            html += `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 10px; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                    <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px; font-weight:600;">1 ${s.label}</div>
                    <div style="font-size:1.2rem; font-weight:bold; color:${displayColor};">${s.val.toFixed(2)}</div>
                    <div style="font-size:0.7rem; color:#666; margin-top:2px;">± ${s.se.toFixed(2)}</div>
                </div>
            `;
        }
    });
    html += `</div></div>`; // Ende Kompakte Ansicht

    // --- DETAILLIERTE ANSICHT (Versteckt) ---
    html += `<div id="detailedWeightsWrap" class="hidden" style="display: flex; flex-direction: column; gap: 20px;">`;
    
    html += `
        <div style="display: flex; justify-content: flex-end; margin-bottom: -10px;">
            <button class="btn-mini" style="border-color:#aaa;" onclick="document.getElementById('detailedWeightsWrap').classList.add('hidden'); document.getElementById('compactWeightsWrap').classList.remove('hidden');">Back to Compact View</button>
        </div>
    `;

    // Detail: Threat
    var threatStats = ["ap", "str", "agi", "crit", "hit", "haste", "arp"];
    html += `
        <div style="background: rgba(229, 57, 53, 0.05); border: 1px solid rgba(229, 57, 53, 0.3); border-radius: 8px; padding: 15px;">
            <h3 style="margin-top: 0; color: #ef5350; font-size: 0.9rem; text-transform: uppercase; border-bottom: 1px solid rgba(229, 57, 53, 0.2); padding-bottom: 5px;">⚔️ Threat Weights (Normalized to 1 AP)</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px; margin-top: 15px;">
    `;
    threatStats.forEach(id => {
        if(!deltas[id]) return;
        html += renderBox(id, deltas[id].tps.mean / refAP_TPS, deltas[id].tps.se / refAP_TPS, "#fff");
    });
    html += `</div></div>`;

    // Detail: EHP
    html += `
        <div style="background: rgba(144, 202, 249, 0.05); border: 1px solid rgba(144, 202, 249, 0.3); border-radius: 8px; padding: 15px;">
            <h3 style="margin-top: 0; color: #90caf9; font-size: 0.9rem; text-transform: uppercase; border-bottom: 1px solid rgba(144, 202, 249, 0.2); padding-bottom: 5px;">🛡️ Survival Weights: EHP (Normalized to 1 Stamina)</h3>
            <p style="font-size: 0.7rem; color: #888; margin-top: 0;">Buffer against one-shots. Avoidance (Dodge/Def) provides 0 EHP.</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px; margin-top: 10px;">
    `;
    ehpStats.forEach(id => {
        if(!deltas[id]) return;
        html += renderBox(id, deltas[id].ehp.mean / refSta_EHP, deltas[id].ehp.se / refSta_EHP, "#90caf9");
    });
    html += `</div></div>`;

    // Detail: DTPS
    html += `
        <div style="background: rgba(165, 214, 167, 0.05); border: 1px solid rgba(165, 214, 167, 0.3); border-radius: 8px; padding: 15px;">
            <h3 style="margin-top: 0; color: #a5d6a7; font-size: 0.9rem; text-transform: uppercase; border-bottom: 1px solid rgba(165, 214, 167, 0.2); padding-bottom: 5px;">🩹 Sustain Weights: Damage Reduction (Normalized to 1% Dodge)</h3>
            <p style="font-size: 0.7rem; color: #888; margin-top: 0;">Reduces healer burden. Stamina provides 0 DTPS reduction.</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px; margin-top: 10px;">
    `;
    ehpStats.forEach(id => {
        if(!deltas[id]) return;
        html += renderBox(id, deltas[id].dtps.mean / refDodge_DTPS, deltas[id].dtps.se / refDodge_DTPS, "#a5d6a7");
    });
    html += `</div></div>`;

    html += `</div>`; // Ende Detaillierte Ansicht
    html += `</div>`; // Ende Master-Wrapper

    var wRes = document.getElementById("weightResults");
    if(wRes) {
        wRes.innerHTML = html;
        wRes.classList.remove("hidden");
        wRes.scrollIntoView({behavior: "smooth"});
    }
}

// Globale Helfer-Funktion zum Übertragen der Werte in den Gear-Planner
function applySimulatedWeights() {
    if (!window.latestSimWeights) {
        alert("No simulated weights found. Run the simulation first.");
        return;
    }
    
    var w = window.latestSimWeights;
    
    // TEP anwenden
    if(document.getElementById("weight_ap")) document.getElementById("weight_ap").value = w.ap.toFixed(2);
    if(document.getElementById("weight_str")) document.getElementById("weight_str").value = w.str.toFixed(2);
    if(document.getElementById("weight_agi")) document.getElementById("weight_agi").value = w.agi.toFixed(2);
    if(document.getElementById("weight_crit")) document.getElementById("weight_crit").value = w.crit.toFixed(2);
    if(document.getElementById("weight_hit")) document.getElementById("weight_hit").value = w.hit.toFixed(2);
    if(document.getElementById("weight_haste")) document.getElementById("weight_haste").value = w.haste.toFixed(2);
    if(document.getElementById("weight_arp")) document.getElementById("weight_arp").value = w.arp.toFixed(2);
    
    // Kombinierte MEP anwenden
    if(document.getElementById("weight_armor")) document.getElementById("weight_armor").value = w.armor.toFixed(2);
    if(document.getElementById("weight_sta")) document.getElementById("weight_sta").value = w.sta.toFixed(2);
    if(document.getElementById("weight_def")) document.getElementById("weight_def").value = w.def.toFixed(2);
    if(document.getElementById("weight_dodge")) document.getElementById("weight_dodge").value = w.dodge.toFixed(2);
    
    // Ein Event auslösen, falls deine UI das Neu-Berechnen des Gear-Scores erzwingt (onchange trigger)
    if(typeof recalcItemScores === "function") {
        recalcItemScores();
        showToast("Weights applied to Gear Planner!");
    } else {
        alert("Weights applied! Please recalculate gear scores.");
    }
}

// ============================================================================
// SEEDED PRNG (Mulberry32) - Aus der Boomkin-Sim adaptiert
// ============================================================================

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function RNGHandler(seed) {
    if (seed !== undefined && seed !== null) {
        // Javascript Bitwise-Hack, um sicherzustellen, dass es ein 32-bit Integer ist
        this.rand = mulberry32(seed | 0); 
    } else {
        this.rand = Math.random;
    }
}

// Returns true based on a 0-100 probability
RNGHandler.prototype.check = function(chance) {
    if (chance <= 0) return false;
    if (chance >= 100) return true;
    return (this.rand() * 100) < chance;
};

// Returns a float between 0 and 1
RNGHandler.prototype.nextFloat = function() {
    return this.rand();
};