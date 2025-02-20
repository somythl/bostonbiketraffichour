mapboxgl.accessToken = 'pk.eyJ1Ijoic29teXRobCIsImEiOiJjbTdiMXljYmIwMjVwMmlwc2VzZHYzYmc3In0.pDhtZHwd2fy-cYS3WZdX_w';

let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

let timeFilter = -1;
let trips = [];
let stations = []; // ✅ Keep stations global

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('time-display');

function formatTime(minutes) {
    if (minutes === -1 || minutes === 1440) {
        return "11:59 PM"; // Force 11:59 PM at both ends
    }
    
    const date = new Date(0, 0, 0, 0, minutes);
    return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);
    selectedTime.textContent = formatTime(timeFilter);

    if (trips.length > 0 && stations.length > 0) {
        filterTripsbyTime();  
    }
}

timeSlider.addEventListener('input', () => {
    updateTimeDisplay();
});

updateTimeDisplay();

function filterTripsbyTime() {
    filteredTrips = timeFilter === -1
        ? trips
        : trips.filter((trip) => {
            const startedMinutes = minutesSinceMidnight(trip.started_at);
            const endedMinutes = minutesSinceMidnight(trip.ended_at);
            return (
              Math.abs(startedMinutes - timeFilter) <= 60 ||
              Math.abs(endedMinutes - timeFilter) <= 60
            );
        });

    filteredArrivals = d3.rollup(
        filteredTrips,
        (v) => v.length,
        (d) => d.end_station_id
    );
    
    filteredDepartures = d3.rollup(
        filteredTrips,
        (v) => v.length,
        (d) => d.start_station_id
    );

    filteredStations = stations.map(station => {
        let clonedStation = { ...station }; 
        let id = station.short_name;

        clonedStation.arrivals = filteredArrivals.get(id) ?? 0;
        clonedStation.departures = filteredDepartures.get(id) ?? 0;
        clonedStation.totalTraffic = clonedStation.arrivals + clonedStation.departures;

        return clonedStation;
    });
}

const map = new mapboxgl.Map({
  container: 'map', 
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], 
  zoom: 12, 
  minZoom: 5, 
  maxZoom: 18 
});

console.log("Mapbox script loaded successfully");

const bikeLaneStyle = {
  'line-color': '#32D400',
  'line-width': 5,
  'line-opacity': 0.5
};

d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv").then(data => {
    trips = data.map(trip => ({
        ...trip,
        started_at: new Date(trip.start_time),
        ended_at: new Date(trip.end_time)
    }));
    console.log("Processed Traffic Data:", trips);
});

map.on('load', () => {
    const svg = d3.select('#map').select('svg');

    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat);
        const { x, y } = map.project(point);
        return { cx: x, cy: y };
    }

    const bikeSources = {
        'boston_route': 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...',
        'cambridge_route': 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson?...'
    };

    Object.keys(bikeSources).forEach((sourceName) => {
        map.addSource(sourceName, {
            type: 'geojson',
            data: bikeSources[sourceName]
        });

        map.addLayer({
            id: `${sourceName}-layer`,
            type: 'line',
            source: sourceName,
            paint: bikeLaneStyle
        });
    });

    console.log("Bike lanes added to the map");

    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";

    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);
        stations = jsonData.data.stations;

        const departures = d3.rollup(trips, (v) => v.length, (d) => d.start_station_id);
        const arrivals = d3.rollup(trips, (v) => v.length, (d) => d.end_station_id);

        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });

        console.log("Updated Stations with Traffic Data:", stations);

        filterTripsbyTime();

        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range([0, 25]);

        const circles = svg.selectAll('circle')
            .data(stations)
            .enter()
            .append('circle')
            .attr('r', d => radiusScale(d.totalTraffic))              
            .attr('fill', 'steelblue')  
            .attr('stroke', 'white')    
            .attr('stroke-width', 1)    
            .attr('opacity', 0.8)
            .each(function(d) {
                d3.select(this)
                  .append('title')
                  .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
            });

        function updatePositions() {
            circles
                .attr('cx', d => getCoords(d).cx)
                .attr('cy', d => getCoords(d).cy);
        }

        updatePositions();

        map.on('move', updatePositions);
        map.on('zoom', updatePositions);
        map.on('resize', updatePositions);
        map.on('moveend', updatePositions);
    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});
