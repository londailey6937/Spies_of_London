
        // =============================================================================
        // INITIALIZATION AND CORE SETUP
        // =============================================================================

        // Initialize Mapbox access token
        mapboxgl.accessToken = "pk.eyJ1IjoibG9uZGFpbGV5IiwiYSI6ImNsZ3ppenhzcTAza3UzanE4OTgzejFldXoifQ.yFlIyYva4PPlYBmfqvdcDw";

        // Global state variables
        let isFollowingAgent = false;
        let activeAgentId = null;
        let userInteractedWithMap = false;
        let poiMarkers = [];
        let activePopup = null;
        let customLocations = {};
        let allLocations = {};
        let locationGraph = {};

        // Initialize the map
        const map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/dark-v11", // Use a dark style (can be customized)
            center: [-0.1278, 51.5074], // London coordinates
            zoom: 12,
            pitch: 60, // 3D pitch
            bearing: -45, // 3D bearing
        });

        // Wait for the map to load
        map.on("load", function() {
            console.log("Map loaded, initializing game...");
            
            // Add 3D buildings effect for better visuals
            map.addLayer({
                id: "3d-buildings",
                source: "composite",
                "source-layer": "building",
                filter: ["==", "extrude", "true"],
                type: "fill-extrusion",
                minzoom: 14,
                paint: {
                    "fill-extrusion-color": "#aaa",
                    "fill-extrusion-height": ["get", "height"],
                    "fill-extrusion-base": ["get", "min_height"],
                    "fill-extrusion-opacity": 0.6,
                }
            });

            // Display intro animation
            showIntroAnimation();
            
            // Initialize game systems with delay for smooth startup
            setTimeout(() => {
                initializeLocations();
                createAgentMarkers();
                setupControls();
                setupRivalAgents();
                setupEventListeners();

                
            }, 1000);
        });

        // Show intro animation
        function showIntroAnimation() {
            const overlay = document.createElement('div');
            overlay.className = 'intro-animation-overlay';
            overlay.innerHTML = `
                <div class="intro-title">
                    <div class="spy-icon" style="font-size: 10rem !important; line-height: 1; margin-bottom: 30px;">🕴️</div>
                    <h1>Spies of London</h1>
                    <p>MI6 agents track foreign operatives across the city</p>
                </div>
                <div class="intro-progress">
                    <div class="progress-inner"></div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            // Start with a zoomed-out view
            map.jumpTo({
                center: [0, 20], // View of Europe
                zoom: 3,
                pitch: 0,
                bearing: 0
            });
            
            // Start the progress animation
            setTimeout(() => {
                document.querySelector('.progress-inner').style.width = '100%';
            }, 100);
            
            // Fade out intro after animation completes
            setTimeout(() => {
                overlay.style.opacity = '0';
                
                // Zoom into London
                map.flyTo({
                    center: [-0.1278, 51.5074], // London coordinates
                    zoom: 14,
                    pitch: 60,
                    bearing: -45,
                    speed: 0.3, // Slower speed for dramatic effect
                    curve: 1,
                    essential: true,
                    // When animation completes
                    complete: function() {
                        showNotification("Welcome to Spies of London");
                    }
                });
                
                // Remove overlay after fade completes
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 1500);
            }, 4000);
        }

        // Add to your initializeGame or setupControls function

        document.getElementById('toggle-intel').addEventListener('click', function() {
            const panel = document.querySelector('.analysis-panel');
            const isVisible = panel.classList.contains('visible');
            
            panel.classList.toggle('visible', !isVisible);
            this.classList.toggle('active', !isVisible);
            
            // Close rival panel if intelligence panel is opened
            if (!isVisible) {
                const rivalPanel = document.querySelector('.rival-monitor');
                const rivalToggle = document.getElementById('toggle-rivals');
                rivalPanel.classList.remove('visible');
                rivalToggle.classList.remove('active');
            }
        });

        document.getElementById('toggle-rivals').addEventListener('click', function() {
            const panel = document.querySelector('.rival-monitor');
            const isVisible = panel.classList.contains('visible');
            
            panel.classList.toggle('visible', !isVisible);
            this.classList.toggle('active', !isVisible);
            
            // Close intel panel if rival panel is opened
            if (!isVisible) {
                const intelPanel = document.querySelector('.analysis-panel');
                const intelToggle = document.getElementById('toggle-intel');
                intelPanel.classList.remove('visible');
                intelToggle.classList.remove('active');
            }
        });

        // =============================================================================
        // UI COMPONENTS AND HELPERS
        // =============================================================================

        // Create accessible popups that avoid aria-hidden issues
        // Create accessible popups that avoid aria-hidden issues
        function createAccessiblePopup(options = {}) {
            // Merge provided options with defaults
            const popupOptions = {
                closeButton: true,
                className: 'transparent-popup',
                closeOnClick: false,
                ...options
            };
            
            // Create the popup but disable the problematic close button
            const popup = new mapboxgl.Popup({
                ...popupOptions,
                closeButton: false
            });
            
            // Get the original popup open method before we override it
            const originalOnAdd = popup.onAdd;
            
            // Override the onAdd method to add our custom close button
            popup.onAdd = function(map) {
                // Call the original onAdd method
                const container = originalOnAdd.call(this, map);
                
                // Only add custom close button if closeButton option is true
                if (popupOptions.closeButton) {
                    // Find the popup content container
                    const content = container.querySelector('.mapboxgl-popup-content');
                    
                    // Create our accessible close button
                    const closeButton = document.createElement('button');
                    closeButton.className = 'mapboxgl-popup-close-button';
                    closeButton.setAttribute('aria-label', 'Close popup');
                    closeButton.setAttribute('type', 'button');
                    closeButton.textContent = '×';
                    
                    // Explicitly ensure aria-hidden is not applied
                    closeButton.removeAttribute('aria-hidden');
                    
                    // Add event listener
                    closeButton.addEventListener('click', () => {
                        popup.remove();
                    });
                    
                    // Add the button to the content container (at the beginning)
                    content.insertBefore(closeButton, content.firstChild);
                    
                    // Add a mutation observer to prevent aria-hidden from being added
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && 
                                mutation.attributeName === 'aria-hidden') {
                                closeButton.removeAttribute('aria-hidden');
                            }
                        });
                    });
                    
                    observer.observe(closeButton, { attributes: true });
                }
                
                return container;
            };
            
            return popup;
        }

        // Show notification popup
        function showNotification(message, duration = 3000) {
            const notification = document.getElementById("notification");
            
            // Clear any existing timeout
            if (window.notificationTimeout) {
                clearTimeout(window.notificationTimeout);
            }
            
            // Update and show notification
            notification.textContent = message;
            notification.classList.add("show");
            
            // Hide after duration
            window.notificationTimeout = setTimeout(() => {
                notification.classList.remove("show");
            }, duration);
        }

        // Setup control buttons
        function setupControls() {
            // MI6 agent movement
            document.getElementById("mi6-move").addEventListener("click", () => {
                const destination = document.getElementById("mi6-destination").value;
                if (destination && destination !== agents.mi6.location) {
                    moveAgent("mi6", destination);
                }
            });
            
            // Replace Reset button with Restart button
            const resetButton = document.getElementById("reset-game");
            
            // Change the button text and ID
            resetButton.textContent = "Restart Game";
            resetButton.id = "restart-game";
            
            // Remove any existing event listeners (by cloning and replacing the button)
            const newButton = resetButton.cloneNode(true);
            resetButton.parentNode.replaceChild(newButton, resetButton);
            
            // Add event listener for page reload
            newButton.addEventListener("click", () => {
                showNotification("Restarting game...");
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            });
            
            // Zoom in button (existing functionality)
            document.getElementById("zoom-in").addEventListener("click", () => {
                const currentZoom = map.getZoom();
                const currentCenter = map.getCenter();
                
                map.easeTo({
                    center: currentCenter,
                    zoom: currentZoom + 1,
                    duration: 1000,
                });
            });

            
            
            // Toggle agent following (existing functionality)
            document.getElementById("follow-button").addEventListener("click", () => {
                toggleAgentFollowing();
            });
        }

       // Setup event listeners
       function setupEventListeners() {
           // Track if user is interacting with map
           map.on("dragstart", () => userInteractedWithMap = true);
           map.on("dragend", () => setTimeout(() => userInteractedWithMap = false, 2000));
           map.on("zoomstart", () => userInteractedWithMap = true);
           map.on("zoomend", () => setTimeout(() => userInteractedWithMap = false, 2000));
           
           // Add click handler to close popups
           map.on('click', (e) => {
               // Close any active popups when clicking elsewhere on the map
               if (activePopup && activePopup.isOpen()) {
                   activePopup.remove();
                   activePopup = null;
               }
               
               // Don't add point if following an agent
               if (isFollowingAgent) return;
               
               // Create custom location from click
               const coordinates = [e.lngLat.lng, e.lngLat.lat];
               
               // Use reverse geocoding to get location name
               reverseGeocode(coordinates);
           });
           
           
       }

        function applySearchUIFixes() {
            // Create a new style element
            const style = document.createElement('style');
            
            // Add CSS fixes, but modify the panel styling to support toggles
            style.textContent = `
                /* Fixed positioning for navigation bars */
                .top-navbar {
                    position: fixed !important; 
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 2000 !important;
                    height: 60px;
                }
                
                .control-panel {
                    position: fixed !important;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 2000 !important;
                    height: 60px;
                }
                
                /* Ensure map container fills viewport */
                #map {
                    position: absolute !important;
                    top: 0 !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: 1 !important;
                }
                
                /* Control body scrolling */
                body, html {
                    overflow: hidden !important;
                    height: 100vh !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    position: relative !important;
                }
                
               
                
                /* Ensure popups are scrollable */
                .mapboxgl-popup-content {
                    max-height: 60vh !important;
                    overflow-y: auto !important;
                }
                
                /* Fix z-index for important UI elements */
                .notification {
                    z-index: 3000 !important;
                }
            `;
            
            // Add the style element to the head
            document.head.appendChild(style);
            
            console.log("Search UI fixes applied with panel toggle support");
        }

        // =============================================================================
        // AGENT SYSTEM
        // =============================================================================

        // Define agent objects
        const agents = {
            mi6: {
                id: "mi6",
                name: "MI6 Agent",
                location: "mi6hq",
                color: "#0078D7",
                marker: null,
                path: null,
                pathDisplay: [],
                routeCoordinates: [], // Array of coordinates for the path
                currentRouteIndex: 0, // Current position in route
                animationInProgress: false,
            }
        };

        // Create agent markers on the map
        function createAgentMarkers() {
            // Clear any existing markers first
            if (agents.mi6 && agents.mi6.marker) {
                agents.mi6.marker.remove();
                agents.mi6.marker = null;
            }
            
            // Create MI6 agent marker
            const mi6El = document.createElement("div");
            mi6El.className = "agent-marker mi6-agent";
            mi6El.textContent = "MI6";
            
            // Add marker to map
            agents.mi6.marker = new mapboxgl.Marker({
                element: mi6El,
                anchor: "center",
                pitchAlignment: "viewport",
                rotationAlignment: "viewport"
            })
            .setLngLat(allLocations["mi6hq"].coordinates)
            .setPopup(new mapboxgl.Popup({ className: 'transparent-popup' }).setText("MI6 Agent"))
            .addTo(map);
            
            // Add interception target property to MI6 agent
            agents.mi6.interceptionTarget = null;
            
            // Update location text in UI
            document.getElementById("mi6-location").textContent = 
                "Location: " + (allLocations[agents.mi6.location]?.name || "MI6 HQ");
        }

      // Setup rival agents
      function setupRivalAgents() {
          // Define embassies and their agents
          const embassies = [
              {
                  id: "russianembassy",
                  name: "Russian",
                  code: "RUS",
                  color: "#e53e3e", // Red
                  agentCount: 3
              },
              {
                  id: "chineseembassy",
                  name: "Chinese",
                  code: "CHN",
                  color: "#dd6b20", // Orange
                  agentCount: 3
              },
              {
                  id: "frenchembassy",
                  name: "French",
                  code: "FRA",
                  color: "#3182ce", // Blue
                  agentCount: 2
              },
              {
                  id: "germanembassy",
                  name: "German",
                  code: "GER",
                  color: "#2c5282", // Dark blue
                  agentCount: 2
              },
              {
                  id: "usembassy",
                  name: "US",
                  code: "USA",
                  color: "#2c7a7b", // Teal
                  agentCount: 3
              }
          ];
          
          // Create agency sections in monitor panel
          const agenciesContainer = document.getElementById("rival-agencies");
          agenciesContainer.innerHTML = '';
          
          // Create rival agents for each embassy
          embassies.forEach(embassy => {
              // Create agency section in monitor panel
              const agencySection = document.createElement('div');
              agencySection.className = 'rival-agency';
              
              // Create agency header
              const header = document.createElement('div');
              header.className = 'rival-agency-header';
              
              const colorDot = document.createElement('div');
              colorDot.className = 'rival-color-dot';
              colorDot.style.backgroundColor = embassy.color;
              header.appendChild(colorDot);
              
              const agencyName = document.createElement('div');
              agencyName.textContent = `${embassy.name} (${embassy.code})`;
              header.appendChild(agencyName);
              
              agencySection.appendChild(header);
              
              // Create agents
              for (let i = 1; i <= embassy.agentCount; i++) {
                  // Create agent in system
                  const agentId = `${embassy.code.toLowerCase()}${i}`;
                  // Create short code for display (e.g., R1, C2, F1)
                  const shortCode = `${embassy.code.charAt(0)}${i}`;
                  
                  // Clear any existing agent data first to prevent duplicates
                  if (agents[agentId] && agents[agentId].marker) {
                      agents[agentId].marker.remove();
                  }
                  
                  // Create agent object
                  agents[agentId] = {
                      id: agentId,
                      name: `${embassy.code} Agent ${i}`,
                      shortCode: shortCode,
                      agency: embassy.name,
                      location: embassy.id,
                      color: embassy.color,
                      marker: null,
                      path: null,
                      pathDisplay: [],
                      routeCoordinates: [],
                      currentRouteIndex: 0,
                      animationInProgress: false,
                      targetLandmark: null,
                      status: "idle",
                      operationTime: 0,
                      operationDuration: 0
                  };
                  
                  // Initialize intelligence on agent creation
                  agents[agentId].intelligence = {
                      hasIntel: Math.random() > 0.3, // 70% chance of having intelligence
                      intelType: ['Classified Documents', 'Military Plans', 'Trade Secrets', 'Political Information', 'Scientific Formulas'][Math.floor(Math.random() * 5)],
                  };
                  
                  // Create marker element
                  const el = document.createElement("div");
                  el.className = "agent-marker rival-agent";
                  el.textContent = shortCode;
                  el.style.backgroundColor = embassy.color;
                  
                  // Add marker to map with enhanced popup including intel status
                  agents[agentId].marker = new mapboxgl.Marker({
                      element: el,
                      anchor: "center",
                      pitchAlignment: "viewport",
                      rotationAlignment: "viewport"
                  })
                  .setLngLat(allLocations[embassy.id].coordinates)
                  .setPopup(new mapboxgl.Popup({ 
                      className: 'transparent-popup',
                      closeOnClick: false
                  })
                  .setHTML(`
                      <h3>${embassy.code} Agent ${shortCode}</h3>
                      <p>Status: <span id="popup-status-${agentId}">At ${embassy.name}</span></p>
                      <p id="popup-intel-${agentId}" style="color: #ffd700;"></p>
                      <div class="popup-actions">
                          <button id="intercept-${agentId}" class="send-mi6">Intercept & Collect Intel</button>
                          <button id="follow-${agentId}" class="follow-agent">Follow Agent</button>
                      </div>
                  `))
                  .addTo(map);
                  
                  // Make marker interactive with enhanced click handler
                  el.addEventListener('click', (e) => {
                      // Stop event propagation to prevent map click
                      e.stopPropagation();
                      e.preventDefault();
                      
                      // DEBUG: Log the click
                      console.log(`Clicked agent ${agentId}`);
                      
                      // Force close any existing popups first
                      if (activePopup && activePopup.isOpen()) {
                          activePopup.remove();
                          activePopup = null;
                      }
                      
                      // Get the popup and ensure it's properly set
                      const popup = agents[agentId].marker.getPopup();
                      
                      // Update the popup content BEFORE showing it
                      const currentLocation = allLocations[agents[agentId].location]?.name || agents[agentId].location;
                      const statusText = agents[agentId].status === "moving" 
                          ? `Moving to ${allLocations[agents[agentId].targetLandmark]?.name || agents[agentId].targetLandmark}`
                          : `At ${currentLocation}`;
                      
                      const intelText = agents[agentId].intelligence && agents[agentId].intelligence.hasIntel
                          ? `Intel: ${agents[agentId].intelligence.intelType} (${agents[agentId].intelligence.intelValue} points)`
                          : 'No intelligence detected';
                      
                      // Update the popup HTML with current data
                      popup.setHTML(`
                          <h3>${agents[agentId].agency.split(' ')[0]} Agent ${agents[agentId].shortCode}</h3>
                          <p>Status: <span id="popup-status-${agentId}">${statusText}</span></p>
                          <p id="popup-intel-${agentId}" style="color: #ffd700;">${intelText}</p>
                          <div class="popup-actions">
                              <button id="intercept-${agentId}" class="send-mi6">Intercept & Collect Intel</button>
                              <button id="follow-${agentId}" class="follow-agent">Follow Agent</button>
                          </div>
                      `);
                      
                      // Show the popup
                      agents[agentId].marker.togglePopup();
                      
                      // Mark this as the active popup
                      activePopup = popup;
                      
                      // Remove existing button listeners to prevent duplicates
                      const interceptBtn = document.getElementById(`intercept-${agentId}`);
                      const followBtn = document.getElementById(`follow-${agentId}`);
                      
                      // Add fresh event listeners
                      setTimeout(() => {
                          if (interceptBtn) {
                              interceptBtn.addEventListener('click', (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  
                                  // Send MI6 agent to intercept
                                  interceptRivalAgent(agentId);
                                  
                                  // Close popup
                                  agents[agentId].marker.togglePopup();
                              });
                          }
                          
                          if (followBtn) {
                              followBtn.addEventListener('click', (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  
                                  // Toggle following this agent
                                  toggleFollowRivalAgent(agentId);
                                  
                                  // Close popup
                                  agents[agentId].marker.togglePopup();
                              });
                          }
                      }, 100);
                  });
                  
                  // Add agent to monitor panel
                  const agentItem = document.createElement('div');
                  agentItem.className = 'rival-agent-item';
                  
                  const agentIdElement = document.createElement('div');
                  agentIdElement.className = 'rival-agent-id';
                  agentIdElement.textContent = `${shortCode}:`;
                  agentItem.appendChild(agentIdElement);
                  
                  const status = document.createElement('div');
                  status.className = 'rival-status rival-idle';
                  status.id = `rival-status-${agentId}`;
                  status.textContent = 'Idle at ' + embassy.name;
                  agentItem.appendChild(status);
                  
                  agencySection.appendChild(agentItem);
                  
                  // Schedule agent activity
                  setTimeout(() => {
                      activateRivalAgent(agentId);
                  }, 5000 + (Math.random() * 10000)); // Random delay between 5-15 seconds
              }
              
              // Add agency section to monitor panel
              agenciesContainer.appendChild(agencySection);
          });
          
          // Initialize popups after all agents are created
          setTimeout(() => {
              setupPopupUpdates();
          }, 2000);
      }
        // Complete agent movement (reached destination)
        function completeAgentMovement(agentId) {
            const agent = agents[agentId];
            
            // Fix: Add null check to avoid "Cannot read properties of null" error
            if (!agent.path || agent.path.length === 0) {
                console.error(`Invalid path for agent ${agentId}`);
                agent.animationInProgress = false;
                return;
            }
            
            const targetLocation = agent.path[agent.path.length - 1];
            
            // Update agent location
            agent.location = targetLocation;
            
            // Update UI
            if (agentId === "mi6") {
                document.getElementById("mi6-location").textContent = 
                    "Location: " + allLocations[targetLocation].name;
            }
            
            // Flash marker to indicate arrival
            const markerEl = agent.marker.getElement();
            markerEl.classList.add("agent-operating");
            
            // Show popup
            agent.marker.setPopup(
                new mapboxgl.Popup({ className: 'transparent-popup' })
                    .setText(`${agent.name} has arrived at ${allLocations[targetLocation].name}`)
            ).togglePopup();
            
            // For rival agents, begin operation
            if (agentId !== "mi6") {
                // Start rival agent operation
                beginRivalOperation(agentId);
            } else {
                // Remove animation after a delay
                setTimeout(() => {
                    markerEl.classList.remove("agent-operating");
                    
                    // Close popup
                    if (agent.marker.getPopup().isOpen()) {
                        agent.marker.togglePopup();
                    }
                    
                    // Turn off following if enabled
                    if (isFollowingAgent && activeAgentId === agentId) {
                        toggleAgentFollowing();
                    }
                }, 3000);
            }
        }

        // Begin operation for rival agent
        function beginRivalOperation(agentId) {
            const agent = agents[agentId];
            
            // Set status to operating
            agent.status = "operating";
            
            // Random duration between 20-60 seconds
            agent.operationDuration = 20000 + Math.random() * 40000;
            agent.operationTime = 0;
            
            // Add operating animation to marker
            const markerEl = agent.marker.getElement();
            markerEl.classList.add("agent-operating");
            
            // Update status display
            updateRivalAgentStatus(agentId);
            
            // Start the operation countdown
            let operationInterval = setInterval(() => {
                // Update operation time
                agent.operationTime += 1000;
                
                // Update status display
                updateRivalAgentStatus(agentId);
                
                // Check if operation is complete
                if (agent.operationTime >= agent.operationDuration) {
                    // Operation complete
                    clearInterval(operationInterval);
                    
                    // Remove animation
                    markerEl.classList.remove("agent-operating");
                    
                    // Set status to idle
                    agent.status = "idle";
                    
                    // Update status display
                    updateRivalAgentStatus(agentId);
                    
                    // Schedule next activity
                    setTimeout(() => {
                        activateRivalAgent(agentId);
                    }, 5000 + Math.random() * 15000); // Random delay between 5-20 seconds
                }
            }, 1000);
        }

        // Update rival agent status display
        function updateRivalAgentStatus(agentId) {
            const agent = agents[agentId];
            const statusElement = document.getElementById(`rival-status-${agentId}`);
            
            if (!statusElement) return;
            
            let statusText = "";
            let statusClass = "";
            
            switch (agent.status) {
                case "idle":
                    statusText = `Idle at ${allLocations[agent.location]?.name || agent.location}`;
                    statusClass = "rival-idle";
                    break;
                    
                case "moving":
                    statusText = `Moving to ${allLocations[agent.targetLandmark]?.name || agent.targetLandmark}`;
                    statusClass = "rival-moving";
                    break;
                    
                case "operating":
                    const timeRemaining = Math.ceil((agent.operationDuration - agent.operationTime) / 1000);
                    statusText = `Operating at ${allLocations[agent.location]?.name} (${timeRemaining}s)`;
                    statusClass = "rival-operating";
                    break;
            }
            
            statusElement.textContent = statusText;
            statusElement.className = `rival-status ${statusClass}`;
        }

        // Function to update agent popup with current intel status
        function updateAgentIntelPopup(agentId) {
            const agent = agents[agentId];
            if (!agent) return;
            
            // Update status text based on agent state
            const statusElement = document.getElementById(`popup-status-${agentId}`);
            if (statusElement) {
                let statusText = "";
                switch (agent.status) {
                    case "idle":
                        statusText = `At ${allLocations[agent.location]?.name || agent.location}`;
                        break;
                    case "moving":
                        statusText = `Moving to ${allLocations[agent.targetLandmark]?.name || agent.targetLandmark}`;
                        break;
                    case "operating":
                        statusText = `Operating at ${allLocations[agent.location]?.name || agent.location}`;
                        break;
                    default:
                        statusText = `At ${allLocations[agent.location]?.name || agent.location}`;
                }
                statusElement.textContent = statusText;
            }
            
            // Update intel status - REMOVE POINTS REFERENCE HERE
            const intelElement = document.getElementById(`popup-intel-${agentId}`);
            if (intelElement && agent.intelligence) {
                if (agent.intelligence.hasIntel) {
                    // Remove the (${agent.intelligence.intelValue} points) part
                    intelElement.textContent = `Intel: ${agent.intelligence.intelType}`;
                    intelElement.style.display = 'block';
                } else {
                    intelElement.textContent = 'No intelligence detected';
                    intelElement.style.display = 'block';
                }
            }
        }

        // Update popup every few seconds to show latest status
        function setupPopupUpdates() {
            setInterval(() => {
                for (const agentId in agents) {
                    if (agentId === "mi6") continue;
                    
                    const agent = agents[agentId];
                    if (agent && agent.marker && agent.marker.getPopup() && agent.marker.getPopup().isOpen()) {
                        updateAgentIntelPopup(agentId);
                    }
                }
            }, 1000);
        }


        // Activate a rival agent
        function activateRivalAgent(agentId) {
            const agent = agents[agentId];
            
            // Don't activate if agent is already busy
            if (agent.status !== "idle") return;
            
            // Select a random landmark as target
            const landmarks = Object.keys(allLocations).filter(id => 
                allLocations[id].type === "landmark" && id !== agent.location
            );
            
            const randomLandmark = landmarks[Math.floor(Math.random() * landmarks.length)];
            
            // Move agent to the landmark
            moveAgent(agentId, randomLandmark, true);
        }

        // Function to update popup status text
        function updateAgentPopupStatus() {
            // Run this every few seconds to update status texts in open popups
            setInterval(() => {
                for (const agentId in agents) {
                    if (agentId === "mi6") continue;
                    
                    const agent = agents[agentId];
                    const statusElement = document.getElementById(`popup-status-${agentId}`);
                    
                    if (statusElement) {
                        let statusText = "";
                        
                        switch (agent.status) {
                            case "idle":
                                statusText = `Idle at ${allLocations[agent.location]?.name || agent.location}`;
                                break;
                                
                            case "moving":
                                statusText = `Moving to ${allLocations[agent.targetLandmark]?.name || agent.targetLandmark}`;
                                break;
                                
                            case "operating":
                                const timeRemaining = Math.ceil((agent.operationDuration - agent.operationTime) / 1000);
                                statusText = `Operating at ${allLocations[agent.location]?.name} (${timeRemaining}s)`;
                                break;
                        }
                        
                        statusElement.textContent = statusText;
                    }
                }
            }, 1000);
        }

        // Complete replacement for the toggleAgentFollowing function
        function toggleAgentFollowing() {
            isFollowingAgent = !isFollowingAgent;
            
            // Update button display
            const followButton = document.getElementById("follow-button");
            
            if (isFollowingAgent) {
                // Set active agent to MI6
                activeAgentId = "mi6";
                
                // Update button styling
                followButton.textContent = "Stop Following";
                followButton.classList.add("active");
                
                // Show indicator
                const indicator = document.getElementById("follow-indicator");
                indicator.style.display = "flex";
                
                // Focus on MI6 agent immediately
                const agent = agents["mi6"];
                if (agent && agent.marker) {
                    const position = agent.marker.getLngLat();
                    
                    map.flyTo({
                        center: position,
                        zoom: 15,
                        pitch: 60,
                        bearing: -45,
                        duration: 1000
                    });
                }
                
                // Begin tracking after the initial flyTo completes
                setTimeout(() => {
                    // Clear any existing interval first
                    if (window.followInterval) {
                        clearInterval(window.followInterval);
                        window.followInterval = null;
                    }
                    
                    // Set up follow interval
                    window.followInterval = setInterval(() => {
                        if (!isFollowingAgent) {
                            clearInterval(window.followInterval);
                            window.followInterval = null;
                            return;
                        }
                        
                        // Skip if user is interacting with map
                        if (userInteractedWithMap) {
                            return;
                        }
                        
                        const agent = agents[activeAgentId];
                        if (!agent || !agent.marker) return;
                        
                        // Get agent position
                        const agentPosition = agent.marker.getLngLat();
                        
                        // Smoothly center on agent
                        map.easeTo({
                            center: agentPosition,
                            duration: 1000,
                            pitch: 60,
                            bearing: -45,
                        });
                    }, 500);
                }, 1500); // Wait for initial flyTo to complete
                
            } else {
                // Reset button
                followButton.textContent = "Follow Agent";
                followButton.classList.remove("active");
                
                // Hide indicator
                document.getElementById("follow-indicator").style.display = "none";
                
                // Clear interval
                if (window.followInterval) {
                    clearInterval(window.followInterval);
                    window.followInterval = null;
                }
            }
            
            showNotification(isFollowingAgent ? 
                "Following MI6 agent - map controls limited" : 
                "Follow mode disabled - normal map controls restored");
            
            return isFollowingAgent;
        }

        // Function to toggle following a rival agent
        function toggleFollowRivalAgent(agentId) {
            // If already following this agent, stop following
            if (isFollowingAgent && activeAgentId === agentId) {
                // Turn off following
                isFollowingAgent = false;
                activeAgentId = null;
                
                // Update button
                const followButton = document.getElementById("follow-button");
                if (followButton) {
                    followButton.textContent = "Follow Agent";
                    followButton.classList.remove("active");
                }
                
                // Hide indicator
                const indicator = document.getElementById("follow-indicator");
                if (indicator) {
                    indicator.style.display = "none";
                }
                
                // Clear interval
                if (window.followInterval) {
                    clearInterval(window.followInterval);
                    window.followInterval = null;
                }
                
                // Clear interception target
                if (agents.mi6) {
                    agents.mi6.interceptionTarget = null;
                }
                
                showNotification("Stopped following agent");
            } else {
                // Start following this agent
                isFollowingAgent = true;
                activeAgentId = agentId;
                
                // Update button
                const followButton = document.getElementById("follow-button");
                if (followButton) {
                    followButton.textContent = "Stop Following";
                    followButton.classList.add("active");
                }
                
                // Show indicator
                const indicator = document.getElementById("follow-indicator");
                if (indicator) {
                    indicator.textContent = `Following ${agents[agentId].name}`;
                    indicator.style.display = "flex";
                }
                
                // Start follow functionality
                followActiveAgent();
                
                showNotification(`Now following ${agents[agentId].name}`);
            }
        }

        // Function to follow active agent continuously
        function followActiveAgent() {
            // Clear any existing interval
            if (window.followInterval) {
                clearInterval(window.followInterval);
                window.followInterval = null;
            }
            
            // Focus on the agent immediately when following starts
            const initialAgent = agents[activeAgentId];
            if (initialAgent && initialAgent.marker) {
                // Get agent position
                const initialPosition = initialAgent.marker.getLngLat();
                
                // Immediately focus on agent
                map.flyTo({
                    center: initialPosition,
                    zoom: 15,
                    pitch: 60,
                    bearing: -45,
                    duration: 1000
                });
            }
            
            // Set up continuous following
            window.followInterval = setInterval(() => {
                if (!isFollowingAgent) {
                    clearInterval(window.followInterval);
                    window.followInterval = null;
                    return;
                }
                
                // Skip if user is interacting with map
                if (userInteractedWithMap) {
                    return;
                }
                
                const agent = agents[activeAgentId];
                if (!agent || !agent.marker) return;
                
                // Get agent position
                const agentPosition = agent.marker.getLngLat();
                
                // Smoothly center on agent
                map.easeTo({
                    center: agentPosition,
                    duration: 1000,
                    pitch: 60,
                    bearing: -45,
                });
            }, 500);
        }

        // Focus camera on agent
        function focusOnAgent(agent) {
            const position = agent.marker.getLngLat();
            
            map.flyTo({
                center: position,
                zoom: 15,
                pitch: 60,
                bearing: -45,
                duration: 1000
            });
        }

        // =============================================================================
        // PATHFINDING AND MOVEMENT
        // =============================================================================


        // --- Priority Queue Implementation ---
        class PriorityQueue {
            constructor() {
                this.elements = [];
            }

            enqueue(item, priority) {
                this.elements.push({ item, priority });
                this.elements.sort((a, b) => a.priority - b.priority);
            }

            dequeue() {
                return this.elements.shift()?.item;
            }

            isEmpty() {
                return this.elements.length === 0;
            }

            has(item) {
                return this.elements.some(element => element.item === item);
            }
        }

    
        function findPath(startLoc, endLoc) {
            // Validate inputs
            if (!startLoc || !endLoc || !allLocations[startLoc] || !allLocations[endLoc]) {
                console.error("Invalid locations in findPath:", startLoc, endLoc);
                return null;
            }
            
            console.log(`Finding path from ${startLoc} to ${endLoc}`);
            
            const startLocation = allLocations[startLoc];
            const endLocation = allLocations[endLoc];

            // Initialize data structures
            const openSet = new PriorityQueue();
            openSet.enqueue(startLoc, 0);

            const cameFrom = {};
            const gScore = {};
            const fScore = {};
            
            // Set initial scores
            gScore[startLoc] = 0;
            fScore[startLoc] = heuristic(startLocation.coordinates, endLocation.coordinates);

            // Main search loop
            while (!openSet.isEmpty()) {
                const current = openSet.dequeue();

                // Check if we've reached the destination
                if (current === endLoc) {
                    // Reconstruct path
                    const path = [current];
                    let currentNode = current;
                    
                    while (cameFrom[currentNode]) {
                        currentNode = cameFrom[currentNode];
                        path.unshift(currentNode);
                    }
                    
                    console.log(`Path found: ${path.join(' → ')}`);
                    return path;
                }

                // Ensure the current location has connections in the graph
                if (!locationGraph[current] || !Array.isArray(locationGraph[current])) {
                    console.error(`Invalid location graph for ${current}`);
                    continue;
                }

                // Explore neighbors
                for (const neighbor of locationGraph[current]) {
                    // Validate neighbor
                    if (!allLocations[neighbor] || !allLocations[neighbor].coordinates) {
                        console.error(`Invalid neighbor: ${neighbor}`);
                        continue;
                    }

                    // Calculate tentative gScore
                    const tentativeGScore = gScore[current] + 
                        calculateDistance(
                            allLocations[current].coordinates,
                            allLocations[neighbor].coordinates
                        );

                    // If this is a better path, record it
                    if (!(neighbor in gScore) || tentativeGScore < gScore[neighbor]) {
                        cameFrom[neighbor] = current;
                        gScore[neighbor] = tentativeGScore;
                        fScore[neighbor] = tentativeGScore + 
                            heuristic(allLocations[neighbor].coordinates, endLocation.coordinates);

                        if (!openSet.has(neighbor)) {
                            openSet.enqueue(neighbor, fScore[neighbor]);
                        }
                    }
                }
            }

            console.error(`No path found from ${startLoc} to ${endLoc}`);
            return null; // No path found
        }

        // Calculate heuristic (straight-line distance)
        function heuristic(coord1, coord2) {
            return calculateDistance(coord1, coord2);
        }

        // Calculate distance between two coordinates
        function calculateDistance(coord1, coord2) {
            // Validate coordinates
            if (!Array.isArray(coord1) || !Array.isArray(coord2) || 
                coord1.length < 2 || coord2.length < 2) {
                console.error("Invalid coordinates:", coord1, coord2);
                return 999999; // Return large number as fallback
            }
            
            try {
                const from = turf.point(coord1);
                const to = turf.point(coord2);
                return turf.distance(from, to, { units: "kilometers" }) * 1000;
            } catch (error) {
                console.error("Error calculating distance:", error);
                // Fallback to manual calculation (Haversine formula)
                const [lon1, lat1] = coord1;
                const [lon2, lat2] = coord2;
                
                const R = 6371e3; // Earth radius in meters
                const φ1 = lat1 * Math.PI / 180;
                const φ2 = lat2 * Math.PI / 180;
                const Δφ = (lat2 - lat1) * Math.PI / 180;
                const Δλ = (lon2 - lon1) * Math.PI / 180;

                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ/2) * Math.sin(Δλ/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c; // Distance in meters
            }
        }

        // --- Fixed Move Agent Function ---
        async function moveAgent(agentId, targetLocation, isRival = false) {
            console.log(`Moving agent ${agentId} to ${targetLocation}`);

            const agent = agents[agentId];
            
            // Validate agent and target
            if (!agent) {
                console.error(`Invalid agent: ${agentId}`);
                return;
            }
            
            if (!allLocations[targetLocation]) {
                console.error(`Invalid target location: ${targetLocation}`);
                return;
            }
            
            const startLocation = agent.location;

            // Check if agent is already moving
            if (agent.animationInProgress) {
                console.log(`${agentId} is already moving`);
                showNotification(`${agent.name} is already on the move!`);
                return;
            }

            // Close any open popups
            if (agent.marker && agent.marker.getPopup && agent.marker.getPopup().isOpen()) {
                agent.marker.togglePopup();
            }

            // Find path
            const path = findPath(startLocation, targetLocation);

            if (!path || path.length < 2) {
                console.error(`No valid path for ${agentId} from ${startLocation} to ${targetLocation}`);
                showNotification(`No valid path for ${agent.name} to ${allLocations[targetLocation]?.name || targetLocation}`);
                return;
            }

            console.log(`Found path for ${agentId}: ${path.join(" → ")}`);

            // Initialize movement
            agent.path = path;
            agent.routeCoordinates = [];
            agent.currentRouteIndex = 0;
            agent.animationInProgress = true;

            // Update UI and agent status
            if (isRival) {
                agent.status = "moving";
                agent.targetLandmark = targetLocation;
                updateRivalAgentStatus(agentId);
            }

            if (agentId === "mi6") {
                document.getElementById("mi6-location").textContent = "Calculating route...";
                document.getElementById("mi6-target").textContent = "Target: " + (allLocations[targetLocation]?.name || targetLocation);
                
                // Show abort button
                const abortButton = document.getElementById("mi6-abort");
                if (abortButton) {
                    abortButton.style.display = "inline-block";
                }
            }

            try {
                // Generate detailed route coordinates
                await generateRouteForPath(agentId, path);

                if (!agent.routeCoordinates || agent.routeCoordinates.length < 2) {
                    throw new Error("Generated route is invalid or too short");
                }

                console.log(`Generated ${agent.routeCoordinates.length} points for ${agentId}'s route`);

                // Clear any existing path display
                if (agent.pathDisplay && agent.pathDisplay.length) {
                    for (const id of agent.pathDisplay) {
                        if (map.getLayer(id)) map.removeLayer(id);
                        const sourceId = id === `${agentId}-path-line` ? `${agentId}-path` : id;
                        if (map.getSource(sourceId)) map.removeSource(sourceId);
                    }
                    agent.pathDisplay = [];
                }

                // Display path on map for MI6 agent
                if (!isRival) {
                    const sourceId = `${agentId}-path`;
                    if (map.getSource(sourceId)) {
                        if (map.getLayer(`${agentId}-path-line`)) map.removeLayer(`${agentId}-path-line`);
                        map.removeSource(sourceId);
                    }

                    // Add path to map
                    map.addSource(sourceId, {
                        type: "geojson",
                        data: {
                            type: "Feature",
                            properties: {},
                            geometry: {
                                type: "LineString",
                                coordinates: agent.routeCoordinates,
                            },
                        },
                    });

                    map.addLayer({
                        id: `${agentId}-path-line`,
                        type: "line",
                        source: sourceId,
                        layout: {
                            "line-join": "round",
                            "line-cap": "round",
                        },
                        paint: {
                            "line-color": agent.color || "#0078D7",
                            "line-width": 3,
                            "line-opacity": 0.7,
                            "line-dasharray": [1, 2],
                        },
                    });

                    agent.pathDisplay.push(`${agentId}-path-line`);

                    // Update path display in UI
                    const pathText = path.map(locId => allLocations[locId]?.name || locId).join(" → ");
                    document.getElementById("mi6-path").textContent = "Path: " + pathText;
                }

                // Start the movement animation
                startAgentMovement(agentId);

                // Follow the agent if that option is enabled
                if (isFollowingAgent && activeAgentId === agentId) {
                    focusOnAgent(agent);
                }

            } catch (error) {
                console.error(`Error moving ${agent.name}:`, error);
                showNotification(`Error moving ${agent.name}: ${error.message}`);
                agent.animationInProgress = false;
            }
        }

        // Generate detailed route coordinates
        async function generateRouteForPath(agentId, path) {
            const agent = agents[agentId];
            
            if (!agent) {
                console.error(`Invalid agent: ${agentId}`);
                return [];
            }
            
            // Reset route coordinates
            agent.routeCoordinates = [];
            
            // Generate route for each segment of the path
            for (let i = 0; i < path.length - 1; i++) {
                // Validate path segment
                if (!allLocations[path[i]] || !allLocations[path[i+1]]) {
                    console.error(`Invalid path segment: ${path[i]} to ${path[i+1]}`);
                    continue;
                }
                
                const startLoc = allLocations[path[i]];
                const endLoc = allLocations[path[i + 1]];
                
                // Make sure both locations have coordinates
                if (!startLoc.coordinates || !endLoc.coordinates) {
                    console.error("Missing coordinates for locations:", path[i], path[i+1]);
                    continue;
                }
                
                try {
                    // Generate route points between these locations
                    const routeSegment = await generateRoutePoints(
                        startLoc.coordinates,
                        endLoc.coordinates,
                        startLoc.type,
                        endLoc.type
                    );
                    
                    if (!routeSegment || routeSegment.length < 2) {
                        console.warn(`Failed to generate route segment from ${startLoc.name} to ${endLoc.name}`);
                        // Fallback to direct line
                        routeSegment = [startLoc.coordinates, endLoc.coordinates];
                    }
                    
                    // Add segment to route (avoid duplicating points)
                    if (i === 0) {
                        agent.routeCoordinates.push(...routeSegment);
                    } else {
                        agent.routeCoordinates.push(...routeSegment.slice(1));
                    }
                } catch (error) {
                    console.error(`Error generating route segment from ${startLoc.name} to ${endLoc.name}:`, error);
                    
                    // Fallback: add direct line
                    if (i === 0) {
                        agent.routeCoordinates.push(startLoc.coordinates, endLoc.coordinates);
                    } else {
                        agent.routeCoordinates.push(endLoc.coordinates);
                    }
                }
            }
            
            return agent.routeCoordinates;
        }

        // Generate route points between two locations
        async function generateRoutePoints(startCoords, endCoords, locType1, locType2) {
            // Validate inputs
            if (!Array.isArray(startCoords) || !Array.isArray(endCoords) || 
                startCoords.length < 2 || endCoords.length < 2) {
                console.error("Invalid coordinates for route generation");
                return [startCoords, endCoords];
            }
            
            // Special case for very short distances
            const distance = calculateDistance(startCoords, endCoords);
            if (distance < 100) { // Less than 100 meters
                return [startCoords, endCoords];
            }
            
            // Special case for metro-to-metro (use curved underground path)
            if (locType1 === "metro" && locType2 === "metro") {
                return generateUndergroundPath(startCoords, endCoords);
            }
            
            // Special case for pier-to-pier (follow river)
            if (locType1 === "pier" && locType2 === "pier") {
                return generateRiverRoute(startCoords, endCoords);
            }
            
            // Try to use Mapbox Directions API for realistic routes
            try {
                const profile = "walking"; // Use walking for all agents
                const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
                    `${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}` +
                    `?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.routes && data.routes[0] && data.routes[0].geometry) {
                    return data.routes[0].geometry.coordinates;
                }
            } catch (error) {
                console.warn("Could not fetch route from Mapbox API:", error);
            }
            
            // Fallback to a grid-based route
            return createFallbackRoute(startCoords, endCoords);
        }

        // Generate underground path for metro stations
        function generateUndergroundPath(startCoords, endCoords) {
            try {
                // Create a curved line using bezier curve
                const points = [];
                const numPoints = 12;
                
                // Calculate control point for curve (perpendicular to direct line)
                const dx = endCoords[0] - startCoords[0];
                const dy = endCoords[1] - startCoords[1];
                const midX = (startCoords[0] + endCoords[0]) / 2;
                const midY = (startCoords[1] + endCoords[1]) / 2;
                
                // Create perpendicular vector for control point
                const perpX = -dy * 0.25; // Adjust this value for curve intensity
                const perpY = dx * 0.25;
                
                const controlPoint = [midX + perpX, midY + perpY];
                
                // Generate points along the curve
                for (let i = 0; i < numPoints; i++) {
                    const t = i / (numPoints - 1);
                    
                    // Quadratic Bezier formula
                    const x = (1-t)*(1-t)*startCoords[0] + 2*(1-t)*t*controlPoint[0] + t*t*endCoords[0];
                    const y = (1-t)*(1-t)*startCoords[1] + 2*(1-t)*t*controlPoint[1] + t*t*endCoords[1];
                    
                    points.push([x, y]);
                }
                
                return points;
            } catch (error) {
                console.error("Error generating underground path:", error);
                return [startCoords, endCoords]; // Fallback to direct line
            }
        }

        // Generate river route for piers
        function generateRiverRoute(startCoords, endCoords) {
            try {
                // Thames river waypoints from west to east
                const riverWaypoints = [
                    [-0.12709, 51.48636], // St. George Wharf
                    [-0.12472, 51.49172], // Millbank
                    [-0.12312, 51.50175], // Westminster
                    [-0.12057, 51.50312], // London Eye
                    [-0.12089, 51.50757], // Embankment
                    [-0.11434, 51.50948], // Waterloo Bridge
                    [-0.10432, 51.50972], // Blackfriars
                    [-0.09853, 51.50959], // Millennium Bridge
                    [-0.09401, 51.50901], // Southwark Bridge
                    [-0.08642, 51.50798], // London Bridge
                    [-0.07536, 51.50558], // Tower Bridge
                    [-0.02893, 51.5054]   // Canary Wharf
                ];
                
                // Find closest waypoints to start and end
                let startIndex = 0;
                let endIndex = 0;
                let minStartDist = Infinity;
                let minEndDist = Infinity;
                
                for (let i = 0; i < riverWaypoints.length; i++) {
                    const waypoint = riverWaypoints[i];
                    
                    const startDist = calculateDistance(startCoords, waypoint);
                    if (startDist < minStartDist) {
                        minStartDist = startDist;
                        startIndex = i;
                    }
                    
                    const endDist = calculateDistance(endCoords, waypoint);
                    if (endDist < minEndDist) {
                        minEndDist = endDist;
                        endIndex = i;
                    }
                }
                
                // Build route along waypoints
                const route = [startCoords]; // Start with exact start coordinates
                
                if (startIndex <= endIndex) {
                    // Moving downstream (west to east)
                    for (let i = startIndex + 1; i <= endIndex; i++) {
                        route.push(riverWaypoints[i]);
                    }
                } else {
                    // Moving upstream (east to west)
                    for (let i = startIndex - 1; i >= endIndex; i--) {
                        route.push(riverWaypoints[i]);
                    }
                }
                
                route.push(endCoords); // End with exact end coordinates
                return route;
            } catch (error) {
                console.error("Error generating river route:", error);
                return [startCoords, endCoords]; // Fallback to direct line
            }
        }

        // Fallback route creation
        function createFallbackRoute(startCoords, endCoords) {
            const [startLng, startLat] = startCoords;
            const [endLng, endLat] = endCoords;
            
            const dx = endLng - startLng;
            const dy = endLat - startLat;
            
            // Determine if route is more east-west or north-south
            const isEastWest = Math.abs(dx) > Math.abs(dy);
            
            const route = [startCoords];
            
            if (isEastWest) {
                // Go east/west first, then north/south
                route.push([endLng, startLat]);
            } else {
                // Go north/south first, then east/west
                route.push([startLng, endLat]);
            }
            
            route.push(endCoords);
            return route;
        }

        // Start agent movement animation
        function startAgentMovement(agentId) {
            const agent = agents[agentId];
            
            if (!agent) {
                console.error(`Invalid agent in startAgentMovement: ${agentId}`);
                return;
            }
            
            // Check if agent has reached destination
            if (agent.currentRouteIndex >= agent.routeCoordinates.length - 1) {
                completeAgentMovement(agentId);
                return;
            }
            
            // Don't proceed if animation is already in progress
            if (!agent.animationInProgress) {
                console.log(`Animation not in progress for ${agentId}, skipping movement`);
                return;
            }
            
            // Safety check: ensure routeCoordinates exists and has sufficient points
            if (!agent.routeCoordinates || agent.routeCoordinates.length < 2) {
                console.error(`Invalid route for ${agentId}:`, agent.routeCoordinates);
                showNotification(`Error: Could not move ${agent.name} - invalid route`);
                agent.animationInProgress = false;
                return;
            }
            
            // Make sure the current index is valid
            if (agent.currentRouteIndex >= agent.routeCoordinates.length - 1) {
                completeAgentMovement(agentId);
                return;
            }
            
            // Get current and next points on route
            const currentPoint = agent.routeCoordinates[agent.currentRouteIndex];
            const nextPoint = agent.routeCoordinates[agent.currentRouteIndex + 1];
            
            // Safety check for valid points
            if (!currentPoint || !nextPoint || !Array.isArray(currentPoint) || !Array.isArray(nextPoint)) {
                console.error(`Invalid route points for ${agentId} at index ${agent.currentRouteIndex}`);
                agent.animationInProgress = false;
                return;
            }
            
            // Start animation
            animateAgentMovement(agentId, currentPoint, nextPoint);
        }

        // Animate agent between two points
        function animateAgentMovement(agentId, startPoint, endPoint) {
            const agent = agents[agentId];
            
            if (!agent || !agent.marker) {
                console.error(`Invalid agent or marker in animateAgentMovement: ${agentId}`);
                return;
            }
            
            // Mark animation in progress
            agent.animationInProgress = true;
            
            // Calculate distance for duration
            const distance = calculateDistance(startPoint, endPoint);
            
            // Base duration - significantly increased for slower movement
            let duration = Math.min(4000, 2500 + distance / 3);
            
            // Adjust speed based on transportation type
            const currentLoc = agent.path[Math.floor(agent.currentRouteIndex / (agent.routeCoordinates.length / agent.path.length))];
            const nextLoc = agent.path[Math.ceil((agent.currentRouteIndex + 1) / (agent.routeCoordinates.length / agent.path.length))];
            
            const currentLocType = allLocations[currentLoc]?.type;
            const nextLocType = allLocations[nextLoc]?.type;
            
            // Different transportation types have different speeds
            let transportType = "Walking";
            
            if (currentLocType === "metro" && nextLocType === "metro") {
                transportType = "Metro";
                duration *= 0.6; // Metro is faster
            } else if (currentLocType === "pier" && nextLocType === "pier") {
                transportType = "River Ferry";
                duration *= 1.2; // River ferry is slower
            }
            
            // Update UI for MI6 agent
            if (agentId === "mi6") {
                // Calculate progress percentage
                const progress = Math.floor((agent.currentRouteIndex / (agent.routeCoordinates.length - 1)) * 100);
                const currentLocName = allLocations[currentLoc]?.name || "Unknown";
                const nextLocName = allLocations[nextLoc]?.name || "Unknown";
                
                // Update location text with transportation mode
                document.getElementById("mi6-location").textContent = 
                    `${transportType}: ${currentLocName} → ${nextLocName} (${progress}%)`;
                
                // Also update path text
                const pathText = agent.path.map(locId => allLocations[locId]?.name || locId).join(" → ");
                document.getElementById("mi6-path").textContent = "Path: " + pathText;
            }
            
            // Animation variables
            const startTime = performance.now();
            
            // Animation function
            function animate(currentTime) {
                // If animation was cancelled, stop immediately
                if (!agent.animationInProgress) {
                    return;
                }
                
                // Calculate progress
                const elapsed = currentTime - startTime;
                let progress = Math.min(elapsed / duration, 1);
                
                // Apply easing for smoother movement
                progress = progress < 0.5 ? 
                    2 * progress * progress : 
                    -1 + (4 - 2 * progress) * progress;
                
                // Interpolate position
                const lng = startPoint[0] + (endPoint[0] - startPoint[0]) * progress;
                const lat = startPoint[1] + (endPoint[1] - startPoint[1]) * progress;
                
                // Update marker position
                agent.marker.setLngLat([lng, lat]);
                
                // Continue animation if not complete
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation segment complete
                    agent.currentRouteIndex++;
                    
                    // Set animationInProgress to false temporarily to avoid race conditions
                    agent.animationInProgress = false;
                    
                    // Continue to next segment
                    setTimeout(() => {
                        // Set back to true before starting next segment
                        agent.animationInProgress = true;
                        startAgentMovement(agentId);
                    }, 10);
                }
            }
            
            // Start animation
            requestAnimationFrame(animate);
        }

        // Complete agent movement (reached destination)
        function completeAgentMovement(agentId) {
            const agent = agents[agentId];
            
            if (!agent) {
                console.error(`Invalid agent in completeAgentMovement: ${agentId}`);
                return;
            }
            
            // Fix: Add null check to avoid "Cannot read properties of null" error
            if (!agent.path || agent.path.length === 0) {
                console.error(`Invalid path for agent ${agentId}`);
                agent.animationInProgress = false;
                return;
            }
            
            const targetLocation = agent.path[agent.path.length - 1];
            
            // Update agent location
            agent.location = targetLocation;
            agent.animationInProgress = false;
            
            // Update UI
            if (agentId === "mi6") {
                document.getElementById("mi6-location").textContent = 
                    "Location: " + (allLocations[targetLocation]?.name || targetLocation);
                
                // Hide abort button
                const abortButton = document.getElementById("mi6-abort");
                if (abortButton) {
                    abortButton.style.display = "none";
                }
            }
            
            // Flash marker to indicate arrival
            const markerEl = agent.marker.getElement();
            markerEl.classList.add("agent-operating");
            
            // Show popup
            agent.marker.setPopup(
                new mapboxgl.Popup({ className: 'transparent-popup' })
                    .setText(`${agent.name} has arrived at ${allLocations[targetLocation]?.name || targetLocation}`)
            ).togglePopup();
            
            // For rival agents, begin operation
            if (agentId !== "mi6") {
                // Start rival agent operation
                beginRivalOperation(agentId);
            } else {
                // MI6 agent: check if intercepting a rival
                if (agent.interceptionTarget) {
                    checkInterception(agent.interceptionTarget);
                }
                
                // Remove animation after a delay
                setTimeout(() => {
                    markerEl.classList.remove("agent-operating");
                    
                    // Close popup
                    if (agent.marker.getPopup().isOpen()) {
                        agent.marker.togglePopup();
                    }
                    
                    // Turn off following if enabled
                    if (isFollowingAgent && activeAgentId === agentId) {
                        toggleAgentFollowing();
                    }
                }, 3000);
            }
        }

        // Check if MI6 agent has intercepted a rival agent
        function checkInterception(targetAgentId) {
            const targetAgent = agents[targetAgentId];
            
            if (!targetAgent) {
                console.error(`Target agent not found: ${targetAgentId}`);
                return;
            }
            
            // Calculate distance between MI6 and target agent
            const mi6Position = agents.mi6.marker.getLngLat();
            const targetPosition = targetAgent.marker.getLngLat();
            
            const distance = calculateDistance(
                [mi6Position.lng, mi6Position.lat],
                [targetPosition.lng, targetPosition.lat]
            );
            
            // If MI6 is close enough to the target (within 50 meters)
            if (distance <= 50) {
                // Intercept successful
                showInterceptionDialog(targetAgentId);
            } else {
                // Not close enough yet
                showNotification(`MI6 agent needs to get closer to ${targetAgent.name} (${Math.round(distance)}m away)`);
                
                // Try again with updated position
                interceptRivalAgent(targetAgentId);
            }
        }

     
               // =============================================================================
               // INITIALIZATION FIXES
               // =============================================================================

               // Fix map initialization to ensure all components load properly
               function fixMapInitialization() {
                   // Ensure map is ready before initializing components
                   if (!map || !map.loaded()) {
                       console.log("Map not loaded yet, waiting...");
                       
                       // If map exists but not loaded, set up load event
                       if (map) {
                           map.on('load', () => {
                               console.log("Map loaded event fired, initializing game components");
                               initializeGameComponents();
                           });
                       } else {
                           // If map doesn't exist yet, retry after a delay
                           setTimeout(fixMapInitialization, 500);
                       }
                       return;
                   }
                   
                   // Map is loaded, proceed with initialization
                   initializeGameComponents();
               }

               // Initialize all game components
               function initializeGameComponents() {
                   console.log("Initializing all game components");
                   
                   // Set up in proper sequence to avoid dependency issues
                   initializeLocations();
                   
                   // Verify location connectivity
                   setTimeout(() => {
                       const unreachableLocations = checkLocationConnectivity();
                       if (unreachableLocations && unreachableLocations.length > 0) {
                           console.warn(`Found ${unreachableLocations.length} unreachable locations, fixing...`);
                           fixDisconnectedLocations(unreachableLocations);
                       } else {
                           console.log("All locations are properly connected!");
                       }
                   }, 1000);
                   
                   // Create agents after locations are established
                   setTimeout(() => {
                       createAgentMarkers();
                       
                       // Set up rival agents after MI6 agent is created
                       setupRivalAgents();
                       
                       // Add all UI controls and listeners
                       setupControls();
                       setupEventListeners();
                       setupAbortMissionFeature();
                       enhanceRivalAgents();
                       
                       console.log("Game components initialized successfully");
                       showNotification("Game initialized successfully. Ready to begin operations.");
                   }, 2000);
               }

               // Fix any disconnected locations by connecting them to the main network
               function fixDisconnectedLocations(unreachableLocations) {
                   console.log("Fixing disconnected locations...");
                   
                   // For each unreachable location, connect it to the nearest reachable location
                   unreachableLocations.forEach(location => {
                       const locId = location.id;
                       const allReachableIds = Object.keys(allLocations).filter(id => {
                           // Skip if this is the location we're trying to fix
                           if (id === locId) return false;
                           
                           // Check if there's a path from MI6 HQ to this location
                           const path = findPath("mi6hq", id);
                           return path !== null;
                       });
                       
                       if (allReachableIds.length === 0) {
                           // Emergency fix: connect directly to MI6 HQ
                           console.log(`Connecting ${locId} directly to MI6 HQ as fallback`);
                           connectLocations(locId, "mi6hq");
                       } else {
                           // Find nearest reachable location
                           let nearestId = allReachableIds[0];
                           let minDistance = Infinity;
                           
                           allReachableIds.forEach(id => {
                               const distance = calculateDistance(
                                   allLocations[locId].coordinates,
                                   allLocations[id].coordinates
                               );
                               
                               if (distance < minDistance) {
                                   minDistance = distance;
                                   nearestId = id;
                               }
                           });
                           
                           // Connect to nearest reachable location
                           console.log(`Connecting ${locId} to ${nearestId} (${allLocations[nearestId].name})`);
                           connectLocations(locId, nearestId);
                       }
                   });
                   
                   // Verify the fix worked
                   setTimeout(() => {
                       const stillUnreachable = checkLocationConnectivity();
                       if (stillUnreachable && stillUnreachable.length > 0) {
                           console.error(`${stillUnreachable.length} locations still unreachable after fix!`);
                           
                           // Last resort: connect all directly to MI6 HQ
                           stillUnreachable.forEach(location => {
                               console.log(`EMERGENCY FIX: Directly connecting ${location.id} to MI6 HQ`);
                               connectLocations(location.id, "mi6hq");
                           });
                       } else {
                           console.log("All locations are now connected!");
                       }
                   }, 500);
               }

               // Fix rival agent initialization to ensure movement works
               function fixRivalAgentSystem() {
                   // Fix the activate rival agent function
                   const originalActivateRivalAgent = activateRivalAgent;
                   
                   activateRivalAgent = function(agentId) {
                       console.log(`Activating rival agent: ${agentId}`);
                       
                       const agent = agents[agentId];
                       
                       // Don't activate if agent is already busy
                       if (agent.status !== "idle") {
                           console.log(`Agent ${agentId} is not idle (${agent.status}), skipping activation`);
                           return;
                       }
                       
                       // Select a random landmark as target
                       let randomLandmark;
                       
                       // First try pattern-based targeting
                       if (agent.getNextTarget && typeof agent.getNextTarget === 'function') {
                           try {
                               randomLandmark = agent.getNextTarget();
                               console.log(`Using pattern-based target for ${agentId}: ${randomLandmark}`);
                           } catch (error) {
                               console.error(`Error using pattern-based targeting for ${agentId}:`, error);
                               randomLandmark = null;
                           }
                       }
                       
                       // Fall back to random selection if pattern-based targeting failed
                       if (!randomLandmark) {
                           // Get all landmarks except current location
                           const landmarks = Object.keys(allLocations).filter(id => 
                               allLocations[id].type === "landmark" && id !== agent.location
                           );
                           
                           // If no landmarks found, expand to include other location types
                           if (landmarks.length === 0) {
                               console.warn(`No landmarks found for ${agentId}, using any location`);
                               const anyLocation = Object.keys(allLocations).filter(id => id !== agent.location);
                               
                               if (anyLocation.length === 0) {
                                   console.error(`No valid locations found for ${agentId}`);
                                   return;
                               }
                               
                               randomLandmark = anyLocation[Math.floor(Math.random() * anyLocation.length)];
                           } else {
                               randomLandmark = landmarks[Math.floor(Math.random() * landmarks.length)];
                           }
                           
                           console.log(`Using random landmark for ${agentId}: ${randomLandmark}`);
                       }
                       
                       // Verify path exists before moving
                       const path = findPath(agent.location, randomLandmark);
                       if (!path) {
                           console.error(`No path found for ${agentId} from ${agent.location} to ${randomLandmark}`);
                           
                           // Create emergency connection
                           console.log(`Creating emergency connection for ${agentId}`);
                           connectLocations(agent.location, randomLandmark);
                       }
                       
                       // Move agent to the landmark
                       moveAgent(agentId, randomLandmark, true);
                   };
                   
                   // Fix rival operation system
                   const originalBeginRivalOperation = beginRivalOperation;
                   
                   beginRivalOperation = function(agentId) {
                       console.log(`Beginning operation for rival agent: ${agentId}`);
                       
                       const agent = agents[agentId];
                       
                       // Set status to operating
                       agent.status = "operating";
                       
                       // Random duration between 20-60 seconds
                       agent.operationDuration = 20000 + Math.random() * 40000;
                       agent.operationTime = 0;
                       
                       // Add operating animation to marker
                       const markerEl = agent.marker.getElement();
                       markerEl.classList.add("agent-operating");
                       
                       // Update status display
                       updateRivalAgentStatus(agentId);
                       
                       // Start the operation countdown
                       let operationInterval = setInterval(() => {
                           // Update operation time
                           agent.operationTime += 1000;
                           
                           // Update status display
                           updateRivalAgentStatus(agentId);
                           
                           // Check if operation is complete
                           if (agent.operationTime >= agent.operationDuration) {
                               // Operation complete
                               clearInterval(operationInterval);
                               
                               // Remove animation
                               markerEl.classList.remove("agent-operating");
                               
                               // Set status to idle
                               agent.status = "idle";
                               
                               // Update status display
                               updateRivalAgentStatus(agentId);
                               
                               // Schedule next activity
                               setTimeout(() => {
                                   activateRivalAgent(agentId);
                               }, 5000 + Math.random() * 15000); // Random delay between 5-20 seconds
                           }
                       }, 1000);
                       
                       // Store interval ID to clear it if needed
                       agent.operationInterval = operationInterval;
                   };
               }

               // Call this to start the initialization fix
               function startFixedInitialization() {
                   console.log("Starting fixed initialization process...");
                   
                   // Apply patched functions
                   // (This assumes the fixed movement code from previous artifact has been applied)
                   fixRivalAgentSystem();
                   
                   // Start initialization process
                   fixMapInitialization();
               }

               // Call this on page load
               window.addEventListener('DOMContentLoaded', () => {
                   console.log("DOM content loaded, checking for map...");
                   setTimeout(startFixedInitialization, 500);
                   
                   // Also fix search UI
                   setTimeout(applySearchUIFixes, 1000);
               });

               // Ensure compatibility with existing code
               if (document.readyState === "complete" || document.readyState === "interactive") {
                   console.log("Document already loaded, starting initialization immediately");
                   setTimeout(startFixedInitialization, 500);
               }
               
               // =============================================================================
               // AGENT INTERCEPTION SYSTEM FIXES
               // =============================================================================

               // Fixed function to intercept rival agents
               function interceptRivalAgent(agentId) {
                   console.log(`Attempting to intercept rival agent: ${agentId}`);
                   
                   const rival = agents[agentId];
                   
                   if (!rival || !rival.marker) {
                       console.error(`Invalid rival agent: ${agentId}`);
                       showNotification("Error: Agent not found");
                       return;
                   }
                   
                   // Get current POSITION of rival agent (the marker's actual position)
                   const rivalPosition = rival.marker.getLngLat();
                   
                   if (!rivalPosition) {
                       console.error(`Cannot determine position of rival agent: ${agentId}`);
                       showNotification(`Error: Cannot determine position of ${rival.name}`);
                       return;
                   }
                   
                   // Create a more unique ID to avoid collisions
                   const tempLocationId = `temp-intercept-${agentId}-${Date.now()}`;
                   
                   // Save the rival's exact coordinates
                   const rivalCoordinates = [rivalPosition.lng, rivalPosition.lat];
                   
                   // Show notification
                   showNotification(`Sending MI6 agent to intercept ${rival.name}`);
                   
                   // Create a direct temporary location at the rival's position
                   allLocations[tempLocationId] = {
                       id: tempLocationId,
                       name: `${rival.name}'s position`,
                       coordinates: rivalCoordinates,
                       type: "poi",
                       temporary: true // Mark as temporary so we can clean it up later
                   };
                   
                   // Initialize connections for the new location
                   locationGraph[tempLocationId] = [];
                   
                   // Connect to nearby locations to ensure reachability
                   // Find all locations within 500m
                   const nearbyLocations = [];
                   
                   for (const locId in allLocations) {
                       if (locId === tempLocationId || locId.startsWith('temp-')) continue;
                       
                       const loc = allLocations[locId];
                       const distance = calculateDistance(rivalCoordinates, loc.coordinates);
                       
                       if (distance < 500) { // Connect to locations within 500m
                           nearbyLocations.push({id: locId, distance: distance});
                       }
                   }
                   
                   // Sort by distance
                   nearbyLocations.sort((a, b) => a.distance - b.distance);
                   
                   // Connect to the closest locations (at least 3)
                   const connectCount = Math.min(3, nearbyLocations.length);
                   for (let i = 0; i < connectCount; i++) {
                       connectLocations(tempLocationId, nearbyLocations[i].id);
                       console.log(`Connected ${tempLocationId} to ${nearbyLocations[i].id} (${allLocations[nearbyLocations[i].id].name})`);
                   }
                   
                   // IMPORTANT: Also directly connect to MI6's current location to ensure a path exists
                   connectLocations(tempLocationId, agents.mi6.location);
                   console.log(`Connected ${tempLocationId} to MI6's location: ${agents.mi6.location}`);
                   
                   // Debug: verify path exists
                   const pathCheck = findPath(agents.mi6.location, tempLocationId);
                   if (!pathCheck) {
                       console.error(`Failed to create path to interception point`);
                       // Emergency fix - connect to ALL nearby locations
                       for (let i = 0; i < nearbyLocations.length; i++) {
                           connectLocations(tempLocationId, nearbyLocations[i].id);
                       }
                   } else {
                       console.log(`Path verification successful: ${pathCheck.join(' → ')}`);
                   }
                   
                   // Store the target agent ID for interception check
                   agents.mi6.interceptionTarget = agentId;
                   console.log(`Set interception target: ${agentId}`);
                   
                   // Display visual indicator of interception target (optional)
                   const rivalEl = rival.marker.getElement();
                   rivalEl.style.boxShadow = '0 0 10px 5px rgba(255, 0, 0, 0.7)';
                   
                   // Move MI6 to the temporary location
                   moveAgent("mi6", tempLocationId);
                   
                   // Enable automatic following of rival agent
                   activeAgentId = agentId;
                   isFollowingAgent = true;
                   
                   // Update follow button display
                   const followButton = document.getElementById("follow-button");
                   if (followButton) {
                       followButton.textContent = "Stop Following";
                       followButton.classList.add("active");
                   }
                   
                   // Show follow indicator with rival agent info
                   const indicator = document.getElementById("follow-indicator");
                   if (indicator) {
                       indicator.textContent = `Following ${rival.name}`;
                       indicator.style.display = "flex";
                   }
                   
                   // Start follow functionality to keep camera on rival agent
                   followActiveAgent();
                   
                   // Clean up temporary location after some time
                   setTimeout(() => {
                       cleanupTemporaryLocation(tempLocationId);
                   }, 10 * 60 * 1000); // 10 minutes
               }

               // Function to clean up temporary locations
               function cleanupTemporaryLocation(locationId) {
                   if (allLocations[locationId] && allLocations[locationId].temporary) {
                       // Check if MI6 agent is still using this location
                       if (agents.mi6.location === locationId || 
                           (agents.mi6.path && agents.mi6.path.includes(locationId))) {
                           // Location still in use, try again later
                           setTimeout(() => cleanupTemporaryLocation(locationId), 60000);
                           return;
                       }
                       
                       console.log(`Cleaning up temporary location: ${locationId}`);
                       
                       // Remove from location graph
                       for (const locId in locationGraph) {
                           if (locationGraph[locId].includes(locationId)) {
                               locationGraph[locId] = locationGraph[locId].filter(id => id !== locationId);
                           }
                       }
                       
                       // Delete the location entry
                       delete locationGraph[locationId];
                       delete allLocations[locationId];
                   }
               }

               // Updated interception dialog
               function showInterceptionDialog(targetAgentId) {
                   const targetAgent = agents[targetAgentId];
                   
                   if (!targetAgent) {
                       console.error(`Target agent not found: ${targetAgentId}`);
                       return;
                   }
                   
                   console.log("Showing interception dialog for", targetAgentId);
                   
                   // Remove any existing overlays first
                   const existingOverlays = document.querySelectorAll('.intelligence-report-overlay');
                   existingOverlays.forEach(overlay => {
                       document.body.removeChild(overlay);
                   });
                   
                   // Create dialog overlay
                   const overlay = document.createElement('div');
                   overlay.className = 'intelligence-report-overlay';
                   overlay.style.zIndex = "10000"; // Ensure it's on top
                   
                   // Determine if agent has intelligence to collect
                   // Generate based on agent status
                   const hasIntelligence = targetAgent.status === "operating" || 
                       (targetAgent.intelligence && targetAgent.intelligence.hasIntel) ||
                       Math.random() > 0.4; // 60% chance of having intelligence
                   
                   // Generate intel value
                   const intelValue = hasIntelligence ? 30 + Math.floor(Math.random() * 70) : 0;
                   
                   // Create intel types
                   const intelTypes = [
                       "Secret diplomatic cables",
                       "Economic intelligence",
                       "Military information",
                       "Scientific research data",
                       "Political intelligence"
                   ];
                   
                   // Select random intel type
                   const intelType = intelTypes[Math.floor(Math.random() * intelTypes.length)];
                   
                   // Give the agent this intelligence
                   if (hasIntelligence && targetAgent.intelligence) {
                       targetAgent.intelligence.hasIntel = true;
                       targetAgent.intelligence.intelType = intelType;
                       targetAgent.intelligence.intelValue = intelValue;
                   }
                   
                   // Create HTML content for dialog
                   overlay.innerHTML = `
                       <div class="intelligence-report">
                           <h2>Agent Interception</h2>
                           <div class="agent-intel">
                               <h3>MI6 Agent has intercepted ${targetAgent.name}</h3>
                               ${hasIntelligence ? `
                                   <div style="background-color: rgba(255, 215, 0, 0.2); padding: 15px; margin: 15px 0; border: 1px solid #ffd700;">
                                       <p><strong>Intelligence detected!</strong></p>
                                       <p>Type: ${intelType}</p>
                                       <p>Value: ${intelValue} points</p>
                                   </div>
                                   <p>What action would you like to take?</p>
                                   <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                       <button id="collect-intel" style="background-color: #48bb78;">Collect Intelligence</button>
                                       <button id="tail-agent" style="background-color: #3182ce;">Continue Tailing</button>
                                       <button id="abort-mission" style="background-color: #e53e3e;">Abort Mission</button>
                                   </div>
                               ` : `
                                   <p>No valuable intelligence detected on this agent.</p>
                                   <div style="display: flex; justify-content: space-between; margin-top: 15px;">
                                       <button id="tail-agent" style="background-color: #3182ce;">Continue Tailing</button>
                                       <button id="abort-mission" style="background-color: #e53e3e;">Abort Mission</button>
                                   </div>
                               `}
                           </div>
                       </div>
                   `;
                   
                   // Add to document
                   document.body.appendChild(overlay);
                   
                   // Add event listeners to buttons after overlay is added to DOM
                   setTimeout(() => {
                       if (hasIntelligence) {
                           const collectButton = document.getElementById('collect-intel');
                           if (collectButton) {
                               collectButton.addEventListener('click', () => {
                                   // Create intelligence data
                                   const intelData = {
                                       id: `intel-${Date.now()}`,
                                       agents: [targetAgentId],
                                       location: targetAgent.location,
                                       type: intelType,
                                       timestamp: Date.now()
                                   };
                                   
                                   // Collect the intelligence
                                   if (typeof collectIntelligence === 'function') {
                                       collectIntelligence(intelData);
                                   } else {
                                       showNotification(`Intelligence collected: ${intelType}`);
                                   }
                                   
                                   // Mark agent as no longer having intelligence
                                   if (targetAgent.intelligence) {
                                       targetAgent.intelligence.hasIntel = false;
                                   }
                                   
                                   // Remove overlay
                                   document.body.removeChild(overlay);
                                   
                                   // Show success notification
                                   showNotification(`Successfully collected ${intelType} from ${targetAgent.name}!`);
                                   
                                   // Clear interception target
                                   agents.mi6.interceptionTarget = null;
                                   
                                   // Remove targeting highlight from rival agent
                                   const rivalEl = targetAgent.marker.getElement();
                                   rivalEl.style.boxShadow = '';
                               });
                           }
                       }
                       
                       const tailButton = document.getElementById('tail-agent');
                       if (tailButton) {
                           tailButton.addEventListener('click', () => {
                               // Remove overlay
                               document.body.removeChild(overlay);
                               
                               // Continue following
                               showNotification(`Continuing to tail ${targetAgent.name}`);
                               
                               // Clear interception target but keep following
                               agents.mi6.interceptionTarget = null;
                               
                               // Remove targeting highlight from rival agent
                               const rivalEl = targetAgent.marker.getElement();
                               rivalEl.style.boxShadow = '';
                           });
                       }
                       
                       const abortButton = document.getElementById('abort-mission');
                       if (abortButton) {
                           abortButton.addEventListener('click', () => {
                               // Remove overlay
                               document.body.removeChild(overlay);
                               
                               // Stop following
                               isFollowingAgent = false;
                               activeAgentId = null;
                               
                               // Update follow UI
                               const followButton = document.getElementById("follow-button");
                               if (followButton) {
                                   followButton.textContent = "Follow Agent";
                                   followButton.classList.remove("active");
                               }
                               
                               // Hide indicator
                               const indicator = document.getElementById("follow-indicator");
                               if (indicator) {
                                   indicator.style.display = "none";
                               }
                               
                               // Clear interception target
                               agents.mi6.interceptionTarget = null;
                               
                               // Remove targeting highlight from rival agent
                               const rivalEl = targetAgent.marker.getElement();
                               rivalEl.style.boxShadow = '';
                               
                               // Show notification
                               showNotification(`Mission aborted. Return to Headquarters. ${targetAgent.name}`);
                               
                               // Clear any intervals
                               if (window.followInterval) {
                                   clearInterval(window.followInterval);
                                   window.followInterval = null;
                               }
                           });
                       }
                   }, 100); // Small delay to ensure DOM is ready
               }

               // Check if MI6 agent is near target agent
               function checkInterceptionDistance() {
                   if (!agents.mi6 || !agents.mi6.interceptionTarget) {
                       return;
                   }
                   
                   const targetAgentId = agents.mi6.interceptionTarget;
                   const targetAgent = agents[targetAgentId];
                   
                   if (!targetAgent || !targetAgent.marker) {
                       console.error(`Invalid interception target: ${targetAgentId}`);
                       agents.mi6.interceptionTarget = null;
                       return;
                   }
                   
                   // Calculate distance between MI6 and target
                   const mi6Pos = agents.mi6.marker.getLngLat();
                   const targetPos = targetAgent.marker.getLngLat();
                   
                   const distance = calculateDistance(
                       [mi6Pos.lng, mi6Pos.lat],
                       [targetPos.lng, targetPos.lat]
                   );
                   
                   // If close enough, show interception dialog
                   if (distance <= 50) { // Within 50 meters
                       console.log(`MI6 agent within interception range of ${targetAgentId}: ${distance}m`);
                       showInterceptionDialog(targetAgentId);
                       
                       // Clear interception target to avoid multiple dialogs
                       agents.mi6.interceptionTarget = null;
                   }
               }

               // Set up interception monitoring
               function setupInterceptionMonitoring() {
                   // Check distance every second
                   setInterval(checkInterceptionDistance, 1000);
               }

               // Initialize the interception system
               function initializeInterceptionSystem() {
                   console.log("Initializing agent interception system");
                   
                   // Set up continuous monitoring for interception opportunities
                   setupInterceptionMonitoring();
               }

               // Call this when initializing the game
               setTimeout(initializeInterceptionSystem, 3000);

                // =============================================================================
                // INTELLIGENCE SYSTEM
                // =============================================================================

                // Intelligence collection system
                let collectedIntelligence = [];
                let intelligenceScore = 0;

                // Enhanced collectIntelligence function
                function collectIntelligence(intelData) {
                    // Store the original collectIntelligence function if it exists
                    const originalCollectIntelligence = 
                        typeof window.collectIntelligence === 'function' ? 
                        window.collectIntelligence : null;
                    
                    // If there's an existing collectIntelligence function, call it
                    if (originalCollectIntelligence) {
                        // Convert to the format expected by the original function if needed
                        const formattedData = {
                            // Remove value reference
                            agents: [intelData.agentId],
                            location: intelData.location,
                            type: intelData.type,
                            timestamp: intelData.timestamp
                        };
                        
                        originalCollectIntelligence(formattedData);
                    } else {
                        // Basic implementation if the original function doesn't exist
                        // Add to collected intelligence
                        if (!window.collectedIntelligence) {
                            window.collectedIntelligence = [];
                        }
                        
                        window.collectedIntelligence.push(intelData);
                        
                        // Remove intelligence score updates
                        
                        // Show notification without point value
                        showNotification(`Intelligence collected: ${intelData.type}`);
                       
                    }
                }

                function createAnalysisUI() {
                    // Add event listener for the minimize button
                    document.getElementById('analysis-minimize').addEventListener('click', () => {
                        const panel = document.querySelector('.analysis-panel');
                        panel.classList.toggle('collapsed');
                        
                        const button = document.getElementById('analysis-minimize');
                        button.textContent = panel.classList.contains('collapsed') ? '[+]' : '[-]';
                    });
                    
                    // Add event listener for the analyze button
                    document.getElementById('analyze-intel').addEventListener('click', () => {
                        showNotification("Analyzing intelligence data...");
                        
                        // Simulate intelligence updates
                        setTimeout(() => {
                            updateIntelligencePanel();
                        }, 1000);
                    });
                    
                    // Start intel updates after a delay
                    setTimeout(() => {
                        updateIntelligencePanel();
                    }, 5000);
                }

                // Function to update intelligence panel with new data
                function updateIntelligencePanel() {
                    // Simple direct update of a random agent
                    const agents = [
                        "intel-rus1", "intel-rus2", "intel-rus3",
                        "intel-chn1", "intel-chn2", "intel-chn3",
                        "intel-fra1", "intel-fra2",
                        "intel-ger1", "intel-ger2",
                        "intel-usa1", "intel-usa2", "intel-usa3"
                    ];
                    
                    const updates = [
                        "Meeting with contacts", 
                        "Surveillance detected",
                        "Secured location visit",
                        "Intercepted transmission",
                        "Unusual travel pattern"
                    ];
                    
                    // Pick a random agent and update
                    const agentId = agents[Math.floor(Math.random() * agents.length)];
                    const update = updates[Math.floor(Math.random() * updates.length)];
                    
                    // Direct DOM manipulation
                    const element = document.getElementById(agentId);
                    if (element) {
                        const statusElement = element.querySelector('.rival-status');
                        if (statusElement) {
                            statusElement.textContent = `Intel: ${update}`;
                            element.style.backgroundColor = "rgba(255, 215, 0, 0.3)";
                            
                            // Remove highlight after delay
                            setTimeout(() => {
                                element.style.backgroundColor = "";
                            }, 5000);
                            
                            showNotification(`Intelligence updated`);
                           
                        }
                    }
                    
                    // Schedule next update
                    setTimeout(updateIntelligencePanel, 8000);
                }

                // Add a new function for tracking intelligence narrative
                let intelligenceStatus = {
                    totalCollected: 0,
                    categories: {},
                    recentCollection: []
                };

                function trackIntelligence(intelData) {
                    intelligenceStatus.totalCollected++;
                    
                    if (!intelligenceStatus.categories[intelData.type]) {
                        intelligenceStatus.categories[intelData.type] = 0;
                    }
                    intelligenceStatus.categories[intelData.type]++;
                    
                    intelligenceStatus.recentCollection.push({
                        type: intelData.type,
                        timestamp: Date.now()
                    });
                    
                    // Keep only last 10 collections
                    if (intelligenceStatus.recentCollection.length > 10) {
                        intelligenceStatus.recentCollection.shift();
                    }
                    
                    showNotification(`Intelligence collected: ${intelData.type}`);
                }

                // Create intelligence opportunity markers
                function createIntelligenceOpportunity(locationId, involvedAgents) {
                    const location = allLocations[locationId];
                    
                    // Create a special marker that will show intelligence is available
                    const intelMarker = document.createElement("div");
                    intelMarker.className = "poi-marker intelligence-marker";
                    intelMarker.textContent = "🔍";
                    intelMarker.style.backgroundColor = "#ffd700"; // Gold color
                    
                    // Store the intelligence data - remove value property
                    const intelData = {
                        id: `intel-${Date.now()}`,
                        location: locationId,
                        name: `Intelligence at ${location.name}`,
                        coordinates: location.coordinates,
                        type: "intelligence",
                        agents: involvedAgents,
                        expires: Date.now() + (5 * 60 * 1000), // 5 minutes expiry
                        discovered: false,
                        // Remove: value: 30 + Math.floor(Math.random() * 70)
                    };
                    
                    // Add marker to map - MERGED CODE HERE
                    const marker = new mapboxgl.Marker({
                        element: intelMarker,
                        anchor: "bottom"
                    })
                    .setLngLat(location.coordinates)
                    .setPopup(
                        new mapboxgl.Popup({ className: 'transparent-popup' })
                        .setHTML(`
                            <h3>Intelligence Opportunity</h3>
                            <p>Agents observed meeting at ${location.name}</p>
                            <!-- Remove point value display line -->
                            <div class="popup-actions">
                                <button id="collect-intel-${intelData.id}" class="send-mi6">Collect Intelligence</button>
                            </div>
                        `)
                    )
                    .addTo(map);
                    
                    // Add event listener
                    marker.getElement().addEventListener('click', () => {
                        marker.togglePopup();
                        
                        // Get updated popup element after it's been created
                        setTimeout(() => {
                            const popup = marker.getPopup().getElement();
                            const collectButton = popup.querySelector(`#collect-intel-${intelData.id}`);
                            
                            if (collectButton) {
                                collectButton.addEventListener('click', () => {
                                    // Check if MI6 agent is close enough
                                    const mi6Distance = calculateDistance(
                                        agents.mi6.marker.getLngLat().toArray(),
                                        location.coordinates
                                    );
                                    
                                    if (mi6Distance < 500) { // Within 500 meters
                                        collectIntelligence(intelData);
                                        marker.remove();
                                    } else {
                                        showNotification("MI6 agent must be closer to collect intelligence");
                                    }
                                });
                            }
                        }, 100);
                    });
                    
                    // Store marker for management
                    poiMarkers.push(marker);
                    
                    // Show notification
                    showNotification(`Intelligence opportunity detected at ${location.name}!`);
                    
                    // Make it expire after some time
                    setTimeout(() => {
                        if (poiMarkers.includes(marker)) {
                            marker.remove();
                            const index = poiMarkers.indexOf(marker);
                            if (index > -1) {
                                poiMarkers.splice(index, 1);
                            }
                            showNotification(`Intelligence opportunity at ${location.name} has expired`);
                        }
                    }, intelData.expires - Date.now());
                    
                    return marker;
                }

                function displayIntelligenceResults(revealedPatterns) {
                    // Create intelligence report UI
                    const reportOverlay = document.createElement('div');
                    reportOverlay.className = 'intelligence-report-overlay';
                    reportOverlay.innerHTML = `
                        <div class="intelligence-report">
                            <h2>Intelligence Report</h2>
                            <div class="report-content">
                                ${Object.keys(revealedPatterns).map(agentId => `
                                    <div class="agent-intel">
                                        <h3>${agents[agentId].name}</h3>
                                        <p><strong>Preferences:</strong> ${revealedPatterns[agentId].preferences.join(', ')}</p>
                                        <p><strong>Likely targets:</strong> ${
                                            revealedPatterns[agentId].nextTargets.length > 0 
                                            ? revealedPatterns[agentId].nextTargets.map(t => 
                                                `${t.name} (${t.likelihood}%)`).join(', ')
                                            : 'Unknown'
                                        }</p>
                                    </div>
                                `).join('')}
                            </div>
                            <button id="close-report" class="close-button">Close Report</button>
                        </div>
                    `;
                    
                    document.body.appendChild(reportOverlay);
                    
                    // Add close button handler
                    document.getElementById('close-report').addEventListener('click', () => {
                        document.body.removeChild(reportOverlay);
                    });
                }

                        // =============================================================================
                        // RIVAL AGENT AI ENHANCEMENT
                        // =============================================================================

                        // Add to your rival agent objects
                        function enhanceRivalAgents() {
                            const agencyPatterns = {
                                "rus": {
                                    preferences: ["governmentBuildings", "transport", "military"],
                                    timePatterns: {morning: 0.7, afternoon: 0.2, evening: 0.9},
                                    meetingLocations: ["dorchester", "tatemodern", "kingscross"]
                                },
                                "chn": {
                                    preferences: ["technology", "finance", "research"],
                                    timePatterns: {morning: 0.3, afternoon: 0.8, evening: 0.4},
                                    meetingLocations: ["shard", "britishmuseum", "liverpool"]
                                },
                                "fra": {
                                    preferences: ["culture", "diplomacy", "finance"],
                                    timePatterns: {morning: 0.5, afternoon: 0.6, evening: 0.3},
                                    meetingLocations: ["connaught", "nationalgallery", "westminsterabbey"]
                                }
                                // Add patterns for other agencies
                            };
                            
                            // Assign these patterns to the agents
                            for (const agentId in agents) {
                                if (agentId === "mi6") continue;
                                
                                const agencyCode = agentId.substring(0, 3);
                                if (agencyPatterns[agencyCode]) {
                                    agents[agentId].patterns = agencyPatterns[agencyCode];
                                    
                                    // Add tracking for agent's movement history
                                    agents[agentId].history = [];
                                    
                                    // Add randomized but consistent behavior parameters
                                    agents[agentId].behaviorSeed = Math.random();
                                    
                                    // Enhanced target selection based on patterns and current game state
                                    agents[agentId].getNextTarget = function() {
                                        return getPatternBasedTarget(this);
                                    };
                                }
                            }
                        }

                        function getPatternBasedTarget(agent) {
                            const agencyCode = agent.id.substring(0, 3);
                            const patterns = agent.patterns;
                            const currentHour = new Date().getHours();
                            
                            // Determine time of day factor
                            let timeOfDay = "afternoon";
                            if (currentHour < 12) timeOfDay = "morning";
                            if (currentHour >= 18) timeOfDay = "evening";
                            
                            // Calculate preference scores for each location
                            const locationScores = {};
                            
                            for (const locId in allLocations) {
                                if (locId === agent.location) continue;
                                
                                const location = allLocations[locId];
                                let score = 0;
                                
                                // Base score based on location type matching preferences
                                if (patterns.preferences.includes(location.type)) {
                                    score += 30;
                                }
                                
                                // Time pattern influence
                                score += patterns.timePatterns[timeOfDay] * 20;
                                
                                // Meeting location bonus
                                if (patterns.meetingLocations.includes(locId)) {
                                    score += 25;
                                }
                                
                                // Distance factor (prefer closer locations)
                                const distance = calculateDistance(
                                    allLocations[agent.location].coordinates,
                                    location.coordinates
                                );
                                score -= distance / 1000; // Reduce score for farther locations
                                
                                // Check if recently visited
                                const recentVisit = agent.history.findIndex(h => h.location === locId);
                                if (recentVisit > -1 && recentVisit > agent.history.length - 5) {
                                    score -= 30; // Strongly avoid recently visited locations
                                }
                                
                                // Add some deterministic randomness based on agent's seed
                                score += Math.sin(agent.behaviorSeed * locId.charCodeAt(0)) * 10;
                                
                                locationScores[locId] = score;
                            }
                            
                            // Select location with highest score
                            const sortedLocations = Object.keys(locationScores).sort(
                                (a, b) => locationScores[b] - locationScores[a]
                            );
                            
                            // Record in history
                            agent.history.push({
                                location: sortedLocations[0],
                                time: Date.now(),
                                reason: "pattern-based selection"
                            });
                            
                            if (agent.history.length > 20) {
                                agent.history.shift(); // Keep history manageable
                            }
                            
                            return sortedLocations[0];
                        }

                        function getTopTargets(agent, count) {
                            // Simulate the agent's target selection process to predict future movements
                            const locationScores = {};
                            
                            for (const locId in allLocations) {
                                if (locId === agent.location) continue;
                                
                                const location = allLocations[locId];
                                let score = 0;
                                
                                // Simplified scoring based on patterns
                                if (agent.patterns.preferences.includes(location.type)) {
                                    score += 30;
                                }
                                
                                // Meeting location bonus
                                if (agent.patterns.meetingLocations.includes(locId)) {
                                    score += 25;
                                }
                                
                                locationScores[locId] = score;
                            }
                            
                            // Select top locations
                            return Object.keys(locationScores)
                                .sort((a, b) => locationScores[b] - locationScores[a])
                                .slice(0, count)
                                .map(id => ({
                                    id,
                                    name: allLocations[id].name,
                                    likelihood: Math.min(100, locationScores[id])
                                }));
                        }

                        function processIntelligence(intelData) {
                            const revealedPatterns = {};
                            
                            // Process data based on which agents were involved
                            intelData.agents.forEach(agentId => {
                                if (agentId === "mi6") return;
                                
                                const agent = agents[agentId];
                                const agencyCode = agentId.substring(0, 3);
                                
                                // Reveal some pattern information based on the intelligence value
                                if (intelData.value > 70) {
                                    // High value intelligence reveals a lot
                                    revealedPatterns[agentId] = {
                                        preferences: agent.patterns.preferences,
                                        nextTargets: getTopTargets(agent, 3),
                                        meetings: agent.history.filter(h => h.reason === "meeting").slice(-3)
                                    };
                                } else if (intelData.value > 40) {
                                    // Medium value reveals some info
                                    revealedPatterns[agentId] = {
                                        preferences: agent.patterns.preferences.slice(0, 1),
                                        nextTargets: getTopTargets(agent, 1),
                                        meetings: agent.history.filter(h => h.reason === "meeting").slice(-1)
                                    };
                                } else {
                                    // Low value reveals minimal info
                                    revealedPatterns[agentId] = {
                                        preferences: ["Unknown - collect more intelligence"],
                                        nextTargets: [],
                                        meetings: []
                                    };
                                }
                            });
                            
                            return revealedPatterns;
                        }

                        function displayAgentPatterns(agentId) {
                            const agent = agents[agentId];
                            const patternsDiv = document.getElementById('agent-patterns');
                            
                            // Calculate how much intelligence we have on this agent
                            const agentIntel = collectedIntelligence.filter(intel => 
                                intel.agents.includes(agentId)
                            );
                            
                            const intelLevel = agentIntel.reduce((sum, intel) => sum + intel.value, 0);
                            
                            // Display what we know based on intel level
                            let patternsHTML = '';
                            
                            if (intelLevel > 200) {
                                // High intel - reveal almost everything
                                patternsHTML = `
                                    <div class="pattern-data">
                                        <p><strong>Intel Level:</strong> High (${intelLevel})</p>
                                        <p><strong>Preferences:</strong> ${agent.patterns.preferences.join(', ')}</p>
                                        <p><strong>Active Hours:</strong> ${
                                            Object.entries(agent.patterns.timePatterns)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([time, val]) => `${time} (${Math.round(val * 100)}%)`)
                                                .join(', ')
                                        }</p>
                                        <p><strong>Known Contacts:</strong> ${
                                            agent.history
                                                .filter(h => h.reason === "meeting")
                                                .slice(-5)
                                                .map(m => allLocations[m.location].name)
                                                .join(', ')
                                        }</p>
                                    </div>
                                `;
                            } else if (intelLevel > 100) {
                                // Medium intel - reveal some patterns
                                patternsHTML = `
                                    <div class="pattern-data">
                                        <p><strong>Intel Level:</strong> Medium (${intelLevel})</p>
                                        <p><strong>Preferences:</strong> ${agent.patterns.preferences.slice(0, 2).join(', ')}</p>
                                        <p><strong>Active Hours:</strong> ${
                                            Object.entries(agent.patterns.timePatterns)
                                                .sort((a, b) => b[1] - a[1])
                                                .slice(0, 1)
                                                .map(([time, val]) => `${time} (${Math.round(val * 100)}%)`)
                                                .join(', ')
                                        }</p>
                                        <p><strong>Known Contacts:</strong> Limited information</p>
                                    </div>
                                `;
                            } else {
                                // Low intel - minimal info
                                patternsHTML = `
                                    <div class="pattern-data">
                                        <p><strong>Intel Level:</strong> Low (${intelLevel})</p>
                                        <p><strong>Preferences:</strong> Insufficient intelligence</p>
                                        <p><strong>Active Hours:</strong> Unknown</p>
                                        <p><strong>Known Contacts:</strong> Unknown</p>
                                        <p>Collect more intelligence on this agent</p>
                                    </div>
                                `;
                            }
                            
                            patternsDiv.innerHTML = patternsHTML;
                        }

                        function predictAgentMovement(agentId) {
                            const agent = agents[agentId];
                            const intelLevel = collectedIntelligence
                                .filter(intel => intel.agents.includes(agentId))
                                .reduce((sum, intel) => sum + intel.value, 0);
                            
                            // Accuracy depends on intel level
                            const accuracy = Math.min(0.9, intelLevel / 300);
                            
                            // Get the actual next target (that the agent would choose)
                            const actualNextTarget = getPatternBasedTarget(agent);
                            
                            // Based on accuracy, either reveal the correct target or a plausible alternative
                            let predictedTarget;
                            if (Math.random() < accuracy) {
                                predictedTarget = actualNextTarget;
                            } else {
                                // Get a plausible but incorrect prediction
                                const possibleTargets = getTopTargets(agent, 5)
                                    .map(t => t.id)
                                    .filter(id => id !== actualNextTarget);
                                
                                predictedTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                            }
                            
                            // Show prediction on map
                            highlightPredictedLocation(predictedTarget, agent.id, accuracy);
                            
                            // Notify user
                            showNotification(`Movement prediction for ${agent.name}: ${allLocations[predictedTarget].name} (Confidence: ${Math.round(accuracy * 100)}%)`);
                        }

                        function highlightPredictedLocation(locationId, agentId, confidence) {
                            const location = allLocations[locationId];
                            const agent = agents[agentId];
                            
                            // Create marker with pulsing effect
                            const el = document.createElement("div");
                            el.className = "poi-marker prediction-marker";
                            el.textContent = "📍";
                            el.style.backgroundColor = confidence > 0.6 ? "#4caf50" : "#ff9800"; // Green for high confidence, orange for lower
                            
                            // Add pulsing animation
                            el.classList.add("highlight");
                            
                            // Create popup content
                            const popupContent = document.createElement("div");
                            popupContent.innerHTML = `
                                <h3>Predicted Movement</h3>
                                <p>${agent.name} is likely to visit ${location.name}</p>
                                <p>Confidence: ${Math.round(confidence * 100)}%</p>
                                <div class="popup-actions">
                                    <button id="intercept-${agentId}" class="send-mi6">Send MI6 to Intercept</button>
                                </div>
                            `;
                            
                            // Create and add marker
                            const marker = new mapboxgl.Marker({
                                element: el,
                                anchor: "bottom"
                            })
                            .setLngLat(location.coordinates)
                            .setPopup(
                                new mapboxgl.Popup({ 
                                    className: 'transparent-popup',
                                    offset: [0, -15]
                                })
                                .setDOMContent(popupContent)
                            )
                            .addTo(map);
                            
                            // Add event listener to intercept button
                            marker.getPopup().on("open", () => {
                                setTimeout(() => {
                                    const button = document.getElementById(`intercept-${agentId}`);
                                    if (button) {
                                        button.addEventListener("click", () => {
                                            moveAgent("mi6", locationId);
                                            marker.remove();
                                        });
                                    }
                                }, 100);
                            });
                            
                            // Add to tracking
                            poiMarkers.push(marker);
                            
                            // Remove after 2 minutes
                            setTimeout(() => {
                                marker.remove();
                                const index = poiMarkers.indexOf(marker);
                                if (index > -1) {
                                    poiMarkers.splice(index, 1);
                                }
                            }, 120000);
                        }
                        // =============================================================================
                        // ABORT MISSION FEATURE
                        // =============================================================================

                        // Function to setup the abort mission feature
                        function setupAbortMissionFeature() {
                            // Store original map click handler
                            const originalMapClickHandler = map.listeners && map.listeners.click ? 
                                map.listeners.click[0] : null;
                            
                            // Remove existing click handler if it exists
                            if (originalMapClickHandler) {
                                map.off('click', originalMapClickHandler);
                            }
                            
                            // Add new click handler that includes mission abort check
                            map.on("click", (e) => {
                                // First, check if MI6 agent is on a mission
                                const mi6Agent = agents["mi6"];
                                
                                if (mi6Agent && (mi6Agent.animationInProgress || mi6Agent.path)) {
                                    // Ask user if they want to abort the mission
                                    // Create a popup for abort confirmation
                                    const popup = new mapboxgl.Popup({
                                        closeButton: true,
                                        className: 'transparent-popup',
                                        closeOnClick: false
                                    })
                                    .setLngLat([e.lngLat.lng, e.lngLat.lat])
                                    .setHTML(`
                                        <h3>Abort Mission?</h3>
                                        <p>MI6 Agent is currently on a mission.</p>
                                        <div class="popup-actions">
                                            <button id="abort-mission-button" class="send-mi6">Abort Mission</button>
                                        </div>
                                    `)
                                    .addTo(map);
                                    
                                    // Set as active popup
                                    if (activePopup) {
                                        activePopup.remove();
                                    }
                                    activePopup = popup;
                                    
                                    // Add event listener to abort button
                                    popup.on('open', () => {
                                        setTimeout(() => {
                                            const abortButton = document.getElementById('abort-mission-button');
                                            if (abortButton) {
                                                abortButton.addEventListener('click', () => {
                                                    abortMission("mi6");
                                                    popup.remove();
                                                });
                                            }
                                        }, 100);
                                    });
                                    
                                    return; // Stop here to prevent other click behaviors
                                }
                                
                                // Don't add point if following an agent
                                if (isFollowingAgent) return;
                                
                                // Continue with regular behavior for adding custom locations
                                // Create custom location from click
                                const coordinates = [e.lngLat.lng, e.lngLat.lat];
                                
                                // Use reverse geocoding to get location name
                                reverseGeocode(coordinates);
                            });
                        }

                        // Add a direct abort button to the control panel
                        function addAbortButton() {
                            // Find MI6 movement controls
                            const moveButton = document.getElementById("mi6-move");
                            if (!moveButton) {
                                console.error("MI6 move button not found");
                                return;
                            }
                            
                            // Create abort button
                            const abortButton = document.createElement("button");
                            abortButton.id = "mi6-abort";
                            abortButton.textContent = "Abort Mission";
                            abortButton.style.display = "none"; // Hide initially
                            
                            // Add event listener with error handling
                            abortButton.addEventListener("click", function() {
                                // Check if abortMission exists in window scope
                                if (typeof window.abortMission === 'function') {
                                    window.abortMission("mi6");
                                } else if (typeof abortMission === 'function') {
                                    abortMission("mi6");
                                } else {
                                    console.error("abortMission function not found");
                                    // Simple fallback to at least hide the button
                                    this.style.display = "none";
                                    
                                    // Update UI to show mission was aborted
                                    const mi6location = document.getElementById("mi6-location");
                                    if (mi6location) mi6location.textContent = "Location: Mission aborted";
                                    
                                    const mi6target = document.getElementById("mi6-target");
                                    if (mi6target) mi6target.textContent = "Target: None";
                                    
                                    const mi6path = document.getElementById("mi6-path");
                                    if (mi6path) mi6path.textContent = "";
                                    
                                    showNotification("Mission aborted");
                                }
                            });
                            
                            // Add button after move button
                            moveButton.parentNode.insertBefore(abortButton, moveButton.nextSibling);
                            
                            // Modify moveAgent function to show/hide abort button
                            const originalMoveAgent = moveAgent;
                            moveAgent = function(agentId, targetLocation, isRival = false) {
                                // Call original function
                                originalMoveAgent(agentId, targetLocation, isRival);
                                
                                // Show abort button if MI6 is moving
                                if (agentId === "mi6") {
                                    document.getElementById("mi6-abort").style.display = "inline-block";
                                }
                            };
                            
                            // Also modify completeAgentMovement to hide abort button when mission completes
                            const originalCompleteAgentMovement = completeAgentMovement;
                            completeAgentMovement = function(agentId) {
                                // Call original function
                                originalCompleteAgentMovement(agentId);
                                
                                // Hide abort button if MI6 mission completed
                                if (agentId === "mi6") {
                                    document.getElementById("mi6-abort").style.display = "none";
                                }
                            };
                            
                            // Make sure abortMission exists and works properly
                            if (typeof abortMission !== 'function') {
                                // Create abortMission if it doesn't exist
                                window.abortMission = function(agentId) {
                                    console.log(`Aborting mission for ${agentId}`);
                                    
                                    const agent = agents[agentId];
                                    if (!agent) {
                                        console.error(`Agent ${agentId} not found`);
                                        return false;
                                    }
                                    
                                    // Stop any ongoing animation
                                    agent.animationInProgress = false;
                                    
                                    // Reset path and route info
                                    agent.path = null;
                                    agent.routeCoordinates = [];
                                    agent.currentRouteIndex = 0;
                                    
                                    // Update UI
                                    if (agentId === "mi6") {
                                        document.getElementById("mi6-location").textContent = "Location: Mission aborted";
                                        document.getElementById("mi6-target").textContent = "Target: None";
                                        document.getElementById("mi6-path").textContent = "";
                                        
                                        // Hide abort button
                                        const abortBtn = document.getElementById("mi6-abort");
                                        if (abortBtn) {
                                            abortBtn.style.display = "none";
                                        }
                                    }
                                    
                                    showNotification(`Mission aborted. Return to HQ`);
                                    return true;
                                };
                            } else {
                                // If abortMission exists, wrap it to ensure button is hidden
                                const originalAbortMission = abortMission;
                                abortMission = function(agentId) {
                                    const result = originalAbortMission(agentId);
                                    
                                    // Hide abort button if MI6 mission aborted
                                    if (agentId === "mi6") {
                                        document.getElementById("mi6-abort").style.display = "none";
                                    }
                                    
                                    return result;
                                };
                            }
                        }

                        // Initialize the abort mission feature
                        function initializeAbortMissionFeature() {
                            // Set up when map is loaded
                            if (map.loaded()) {
                                setupAbortMissionFeature();
                                addAbortButton();
                            } else {
                                map.on("load", () => {
                                    setupAbortMissionFeature();
                                    addAbortButton();
                                });
                            }
                        }
                        // =============================================================================
                        // INITIALIZATION
                        // =============================================================================

                        // Function to initialize the AI enhancements
                        function initializeAI() {
                            console.log("Starting AI initialization...");
                            enhanceRivalAgents();
                            
                            console.log("Creating Analysis UI...");
                            createAnalysisUI();
                            console.log("Analysis UI created");

                            // Modify activateRivalAgent to use pattern-based targeting
                            const originalActivateRivalAgent = activateRivalAgent;
                            activateRivalAgent = function(agentId) {
                                const agent = agents[agentId];
                                
                                // Don't activate if agent is already busy
                                if (agent.status !== "idle") return;
                                
                                // Use pattern-based target selection if available
                                let targetLocation;
                                if (agent.getNextTarget) {
                                    targetLocation = agent.getNextTarget();
                                } else {
                                    // Fall back to original random method
                                    const landmarks = Object.keys(allLocations).filter(id => 
                                        allLocations[id].type === "landmark" && id !== agent.location
                                    );
                                    targetLocation = landmarks[Math.floor(Math.random() * landmarks.length)];
                                }
                                
                                // Move agent to the landmark
                                moveAgent(agentId, targetLocation, true);
                            };
                            
                            // Add meeting detection to completeAgentMovement
                            const originalCompleteAgentMovement = completeAgentMovement;
                            completeAgentMovement = function(agentId) {
                                // Call the original function first
                                originalCompleteAgentMovement(agentId);
                                
                                // Check if this is MI6 and if there's an interception target
                                if (agentId === "mi6" && agents.mi6.interceptionTarget) {
                                    const targetAgentId = agents.mi6.interceptionTarget;
                                    const targetAgent = agents[targetAgentId];
                                    
                                    if (!targetAgent) {
                                        console.error("Target agent no longer exists");
                                        return;
                                    }
                                    
                                    // Calculate distance between MI6 and target agent
                                    const mi6Position = agents.mi6.marker.getLngLat();
                                    const targetPosition = targetAgent.marker.getLngLat();
                                    
                                    const distance = calculateDistance(
                                        [mi6Position.lng, mi6Position.lat],
                                        [targetPosition.lng, targetPosition.lat]
                                    );
                                    
                                    // If MI6 is close enough to the target (within 50 meters)
                                    if (distance <= 50) {
                                        // Intercept successful
                                        showInterceptionDialog(targetAgentId);
                                    } else {
                                        // Not close enough yet
                                        showNotification(`MI6 agent needs to get closer to ${targetAgent.name} (${Math.round(distance)}m away)`);
                                        
                                        // Try again with updated position
                                        interceptRivalAgent(targetAgentId);
                                    }
                                }
                            };
                        }

                        // =============================================================================
                        // EVENT LISTENERS AND PAGE INITIALIZATION
                        // =============================================================================

                        // Initialize the game on page load
                        document.addEventListener("DOMContentLoaded", function() {
                            console.log("DOM loaded, game initialization will begin after map loads");
                        });

                        document.addEventListener('DOMContentLoaded', () => {
                            // Initialize search after a short delay to ensure DOM is ready
                            setTimeout(initializeSearch, 1000);
                        });

                        // Add click events to agent intel elements to show reports
                        document.addEventListener('DOMContentLoaded', function() {
                            setTimeout(() => {
                                // Add click handlers to all intel elements
                                const intelElements = document.querySelectorAll('[id^="intel-"]');
                                intelElements.forEach(element => {
                                    const agentId = element.id.replace('intel-', '');
                                    
                                    element.addEventListener('click', (e) => {
                                        // Prevent event propagation
                                        e.stopPropagation();
                                        e.preventDefault();
                                        
                                        console.log(`Intel element clicked for ${agentId}`);
                                        
                                        // Use the showNotification function instead of alert
                                        if (window.showNotification) {
                                            window.showNotification(`Agent ${agentId.toUpperCase()}: ${element.querySelector('.rival-status').textContent}\n\nClick on this agent's marker to intercept them.`, 5000);
                                        }
                                        
                                        // Optionally focus the map on this agent's location
                                        if (agents[agentId] && agents[agentId].marker) {
                                            // Get agent position
                                            const position = agents[agentId].marker.getLngLat();
                                            
                                            // Fly to agent
                                            map.flyTo({
                                                center: position,
                                                zoom: 15,
                                                duration: 1000
                                            });
                                        }
                                    });
                                    
                                    // Make it look clickable
                                    element.style.cursor = 'pointer';
                                });
                                    
                                // Add hover effect with CSS
                                const style = document.createElement('style');
                                style.textContent = `
                                    [id^="intel-"]:hover {
                                        background-color: rgba(100, 149, 237, 0.1) !important;
                                    }
                                `;
                                document.head.appendChild(style);
                            }, 3000);
                            
                            console.log("Added click handlers to all intel elements");
                        });

                        // Add a window.onload handler to ensure all fixes are applied after page load
                        window.onload = function() {
                           
                            
                            // Set up enhanced search listeners
                            setupEnhancedSearchListeners();
                            
                            // Force a resize after a short delay to fix any initial rendering issues
                            setTimeout(() => {
                                window.dispatchEvent(new Event('resize'));
                                
                                // If map exists and has a resize method, call it
                                if (map && typeof map.resize === 'function') {
                                    map.resize();
                                }
                                
                                console.log("Forced resize after load");
                            }, 1000);
                            
                            document.addEventListener('DOMContentLoaded', setupEnhancedSearchListeners);
                            
                            console.log("Window load handler executed");
                            
                            // Initialize abort mission feature
                            initializeAbortMissionFeature();
                            
                            // Initialize AI enhancements
                            initializeAI();
                        };

                        // Fix for any existing map issues
                        // If the map is already loaded, resize it now
                        if (map && typeof map.resize === 'function') {
                            console.log("Attempting immediate map resize");
                            map.resize();
                        }
                        // =============================================================================
                        // MAP AND LOCATION MANAGEMENT
                        // =============================================================================

                        // Initialize locations and connections
                        function initializeLocations() {
                            // Clear existing locations (important for reset functionality)
                            allLocations = {};
                            locationGraph = {};
                            
                            function addLocation(id, name, coordinates, type) {
                                allLocations[id] = {
                                    id: id,
                                    name: name,
                                    coordinates: coordinates,
                                    type: type,
                                };
                                locationGraph[id] = [];
                            }
                            
                            // Add important landmarks
                            addLocation("stgeorgeswharf", "St. George Wharf", [-0.12709, 51.48636], "pier");
                            addLocation("mi6hq", "MI6 Headquarters", [-0.1235, 51.4874], "landmark");
                            addLocation("towerhill", "Tower of London", [-0.0759, 51.5081], "landmark");
                            addLocation("westminsterabbey", "Westminster Abbey", [-0.1276, 51.4994], "landmark");
                            addLocation("parliamenthouse", "Houses of Parliament", [-0.1248, 51.4994], "landmark");
                            addLocation("buckinghampalace", "Buckingham Palace", [-0.1419, 51.5014], "landmark");
                            addLocation("londoneye", "London Eye", [-0.11943, 51.504], "landmark");
                            addLocation("stpauls", "St. Paul's Cathedral", [-0.0984, 51.5138], "landmark");
                            addLocation("trafalgarsquare", "Trafalgar Square", [-0.1281, 51.508], "landmark");
                            addLocation("britishmuseum", "British Museum", [-0.1269, 51.5194], "landmark");
                            addLocation("shard", "The Shard", [-0.0865, 51.5045], "landmark");
                            addLocation("tatemodern", "Tate Modern", [-0.0994, 51.5076], "landmark");
                            addLocation("gherkin", "The Gherkin", [-0.0803, 51.5145], "landmark");
                            addLocation("shakespeareglobe", "Shakespeare's Globe", [-0.0972, 51.5081], "landmark");
                            addLocation("nationalgallery", "National Gallery", [-0.1283, 51.5089], "landmark");
                            addLocation("hydepark", "Hyde Park", [-0.1657, 51.5073], "landmark");
                            
                            // Add metro stations
                            addLocation("westminster", "Westminster Station", [-0.12475, 51.50132], "metro");
                            addLocation("waterloo", "Waterloo Station", [-0.11311, 51.50331], "metro");
                            addLocation("embankment", "Embankment Station", [-0.12219, 51.50717], "metro");
                            addLocation("londonbridge", "London Bridge Station", [-0.08642, 51.50539], "metro");
                            addLocation("piccadillycircus", "Piccadilly Circus Station", [-0.13472, 51.51005], "metro");
                            addLocation("oxfordcircus", "Oxford Circus Station", [-0.14083, 51.51522], "metro");
                            addLocation("bakerstreet", "Baker Street Station", [-0.1578, 51.5226], "metro");
                            addLocation("kingscross", "King's Cross St. Pancras", [-0.1239, 51.5300], "metro");
                            addLocation("bank", "Bank Station", [-0.08889, 51.51336], "metro");
                            addLocation("victoriastation", "Victoria Station", [-0.1440, 51.4952], "metro");
                            
                            // Add embassies
                            addLocation("russianembassy", "Russian Embassy", [-0.19185, 51.50946], "embassy");
                            addLocation("chineseembassy", "Chinese Embassy", [-0.14572, 51.51994], "embassy");
                            addLocation("frenchembassy", "French Embassy", [-0.15807, 51.5025], "embassy");
                            addLocation("germanembassy", "German Embassy", [-0.15425, 51.49817], "embassy");
                            addLocation("usembassy", "US Embassy", [-0.13218, 51.4825], "embassy");
                            
                            // Add river piers
                            addLocation("westminsterpier", "Westminster Pier", [-0.12312, 51.50175], "pier");
                            addLocation("embankmentpier", "Embankment Pier", [-0.12089, 51.50757], "pier");
                            addLocation("londoneyepier", "London Eye Pier", [-0.12057, 51.50312], "pier");
                            addLocation("towerpier", "Tower Millennium Pier", [-0.07903, 51.50731], "pier");
                            addLocation("londonbridgepier", "London Bridge City Pier", [-0.08464, 51.50693], "pier");
                            
                            // Upscale Hotels
                            addLocation("dorchester", "The Dorchester", [-0.1526, 51.5067], "hotel");
                            addLocation("connaught", "The Connaught", [-0.1487, 51.5109], "hotel");
                            addLocation("langham", "The Langham", [-0.1444, 51.5177], "hotel");
                            addLocation("shangri", "Shangri-La The Shard", [-0.0865, 51.5045], "hotel");
                            addLocation("mandarinoriental", "Mandarin Oriental Hyde Park", [-0.1597, 51.5018], "hotel");

                            // Fine Dining Restaurants
                            addLocation("gordon", "Restaurant Gordon Ramsay", [-0.1692, 51.4848], "restaurant");
                            addLocation("ledbury", "The Ledbury", [-0.1995, 51.5168], "restaurant");
                            addLocation("ducasse", "Alain Ducasse at The Dorchester", [-0.1526, 51.5067], "restaurant");
                            addLocation("sketch", "Sketch", [-0.1414, 51.5122], "restaurant");
                            addLocation("clove", "Clove Club", [-0.0798, 51.5265], "restaurant");

                            // Additional Underground Stations
                            addLocation("kingscross", "King's Cross St. Pancras", [-0.1239, 51.5300], "metro");
                            addLocation("paddington", "Paddington Station", [-0.1755, 51.5151], "metro");
                            addLocation("victoriastation", "Victoria Station", [-0.1440, 51.4952], "metro");
                            addLocation("bakerstreet", "Baker Street Station", [-0.1578, 51.5226], "metro");
                            addLocation("eustonstation", "Euston Station", [-0.1328, 51.5280], "metro");

                            // Major Transportation Hubs
                            addLocation("heathrow", "Heathrow Airport", [-0.4543, 51.4700], "transport");
                            addLocation("londongateway", "London Gateway Port", [0.4822, 51.5067], "port");
                            addLocation("tilbury", "Port of Tilbury", [0.3555, 51.4622], "port");
                            addLocation("citylondonairport", "London City Airport", [0.0484, 51.5048], "transport");
                            addLocation("stpancras", "St Pancras International", [-0.1254, 51.5304], "transport");

                            // Add these locations before calling connectLocations
                            addLocation("hydeparkcorner", "Hyde Park Corner", [-0.1529, 51.5026], "metro");
                            addLocation("bondstreet", "Bond Street", [-0.1491, 51.5142], "metro");
                            addLocation("knightsbridge", "Knightsbridge", [-0.1603, 51.5016], "metro");
                            addLocation("nottinghill", "Notting Hill", [-0.1967, 51.5094], "metro");
                            addLocation("liverpool", "Liverpool Street", [-0.0823, 51.5178], "metro");
                            addLocation("queensway", "Queensway", [-0.1874, 51.5107], "metro");
                            addLocation("lancastergate", "Lancaster Gate", [-0.1756, 51.5119], "metro");
                            addLocation("greenpark", "Green Park", [-0.1428, 51.5067], "metro");
                            addLocation("regentspark", "Regent's Park", [-0.1466, 51.5258], "metro");
                            addLocation("marblearch", "Marble Arch", [-0.1589, 51.5136], "metro");
                            addLocation("tottenhamcourt", "Tottenham Court Road", [-0.1298, 51.5165], "metro");
                            addLocation("canarywharf", "Canary Wharf", [-0.0196, 51.5054], "metro");
                            addLocation("canarywharfpier", "Canary Wharf Pier", [-0.0287, 51.5053], "pier");
                            
                            // Connect landmarks to nearby transit
                            connectLocations("mi6hq", "westminster");
                            connectLocations("towerhill", "towerpier");
                            connectLocations("westminsterabbey", "westminster");
                            connectLocations("parliamenthouse", "westminster");
                            connectLocations("buckinghampalace", "victoriastation");
                            connectLocations("londoneye", "londoneyepier");
                            connectLocations("stpauls", "bank");
                            connectLocations("trafalgarsquare", "embankment");
                            connectLocations("britishmuseum", "oxfordcircus");
                            connectLocations("shard", "londonbridge");
                            connectLocations("tatemodern", "londonbridge");
                            connectLocations("gherkin", "bank");
                            connectLocations("shakespeareglobe", "londonbridgepier");
                            connectLocations("nationalgallery", "embankment");
                            connectLocations("hydepark", "piccadillycircus");
                            
                            // Connect metro stations (tube lines)
                            connectLocations("westminster", "embankment");
                            connectLocations("embankment", "piccadillycircus");
                            connectLocations("piccadillycircus", "oxfordcircus");
                            connectLocations("oxfordcircus", "kingscross");
                            connectLocations("waterloo", "embankment");
                            connectLocations("londonbridge", "bank");
                            connectLocations("victoriastation", "westminster");
                            connectLocations("bakerstreet", "oxfordcircus");
                            
                            // Connect piers along the river
                            connectLocations("westminsterpier", "londoneyepier");
                            connectLocations("londoneyepier", "embankmentpier");
                            connectLocations("embankmentpier", "londonbridgepier");
                            connectLocations("londonbridgepier", "towerpier");
                            connectLocations("stgeorgeswharf", "westminsterpier");
                            connectLocations("westminsterpier", "londoneyepier");
                    
                        
                            
                            // Connect embassies to the network
                            connectLocations("russianembassy", "piccadillycircus");
                            connectLocations("chineseembassy", "oxfordcircus");
                            connectLocations("frenchembassy", "piccadillycircus");
                            connectLocations("germanembassy", "victoriastation");
                            connectLocations("usembassy", "westminster");
                            
                            // Connect piers to nearby metro stations (fix for pier access)
                            connectLocations("westminsterpier", "westminster");
                            connectLocations("embankmentpier", "embankment");
                            connectLocations("londoneyepier", "waterloo");
                            connectLocations("towerpier", "bank");
                            connectLocations("londonbridgepier", "londonbridge");

                            // Connect hotels to nearest transit/landmarks
                            connectLocations("dorchester", "hydeparkcorner");
                            connectLocations("connaught", "bondstreet");
                            connectLocations("langham", "oxfordcircus");
                            connectLocations("shangri", "londonbridge");
                            connectLocations("mandarinoriental", "knightsbridge");

                            // Connect restaurants to nearby locations
                            connectLocations("gordon", "westminster");
                            connectLocations("ledbury", "nottinghill");
                            connectLocations("ducasse", "dorchester");
                            connectLocations("sketch", "oxfordcircus");
                            connectLocations("clove", "liverpool");

                            // Connect new metro stations to the network
                            connectLocations("kingscross", "stpancras");
                            connectLocations("kingscross", "eustonstation");
                            connectLocations("paddington", "queensway");
                            connectLocations("paddington", "lancastergate");
                            connectLocations("victoriastation", "greenpark");
                            connectLocations("victoriastation", "westminster");
                            connectLocations("bakerstreet", "regentspark");
                            connectLocations("bakerstreet", "marblearch");
                            connectLocations("eustonstation", "kingscross");
                            connectLocations("eustonstation", "tottenhamcourt");

                            // Connect major transport hubs
                            connectLocations("heathrow", "paddington"); // Heathrow Express connection
                            connectLocations("stpancras", "kingscross");
                            connectLocations("citylondonairport", "canarywharf");
                            connectLocations("londongateway", "tilbury"); // Connect the ports to each other
                            connectLocations("tilbury", "canarywharf"); // Connect Tilbury to the DLR network at Canary Wharf
                            connectLocations("londongateway", "citylondonairport"); // Connect Gateway to City Airport

                            // Additional strategic connections for new locations
                            connectLocations("stpancras", "britishmuseum");
                            connectLocations("citylondonairport", "canarywharfpier");
                            connectLocations("victoriastation", "buckinghampalace");
                            connectLocations("bakerstreet", "regentspark");
                            connectLocations("liverpool", "bank"); // Connect Liverpool St to Bank station
                            connectLocations("liverpool", "kingscross"); // Connect to King's Cross
                            connectLocations("liverpool", "gherkin"); // Connect to the Gherkin
                            connectLocations("canarywharf", "bank"); // Connect Canary Wharf to Bank
                            connectLocations("tilbury", "canarywharf"); // Ensure Tilbury connects properly
                            connectLocations("londongateway", "tilbury"); // Ensure Gateway connects properly
                            connectLocations("kingscross", "oxfordcircus"); // Connect major tube stations
                            connectLocations("bank", "londonbridge"); // Connect major stations in the City
                            connectLocations("liverpool", "stpauls"); // Connect Liverpool St to St Paul's
                            connectLocations("connaught", "oxfordcircus"); // Connect The Connaught to Oxford Circus directly
                            connectLocations("connaught", "regentspark"); // Add second connection for redundancy
                            connectLocations("dorchester", "buckinghampalace"); // Connect Dorchester to Buckingham Palace
                            connectLocations("shangri", "tatemodern"); // Connect Shangri-La to Tate Modern
                            
                            // Add these connections to fix unreachable locations
                            connectLocations("knightsbridge", "hydeparkcorner");
                            connectLocations("knightsbridge", "greenpark");
                            connectLocations("knightsbridge", "hydepark");
                            connectLocations("mandarinoriental", "knightsbridge");
                            connectLocations("mandarinoriental", "hydeparkcorner");
                            connectLocations("mandarinoriental", "hydepark");

                            // Fix Bond Street connections
                            connectLocations("bondstreet", "oxfordcircus"); // Connect Bond Street to Oxford Circus
                            connectLocations("bondstreet", "piccadillycircus"); // Connect Bond Street to Piccadilly Circus
                            connectLocations("bondstreet", "greenpark"); // Connect to Green Park

                            // Restaurants
                            connectLocations("gordon", "victoriastation"); // Connect Gordon Ramsay restaurant to Victoria Station
                            connectLocations("ledbury", "hydeparkcorner"); // Connect The Ledbury to Hyde Park Corner
                            connectLocations("sketch", "kingscross"); // Connect Sketch to Kings Cross

                            // Better connect outer London
                            connectLocations("heathrow", "londongateway"); // Create an additional path for Heathrow
                            connectLocations("citylondonairport", "bank"); // Add additional connection for City Airport
                            
                            // Additional connections to ensure the network is well-connected
                            connectLocations("mi6hq", "westminsterpier");
                            connectLocations("canarywharf", "canarywharfpier");
                            connectLocations("bank", "canarywharfpier");
                            connectLocations("londonbridge", "canarywharfpier");
                            
                            // Add connections to our UI dropdowns
                            const mi6Select = document.getElementById("mi6-destination");
                            
                            // Sort locations by name for the dropdown
                            const locationIds = Object.keys(allLocations);
                            locationIds.sort((a, b) => allLocations[a].name.localeCompare(allLocations[b].name));
                            
                            for (const locId of locationIds) {
                                const loc = allLocations[locId];
                                
                                // Create option
                                const option = document.createElement("option");
                                option.value = locId;
                                option.textContent = loc.name;
                                mi6Select.appendChild(option);
                            }
                            
                            setTimeout(() => checkLocationConnectivity(), 2000); // Delay to ensure map is loaded
                            setTimeout(() => {
                                debugLocation("connaught");
                                verifyAllPaths();
                            }, 2000);
                        }

                        // Connect locations in the graph (bidirectional)
                        function connectLocations(loc1, loc2) {
                            if (!locationGraph[loc1]) {
                                console.error(`Cannot connect locations: '${loc1}' does not exist`);
                                return;
                            }
                            
                            if (!locationGraph[loc2]) {
                                console.error(`Cannot connect locations: '${loc2}' does not exist`);
                                return;
                            }
                            
                            // Create bidirectional connection
                            if (!locationGraph[loc1].includes(loc2)) {
                                locationGraph[loc1].push(loc2);
                            }
                            
                            if (!locationGraph[loc2].includes(loc1)) {
                                locationGraph[loc2].push(loc1);
                            }
                        }

                        // Debug code to verify the Connaught's ID and connections
                        function debugLocation(locationName) {
                            console.log(`Debugging location: ${locationName}`);
                            
                            // Find IDs that might match this location
                            const matchingIds = Object.keys(allLocations).filter(id => 
                                allLocations[id].name.toLowerCase().includes(locationName.toLowerCase())
                            );
                            
                            console.log(`Found ${matchingIds.length} possible matches:`);
                            
                            matchingIds.forEach(id => {
                                console.log(`ID: "${id}" - Name: "${allLocations[id].name}"`);
                                console.log(`Type: ${allLocations[id].type}`);
                                console.log(`Coordinates: [${allLocations[id].coordinates}]`);
                                console.log(`Connected to: ${locationGraph[id].map(connId => 
                                    `${connId} (${allLocations[connId]?.name || "Unknown"})`
                                ).join(', ')}`);
                                console.log('---');
                            });
                            
                            return matchingIds;
                        }

                        function verifyAllPaths() {
                            const mi6Select = document.getElementById("mi6-destination");
                            const unreachableOptions = [];
                            
                            // Check each option in the dropdown
                            for (let i = 0; i < mi6Select.options.length; i++) {
                                const option = mi6Select.options[i];
                                if (!option.value) continue; // Skip empty option
                                
                                const path = findPath("mi6hq", option.value);
                                if (!path) {
                                    unreachableOptions.push({
                                        id: option.value,
                                        name: option.textContent
                                    });
                                }
                            }
                            
                            // Display results
                            if (unreachableOptions.length === 0) {
                                console.log("✅ All destinations in the dropdown are reachable!");
                                return true;
                            } else {
                                console.log(`❌ Found ${unreachableOptions.length} unreachable destinations:`);
                                unreachableOptions.forEach(loc => {
                                    console.log(`- ${loc.name} (${loc.id})`);
                                });
                                return unreachableOptions;
                            }
                        }

                        // Add this function to help detect isolated locations in the future:
                        function checkLocationConnectivity() {
                            console.log("Checking location connectivity...");
                            
                            // Start from MI6 HQ
                            const startLoc = "mi6hq";
                            const unreachableLocations = [];
                            
                            // Check each location for reachability from MI6 HQ
                            for (const locId in allLocations) {
                                if (locId === startLoc) continue;
                                
                                // Try to find a path
                                const path = findPath(startLoc, locId);
                                
                                if (!path) {
                                    unreachableLocations.push({
                                        id: locId,
                                        name: allLocations[locId].name,
                                        connections: locationGraph[locId]
                                    });
                                }
                            }
                            
                            // Report results
                            if (unreachableLocations.length === 0) {
                                console.log("All locations are reachable from MI6 HQ!");
                            } else {
                                console.log(`Found ${unreachableLocations.length} unreachable locations:`);
                                unreachableLocations.forEach(loc => {
                                    console.log(`${loc.name} (${loc.id}) - Connected to: ${loc.connections.map(id => allLocations[id]?.name || id).join(', ')}`);
                                });
                            }
                            
                            return unreachableLocations;
                        }
                        // =============================================================================
                        // SEARCH AND LOCATION UTILITIES
                        // =============================================================================

                        // Perform search for landmarks
                        function performSearch(query) {
                            // Clear existing markers
                            clearPOIMarkers();
                            
                            // Clear any active popups first
                            if (activePopup && activePopup.isOpen()) {
                                activePopup.remove();
                                activePopup = null;
                            }
                            
                            if (!query || query.trim() === "") {
                                showNotification("Please enter a search term");
                                return;
                            }
                            
                            // Find matching landmarks
                            const normalizedQuery = query.trim().toLowerCase();
                            const matches = Object.keys(allLocations).filter(id => 
                                allLocations[id].name.toLowerCase().includes(normalizedQuery)
                            ).map(id => allLocations[id]);
                            
                            if (matches.length === 0) {
                                showNotification("No matching landmarks found. Try a different search term");
                                return;
                            }
                            
                            // Add markers for matches
                            matches.forEach(landmark => {
                                // Add marker to map
                                addPOIMarker({
                                    id: landmark.id,
                                    name: landmark.name,
                                    coordinates: landmark.coordinates,
                                    type: landmark.type
                                });
                            });
                            
                            // Create bounds to fit all results
                            const bounds = new mapboxgl.LngLatBounds();
                            matches.forEach(landmark => {
                                bounds.extend(landmark.coordinates);
                            });
                            
                            // Get current viewport dimensions before changing the map view
                            const currentViewportHeight = window.innerHeight;
                            
                            // Use padding to keep UI elements visible
                            const padding = {
                                top: 80,      // Space for top navbar
                                bottom: 80,   // Space for bottom control panel
                                left: 50,
                                right: 50
                            };
                            
                            // Use fitBounds with padding and controlled zoom level
                            map.fitBounds(bounds, {
                                padding: padding,
                                maxZoom: 16,  // Limit maximum zoom level
                                duration: 1000,
                                essential: true // Mark as essential to ensure it happens
                            });
                            
                            // After the map move completes, check if the viewport size changed and fix it
                            map.once('moveend', () => {
                                // Check if viewport height changed
                                if (window.innerHeight !== currentViewportHeight) {
                                    console.log("Detected viewport height change, fixing...");
                                    
                                    // Force layout recalculation
                                    document.body.style.height = "100vh";
                                    document.body.style.overflow = "hidden";
                                    
                                    // Fix map container
                                    const mapContainer = document.getElementById("map");
                                    if (mapContainer) {
                                        mapContainer.style.height = "100%";
                                    }
                                    
                                    // Force window resize event to make map redraw correctly
                                    window.dispatchEvent(new Event('resize'));
                                }
                            });
                            
                            // Show notification
                            showNotification(`Found ${matches.length} landmark${matches.length !== 1 ? 's' : ''}`);
                            
                            // Clear the search field
                            document.getElementById("poi-search").value = "";
                        }

                        function setupSearchListeners() {
                            console.log("Setting up search listeners");
                            
                            const searchButton = document.getElementById("search-button");
                            const searchInput = document.getElementById("poi-search");
                            
                            if (!searchButton || !searchInput) {
                                console.error("Search elements not found in the DOM");
                                return;
                            }
                            
                            // Remove any existing listeners by cloning the elements
                            const newSearchButton = searchButton.cloneNode(true);
                            searchButton.parentNode.replaceChild(newSearchButton, searchButton);
                            
                            const newSearchInput = searchInput.cloneNode(true);
                            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                            
                            // Add click listener to search button
                            newSearchButton.addEventListener("click", () => {
                                const query = newSearchInput.value.trim();
                                if (query.length > 0) {
                                    performSearch(query);
                                } else {
                                    showNotification("Please enter a search term");
                                }
                            });
                            
                            // Add key press listener for Enter key
                            newSearchInput.addEventListener("keypress", (e) => {
                                if (e.key === "Enter") {
                                    const query = newSearchInput.value.trim();
                                    if (query.length > 0) {
                                        performSearch(query);
                                    } else {
                                        showNotification("Please enter a search term");
                                    }
                                }
                            });
                            
                            console.log("Search listeners set up successfully");
                        }

                        function setupEnhancedSearchListeners() {
                            // Setup POI search
                            const searchButton = document.getElementById("search-button");
                            const searchInput = document.getElementById("poi-search");
                            
                            if (searchButton && searchInput) {
                                // Remove any existing listeners
                                const newSearchButton = searchButton.cloneNode(true);
                                searchButton.parentNode.replaceChild(newSearchButton, searchButton);
                                
                                const newSearchInput = searchInput.cloneNode(true);
                                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                                
                                // Add new event listeners
                                newSearchButton.addEventListener("click", () => {
                                    const query = newSearchInput.value.trim();
                                    if (query.length > 0) {
                                        performSearch(query);
                                    } else {
                                        showNotification("Please enter a search term");
                                    }
                                });
                                
                                newSearchInput.addEventListener("keypress", (e) => {
                                    if (e.key === "Enter") {
                                        const query = newSearchInput.value.trim();
                                        if (query.length > 0) {
                                            performSearch(query);
                                        } else {
                                            showNotification("Please enter a search term");
                                        }
                                    }
                                });
                                
                                console.log("Enhanced search listeners set up");
                            }
                        }

                        // Get location name from coordinates using reverse geocoding
                        async function reverseGeocode(coordinates) {
                            try {
                                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?access_token=${mapboxgl.accessToken}&types=poi,address&limit=1`;
                                
                                const response = await fetch(url);
                                const data = await response.json();
                                
                                let locationName = "Custom Location";
                                
                                if (data.features && data.features.length > 0) {
                                    locationName = data.features[0].text || data.features[0].place_name || "Custom Location";
                                }
                                
                                // Create a custom POI
                                const poiId = `custom-${Date.now()}`;
                                
                                // Add marker for the custom location (passing true for isTemporary)
                                addPOIMarker({
                                    id: poiId,
                                    name: locationName,
                                    coordinates: coordinates,
                                    type: "poi"
                                }, true);
                                
                                // Auto-open popup
                                poiMarkers[poiMarkers.length - 1].togglePopup();
                                
                            } catch (error) {
                                console.error("Error in reverse geocoding:", error);
                                showNotification("Error getting location information");
                            }
                        }

                        // Add a POI marker to the map
                        function addPOIMarker(poiData, isTemporary = false) {
                            // Close any active popups first to avoid multiple popups
                            if (activePopup) {
                                activePopup.remove();
                                activePopup = null;
                            }
                            
                            // Select icon based on category
                            const icons = {
                                landmark: "🏛️",
                                museum: "🏛️",
                                theatre: "🎭",
                                shopping: "🛍️",
                                attraction: "🎡",
                                park: "🌳",
                                hotel: "🏨",
                                restaurant: "🍽️",
                                transport: "✈️",
                                port: "🚢",
                                metro: "🚇",
                                poi: "📍"
                            };
                            
                            const icon = icons[poiData.type] || "📍";
                            
                            // Create marker element
                            const el = document.createElement("div");
                            el.className = "poi-marker";
                            el.textContent = icon;
                            
                            // Create popup with the content
                            const popup = new mapboxgl.Popup({ 
                                closeButton: true,
                                className: 'transparent-popup',
                                offset: [0, -15],
                                closeOnClick: false
                            });
                            
                            // Create and add marker
                            const marker = new mapboxgl.Marker({
                                element: el,
                                anchor: "bottom"
                            })
                            .setLngLat(poiData.coordinates)
                            .addTo(map);
                            
                            // Set popup content
                            popup.setHTML(`
                                <h3>${poiData.name}</h3>
                                <p>${(poiData.type || "location").charAt(0).toUpperCase() + (poiData.type || "location").slice(1)}</p>
                                <div class="popup-actions">
                                    <button id="send-mi6-${poiData.id}" class="send-mi6">Send MI6 Agent</button>
                                    <button id="reveal-${poiData.id}" class="reveal-location">Reveal Exact Location</button>
                                </div>
                            `);
                            
                            // Store POI data with marker
                            marker.poiData = poiData;
                            marker.setPopup(popup);
                            
                            // Add event listeners after popup is added to DOM
                            popup.on('open', () => {
                                // Set this as the active popup
                                activePopup = popup;
                                
                                // Get popup element
                                const popupElement = popup.getElement();
                                
                                // Add event listeners after a brief delay to ensure DOM is ready
                                setTimeout(() => {
                                    const sendButton = popupElement.querySelector(`#send-mi6-${poiData.id}`);
                                    if (sendButton) {
                                        sendButton.onclick = function(e) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            console.log(`Send MI6 button clicked for ${poiData.name}`);
                                            
                                            // Explicitly log POI data to verify it's correct
                                            console.log("POI data:", {
                                                id: poiData.id,
                                                name: poiData.name,
                                                coordinates: poiData.coordinates,
                                                type: poiData.type
                                            });
                                            
                                            // Use a timeout to avoid any race conditions
                                            setTimeout(() => {
                                                sendAgentToPOI("mi6", poiData);
                                            }, 50);
                                            
                                            popup.remove();
                                        };
                                    }
                                    
                                    const revealButton = popupElement.querySelector(`#reveal-${poiData.id}`);
                                    if (revealButton) {
                                        revealButton.onclick = function(e) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            // FIX FOR UI JUMPING: Get current view bounds before creating marker
                                            const currentBounds = map.getBounds();
                                            
                                            // Create a highlight marker at the exact location
                                            const exactMarker = new mapboxgl.Marker({
                                                color: "#ff0000", // Red color to distinguish
                                                draggable: false
                                            })
                                            .setLngLat(poiData.coordinates)
                                            .addTo(map);
                                            
                                            // Add pulse animation to make it noticeable
                                            const exactEl = exactMarker.getElement();
                                            exactEl.classList.add("highlight");
                                            
                                            // FIX: Use a more controlled fly-to that preserves vertical space
                                            // Instead of changing zoom dramatically, just center on the marker
                                            map.flyTo({
                                                center: poiData.coordinates,
                                                zoom: map.getZoom() < 16 ? 16 : map.getZoom(), // Don't zoom in too much
                                                duration: 1000,
                                                padding: {top: 100, bottom: 100, left: 50, right: 50} // Add padding to keep UI visible
                                            });
                                            
                                            // Show notification
                                            showNotification(`Exact location of ${poiData.name} revealed`);
                                            
                                            // Add to tracking so it can be cleared later
                                            poiMarkers.push(exactMarker);
                                            
                                            // Remove after 15 seconds
                                            setTimeout(() => {
                                                exactMarker.remove();
                                                const index = poiMarkers.indexOf(exactMarker);
                                                if (index > -1) {
                                                    poiMarkers.splice(index, 1);
                                                }
                                            }, 15000);
                                        };
                                    }
                                }, 100);
                            });
                            
                            // If this is a temporary marker from map click, remove it after delay
                            if (isTemporary) {
                                setTimeout(() => {
                                    marker.remove();
                                    // Also remove from poiMarkers array
                                    const index = poiMarkers.indexOf(marker);
                                    if (index > -1) {
                                        poiMarkers.splice(index, 1);
                                    }
                                }, 10000); // Remove after 10 seconds
                            }
                            
                            // Store marker for management
                            poiMarkers.push(marker);
                            return marker;
                        }

                        // Clear all POI markers
                        function clearPOIMarkers() {
                            poiMarkers.forEach(marker => marker.remove());
                            poiMarkers = [];
                        }

                        // Send agent to POI
                        function sendAgentToPOI(agentId, poiData) {
                            // Make sure we close any open popups
                            if (activePopup) {
                                activePopup.remove();
                                activePopup = null;
                            }
                            
                            console.log(`Attempting to send ${agentId} to ${poiData.name} (${poiData.id})`);
                            
                            // Check if location already exists in system
                            if (!allLocations[poiData.id]) {
                                console.log(`Adding new location ${poiData.id} to the system`);
                                
                                // Add to locations
                                allLocations[poiData.id] = {
                                    id: poiData.id,
                                    name: poiData.name,
                                    coordinates: poiData.coordinates,
                                    type: poiData.type || "poi" // Ensure type exists
                                };
                                
                                // Initialize connections
                                locationGraph[poiData.id] = [];
                                
                                // Connect to nearest locations
                                const nearestLocations = [];
                                
                                for (const locId in allLocations) {
                                    if (locId === poiData.id) continue;
                                    
                                    const distance = calculateDistance(
                                        poiData.coordinates,
                                        allLocations[locId].coordinates
                                    );
                                    
                                    nearestLocations.push({ locId, distance });
                                }
                                
                                // Sort by distance
                                nearestLocations.sort((a, b) => a.distance - b.distance);
                                
                                // Connect to at least 3 closest locations to ensure reachability
                                const connectCount = Math.min(3, nearestLocations.length);
                                console.log(`Connecting to ${connectCount} nearest locations`);
                                for (let i = 0; i < connectCount; i++) {
                                    const { locId } = nearestLocations[i];
                                    
                                    // Add bidirectional connection
                                    locationGraph[poiData.id].push(locId);
                                    locationGraph[locId].push(poiData.id);
                                    
                                    console.log(`Connected ${poiData.id} to ${locId} (${allLocations[locId].name})`);
                                }
                                
                                // CRITICAL: Ensure the location is reachable from agent's current position
                                // Connect directly to agent's current location if there's no path
                                const agentCurrentLocation = agents[agentId].location;
                                const testPath = findPath(agentCurrentLocation, poiData.id);
                                
                                if (!testPath) {
                                    console.log(`No path found from ${agentCurrentLocation} to ${poiData.id}. Creating direct connection.`);
                                    // Force a direct connection
                                    locationGraph[poiData.id].push(agentCurrentLocation);
                                    locationGraph[agentCurrentLocation].push(poiData.id);
                                }
                            } else {
                                console.log(`Location ${poiData.id} already exists in system`);
                            }
                            
                            // Ensure MI6 agent can reach the location 
                            const startLocation = agents[agentId].location;
                            const path = findPath(startLocation, poiData.id);
                            
                            if (!path) {
                                console.error(`No path found from ${startLocation} to ${poiData.id}`);
                                showNotification(`Cannot find a path to ${poiData.name}. Try moving closer first.`);
                                return;
                            }
                            
                            console.log(`Path found from ${startLocation} to ${poiData.id}:`, path);
                            
                            // Move agent to this location
                            moveAgent(agentId, poiData.id);
                            
                            showNotification(`Sending ${agentId.toUpperCase()} agent to ${poiData.name}`);
                        }

                        function initializeSearch() {
                            // Apply UI fixes for search
                            applySearchUIFixes();
                            
                            // Set up event listeners for search
                            setupSearchListeners();
                            
                            // Force a resize to ensure correct layout
                            if (map && typeof map.resize === 'function') {
                                setTimeout(() => {
                                    map.resize();
                                    console.log("Map resized during search initialization");
                                }, 500);
                            }
                        }
                   