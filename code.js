const COLOR_RING_STROKE = "rgb(27, 255, 154)";
const COLOR_ACTIVE_TEXT = "rgb(27, 255, 154)";
const COLOR_INACTIVE_TEXT = "rgb(150,150,150)";
const COLOR_TRACK = "#dfdfdf";
const COLOR_STROKE_STATION = "#dfdfdf";

let STATIONS;
let traindataAsJson;
let interval;

function init() {
  let url = "https://rata.digitraffic.fi/api/v1/metadata/stations";
  loadData(url, function() {
    STATIONS = JSON.parse(this.responseText);
  });
  loadSVGmap();
  document.getElementById("events").addEventListener("mouseout", () => {
    highlightStopsOn("-");
  });
}

function loadData(url, callback) {
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", url, true);
  xmlhttp.send();

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      callback.apply(xmlhttp);
    }
  }
}

function parseTrains(data, selectedStation) {
  let trains = [];
  let selectedStationDecoded = decodeURIComponent(selectedStation);
  selectedStationDecoded = decodeURIComponent(selectedStationDecoded);

  data.forEach((train) => {
    train.timeTableRows.forEach((station) => {
      if (station.stationShortCode === selectedStationDecoded && station.type === 'DEPARTURE') {
        let dDeparture = station.liveEstimateTime ? new Date(station.liveEstimateTime) : new Date(station.scheduledTime);
        let dNow = new Date();

        // console.log("Tunnus: " + train.commuterLineID + ", Sekuntia lähtoon: " + Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000) + ", JunaNro: " + train.trainNumber);
        let newTrain = {
          id: train.commuterLineID,
          dest: train.timeTableRows[train.timeTableRows.length - 1].stationShortCode,
          waitTime: Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000),
          track: station.commercialTrack,
          departure: dDeparture,
          selectedStation: selectedStationDecoded,
          route: train.timeTableRows
        };
        if (newTrain.waitTime > 0) {
          if (newTrain.id === "") {
            newTrain.id = train.trainType;
          }
          trains.push(newTrain);
        }
      }
    });
  });
  return trains;
}

