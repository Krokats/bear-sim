/**
 * Bear Tank Simulation - File 1: Global State & Constants
 * Updated for Turtle WoW Patch 1.18.1 (Dire Bear)
 * Includes Boss Armor & Attack Database for DTPS/EHP Calculation
 */

// ============================================================================
// 1. GLOBAL STATE
// ============================================================================
var SIM_LIST = [];
var ACTIVE_SIM_INDEX = 0;
var SIM_DATA = null;
var CURRENT_VIEW = 'avg';
var toastTimer = null;

var ITEM_DB = [];
var ENCHANT_DB = [];
var GEAR_SELECTION = {};
var ENCHANT_SELECTION = {};

// Bear Skills (Threat & Mitigation)
const ROTATION_SKILLS = [
    { id: "Enrage", name: "Enrage", icon: "ability_druid_enrage" },
    { id: "Barkskin", name: "Barkskin", icon: "spell_nature_stoneclawtotem" },
    { id: "Faerie Fire", name: "Faerie Fire (Feral)", icon: "spell_nature_faeriefire" },
    { id: "Maul", name: "Maul", icon: "ability_druid_maul" },
    { id: "Swipe", name: "Swipe", icon: "inv_misc_monsterclaw_03" },
    { id: "Savage Bite", name: "Savage Bite", icon: "ability_hunter_pet_hyena" },
    { id: "Feral Charge", name: "Feral Charge", icon: "ability_hunter_pet_bear" }, 
    { id: "Demoralizing Roar", name: "Demoralizing Roar", icon: "ability_druid_demoralizingroar" },
    { id: "Frenzied Regeneration", name: "Frenzied Regeneration", icon: "ability_bullrush" },
    { id: "Trinket 1", name: "Use Trinket 1", icon: "inv_jewelry_trinket_04" },
    { id: "Trinket 2", name: "Use Trinket 2", icon: "inv_jewelry_trinket_04" },
    { id: "Potion", name: "Use Potion/Juju", icon: "inv_potion_27" }
];

const CONDITION_TYPES = {
    "rage": { label: "Rage", type: "number", ops: [">=", "<=", "=="] },
    "hp_pct": { label: "Health %", type: "number", ops: [">=", "<=", "=="] },
    "time_elapsed": { label: "Time Elapsed (s)", type: "number", ops: [">=", "<="] },
    "time_remaining": { label: "Time Remaining (s)", type: "number", ops: [">=", "<="] },
    "debuff_rem": { label: "Target Debuff Rem. (s)", type: "select", options: ["Faerie Fire", "Demoralizing Roar"], ops: [">=", "<=", "=="] },
    "buff_rem": { label: "Player Buff Rem. (s)", type: "select", options: ["Enrage", "Barkskin", "Clearcasting", "Blood Frenzy", "Earthstrike", "Jom", "ZHM"], ops: [">=", "<=", "=="] },
    "last_spell": { label: "Last Spell Cast", type: "select", options: ["Maul", "Swipe", "Savage Bite", "None"], ops: ["==", "!="] }
};

const PRESET_ROTATIONS = {
    "standard_tank": {
        name: "Standard Bear TPS",
        desc: "Optimal threat priority. Maintains Faerie Fire, uses Savage Bite on CD, dumps rage with Maul/Swipe.",
        steps: [
            { id: "step_1", skill: "Trinket 1", conditions: [] },
            { id: "step_2", skill: "Trinket 2", conditions: [] },
            { id: "step_3", skill: "Potion", conditions: [] },
            { id: "step_4", skill: "Enrage", conditions: [{ type: "time_elapsed", op: "<=", val: 0 }, { type: "hp_pct", op: ">=", val: 50 }] },
            { id: "step_5", skill: "Feral Charge", conditions: [{ type: "time_elapsed", op: "<=", val: 0 }] },
            { id: "step_6", skill: "Faerie Fire", conditions: [{ type: "debuff_rem", target: "Faerie Fire", op: "<=", val: 0 }] },
            { id: "step_7", skill: "Savage Bite", conditions: [{ type: "rage", op: ">=", val: 30 }] },
            { id: "step_8", skill: "Maul", conditions: [{ type: "rage", op: ">=", val: 15 }] }
        ]
    },
    "mitigation_tank": {
        name: "Survival Priority",
        desc: "Uses Barkskin and Demoralizing Roar to reduce incoming damage.",
        steps: [
            { id: "step_1", skill: "Barkskin", conditions: [{ type: "hp_pct", op: "<=", val: 40 }] },
            { id: "step_2", skill: "Demoralizing Roar", conditions: [{ type: "debuff_rem", target: "Demoralizing Roar", op: "<=", val: 0 }] },
            { id: "step_3", skill: "Faerie Fire", conditions: [{ type: "debuff_rem", target: "Faerie Fire", op: "<=", val: 0 }] },
            { id: "step_4", skill: "Maul", conditions: [{ type: "rage", op: ">=", val: 15 }] }
        ]
    }
};

