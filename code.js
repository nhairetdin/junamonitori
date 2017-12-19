const COLOR_RING_STROKE = "rgb(27, 255, 154)"; //Määritellään väriarvoja SVG:lle
const COLOR_ACTIVE_TEXT = "rgb(27, 255, 154)";
const COLOR_INACTIVE_TEXT = "rgb(150,150,150)";
const COLOR_TRACK = "#dfdfdf";
const COLOR_STROKE_STATION = "#dfdfdf";

let STATIONS; //Sivun latautuessa tallennetaan apista asemien tiedot
let traindataAsJson;  //parsettu data apista
let interval; //muuttuja jatkuvasti kutsuttavalle loopille

function init() { //ensimmäinen kutsuttava funktio
  let url = "https://rata.digitraffic.fi/api/v1/metadata/stations";
  loadData(url, function() {  //haetaan asemat
    STATIONS = JSON.parse(this.responseText);
  });
  loadSVGmap(); //valmistelee kartan, mm. lataa svg tiedoston ja tekee tapahatumakuuntelijat ym.
  $("#events").mouseout(() => { //JQuerylla tapahtumakuuntelija
    highlightStopsOn("-");
  })
}

function loadData(url, callback) { //funktio tiedon hakua varten, //callaback on funktio, jota kutsutaan vasta kun data on ladattu
  let xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", url, true);
  xmlhttp.send();

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
      callback.apply(xmlhttp); //kutsutaan callback joka saa parametriksi xmlhttp:n
    }
  }
}

function parseTrains(data, selectedStation) { //hakee datasta (traindataAsJson) oikeat junat ja luo niistä newTrain-objektin
  let trains = [];
  let selectedStationDecoded = decodeURIComponent(selectedStation); //APIlle menevä aseman shortcode täytyy enkoodata ja dekoodata 2 kertaa (bugi?)
  selectedStationDecoded = decodeURIComponent(selectedStationDecoded);

  data.forEach((train) => { //käydään datan jokainen juna-objekti läpi
    train.timeTableRows.forEach((station) => { //jokaisen junan timeTableRows-objekti läpi
      if (station.stationShortCode === selectedStationDecoded && station.type === 'DEPARTURE') { //jos asema on oikea ja tyyppi on departure luodaan tässä lohkossa uusi newTrain objekti
        let dDeparture = station.liveEstimateTime ? new Date(station.liveEstimateTime) : new Date(station.scheduledTime); //jos liveEstimate on tarjolla käytetään sitä, muuten aikataulun aikaa
        let dNow = new Date(); //aika nyt, jotta voidaan laskea sekuntimäärä junan saapumiseen

        // console.log("Tunnus: " + train.commuterLineID + ", Sekuntia lähtoon: " + Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000) + ", JunaNro: " + train.trainNumber);
        let newTrain = { //uusi juna
          id: train.commuterLineID, //junan kirjain
          dest: train.timeTableRows[train.timeTableRows.length - 1].stationShortCode, //päämäärä, eli reitin viimeinen asema
          waitTime: Math.floor((dDeparture.getTime() - dNow.getTime()) / 1000), //sekuntia lähtöön
          track: station.commercialTrack, //raidenumero
          departure: dDeparture, //lähtöaika date-objektina
          selectedStation: selectedStationDecoded, //aseman shortcode
          route: train.timeTableRows //kyseisen junan kaikki asemat, tarvitaan jotta voidaan korostaa pysähdykset kartalla kun hiiri viedään päälle
        };
        if (newTrain.waitTime > 0) {
          if (newTrain.id === "") { //jos junalla ei ole tunnusta (kaukojunat), käytetään junan tyyppiä, esim IC
            newTrain.id = train.trainType;
          }
          trains.push(newTrain); //lisätään listaan
        }
      }
    });
  });
  return trains;
}

function loadTraindata(selectedStation) { //selectedStation = valitun aseman shortcode enkoodattuna
  let url = `https://rata.digitraffic.fi/api/v1/live-trains/station/${selectedStation}?arrived_trains=0&arriving_trains=20&departed_trains=0&departing_trains=20&minutes_before_departure=15&minutes_after_departure=0&minutes_before_arrival=15&minutes_after_arrival=0&include_nonstopping=false`;
  loadData(url, function() { //function on anonyymi funktio aiemmin mainittua callbackia varten
    traindataAsJson = JSON.parse(this.responseText); //luodaan json objekti datasta
    let trains = parseTrains(traindataAsJson, selectedStation); //haetaan oikean aseman tiedot

    trains.sort((a, b) => { //sort..
      return a.waitTime - b.waitTime;
    });

    deleteEventElements(); //poistetaan vanhat näkymästä

    for (let i = 0; i < trains.length; i++) { //luodaan elementit näkyville yksi kerrallaan
      createEventElement(i, trains[i]);
    }
  });
}

function showTrains() {
  parseTrains(traindataAsJson); //näyttää junat consolessa
}

