const colorRingStroke = "rgb(27, 255, 154)";
const colorActiveText = "rgb(27, 255, 154)";
const colorInactiveText = "rgb(185, 185, 185)";
const colorTrack = "#dfdfdf";
const colorStrokeStation = "#dfdfdf";

let STATIONS;
let traindataAsJson;
// let selectedStation;

function init() {
  let url = "https://rata.digitraffic.fi/api/v1/metadata/stations";
  loadData(url, function() {
    STATIONS = JSON.parse(this.responseText);
  });
  loadSVGmap();
}

function loadData(url, callback) {
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", url, true);
  xmlhttp.send();

  document.getElementById('statusMessage').innerHTML = "Ladataan..";

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      document.getElementById('statusMessage').innerHTML = "Valmis.";
      callback.apply(xmlhttp);
    }
  }
}

function parseTrains(data, selectedStation) {
  let trains = [];

  data.forEach((train) => {
    train.timeTableRows.forEach((station) => {
      if (station.stationShortCode === selectedStation && station.type === 'DEPARTURE') {
        let dDeparture = station.liveEstimateTime ? new Date(station.liveEstimateTime) : new Date(station.scheduledTime);
        let dNow = new Date();

        console.log("Tunnus: " + train.commuterLineID + ", Sekuntia lähtoon: " + Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000) + ", JunaNro: " + train.trainNumber);
        let newTrain = {
          id: train.commuterLineID,
          dest: train.timeTableRows[train.timeTableRows.length - 1].stationShortCode,
          waitTime: Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000),
          track: station.commercialTrack
        };
        if (newTrain.waitTime > 0) {
          trains.push(newTrain);
        }
      }
    });
  });
  return trains;
}

function loadTraindata(selectedStation) {
  let url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${selectedStation}?arrived_trains=0&arriving_trains=20&departed_trains=0&departing_trains=20&minutes_before_departure=15&minutes_after_departure=0&minutes_before_arrival=15&minutes_after_arrival=0&include_nonstopping=false`;
  console.log(url);
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
  console.log(traindataAsJson);
  parseTrains(traindataAsJson);
}

function createEventElement(num, train) {
  let c = document.createElement("div");
  let c_1 = document.createElement("div");
  let c_2 = document.createElement("div");
  let t = document.createTextNode(train.id + " " + train.dest + " raide " + train.track);

  c.classList.add("event-container");
  c_1.classList.add("event-info-container");
  c_2.classList.add("event-progressbar-container");

  c_2.setAttribute("id", "progressbar" + num);

  c.appendChild(c_1);
  c.appendChild(c_2);
  c_1.appendChild(t);

  document.getElementById("events").appendChild(c);

  let drawProgressbar = SVG('progressbar' + num).size(900, 10);
  drawProgressbar.rect(900, 20).fill('#dfdfdf');
  drawProgressbar.rect(train.waitTime, 20).fill('#00ffab').animate(train.waitTime * 1000, '-', 0).size(1, 10);
}

function deleteEventElements() {
  let e = document.getElementById("events");
  while (e.firstChild) {
    e.removeChild(e.firstChild);
  }
}

function loadSVGmap() {
  let svgImage = Snap("#mapContainer");

  Snap.load("asematx_plain4.svg", function(f) {
    let stations = f.select("#station_nodes").node.children;
    let track = f.select("#track");

    track.attr({
      stroke: colorTrack
    });

    for (let i = 0; i < stations.length; i++) {
      let mapStationText = f.select("#" + stations[i].children[0].firstChild.id);
      let mapStation = f.select("#" + stations[i].children[1].id);
      let mapStationRing = f.select("#" + stations[i].children[2].id);

      mapStation.attr({stroke: colorStrokeStation});
      mapStationRing.attr({stroke: colorRingStroke});
      mapStationText.attr({fill: colorInactiveText});

      let hoverFunc = function() {
        mapStationText.attr({fill: colorActiveText});

        mapStationRing.stop().animate({
          opacity: 1,
          r: 22,
          strokeWidth: 2.5
        }, 700, mina.elastic);
      }

      let endAnim = function() {
        mapStationText.attr({fill: colorInactiveText});

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

document.getElementById('btnStopButton').addEventListener('click', () => {
  square.stop();
});
document.getElementById('btnLoadData').addEventListener('click', () => {
  loadTraindata();
});
document.getElementById('btnLogStations').addEventListener('click', () => {
  console.log(STATIONS);
});
document.getElementById('btnShowTrains').addEventListener('click', () => {
  showTrains();
});
document.getElementById('btnCreateEventElement').addEventListener('click', () => {
  createEventElement();
});
document.getElementById('btnLoadSample').addEventListener('click', () => {
  loadTraindata();
});
document.getElementById('btnDelete').addEventListener('click', () => {
  deleteEventElements();
});
