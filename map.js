mapboxgl.accessToken = 'pk.eyJ1Ijoic29teXRobCIsImEiOiJjbTdiMXljYmIwMjVwMmlwc2VzZHYzYmc3In0.pDhtZHwd2fy-cYS3WZdX_w';

let timeFilter = -1;
//let trips = [];
let stations = [];
let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


const map = new mapboxgl.Map({
  container: 'map', 
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027], 
  zoom: 12, 
  minZoom: 5, 
  maxZoom: 18 
});

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1 
      ? trips // If no filter is applied (-1), return all trips
      : trips.filter((trip) => {
          // Convert trip start and end times to minutes since midnight
          const startedMinutes = minutesSinceMidnight(trip.started_at);
          const endedMinutes = minutesSinceMidnight(trip.ended_at);
          
          // Include trips that started or ended within 60 minutes of the selected time
          return (
            Math.abs(startedMinutes - timeFilter) <= 60 ||
            Math.abs(endedMinutes - timeFilter) <= 60
          );
      });
  }

/*
function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // Get slider value
  
    if (timeFilter === -1) {
      selectedTime.textContent = '';  // Clear time display
      anyTimeLabel.style.display = 'block';  // Show "(any time)"
    } else {
      selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
      anyTimeLabel.style.display = 'none';  // Hide "(any time)"
    }
  
    // Trigger filtering logic which will be implemented in the next step
  }*/

function computeStationTraffic(stations, trips) {
    // Compute departures
    const departures = d3.rollup(
        trips, 
        (v) => v.length, 
        (d) => d.start_station_id
    );

    // Computed arrivals as you did in step 4.2
    const arrivals = d3.rollup(
        trips,
        (v) => v.length,
        (d) => d.end_station_id
      );
    
    // Update each station..
    return stations.map((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      // what you updated in step 4.2
      station.departures = departures.get(id) ?? 0; // Set departures (default to 0 if undefined)
      station.totalTraffic = station.arrivals + station.departures; // Total traffic = arrivals + departures
      return station;
  });
}

console.log("Mapbox script loaded successfully");

const bikeLaneStyle = {
  'line-color': '#32D400',
  'line-width': 5,
  'line-opacity': 0.5
};

/*
d3.csv("https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv").then(data => {
    trips = data.map(trip => ({
        ...trip,
        started_at: new Date(trip.start_time),
        ended_at: new Date(trip.end_time)
    }));
    console.log("Processed Traffic Data:", trips);
});*/



map.on('load', async () => {
    const svg = d3.select('#map').select('svg');

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('time-display');
    const anyTimeLabel = document.getElementById('any-time');

    //within the map.on('load') 
    let trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    },
    );
/*
    function updateTimeDisplay() {
        timeFilter = Number(timeSlider.value);  // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = '';  // Clear time display
          anyTimeLabel.style.display = 'block';  // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
          anyTimeLabel.style.display = 'none';  // Hide "(any time)"
        }
      
        // Trigger filtering logic which will be implemented in the next step
        updateScatterPlot(timeFilter);
      }

    function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
        const filteredTrips = filterTripsbyTime(trips, timeFilter);
        
        // Recompute station traffic based on the filtered trips
        const filteredStations = computeStationTraffic(stations, filteredTrips);
        
        // Update the scatterplot by adjusting the radius of circles
        circles
          .data(filteredStations)
          .join('circle') // Ensure the data is bound correctly
          .attr('r', (d) => radiusScale(d.totalTraffic)); // Update circle sizes
    }


    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();*/



    function getCoords(station) {
        const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
        const { x, y } = map.project(point);  // Project to pixel coordinates
        return { cx: x, cy: y };  // Return as object for use in SVG attributes
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
        /*stations = jsonData.data.stations;

        const departures = d3.rollup(trips, (v) => v.length, (d) => d.start_station_id);
        const arrivals = d3.rollup(trips, (v) => v.length, (d) => d.end_station_id);

        stations = stations.map((station) => {
            let id = station.short_name;    
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures;
            return station;
        });*/

        //within the map.on('load') 
    
        const stations = computeStationTraffic(jsonData.data.stations, trips);

        console.log("Updated Stations with Traffic Data:", stations);

        const svg = d3.select('#map').select('svg');
        
        const radiusScale = d3
            .scaleSqrt()
            .domain([0, d3.max(stations, (d) => d.totalTraffic)])
            .range(timeFilter === -1 ? [0, 25] : [3, 50]);

        const circles = svg.selectAll('circle')
            .data(stations, (d) => d.short_name)
            .join('circle')
            .attr('r', d => radiusScale(d.totalTraffic))              
            .attr('fill', 'steelblue')  
            .attr('stroke', 'white')    
            .attr('stroke-width', 1)    
            .attr('opacity', 0.8)
            .each(function(d) {
                d3.select(this)
                .select('title')
                .remove();
                d3.select(this)
                .append('title')
                .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals})`);
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

        function updateTimeDisplay() {
            timeFilter = Number(timeSlider.value);  // Get slider value
          
            if (timeFilter === -1) {
              selectedTime.textContent = '';  // Clear time display
              anyTimeLabel.style.display = 'block';  // Show "(any time)"
            } else {
              selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
              anyTimeLabel.style.display = 'none';  // Hide "(any time)"
            }
          
            // Trigger filtering logic which will be implemented in the next step
            updateScatterPlot(timeFilter);
          }
    
        function updateScatterPlot(timeFilter) {
            // Get only the trips that match the selected time filter
            const filteredTrips = filterTripsbyTime(trips, timeFilter);
            
            // Recompute station traffic based on the filtered trips
            const filteredStations = computeStationTraffic(stations, filteredTrips);

            timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
            
            // Update the scatterplot by adjusting the radius of circles
            circles
              .data(filteredStations, (d) => d.short_name)
              .join('circle') // Ensure the data is bound correctly
              .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
              .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),
              );

        }
    
    
        timeSlider.addEventListener('input', updateTimeDisplay);
        updateTimeDisplay();

        

    }).catch(error => {
        console.error('Error loading JSON:', error);
    });
});