var CUSTOM_ROTATION = JSON.parse(JSON.stringify(PRESET_ROTATIONS["standard_tank"]));

var CONFIG_IDS = [
    // General & Sim Settings
    "simTime", "simCount", "sim_seed", "char_race", "manual_stats",
    
    // Player Stats (Manual / Auto)
    "stat_hp", "stat_armor", "stat_defense", "stat_str", "stat_agi", 
    "stat_sta", "stat_ap", "stat_crit", "stat_hit", "stat_dodge", 
    "stat_haste", "stat_arp",
    
    // Stat Weights (Gespeichert pro Sim-Profil)
    "weight_ap", "weight_str", "weight_agi", "weight_crit", "weight_hit", 
    "weight_haste", "weight_arp", "weight_armor", "weight_sta", 
    "weight_def", "weight_dodge",
    
    // Enemy Settings
    "enemy_boss_select", "enemy_level", "enemy_armor", 
    "boss_base_dmg", "boss_attack_speed", "enemy_mechanics",
    
    // Target Debuffs
    "debuff_major_armor", "debuff_ff", "debuff_cor", "debuff_eskhandar",
    
    // Bear Talents (Flex choice)
    "tal_flex",
    
    // Consumables (Dropdowns)
    "consum_weapon", "consum_zg", "consum_blasted", 
    "consum_ap_buff", "consum_food", "consum_alcohol",
    
    // Consumables (Checkboxes)
    "consum_flask_titan", "consum_elixir_mongoose", "consum_elixir_fortitude", 
    "consum_elixir_defense", "consum_crystal_ward", "consum_trolls_blood", 
    "consum_arthas", "consum_juju_power", "consum_bogling", 
    "consum_quickness", "consum_stoneshield",
    
    // Raid Buffs
    "buff_motw", "buff_kings", "buff_might", "buff_bs", "buff_fortitude", 
    "buff_bloodpact", "buff_tsa", "buff_wf_totem", "buff_goa_totem"
];

var SLOT_LAYOUT = {
    left: ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist"],
    right: ["Hands", "Waist", "Legs", "Feet", "Finger 1", "Finger 2", "Trinket 1", "Trinket 2"],
    bottom: ["Main Hand", "Off Hand", "Idol"]
};

// Base Stats (Level 60 - Turtle WoW 1.18)
const RACE_STATS = {
    "Tauren": { str: 70, agi: 55, sta: 72, baseHp: 2124, int: 114, spi: 112, attackPower: 300, crit: 3.65, dodge: 0.0, attackSpeed: 2.5, minDmg: 181, maxDmg: 242 },
    "NightElf": { str: 62, agi: 65, sta: 69, baseHp: 2124, int: 120, spi: 110, attackPower: 300, crit: 3.65, dodge: 1.0, attackSpeed: 2.5, minDmg: 181, maxDmg: 242 }
};

// Combat Constants
const CONSTANTS = {
    GCD: 1.5,
    HIT_CAP: 8.0,
    CRIT_SUPPRESSION: 4.8, // Boss level difference
    THREAT_MOD_BEAR: 1.30 // Dire Bear inherent threat modifier
};

function SimObject(id, name) {
    this.id = id;
    this.name = name;
    this.config = {};
    this.results = null;
}


// Boss Database (Includes DTPS specific values)
const BOSS_PRESETS = [
    { group: "World", name: "Training Dummy", armor: 3000, level: 60, baseDmg: 1000, attackSpeed: 2.0, mechanics: "none" },
    { group: "Molten Core", name: "Magmadar (Fast Hitter)", armor: 3731, level: 63, baseDmg: 2500, attackSpeed: 1.5, mechanics: "frenzy" },
    { group: "Onyxia", name: "Onyxia (Standard Heavy)", armor: 4611, level: 63, baseDmg: 3500, attackSpeed: 2.0, mechanics: "cleave" },
    { group: "Zul'Gurub", name: "Bloodlord Mandokir", armor: 3731, level: 63, baseDmg: 3000, attackSpeed: 2.0, mechanics: "cleave" },
    { group: "BWL", name: "Broodlord Lashlayer", armor: 4611, level: 63, baseDmg: 5500, attackSpeed: 2.0, mechanics: "mortal_strike" }, 
    { group: "AQ40", name: "Twin Emperors", armor: 3833, level: 63, baseDmg: 4000, attackSpeed: 1.5, mechanics: "none" },
    { group: "Naxxramas", name: "Patchwerk", armor: 4611, level: 63, baseDmg: 6000, attackSpeed: 1.2, mechanics: "none" },
    { group: "Naxxramas", name: "Maexxna", armor: 4211, level: 63, baseDmg: 3500, attackSpeed: 1.5, mechanics: "frenzy" },
    { group: "Other", name: "Standard Raid Boss", armor: 4211, level: 63, baseDmg: 3000, attackSpeed: 2.0, mechanics: "none" }
];

