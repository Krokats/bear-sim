/**
 * Bear Tank Simulation - File 6: Main Init
 * Updated for Turtle WoW 1.18 (Dire Bear Tank)
 * Entry point for the application. Handles initialization and URL parsing.
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    console.log("Initializing Krokat's Bear Tank Sim (Turtle WoW 1.18)...");

    // Set up all UI event listeners (tabs, buttons, dropdowns)
    if (typeof setupUIListeners === 'function') {
        setupUIListeners();
    }

    // Render the initial sidebar (Sim list)
    if (typeof renderSidebar === 'function') {
        renderSidebar();
    }

    // Load the Item and Enchant Databases
    if (typeof loadDatabase === 'function') {
        loadDatabase().then(function () {
            console.log("Item & Enchant Database Loaded.");

            // Parse URL for imported configurations (Build Sharing)
            var urlParams = new URLSearchParams(window.location.search);
            var cfgStr = urlParams.get('cfg');

            if (cfgStr) {
                try {
                    // Try to decompress the URL parameter
                    var json = LZString.decompressFromEncodedURIComponent(cfgStr);
                    if (!json) json = LZString.decompressFromBase64(cfgStr);

                    if (json) {
                        var data = JSON.parse(json);
                        if (!Array.isArray(data)) data = [data];

                        if (data.length > 0) {
                            SIM_LIST = [];
                            data.forEach(function (item) {
                                var sName = item.n || item.name || "Imported Bear Build";
                                var newSim = new SimObject(Date.now() + Math.floor(Math.random() * 1000), sName);

                                if (item.d && typeof unpackConfig === 'function') {
                                    newSim.config = unpackConfig(item.d);
                                } else {
                                    newSim.config = item.config || item;
                                }
                                SIM_LIST.push(newSim);
                            });

                            if (typeof renderSidebar === 'function') renderSidebar();

                            // Load the first imported sim
                            if (SIM_LIST.length > 0 && typeof switchSim === 'function') {
                                switchSim(0, true);
                            }
                        }
                    }
                } catch (e) {
                    console.error("URL Load Error (Invalid Build String):", e);
                    if (SIM_LIST.length === 0 && typeof addSim === 'function') addSim(true);
                }
            } else {
                // If no URL config, start a fresh profile
                if (SIM_LIST.length === 0 && typeof addSim === 'function') {
                    // Falls eine addSim Funktion existiert, ansonsten leeres Profil laden
                    addSim(true); 
                } else {
                    // Trigger initial calculations for the default empty state
                    if (typeof calculateGearStats === 'function') calculateGearStats();
                }
            }

        }).catch(function (err) {
            console.error("Database Error:", err);
            // Fallback initialization if DB fails
            if (typeof calculateGearStats === 'function') calculateGearStats();
        });
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Ensure DOM is fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}