function loadTraindata(selectedStation) {
  let url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${selectedStation}?arrived_trains=0&arriving_trains=20&departed_trains=0&departing_trains=20&minutes_before_departure=15&minutes_after_departure=0&minutes_before_arrival=15&minutes_after_arrival=0&include_nonstopping=false`;
  loadData(url, function() {
    traindataAsJson = JSON.parse(this.responseText);
    let trains = parseTrains(traindataAsJson, selectedStation);

    trains.sort((a, b) => {
      return a.waitTime - b.waitTime;
    });

    deleteEventElements();

    for (let i = 0; i < trains.length; i++) {
      createEventElement(i, trains[i]);
    }
  });
}

function showTrains() {
  parseTrains(traindataAsJson);
}

function createEventElement(num, train) {
  if (isThroughAirport(train)) {
    train.dest = "Lentoasema -> Helsinki";
  } else {
    train.dest = getStationName(train.dest);
  }

  let c = document.createElement("div");
  let c_1 = document.createElement("div");
  let c_1_1 = document.createElement("div");
  let c_1_2 = document.createElement("div");
  let c_2 = document.createElement("div");

  let hours = ("0" + train.departure.getHours()).slice(-2);
  let minutes = ("0" + train.departure.getMinutes()).slice(-2);
  let seconds = ("0" + train.departure.getSeconds()).slice(-2);

  c.classList.add("event-container");
  c_1.classList.add("event-info-container");
  c_1_1.classList.add("inner");
  c_1_2.classList.add("inner2");
  c_2.classList.add("event-progressbar-container");
  c_2.setAttribute("id", "progressbar" + num);

  c.appendChild(c_1);
  c.appendChild(c_2);
  c_1.appendChild(c_1_1);
  c_1.appendChild(c_1_2);

  c_1_2.innerHTML = `<span class="strongtext">${hours}:${minutes}:${seconds}</span>`;
  c_1_1.innerHTML = `<span class="strongtext">${train.id}</span> ${train.dest} raide <span class="strongtext">${train.track}</span>`;
  document.getElementById("events").appendChild(c);

  c.addEventListener("mouseover", () => {
    highlightStopsOn(train.id);
  });

  let drawProgressbar = SVG('progressbar' + num).size(900, 10);
  drawProgressbar.rect(900, 20).fill('#dfdfdf');
  drawProgressbar.rect(train.waitTime, 20).fill(COLOR_ACTIVE_TEXT).animate(train.waitTime * 1000, '-', 0).size(1, 10);
}

function deleteEventElements() {
  let e = document.getElementById("events");
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
}

function getStationName(shortcode) {
  for (let i = 0; i < STATIONS.length; i++) {
    if (STATIONS[i].stationShortCode === shortcode) {
      return STATIONS[i].stationName.split(" ")[0];
    }
  }
}

function isThroughAirport(train) {
  for (let i = 0; i < train.route.length; i++) {
    if (train.route[i].stationShortCode === train.selectedStation) {
      for (let j = i+2; j < train.route.length; j++) {
        if (train.route[j].stationShortCode === "LEN") {
          return true;
        }
      }
    }
  }
  return false;
}

function loadSVGmap() {
  let svgImage = Snap("#mapContainer");

  Snap.load("stationmap.svg", function(f) {
    let stations = f.select("#station_nodes").node.children;
    let track = f.select("#track");

    track.attr({
      stroke: COLOR_TRACK
    });

    for (let i = 0; i < stations.length; i++) {
      let mapStationText = f.select("#" + stations[i].children[0].firstChild.id);
      let mapStation = f.select("#" + stations[i].children[1].id);
      let mapStationRing = f.select("#" + stations[i].children[2].id);
      let mapStationShortcode = mapStation.node.textContent.split(":")[0];
      let radius = 12;
      let strokeWidth = 15;
      let ringRadius = 22;

      if (mapStationShortcode.trim() === "HKI" || mapStationShortcode.trim() === "PSL") {
        radius = 21;
        strokeWidth = 21;
        ringRadius = 34;
      }

      mapStation.attr({
        stroke: COLOR_STROKE_STATION,
        r: radius,
        strokeWidth: strokeWidth
      });
      mapStationRing.attr({stroke: COLOR_RING_STROKE});
      mapStationText.attr({fill: COLOR_INACTIVE_TEXT});

      mapStation.click(function() {
        mapStationShortCodeTrimmed = mapStationShortcode.trim();
        document.getElementById("stationName").textContent = getStationName(mapStationShortCodeTrimmed);
        mapStationShortCodeTrimmed = encodeURIComponent(mapStationShortCodeTrimmed);
        mapStationShortCodeTrimmed = encodeURIComponent(mapStationShortCodeTrimmed);
        loadTraindata(mapStationShortCodeTrimmed);
        if (interval) {
          clearInterval(interval);
        }
        interval = setInterval(function() {
          loadTraindata(mapStationShortCodeTrimmed)
        }, 5000);
      });

      let hoverFunc = function() {
        mapStationText.attr({
          fill: COLOR_ACTIVE_TEXT
        });

        mapStationRing.stop().animate({
          opacity: 1,
          r: ringRadius,
          strokeWidth: 2.5
        }, 700, mina.elastic);
      }

      let endAnim = function() {
        mapStationText.attr({fill: COLOR_INACTIVE_TEXT});

        mapStationRing.stop().animate({
          opacity: 0,
          r: 40,
          strokeWidth: 10
        }, 500);
      }

      mapStation.mouseover(hoverFunc);
      mapStation.mouseout(endAnim);
    }
    svgImage.append(f);
  });
}

function highlightStopsOn(trainid) {
  let stations = Snap("#station_nodes").node.children;

  for (let i = 0; i < stations.length; i++) {
    let mapStation = Snap("#" + stations[i].children[1].id);
    let traindIds = mapStation.node.textContent.split(":")[2];

    mapStation.attr({
      fill: "#606060"
    });

    if (traindIds.toUpperCase().includes(trainid.toUpperCase())) {
      mapStation.attr({
        fill: COLOR_ACTIVE_TEXT
      });
    }
  }
}