var GEAR_PRESETS = {
    "Phase 0 (Threat)": {
        gear: {
            "Head": 61060,       // Thornweave mask
            "Neck": 19491,       // Amulet of the Darkmoon
            "Shoulder": 12927,   // Truestrike Shoulders
            "Back": 20691,       // Windshear Cape
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 19587,      // Forest Stalker's Bracers
            "Hands": 60729,      // Skulker's Gloves
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 22749,       // Sentinel's Leather pants
            "Feet": 20052,       // Highlander's Leather Boots
            "Finger 1": 19325,   // Don Julio's Band
            "Finger 2": 56094,   // Golden runed ring
            "Trinket 1": 60559,  // Hatereaver Cog
            "Trinket 2": 60501,  // Whip of Encouragement
            "Main Hand": 84603,  // Rod of the Churning Hourglass
            "Off Hand": 0,       
            "Idol": 23198            
        },
        enchants: {
            "Head": 0,
            "Neck": 0,
            "Shoulder": 0,
            "Back": 0,
            "Chest": 0,
            "Wrist": 0,
            "Hands": 0,
            "Waist": 0,
            "Legs": 0,
            "Feet": 0,
            "Finger 1": 0,
            "Finger 2": 0,
            "Trinket 1": 0,
            "Trinket 2": 0,
            "Main Hand": 0,
            "Off Hand": 0,
            "Idol": 0
        }
    },
    "Phase 0 (Mitigation)": {
        gear: {
            "Head": 60436,       // Sightless Leather Hood
            "Neck": 60569,       // Taskmaster's Tag
            "Shoulder": 20059,   // Highlander's Leather Shoulders
            "Back": 18689,       // Phantasmal Cloak
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 12966,      // Blackmist Armguards
            "Hands": 13258,      // Slaghide Gauntlets of the bear
            "Waist": 20190,      // Highlander's Leather Girdle
            "Legs": 22749,       // Sentinel's Leather pants
            "Feet": 20052,       // Highlander's Leather Boots
            "Finger 1": 15855,   // Ring of Protection
            "Finger 2": 50189,   // Ring of authority
            "Trinket 1": 13966,  // Mark of Tyranny
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 61044,  // Gavel of the northwind
            "Off Hand": 0,       
            "Idol": 23198            
        },
        enchants: {
            "Head": 0,
            "Neck": 0,
            "Shoulder": 0,
            "Back": 0,
            "Chest": 0,
            "Wrist": 0,
            "Hands": 0,
            "Waist": 0,
            "Legs": 0,
            "Feet": 0,
            "Finger 1": 0,
            "Finger 2": 0,
            "Trinket 1": 0,
            "Trinket 2": 0,
            "Main Hand": 0,
            "Off Hand": 0,
            "Idol": 0
        }
    },
    // ==========================================
    // PHASE 1 (Molten Core / Onyxia)
    // ==========================================
    "Phase 1 (Threat)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 18404,       // Onyxia tooth pendant
            "Shoulder": 61756,   // Highlander's Leather Shoulders
            "Back": 20691,       // Windshear Cape
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 19587,      // Forest Stalker's Bracers
            "Hands": 60729,      // Skulker's Gloves
            "Waist": 20190,      // Highlander's Leather Girdle
            "Legs": 47360,       // Stormrage pants
            "Feet": 20052,       // Highlander's Leather Boots
            "Finger 1": 83237,   // Band of Ancient Lethality
            "Finger 2": 18821,   // Quick Strike Ring
            "Trinket 1": 60559,  // Hatereaver Cog
            "Trinket 2": 60501,  // Whip of Encouragement
            "Main Hand": 84603,  // Rod of the Churning Hourglass
            "Off Hand": 0,       
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Phase 1 (Mitigation)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 81263,       // Lost Dark Iron Chain
            "Shoulder": 20059,   // Highlander's Leather Shoulders
            "Back": 17107,       // Dragon's Blood Cape
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 12966,      // Blackmist Armguards
            "Hands": 13258,      // Slaghide Gauntlets of the bear
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 22749,       // Sentinel's Leather pants
            "Feet": 20052,       // Highlander's Leather Boots
            "Finger 1": 18879,   // Heavy Dark Iron Ring
            "Finger 2": 18813,   // Ring of Binding
            "Trinket 1": 13966,  // Mark of Tyranny
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 61044,  // Gavel of the northwind
            "Off Hand": 0,       
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    // ==========================================
    // PHASE 1.5 (Kara10 / Nightmare dragons / Kazzak) - Nur Mitigation
    // ==========================================
    "Phase 1.5 (Mitigation)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 81263,       // Lost Dark Iron Chain
            "Shoulder": 20059,   // Highlander's Leather Shoulders
            "Back": 17107,       // Dragon's Blood Cape
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 51783,      // Shadowskin Bracers
            "Hands": 13258,      // Slaghide Gauntlets of the bear
            "Waist": 20190,      // Highlander's Leather Girdle
            "Legs": 22749,       // Sentinel's Leather pants
            "Feet": 20052,       // Highlander's Leather Boots
            "Finger 1": 18879,   // Heavy Dark Iron Ring
            "Finger 2": 56062,   // Blackwing signet of command
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 20580,  // Hammer of Bestial Fury
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },

    // ==========================================
    // PHASE 2 (Blackwing Lair / Blood Ring)
    // ==========================================
    "Phase 2 (Threat)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 20622,       // Dragonhearth Necklace
            "Shoulder": 47355,   // Stormrage shoulderpads
            "Back": 20691,       // Windshear Cape
            "Chest": 16452,      // Field Marshal's Dragonhide Breastplate
            "Wrist": 51783,      // Shadowskin Bracers
            "Hands": 16555,      // Marshal's Dragonhide Gloves
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 47360,       // Stormrage pants
            "Feet": 47361,       // Stormrage treads
            "Finger 1": 56062,   // Blackwing signet of command
            "Finger 2": 18821,   // Quick Strike Ring
            "Trinket 1": 60559,  // Hatereaver Cog
            "Trinket 2": 19406,  // Drake Fang Talisman
            "Main Hand": 20580,  // Hammer of Bestial Fury
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Phase 2 (Mitigation)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 81263,       // Lost Dark Iron Chain
            "Shoulder": 83435,   // Bloody Gladiator Shoulders
            "Back": 17107,       // Dragon's Blood Cape
            "Chest": 19405,      // Malfurion's Blessed Bulwark
            "Wrist": 47357,      // Stormrage wristguards
            "Hands": 83430,      // Bloody Gladiator's Gloves
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 22749,       // Sentinel's Leather pants
            "Feet": 19381,       // Boots of the Shadow Flame
            "Finger 1": 18879,   // Heavy Dark Iron Ring
            "Finger 2": 56062,   // Blackwing signet of command
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 20580,  // Hammer of Bestial Fury
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },

    // ==========================================
    // PHASE 3 (Emerald Sanctum / Zul'Gurub)
    // ==========================================
    "Phase 3 (Threat)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 18404,       // Onyxia tooth pendant
            "Shoulder": 47355,   // Stormrage shoulderpads
            "Back": 20691,       // Windshear Cape
            "Chest": 12757,      // Breastplate of Bloodthirst
            "Wrist": 61212,      // Sanctum Bark Wraps
            "Hands": 47358,      // Stormrage handguards
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 20627,       // Dark Heart Pants
            "Feet": 47361,       // Stormrage treads
            "Finger 1": 83237,   // Band of Ancient Lethality
            "Finger 2": 18821,   // Quick Strike Ring
            "Trinket 1": 19406,  // Drake Fang Talisman
            "Trinket 2": 61194,  // The Heart of Dreams
            "Main Hand": 20580,  // Hammer of Bestial Fury
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Phase 3 (Mitigation)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 81263,       // Lost Dark Iron Chain
            "Shoulder": 83435,   // Bloody Gladiator Shoulders
            "Back": 51731,       // Venom Covered Cloak
            "Chest": 19405,      // Malfurion's Blessed Bulwark
            "Wrist": 47357,      // Stormrage wristguards
            "Hands": 83430,      // Bloody Gladiator's Gloves
            "Waist": 83447,      // Clutch of Hivaxxis
            "Legs": 20627,       // Dark Heart Pants
            "Feet": 19381,       // Boots of the Shadow Flame
            "Finger 1": 18879,   // Heavy Dark Iron Ring
            "Finger 2": 61195,   // Ring of Nordrassil
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 20580,  // Hammer of Bestial Fury
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },

    // ==========================================
    // PHASE 4 (AQ40 / AQ20)
    // ==========================================
    "Phase 4 (Threat)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 83484,       // Desert Wind Talisman
            "Shoulder": 47368,   // Genesis shoulderpads
            "Back": 20691,       // Windshear Cape
            "Chest": 47369,      // Genesis raiments
            "Wrist": 61212,      // Sanctum Bark Wraps
            "Hands": 21605,      // Gloves of the Hidden Temple
            "Waist": 21586,      // Belt of Never-ending Agony
            "Legs": 47370,       // Genesis Pants
            "Feet": 47371,       // Genesis Treads
            "Finger 1": 19384,   // Master Dragonslayer's Ring
            "Finger 2": 21408,   // Band of Unending Life
            "Trinket 1": 60559,  // Hatereaver Cog
            "Trinket 2": 61194,  // The Heart of Dreams
            "Main Hand": 21268,  // Blessed Qiraji War Hammer
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Phase 4 (Mitigation)": {
        gear: {
            "Head": 21693,       // Guise of the Devourer
            "Neck": 22732,       // Mark of C'thun
            "Shoulder": 83435,   // Bloody Gladiator Shoulders
            "Back": 51731,       // Venom Covered Cloak
            "Chest": 19405,      // Malfurion's Blessed Bulwark
            "Wrist": 83433,      // Bloody Gladiator's Bands
            "Hands": 21605,      // Gloves of the Hidden Temple
            "Waist": 21586,      // Belt of Never-ending Agony
            "Legs": 20627,       // Dark Heart Pants
            "Feet": 19381,       // Boots of the Shadow Flame
            "Finger 1": 21601,   // Ring of Emperor Vek'lor
            "Finger 2": 61195,   // Ring of Nordrassil
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 21268,  // Blessed Qiraji War Hammer
            "Off Hand": 22988,   // Almanac of Savagery
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },

    // ==========================================
    // PHASE 5 (Naxxramas)
    // ==========================================
    "Phase 5 (Threat)": {
        gear: {
            "Head": 47354,       // Stormrage helmet
            "Neck": 23053,       // Stormrage's Talisman of Seething
            "Shoulder": 47368,   // Genesis shoulderpads
            "Back": 23045,       // Shroud of dominion
            "Chest": 47369,      // Genesis raiments
            "Wrist": 61212,      // Sanctum Bark Wraps
            "Hands": 21605,      // Gloves of the Hidden Temple
            "Waist": 21586,      // Belt of Never-ending Agony
            "Legs": 23071,       // Leggings of Apocalypse
            "Feet": 47388,       // Dreamwalker Treads
            "Finger 1": 23038,   // Band of Unnatural Forces
            "Finger 2": 47389,   // Band of the dreamwalker
            "Trinket 1": 22954,  // Kiss of the Spider
            "Trinket 2": 61194,  // The Heart of Dreams
            "Main Hand": 23039,  // Atiesh, Greatstaff of the Guardian
            "Off Hand": 0,       
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Phase 5 (Mitigation)": {
        gear: {
            "Head": 47381,       // Dreamwalker helmet
            "Neck": 23023,       // Sadist's Collar
            "Shoulder": 47382,   // Dreamwalker Shoulderpads
            "Back": 51731,       // Venom Covered Cloak
            "Chest": 47383,      // Dreamwalker Raiments
            "Wrist": 47384,      // Dreamwalker wristguards
            "Hands": 21605,      // Gloves of the Hidden Temple
            "Waist": 47386,      // Dreamwaker Girdle
            "Legs": 47387,       // Dreamwalker pants
            "Feet": 47388,       // Dreamwalker Treads
            "Finger 1": 23018,   // Signet of the Fallen Defender
            "Finger 2": 47389,   // Band of the dreamwalker
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 23039,  // Atiesh, Greatstaff of the Guardian
            "Off Hand": 0,       
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    

    // ==========================================
    // KARA 40 (Endgame BiS)
    // ==========================================
    "Kara 40 (Threat)": {
        gear: {
            "Head": 55119,       // Forgotten Hide Helm
            "Neck": 23053,       // Stormrage's Talisman of Seething
            "Shoulder": 47368,   // Genesis shoulderpads
            "Back": 55515,       // Felforged Nathzeran Veil
            "Chest": 55513,      // Tunic of Demonic Deception
            "Wrist": 55089,      // Bands of the surgebreaker
            "Hands": 55125,      // Handwraps of Dead Winds
            "Waist": 55357,      // Sash of the Grand Betrayal
            "Legs": 23071,       // Leggings of Apocalypse
            "Feet": 47406,       // Treads of the Talon
            "Finger 1": 23038,   // Band of Unnatural Forces
            "Finger 2": 47389,   // Band of the dreamwalker
            "Trinket 1": 22954,  // Kiss of the Spider
            "Trinket 2": 61194,  // The Heart of Dreams
            "Main Hand": 23039,  // Atiesh, Greatstaff of the Guardian
            "Off Hand": 0,       
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    },
    "Kara 40 (Mitigation)": {
        gear: {
            "Head": 55119,       // Forgotten Hide Helm
            "Neck": 55132,       // Pendant of purified demon's blood
            "Shoulder": 47382,   // Dreamwalker Shoulderpads
            "Back": 51731,       // Venom Covered Cloak
            "Chest": 47383,      // Dreamwalker Raiments
            "Wrist": 47384,      // Dreamwalker wristguards
            "Hands": 47385,      // Dreamwalker handwraps
            "Waist": 47386,      // Dreamwaker Girdle
            "Legs": 47387,       // Dreamwalker pants
            "Feet": 47388,       // Dreamwalker Treads
            "Finger 1": 55123,   // Looop of Hardened Slate
            "Finger 2": 47389,   // Band of the dreamwalker
            "Trinket 1": 61816,  // Araxxna's Husk
            "Trinket 2": 60559,  // Hatereaver Cog
            "Main Hand": 55276,  // Forgotten Raven's Mallet
            "Off Hand": 55279,   // Branch of Resolute Defense
            "Idol": 23198        // Idol of Brutality
        },
        enchants: { "Head": 0, "Neck": 0, "Shoulder": 0, "Back": 0, "Chest": 0, "Wrist": 0, "Hands": 0, "Waist": 0, "Legs": 0, "Feet": 0, "Finger 1": 0, "Finger 2": 0, "Trinket 1": 0, "Trinket 2": 0, "Main Hand": 0, "Off Hand": 0, "Idol": 0 }
    }


};

// ============================================================================
// PIXEL ART ANIMATION DATA (BEAR TANK EDITION - DETAILED MODELS)
// ============================================================================

// Erweiterte Farbpalette für detailliertere Boss/Bären-Modelle
const C = {
    _: null, 
    // Bear Colors
    BR: '#5C4033', DBR: '#3e2723', 
    // Dark/Monsters (Onyxia, Maexxna, Lashlayer)
    BK: '#111111', GR: '#555555', DGR: '#333333',
    // Fire/Blood (Magmadar, Mandokir)
    R: '#E53935', DR: '#B71C1C', OR: '#FB8C00', Y: '#FDD835',
    // Poison/Nature (Patchwerk, Mandokir)
    LG: '#7CB342', DG: '#33691E',
    // Magic/Void (Twin Emps, Onyxia)
    PU: '#8E24AA', DPU: '#4A148C',
    // Flesh/Undead (Patchwerk)
    PK: '#F48FB1', DPK: '#C2185B',
    // Metals/Bones
    W: '#EEEEEE', SV: '#B0BEC5',
    // Text Colors
    TX: '#FFFFFF'
};

const T = (rows, color = C.TX) => rows.map(r => r.split('').map(c => c === 'X' ? color : C._));

window.SPRITES = {
    // 🐻 Dire Bear (Facing Right) - Markanter Höcker, Schnauze und Ohren
    bear: [
        [C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._],
        [C._,   C._,   C.DBR, C.DBR, C._,   C._,   C._,   C._,   C._,   C._,   C._,   C._],
        [C._,   C.DBR, C.BR,  C.BR,  C.DBR, C._,   C._,   C._,   C.DBR, C.DBR, C._,   C._],
        [C.DBR, C.BR,  C.BR,  C.BR,  C.BR,  C.DBR, C.DBR, C.DBR, C.BR,  C.BR,  C.DBR, C._],
        [C.DBR, C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.W,   C.BK,  C._],
        [C._,   C.DBR, C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.BR,  C.DBR, C._],
        [C._,   C._,   C.DBR, C.DBR, C._,   C._,   C.DBR, C.DBR, C.DBR, C.DBR, C._,   C._],
        [C._,   C._,   C.BK,  C.BK,  C._,   C._,   C._,   C.BK,  C.BK,  C._,   C._,   C._]
    ],
    // ⚔️ Melee Swipe Effect (Rote Kratzer)
    swipe: [
        [C._, C.R, C._, C._, C._, C.R, C._],
        [C._, C._, C.R, C._, C.R, C._, C._],
        [C._, C._, C._, C.R, C._, C._, C._],
        [C._, C._, C.R, C._, C.R, C._, C._],
        [C._, C.R, C._, C._, C._, C.R, C._]
    ],

    // --- BOSSES (Facing Left) ---
    dummy: [
        [C._, C._, C._, C.DBR, C.DBR, C.DBR, C._, C._, C._],
        [C._, C._, C.DBR, C.Y,   C.Y,   C.Y,   C.DBR, C._, C._],
        [C._, C._, C.DBR, C.Y,   C.Y,   C.Y,   C.DBR, C._, C._],
        [C._, C.GR,  C.GR,  C.GR,  C.GR,  C.GR,  C.GR,  C.GR, C._],
        [C._, C.GR,  C.BR,  C.BR,  C.DBR, C.BR,  C.BR,  C.GR, C._],
        [C._, C._, C.BR,  C.BR,  C.DBR, C.BR,  C.BR,  C._, C._],
        [C._, C._, C._, C.DBR, C.BR,  C.DBR, C._, C._, C._],
        [C._, C._, C.DBR, C.DBR, C.DBR, C.DBR, C.DBR, C._, C._]
    ],
    magmadar: [ // Core Hound (2 Köpfe, Feuer-Farben)
        [C._, C._, C._, C.R,  C._,  C._,  C._,  C.R,  C._,  C._],
        [C._, C._, C.R, C.OR, C.R,  C._,  C.R,  C.OR, C.R,  C._],
        [C._, C.R, C.OR,C.Y,  C.OR, C.R,  C.OR, C.Y,  C.OR, C.R],
        [C.R, C.OR,C.Y, C.BK, C.Y,  C.OR, C.Y,  C.BK, C.Y,  C.OR],
        [C._, C.R, C.OR,C.Y,  C.OR, C.R,  C.OR, C.Y,  C.OR, C._],
        [C._, C._, C.R, C.OR, C.R,  C.R,  C.R,  C.OR, C.R,  C._],
        [C._, C._, C._, C.DR, C.DR, C._,  C.DR, C.DR, C._,  C._]
    ],
    onyxia: [ // Schwarzer Drache
        [C._,  C._,  C._,  C._,  C._,  C._,  C.DPU,C.DPU,C._,  C._],
        [C._,  C._,  C._,  C._,  C._,  C.BK, C.GR, C.GR, C.W,  C._],
        [C.DPU,C._,  C._,  C.DPU,C.BK, C.GR, C.GR, C.BK, C.DR, C._],
        [C._,  C.DPU,C.DPU,C.BK, C.GR, C.GR, C.GR, C.GR, C._,  C._],
        [C._,  C._,  C.BK, C.GR, C.GR, C.GR, C.GR, C._,  C._,  C._],
        [C._,  C.BK, C.GR, C.GR, C.BK, C._,  C.BK, C._,  C._,  C._],
        [C._,  C._,  C._,  C.BK, C.BK, C._,  C.BK, C.BK, C._,  C._]
    ],
    mandokir: [ // Troll (Oben) auf Raptor (Unten)
        [C._,  C._,  C._,  C._,  C.DG, C.DG, C.DG, C._,  C._,  C._],
        [C._,  C._,  C._,  C._,  C._,  C.LG, C.LG, C._,  C._,  C._],
        [C._,  C._,  C._,  C._,  C.SV, C.DG, C.DG, C.LG, C._,  C._],
        [C._,  C._,  C._,  C._,  C.SV, C.DR, C.DR, C._,  C._,  C._],
        [C._,  C._,  C.R,  C.R,  C.OR, C.OR, C.OR, C.R,  C.R,  C._],
        [C._,  C.R,  C.R,  C.OR, C.Y,  C.OR, C.OR, C.OR, C.Y,  C.W],
        [C._,  C._,  C.R,  C.R,  C.OR, C.OR, C.OR, C.R,  C.R,  C._],
        [C._,  C._,  C._,  C.DR, C.DR, C._,  C.DR, C.DR, C._,  C._]
    ],
    lashlayer: [ // Black Dragonkin mit großem Schwert
        [C._,  C._,  C._,  C._,  C._,  C._,  C.SV, C.SV, C.SV, C._],
        [C._,  C._,  C._,  C._,  C._,  C.GR, C.SV, C.SV, C._,  C._],
        [C._,  C._,  C._,  C._,  C.BK, C.GR, C.GR, C.BK, C.DR, C._],
        [C._,  C._,  C._,  C.BK, C.GR, C.GR, C.GR, C.GR, C._,  C._],
        [C._,  C.BK, C.GR, C.GR, C.GR, C.GR, C.GR, C.BK, C._,  C._],
        [C._,  C._,  C.BK, C.GR, C.GR, C.GR, C._,  C._,  C._,  C._],
        [C._,  C._,  C._,  C.BK, C.BK, C._,  C.BK, C.BK, C._,  C._]
    ],
    twinemps: [ // Zwei große Silhouetten nebeneinander (Lila & Rot)
        [C._,  C._,  C.Y,  C.Y,  C._,  C._,  C.Y,  C.Y,  C._,  C._],
        [C._,  C.DPU,C.PU, C.PU, C.DPU,C.DR, C.R,  C.R,  C.DR, C._],
        [C._,  C.DPU,C.PU, C.PU, C.DPU,C.DR, C.R,  C.R,  C.DR, C._],
        [C._,  C._,  C.Y,  C.Y,  C._,  C._,  C.Y,  C.Y,  C._,  C._],
        [C._,  C.DPU,C.PU, C.PU, C.DPU,C.DR, C.R,  C.R,  C.DR, C._],
        [C._,  C.DPU,C.PU, C.PU, C.DPU,C.DR, C.R,  C.R,  C.DR, C._],
        [C._,  C.DPU,C.PU, C.PU, C.DPU,C.DR, C.R,  C.R,  C.DR, C._]
    ],
    patchwerk: [ // Fette Monstrosität mit Fleischerhaken
        [C._,  C._,  C._,  C._,  C.PK, C.PK, C._,  C._,  C._,  C._],
        [C._,  C._,  C._,  C.PK, C.PK, C.PK, C.PK, C._,  C._,  C._],
        [C._,  C._,  C.PK, C.PK, C.LG, C.LG, C.PK, C.PK, C._,  C._],
        [C._,  C.SV, C.PK, C.PK, C.PK, C.PK, C.PK, C.PK, C.SV, C._],
        [C.SV, C.SV, C.PK, C.PK, C.DG, C.DG, C.PK, C.PK, C._,  C._],
        [C._,  C.SV, C._,  C.PK, C.PK, C.PK, C.PK, C._,  C._,  C._],
        [C._,  C._,  C._,  C.DPK,C.DPK,C._,  C.DPK,C.DPK,C._,  C._]
    ],
    maexxna: [ // Große Spinne mit 8 Beinen & Hinterleib
        [C._,  C._,  C.DGR,C._,  C._,  C.DGR,C._,  C._,  C.DGR,C._],
        [C._,  C.DGR,C.GR, C.DGR,C.DGR,C.GR, C.DGR,C.DGR,C._,  C._],
        [C.DGR,C.GR, C.GR, C.GR, C.GR, C.GR, C.GR, C.GR, C.DGR,C._],
        [C.DGR,C.GR, C.LG, C.GR, C.GR, C.LG, C.GR, C.GR, C.W,  C.DGR],
        [C.DGR,C.GR, C.GR, C.GR, C.GR, C.GR, C.GR, C.GR, C.DGR,C._],
        [C._,  C.DGR,C.DGR,C.DGR,C.DGR,C.DGR,C.DGR,C.DGR,C._,  C._],
        [C._,  C.DGR,C._,  C._,  C._,  C._,  C._,  C.DGR,C._,  C._]
    ],
    
    // Letters for Popups
    txtC: T(['XXX','X..','X..','X..','XXX']),
    txtR: T(['XXX','X.X','XXX','X.X','X.X']),
    txtI: T(['XXX','.X.','.X.','.X.','XXX']),
    txtT: T(['XXX','.X.','.X.','.X.','.X.']),
    txtM: T(['X.X','XXX','X.X','X.X','X.X']),
    txtS: T(['XXX','X..','XXX','..X','XXX']),
    txtD: T(['XX.','X.X','X.X','X.X','XX.']),
    txtO: T(['XXX','X.X','X.X','X.X','XXX']),
    txtG: T(['XXX','X..','X.X','X.X','XXX']),
    txtE: T(['XXX','X..','XXX','X..','XXX']),
    txtP: T(['XXX','X.X','XXX','X..','X..']),
    txtA: T(['.X.','X.X','XXX','X.X','X.X']),
    txtY: T(['X.X','X.X','.X.','.X.','.X.']),
    txtEcl: T(['.X.','.X.','.X.','...','.X.'])
};