function createEventElement(num, train) { //rakentaa uuden lähtevän junan ja lisää sen sivulle näkyviin
  if (isThroughAirport(train)) { //lentokenttäjuna vaatii spesiaalin esitystavan
    train.dest = "Lentoasema -> Helsinki";
  } else {
    train.dest = getStationName(train.dest);
  }

  //luodaan elemennetejä..
  let c = document.createElement("div");
  let c_1 = document.createElement("div");
  let c_1_1 = document.createElement("div");
  let c_1_2 = document.createElement("div");
  let c_2 = document.createElement("div");
  //haetaan date-objektista tunnit, minuutit ja sekuntit esitystä varten
  let hours = ("0" + train.departure.getHours()).slice(-2);
  let minutes = ("0" + train.departure.getMinutes()).slice(-2);
  let seconds = ("0" + train.departure.getSeconds()).slice(-2);
  //lisätään luokat..
  c.classList.add("event-container");
  c_1.classList.add("event-info-container");
  c_1_1.classList.add("inner");
  c_1_2.classList.add("inner2");
  c_2.classList.add("event-progressbar-container");
  c_2.setAttribute("id", "progressbar" + num);
  //asetellaan
  c.appendChild(c_1);
  c.appendChild(c_2);
  c_1.appendChild(c_1_1);
  c_1.appendChild(c_1_2);

  c_1_2.innerHTML = `<span class="strongtext">${hours}:${minutes}:${seconds}</span>`; //näyttää junan lähtöajan
  c_1_1.innerHTML = `<span class="strongtext">${train.id}</span> ${train.dest} raide <span class="strongtext">${train.track}</span>`; //muut tiedot
  document.getElementById("events").appendChild(c);

  c.addEventListener("mouseover", () => { //kun hiiri viedään laatikon päälle, korostetaan kartalla asemat joissa kyseinen juna pysähtyy
    highlightStopsOn(train.id);
  });

  let drawProgressbar = SVG('progressbar' + num).size(900, 10); //valitaan domista oikea laatikko
  drawProgressbar.rect(900, 20).fill('#dfdfdf'); //piirretään sille palkin tausta
  drawProgressbar.rect(train.waitTime, 20).fill(COLOR_ACTIVE_TEXT).animate(train.waitTime * 1000, '-', 0).size(1, 10); //varsinainen palkki ja animointi
}

function deleteEventElements() { //poistaa kaikki
  $("#events").empty();
}

function getStationName(shortcode) { //hakee aseman shortcodea vastaavan aseman koko nimen STATIONS-muuttujasta
  for (let i = 0; i < STATIONS.length; i++) {
    if (STATIONS[i].stationShortCode === shortcode) {
      return STATIONS[i].stationName.split(" ")[0];
    }
  }
}

function isThroughAirport(train) { //katsotaan onko lentoasema junan JÄLJELLÄ olevalla reitillä
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

function loadSVGmap() { //kartta
  let svgImage = Snap("#mapContainer"); //ladataan .svg tiedosto snapillä

  Snap.load("stationmap.svg", function(f) {
    let stations = f.select("#station_nodes").node.children; //haetaan tiedostosta asemat
    let track = f.select("#track"); //rata..

    track.attr({ //asetetaan radalle väri
      stroke: COLOR_TRACK
    });

    for (let i = 0; i < stations.length; i++) { //käydään asemat läpi, määritellään ominaisuuksia värjeä ja animointi
      let mapStationText = f.select("#" + stations[i].children[0].firstChild.id);
      let mapStation = f.select("#" + stations[i].children[1].id);
      let mapStationRing = f.select("#" + stations[i].children[2].id);
      let mapStationShortcode = mapStation.node.textContent.split(":")[0];
      let radius = 12;
      let strokeWidth = 15;
      let ringRadius = 22;

      if (mapStationShortcode.trim() === "HKI" || mapStationShortcode.trim() === "PSL") { //helsinki ja pasila näytetään isompana
        radius = 21;
        strokeWidth = 21;
        ringRadius = 34;
      }

      mapStation.attr({ //asetetaan asema rinkulan väri ja koko käyttäen edellä määriteltyjä muuttujia
        stroke: COLOR_STROKE_STATION,
        r: radius,
        strokeWidth: strokeWidth
      });
      mapStationRing.attr({stroke: COLOR_RING_STROKE});
      mapStationText.attr({fill: COLOR_INACTIVE_TEXT});

      mapStation.click(function() { //tapahtumakuuntelija klikkaukselle
        mapStationShortCodeTrimmed = mapStationShortcode.trim(); //poistaa välilyönnit merkkijonosta
        $("#stationName").text(getStationName(mapStationShortCodeTrimmed)); //haetaan klikatun aseman shortcode
        mapStationShortCodeTrimmed = encodeURIComponent(mapStationShortCodeTrimmed); //shortcode täytyy enkoodata 2 kertaa, muuten ei toimi (bugi apissa?)
        mapStationShortCodeTrimmed = encodeURIComponent(mapStationShortCodeTrimmed);
        loadTraindata(mapStationShortCodeTrimmed); //haetaan apista data, parametriksi aseman shortcode enkoodattuna
        if (interval) { //poistetaan aiempi looppi ennen kuin käynnistetään uudestaan toisella asemalla
          clearInterval(interval);
        }
        interval = setInterval(function() { //asetetaan looppi, hakee tiedot 5 sekunnin välein
          loadTraindata(mapStationShortCodeTrimmed)
        }, 5000);
      });

      let hoverFunc = function() { //määritellään tapahtumakuuntelija, kun hiiri viedään asemaympyrän päälle
        mapStationText.attr({
          fill: COLOR_ACTIVE_TEXT
        });

        mapStationRing.stop().animate({ //svg animaatio IN
          opacity: 1,
          r: ringRadius,
          strokeWidth: 2.5
        }, 700, mina.elastic);
      }

      let endAnim = function() { //kun hiiri viedään pois aseman päältä..
        mapStationText.attr({fill: COLOR_INACTIVE_TEXT});

        mapStationRing.stop().animate({ //svg animaatio OUT
          opacity: 0,
          r: 40,
          strokeWidth: 10
        }, 500);
      }

      mapStation.mouseover(hoverFunc); //asetetaan tapahtumakuuntelijat
      mapStation.mouseout(endAnim);
    }
    svgImage.append(f); //lopuksi lisätään SVG kuva DOMiin, eli #mapContainer elementtiin
  });
}

function highlightStopsOn(trainid) { //valitsee oikeat asemat kartalta ja korostaa keskustan
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
