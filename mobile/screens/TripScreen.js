import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, Alert,
  ScrollView, StatusBar, BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { io } from "socket.io-client";
import { WebView } from "react-native-webview";
import * as tripService from "../services/tripService";
import s, { COLORS } from "../components/styles";
import { CITY_COORDS } from "../services/coords";
import {
  API_URL,
  getMyBus,
  getPickupRequests,
  updatePickupRequestStatus,
  updateTripSettings
} from "../services/api";

export default function TripScreen({ route, navigation }) {
  const { busId } = route.params;
  const [trip, setTrip] = useState(tripService.getState());
  const [bus, setBus] = useState(null);

  // Smart Capacity & Request States
  const [isFull, setIsFull] = useState(false);
  const [acceptingRequests, setAcceptingRequests] = useState(true);
  const [occupancy, setOccupancy] = useState(0);
  const [requests, setRequests] = useState([]);
  const [selectedStopName, setSelectedStopName] = useState(null);

  const webviewRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Send data updates to WebView when ready
  useEffect(() => {
    if (mapReady && webviewRef.current && trip.running) {
      const busPosData = bus?.currentLocation?.latitude && bus?.currentLocation?.longitude
        ? [bus.currentLocation.latitude, bus.currentLocation.longitude]
        : null;

      const passengerRequestsData = requests
        .filter(r => ["sent", "accepted", "approaching", "arrived"].includes(r.status))
        .map(r => ({
          latitude: r.latitude,
          longitude: r.longitude,
          status: r.status,
          stopName: r.stopName,
          passengerId: r.passengerId
        }));

      webviewRef.current.postMessage(JSON.stringify({
        type: 'UPDATE_DATA',
        busPos: busPosData,
        passengers: passengerRequestsData
      }));
    }
  }, [mapReady, bus, requests, trip.running]);

  // Reset mapReady when trip stops running
  useEffect(() => {
    if (!trip.running) {
      setMapReady(false);
    }
  }, [trip.running]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'READY') {
        setMapReady(true);
      }
    } catch (err) {
      console.warn("[NOVA] WebView message parsing failed", err);
    }
  };

  // Subscribe to global trip state
  useEffect(() => {
    const unsub = tripService.subscribe(setTrip);
    return unsub;
  }, []);

  // Hide back button in header and disable gestures when trip is running
  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: !trip.running,
      gestureEnabled: !trip.running,
    });
  }, [navigation, trip.running]);

  // Intercept all forms of navigation/back actions while trip is active
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      if (trip.running) {
        e.preventDefault();
        Alert.alert(
          "Trip is active",
          "Please stop the trip before leaving this screen."
        );
      }
    });
    return unsub;
  }, [navigation, trip.running]);

  // Intercept Android hardware back while trip is active
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (tripService.getState().running) {
          Alert.alert(
            "Trip is active",
            "Please stop the trip before leaving this screen."
          );
          return true; // prevent default back action
        }
        return false;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [navigation])
  );

  // Fetch initial bus details and requests
  const loadBusAndRequests = useCallback(async () => {
    try {
      const b = await getMyBus();
      setBus(b);
      if (b) {
        setIsFull(b.isFull || false);
        setAcceptingRequests(b.acceptingRequests !== false);
        setOccupancy(b.occupancy || 0);
      }

      const reqs = await getPickupRequests(busId);
      setRequests(reqs);
    } catch (e) {
      console.warn("[NOVA] Failed to load data", e.message);
    }
  }, [busId]);

  useFocusEffect(
    useCallback(() => {
      loadBusAndRequests();
    }, [loadBusAndRequests])
  );

  // Real-time socket sync
  useEffect(() => {
    const socketUrl = API_URL.replace("/api", "");
    const socket = io(socketUrl);

    socket.on("pickupRequestUpdate", (data) => {
      if (data.busId === busId) {
        // Reload all requests
        getPickupRequests(busId).then(setRequests).catch(console.error);
      }
    });

    socket.on("busLocationUpdate", (updatedBus) => {
       if (updatedBus._id === busId) {
         setBus(updatedBus);
         setIsFull(updatedBus.isFull || false);
         setAcceptingRequests(updatedBus.acceptingRequests !== false);
         setOccupancy(updatedBus.occupancy || 0);
       }
     });

    return () => {
      socket.disconnect();
    };
  }, [busId]);

  // Capacity modifications
  const toggleFull = async () => {
    try {
      const nextFull = !isFull;
      const updated = await updateTripSettings(busId, {
        isFull: nextFull,
        acceptingRequests: !nextFull
      });
      setIsFull(updated.isFull);
      setAcceptingRequests(updated.acceptingRequests);
    } catch (err) {
      Alert.alert("Error", "Failed to update bus capacity status");
    }
  };

  // Request updates
  const handleUpdateStatus = async (requestId, status) => {
    try {
      await updatePickupRequestStatus(busId, requestId, status);
      const reqs = await getPickupRequests(busId);
      setRequests(reqs);
    } catch (err) {
      Alert.alert("Error", "Failed to update request status");
    }
  };

  // Route stops extraction with coordinates (stable on bus route)
  const routeWaypointsCoords = useMemo(() => {
    if (!bus || !bus.routeId) return [];
    const r = bus.routeId;
    const points = [];
    
    const srcCoord = CITY_COORDS[r.source];
    if (srcCoord) points.push({ name: r.source, coord: srcCoord, type: "endpoint" });

    if (r.stops) {
      for (const stop of r.stops) {
        const coord = CITY_COORDS[stop];
        if (coord) points.push({ name: stop, coord, type: "stop" });
      }
    }

    const dstCoord = CITY_COORDS[r.destination];
    if (dstCoord) points.push({ name: r.destination, coord: dstCoord, type: "endpoint" });

    return points;
  }, [bus?.routeId?._id]);

  // Route stops extraction (names only)
  const routeWaypoints = useMemo(() => {
    return routeWaypointsCoords.map(wp => wp.name);
  }, [routeWaypointsCoords]);

  // Generate Map HTML containing Leaflet (reloads only if route changes)
  const routeIdStr = bus?.routeId?._id || "";
  const mapHtml = useMemo(() => {
    const waypointsData = routeWaypointsCoords.map(wp => ({
      name: wp.name,
      coord: wp.coord,
      type: wp.type
    }));

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #ffffff; }
          .stop-icon {
            width: 12px; height: 12px; border-radius: 50%;
            background: #d97706; border: 2.5px solid #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          }
          .endpoint-icon {
            width: 16px; height: 16px; border-radius: 50%;
            background: #0d9488; border: 3px solid #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          }
          .bus-icon {
            width: 32px; height: 32px; border-radius: 50%;
            background: #7B2CBF; border: 3px solid #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px;
          }
          .passenger-icon {
            width: 24px; height: 24px; border-radius: 50%;
            background: #f97316; border: 2.5px solid #fff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map').setView([31.1471, 75.3412], 8);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO'
          }).addTo(map);

          var routePoints = ${JSON.stringify(waypointsData)};

          // Draw route path (light color)
          if (routePoints.length > 1) {
            var coords = routePoints.map(function(wp) { return wp.coord; });
            L.polyline(coords, {
              color: '#cbd5e1', // Light slate gray
              weight: 5,
              opacity: 0.8
            }).addTo(map);

            // Add route stops
            routePoints.forEach(function(wp) {
              var iconHtml = wp.type === 'endpoint' 
                ? '<div class="endpoint-icon"></div>' 
                : '<div class="stop-icon"></div>';
              
              var icon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: wp.type === 'endpoint' ? [16, 16] : [12, 12],
                iconAnchor: wp.type === 'endpoint' ? [8, 8] : [6, 6]
              });

              L.marker(wp.coord, { icon: icon })
                .bindPopup('<b>' + wp.name + '</b><br/>' + (wp.type === 'endpoint' ? 'Endpoint' : 'Bus Stop'))
                .addTo(map);
            });
          }

          var busMarker = null;
          var passengerMarkers = {};
          var hasFittedBounds = false;

          function updateData(busPos, passengers) {
            // Update Bus location
            if (busPos) {
              if (!busMarker) {
                var busIcon = L.divIcon({
                  html: '<div class="bus-icon">🚌</div>',
                  className: '',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                });
                busMarker = L.marker(busPos, { icon: busIcon })
                  .bindPopup('<b>Your Bus Location</b>')
                  .addTo(map);
              } else {
                busMarker.setLatLng(busPos);
              }
            }

            // Update Passenger requests
            var currentIds = passengers.map(function(p) { return p.passengerId; });
            // Remove old ones
            for (var id in passengerMarkers) {
              if (currentIds.indexOf(id) === -1) {
                map.removeLayer(passengerMarkers[id]);
                delete passengerMarkers[id];
              }
            }
            // Add/update new ones
            passengers.forEach(function(p) {
              if (p.latitude && p.longitude) {
                var latLng = [p.latitude, p.longitude];
                if (!passengerMarkers[p.passengerId]) {
                  var passIcon = L.divIcon({
                    html: '<div class="passenger-icon">🧍</div>',
                    className: '',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });
                  passengerMarkers[p.passengerId] = L.marker(latLng, { icon: passIcon })
                    .bindPopup('<b>Passenger Pickup Request</b><br/>Stop: ' + p.stopName + '<br/>Status: ' + p.status)
                    .addTo(map);
                } else {
                  passengerMarkers[p.passengerId].setLatLng(latLng);
                  passengerMarkers[p.passengerId].setPopupContent('<b>Passenger Pickup Request</b><br/>Stop: ' + p.stopName + '<br/>Status: ' + p.status);
                }
              }
            });

            // fitBounds on first valid data load
            if (!hasFittedBounds) {
              var allLatLngs = [];
              if (routePoints.length > 0) {
                routePoints.forEach(function(wp) { allLatLngs.push(wp.coord); });
              }
              if (busPos) {
                allLatLngs.push(busPos);
              }
              passengers.forEach(function(p) {
                if (p.latitude && p.longitude) {
                  allLatLngs.push([p.latitude, p.longitude]);
                }
              });

              if (allLatLngs.length > 0) {
                map.fitBounds(allLatLngs, { padding: [30, 30] });
                hasFittedBounds = true;
              }
            }
          }

          function handleMessage(event) {
            try {
              var data = JSON.parse(event.data);
              if (data.type === 'UPDATE_DATA') {
                updateData(data.busPos, data.passengers);
              }
            } catch (err) {
              // Log or handle error
            }
          }

          window.addEventListener('message', handleMessage);
          document.addEventListener('message', handleMessage); // for Android

          // Let React Native know WebView is ready
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
          }
        </script>
      </body>
      </html>
    `;
  }, [routeIdStr, routeWaypointsCoords]);

  // Request grouping by stop
  const requestsByStop = useMemo(() => {
    const map = {};
    for (const req of requests) {
      if (["sent", "accepted", "approaching", "arrived"].includes(req.status)) {
        if (!map[req.stopName]) map[req.stopName] = [];
        map[req.stopName].push(req);
      }
    }
    return map;
  }, [requests]);

  // Total active request counts
  const totalActiveRequests = useMemo(() => {
    return requests.filter(r => ["sent", "accepted", "approaching", "arrived"].includes(r.status)).length;
  }, [requests]);

  const onStart = async () => {
    try {
      await tripService.startTrip(busId);
    } catch (e) {
      Alert.alert("Failed to start trip", e.message);
    }
  };

  const onStop = () => {
    Alert.alert(
      "Stop trip?",
      "This will end the trip and stop location sharing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop trip",
          style: "destructive",
          onPress: () => tripService.stopTrip(),
        },
      ]
    );
  };

  const goToDashboard = () => {
    if (trip.running) {
      Alert.alert(
        "Trip is still running",
        "Your trip will continue in the background. Go to dashboard?",
        [
          { text: "Stay here", style: "cancel" },
          { text: "Go to dashboard", onPress: () => navigation.navigate("Dashboard") },
        ]
      );
    } else {
      navigation.navigate("Dashboard");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <Text style={[s.title, { textAlign: "center" }]}>
        {trip.running ? "Trip in progress" : "Trip stopped"}
      </Text>
      <Text style={[s.muted, { textAlign: "center", marginBottom: 20 }]}>
        {trip.running
          ? "Location shared every 10 s — works in background & when screen is off"
          : "Start your trip to begin sharing location"}
      </Text>

      {/* ── Status and Stats Counters ── */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0, padding: 16 }]}>
          <Text style={[s.statValue, { fontSize: 28 }]}>{trip.sendCount}</Text>
          <Text style={[s.statLabel, { fontSize: 11 }]}>Pings sent</Text>
        </View>
        <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0, padding: 16 }]}>
          <Text style={[s.statValue, { fontSize: 28, color: COLORS.coral }]}>{totalActiveRequests}</Text>
          <Text style={[s.statLabel, { fontSize: 11 }]}>Requests</Text>
        </View>
        <View style={[s.card, { flex: 1, alignItems: "center", marginBottom: 0, padding: 16 }]}>
          <View
            style={[
              s.badge,
              {
                backgroundColor: trip.running ? COLORS.greenLight : COLORS.redLight,
                marginBottom: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
              },
            ]}
          >
            <Text
              style={[
                s.badgeText,
                { color: trip.running ? COLORS.green : COLORS.red, fontSize: 10 },
              ]}
            >
              {trip.running ? "Active" : "Offline"}
            </Text>
          </View>
          <Text style={[s.statLabel, { fontSize: 11 }]}>Status</Text>
        </View>
      </View>

      {/* ── Bus Capacity Management Card ── */}
      {trip.running && (
        <View style={s.card}>
          <Text style={s.cardHeader}>Capacity Management</Text>
          <TouchableOpacity
            style={{
              backgroundColor: isFull ? COLORS.coral : COLORS.green,
              padding: 18,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: isFull ? COLORS.coral : COLORS.green,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.2,
              shadowRadius: 10,
              elevation: 4,
              marginTop: 4,
            }}
            onPress={toggleFull}
            activeOpacity={0.7}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.5 }}>
              {isFull ? "BUS IS FULL (REQUESTS PAUSED)" : "MARK BUS AS FULL"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Live Route & Request Map ── */}
      {trip.running && (
        <View style={[s.card, { height: 350, overflow: "hidden", padding: 0 }]}>
          <Text style={[s.cardHeader, { padding: 16, marginBottom: 0, paddingBottom: 8 }]}>Live Route & Pickup Map</Text>
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            domStorageEnabled={true}
            javaScriptEnabled={true}
            onMessage={handleWebViewMessage}
          />
        </View>
      )}

      {/* ── Active Route Map representation & Pickup Requests ── */}
      {trip.running && routeWaypoints.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardHeader}>Interactive Route Stop Progress</Text>
          <Text style={[s.muted, { marginBottom: 16, fontSize: 13 }]}>
            Stops with active pickup requests are highlighted in orange. Tap a stop to view details and accept/reject requests.
          </Text>

          <View style={{ paddingLeft: 20, borderLeftWidth: 3, borderLeftColor: COLORS.border, marginLeft: 10, marginVertical: 10 }}>
            {routeWaypoints.map((stopName, idx) => {
              const activeReqs = requestsByStop[stopName] || [];
              const count = activeReqs.length;
              const isSelected = selectedStopName === stopName;
              return (
                <View key={`stop-wrapper-${idx}`} style={{ marginBottom: 16 }}>
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      position: "relative",
                    }}
                    onPress={() => setSelectedStopName(isSelected ? null : stopName)}
                    activeOpacity={0.7}
                  >
                    {/* Visual Node Dot on vertical line */}
                    <View
                      style={{
                        position: "absolute",
                        left: -27,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: count > 0 ? COLORS.coral : COLORS.violet,
                        borderWidth: 3,
                        borderColor: "#fff",
                        shadowColor: count > 0 ? COLORS.coral : COLORS.violet,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 4,
                        elevation: 4,
                      }}
                    />
                    {/* Stop Information */}
                    <View style={{ flex: 1, paddingLeft: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: count > 0 ? COLORS.coral : COLORS.ink }}>
                        {stopName}
                      </Text>
                      {count > 0 && (
                        <Text style={{ fontSize: 12, color: COLORS.coral, fontWeight: "600", marginTop: 2 }}>
                          {count} passenger{count > 1 ? "s" : ""} waiting
                        </Text>
                      )}
                    </View>
                    {/* Badge */}
                    {count > 0 && (
                      <View style={[s.badge, { backgroundColor: COLORS.redLight }]}>
                        <Text style={[s.badgeText, { color: COLORS.coral, fontSize: 10 }]}>
                          {count} Waiting
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Render Stop-Specific Passenger Requests */}
                  {isSelected && (
                    <View style={{ marginTop: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: COLORS.borderStrong, marginLeft: 5 }}>
                      {count === 0 ? (
                        <Text style={{ color: COLORS.inkMuted, fontSize: 13, fontStyle: "italic" }}>
                          No active requests at this stop.
                        </Text>
                      ) : (
                        activeReqs.map((req, reqIdx) => (
                          <View key={`req-${reqIdx}`} style={{ paddingVertical: 10, borderTopWidth: reqIdx > 0 ? 1 : 0, borderTopColor: COLORS.border }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.inkSecondary }}>
                                Passenger #{req.passengerId.slice(-4).toUpperCase()}
                              </Text>
                              <View style={[s.badge, { backgroundColor: COLORS.blueLight, paddingHorizontal: 8, paddingVertical: 3 }]}>
                                <Text style={[s.badgeText, { color: COLORS.violet, fontSize: 9 }]}>
                                  {req.status.toUpperCase()}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                              {req.status === "sent" && (
                                <>
                                  <TouchableOpacity
                                    style={{ backgroundColor: COLORS.green, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                    onPress={() => handleUpdateStatus(req._id, "accepted")}
                                  >
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Accept</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={{ backgroundColor: COLORS.coral, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                    onPress={() => handleUpdateStatus(req._id, "rejected")}
                                  >
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Reject</Text>
                                  </TouchableOpacity>
                                </>
                              )}

                              {req.status === "accepted" && (
                                <TouchableOpacity
                                  style={{ backgroundColor: COLORS.amber, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                  onPress={() => handleUpdateStatus(req._id, "approaching")}
                                >
                                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Mark Approaching</Text>
                                </TouchableOpacity>
                              )}

                              {req.status === "approaching" && (
                                <TouchableOpacity
                                  style={{ backgroundColor: COLORS.green, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                  onPress={() => handleUpdateStatus(req._id, "arrived")}
                                >
                                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Mark Arrived</Text>
                                </TouchableOpacity>
                              )}

                              {req.status === "arrived" && (
                                <TouchableOpacity
                                  style={{ backgroundColor: COLORS.violet, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                                  onPress={() => handleUpdateStatus(req._id, "completed")}
                                >
                                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 11 }}>Pickup Completed</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Start / Stop controls ── */}
      {!trip.running ? (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: COLORS.green }]}
          onPress={onStart}
          activeOpacity={0.7}
        >
          <Text style={s.btnText}>Start trip</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.btn, s.btnDanger]}
          onPress={onStop}
          activeOpacity={0.7}
        >
          <Text style={s.btnText}>Stop trip</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          s.btn,
          s.btnSecondary,
          trip.running && { opacity: 0.35 },
        ]}
        onPress={goToDashboard}
        disabled={trip.running}
        activeOpacity={0.7}
      >
        <Text style={s.btnTextSecondary}>← Back to dashboard</Text>
      </TouchableOpacity>

      {trip.running && (
        <Text
          style={[
            s.muted,
            { textAlign: "center", marginTop: 8, fontSize: 12 },
          ]}
        >
          Stop the trip first to go back to dashboard.
        </Text>
      )}
      </ScrollView>
    </View>
  );
}
