/*
===============================================================================================================
======= Usage Documentation ===================================================================================
===============================================================================================================
    |                      |                     |
    |   Class Hierarchy    |   Tech              |   Conventions
    |   ---------------    |   ----              |   -----------
    |                      |   •jQuery      ($)  |
    |   Map                |   •Leaflet.js  (L)  |   •Private class methods (that should not be called from app)
    |   •Layer             |   •MapQuest.js (MQ) |    start with underscore, and are lowercase
    |   --Location         |   •Bootstrap        |   •This library loads in all its own dependencies in order
    |   --Location         |   •OSM Data         |
    |   •Layer             |   •MapTiler         |
    |   --Location         |                     |
    |   --Location         |                     |

    •WARNING• - if the latest version of jQuery is not already used in your application add 
                <script src="https://code.jquery.com/jquery-LATEST-VERSION.min.js" crossorigin="anonymous"></script>

                the latest version bootstrap is also recommended,
                you can get the BootstrapCDN for the latest version of both from https://getbootstrap.com/

===============================================================================================================

        new Map
        (
          <string> mapID,                                 *id of element to insert map*
          <string> panelID                                *if of elemnt to insert panel content*
          <bool> use_getJSON (default = true)             *should 
        )
        --Map class instance will save itself to window.map(map) and load in all dependencies
        
===============================================================================================================

        new Layer
        (
          <string> name,                                  *layer name that can be used as a title*
          <Icon> icon,                                    *icon data saved for use by child locations*
either    <string> dataUrl,                               *url to retrieve json data (it will be accessable in CreateLocationsFunction(layer,data))*
or        <object> dataUrl,                               *this will set the data object to whatever object you pass here*
          <string> panelEl                                *html string to contain its locations*
          <function(layer,data)> CreateLocationsFunction, *create locations here*
        ) 
        --Layer class instances can be created after new Map() as they will add themselves to map.layers[]

===============================================================================================================
        
        <function(layer,data)> CreateLocationsFunction = ...
        new Location
        (
          <Layer> layer,                                  *use the parent layer from (layer,data)=>*
          <string> parentID,                              *parent elemnt id to insert locationEl*
          <string> name,                                  *string used as display title*
          <decimal> lat,                                  *marker latitude*
          <decimal> long,                                 *marker longitude*
          <Icon> iconData,                                *icon data to generate L.marker on map*
          <string> locationEl                             *html string inserted into panel and icon popup*
        )
        ---This function generates a Location object for $.each location in (layer,data)=>
        
===============================================================================================================
        
        <string> locationEl =  new Accordion 
        (
          <string> parentID,                              *id of the side panel to insert this group*
          <string> layerName,                             *title/text of the layer/group header and used for map icon filtering*
          <string> headerIconUrl,                         *icon to the left of the layer/group header*
          <string> body                                   *panel/group element to insert locations into* 
        )
        ---Accordian generates a standard html string for the Location object's 'locationEl'

===============================================================================================================
*/

//Leaflet Documentation https://leafletjs.com/reference-0.7.7.html
class Map {
    Show_Layer(target) { this.layers.filter(l => l.name === target)[0].Show(); }
    Show_All_Layers() { this.layers.forEach(l => l.Show()); }
    Hide_All_Layers() { this.layers.forEach(l => l.Hide()); }

    constructor(mapID, panelID) {
        this.Loaded = false;
        this.layers = [];

        this.MapEl = mapID;
        this.PanelEl = panelID;

        window.map = this;
        this.pipe = this._pipeline();
        window.onload = function () { window.map._onLoad(); }

        this.utils = new Utils();
        //this.maptiler = new Maptiler();
        //this.mapquest = new MapQuest();

        //Old Leaflet versions to support directions
        this.utils.getScript("https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/leaflet.js");
        this.utils.getStyleSheet("https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/leaflet.css");

        this.utils.addStyle(`@media print {.print-me, .print-me * {visibility: visible;}body * {visibility: hidden;}`);

    }
    //--Internal---------------------------
    *_pipeline() {
        this._createMap(); yield;
        this._generateElements(); yield;
    }
    _onLoad() {
        //this.mapquest._loaded();
        //this.maptiler._loaded();
        this._next();
    }
    _createMap() {
        this.map = L.map(this.MapEl).setView([35.3543606, -106.2516825], 7);

        //https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
        L.tileLayer('https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=s2pZVV9fpaIS2jffulN8',
            {
                attribution: '<a href="https://www.maptiler.com/copyright/">© MapTiler</a> | <a href="https://openstreetmap.org" title="built by JJ Auer">© OpenStreetMap contributors</a>',
                maxZoom: 14,
                minZoom: 7
            }).addTo(this.map);

        //this.map.getRenderer(this.map).options.padding = 1;
        //mymap.scrollWheelZoom.disable();
        this.map.setMaxBounds([[30.0000000, -110.0000000], [40.0000000, -101.0000000, 21]]);

        this.Loaded = true;


        L.Control.Watermark = L.Control.extend({
            onAdd: function(map) {
                var locs = L.DomUtil.create('div');
        
                locs.innerHTML = `<div id="${window.map.PanelEl}"></div>`
                locs.style.width = '100%';
                locs.style.height = '100%';
                locs.style.backgroundColor = "white";
        
                return locs;
            },
        
            onRemove: function(map) {
                // Nothing to do here
            }
        });
        
        L.control.watermark = function(opts) {
            return new L.Control.Watermark(opts);
        }
        
        L.control.watermark({ position: 'topright' }).addTo(this.map);






        this._next();
    }
    _generateElements() {
        for (let i in this.layers) {
            let l = this.layers[i];
            l._generate();
            l.layerGroup.addTo(this.map);
        }
    }
    _next() { setTimeout(() => { this.pipe.next(); }, 1); }
}


class Layer {
    Show() { map.map.addLayer(this.layerGroup); }
    Hide() { map.map.removeLayer(this.layerGroup); }
    //--Internal---------------------------
    constructor(name, icon, dataUrl, panelEl, CreateLocationsFunction) {
        this.layerGroup = null;
        this.locations = [];
        this.panelGroupEl = panelEl;
        this.name = name;
        this.icon = icon;
        this.data = {};
        this.pipe = this._pipeline();
        this._dataUrl = dataUrl;
        this._createLocations = CreateLocationsFunction;

        map.layers.push(this);

        this.pipe.next();
    }
    _generate() {

        let PanelEl = $(`#${map.PanelEl}`);

        this.layerGroup = L.layerGroup();

        this.panelGroupEl = $(this.panelGroupEl);

        for (let i in this.locations) {
            let l = this.locations[i];
            l._generate();
            PanelEl.append(this.panelGroupEl);
        }
    }
    *_pipeline() {
        this._getData(); yield;
        this._createLocations(this, this.data); yield;
    }
    _getData() {
        if (typeof this._dataUrl == "string") { map.utils.getJSON(this, this._dataUrl); }
        else if (typeof this._dataUrl == "object") { this.data = this._dataUrl; this._next(); }
        else { console.log("Error loading data for " + typeof this._dataUrl + ": " + this.name); }
    }
    _next() { setTimeout(() => { this.pipe.next(); }, 1); }
}

class Location {
    //--Internal---------------------------
    constructor(layer, parentID, name, lat, long, iconData, locationEl) {
        this.layer = layer;
        this.parentID = parentID;
        this.name = name;
        this.lat = lat;
        this.long = long;
        this.iconData = iconData;
        this.locationEl = locationEl;

        layer.locations.push(this);
    }
    _generate() {

        let jQueryEl = $(this.locationEl);
        let PanelEl = $(`#${this.parentID}`);

        this.MapEl = this._createMapElement(jQueryEl);
        this._createMarker(jQueryEl);

        this.PanelEl = this._createPanelElement(jQueryEl);
        PanelEl.append(this.PanelEl);
    }
    _createIcon() {
        return L.icon({
            iconUrl: this.iconData.iconUrl,
            iconSize: this.iconData.iconSize,
            iconAnchor: this.iconData.iconAnchor,
            popupAnchor: this.iconData.popupAnchor
        });
    }
    _createMarker() {
        var marker = L.marker([this.lat, this.long], { icon: this._createIcon() }).addTo(this.layer.layerGroup);
        marker.bindPopup(this.MapEl);
        marker.addEventListener("click", () => { this._panTO(this.locationEl$) }, false);
    }
    _createPanelElement(loc$) {
        loc$.addClass("filterEl");

        loc$.append(`<hr class="mt-3 mb-2">`);
        return loc$.prop('outerHTML');
    }
    _panTO() {
        map.map.panTo([this.lat, this.long]);
    }
    _createMapElement(loc$) { return loc$.prop('outerHTML'); }
}

class Icon {
    constructor(iconUrl, iconSize, iconAnchor, popupAnchor) {
        this.iconUrl = iconUrl;
        this.iconSize = iconSize,
            this.iconAnchor = iconAnchor,
            this.popupAnchor = popupAnchor
    }
}

class Accordion {
    constructor(parentID, headerText, headerIconUrl, body) {
        if (!map.AccordionCount) { map.AccordionCount = 0; }
        map.AccordionCount += 1;
        this.html = this._generatePanel(parentID, headerText, headerIconUrl, body, map.AccordionCount)
    }
    //--Internal---------------------------
    _generatePanel(parentID, layerName, headerIconUrl, body, i) {
        let el =
            `<div class="card">
            <div class="card-header" id="heading${i}">
                <h2 class="mb-0">
                    <img src="${headerIconUrl}">
                    <button onclick="map.Hide_All_Layers(); map.Show_Layer('${layerName}');" class="btn btn-link collapsed" type="button" data-toggle="collapse" data-target="#collapse${i}" aria-expanded="true" aria-controls="collapse${i}">
                        ${layerName}
                    </button>
                </h2>
            </div>
            <div id="collapse${i}" class="collapse" aria-labelledby="heading${i}" data-parent="#${parentID}">
                ${body}
            </div>
        </div>`
        return el;
    }
}
class Overlay {
    constructor(parentID, headerText, headerIconUrl, body) {
        if (!map.AccordionCount) { map.AccordionCount = 0; }
        map.AccordionCount += 1;
        this.html = this._generatePanel(parentID, headerText, headerIconUrl, body, map.AccordionCount)
    }
    //--Internal---------------------------
    _generatePanel(parentID, layerName, headerIconUrl, body, i) {
        let el =
            `<div class="card" style="padding:5px; box-shadow: 0 0 3px #797979;>
            <div class="card-header" id="heading${i}" style="padding:0; margin:0;">
                <button onclick="map.Hide_All_Layers(); map.Show_Layer('${layerName}');" class="btn btn-link collapsed" type="button" data-toggle="collapse" data-target="#collapse${i}" aria-expanded="true" aria-controls="collapse${i}" style="padding:0; margin:0;">
                    <img src="${headerIconUrl}" title="${layerName}"> 
                </button>
            </div>
            <div id="collapse${i}" class="collapse" aria-labelledby="heading${i}" data-parent="#${parentID}">
                ${body}
            </div>
        </div>`
        return el;
    }
}


class Utils {
    //--Awake--(preload)
    getScript(url) { var s = document.createElement('script'); s.type = 'text/javascript'; s.src = url; document.getElementsByTagName('body')[0].appendChild(s); }
    getStyleSheet(url) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.type = 'text/css'; l.href = url; document.getElementsByTagName('head')[0].appendChild(l); }
    addStyle(rule) { $(`<style type='text/css'> ${rule} </style>`).appendTo("head"); }


    //--Start--(postload)
    getJSON(layer, url) {
        $.getJSON(url)
            .done((data) => {
                layer.data = data;
                layer.pipe.next();
            })
            .fail(function (x, t, e) {
                console.log(`Could not load ${layer.name} locations`);
            })
    }
    styleAttribution(attrClass) { $("." + attrClass).css("font-size", "8px"); }
    setCaseInsensitiveSearch() { jQuery.expr[':'].contains = function (a, i, m) { return jQuery(a).text().toUpperCase().indexOf(m[3].toUpperCase()) >= 0; }; }
    filterLocations(query) {
        var IDs = [];
        //Filter Side Panel
        $('.filterEl').show(); $('.filterEl:not(:contains(' + query + '))').each(function () { IDs.push(parseInt(this.id.split('_')[1], 10)); }).hide();
        //Filter Map Markers
        var mapIcons$ = $(".leaflet-marker-icon").show(); $.each(mapIcons$, function (i) { if ($.inArray(mapIcons$[i]._leaflet_id, IDs) >= 0) { $(mapIcons$[i]).hide(); } });
    }
}

//API and library for directions data 
//Documentation https://developer.mapquest.com/documentation/leaflet-plugins/open/
class MapQuest {
    From(_lat, _long) { map.mapquest.start = { latLng: { lat: _lat, lng: _long } }; }
    To(_lat, _long) { map.mapquest.end = { latLng: { lat: _lat, lng: _long } }; }
    Nav() {
        this.Clear();

        let dir = MQ.routing.directions()
            .on('success', function (data) { DirSuccess(data); })
            .on('error', function (N) { DirFail(); });

        dir.route({

            locations: [this.start, this.end]
        });

        this.MQlayer = MQ.routing.routeLayer
            ({
                directions: dir,
                draggable: false,
                fitBounds: true
            });

        map.map.addLayer(this.MQlayer);
    }
    Clear() {
        if (this.MQlayer != null) {
            map.map.removeLayer(this.MQlayer);
            this.MQlayer = null;
        }
    }
    Geolocate() {
        navigator.geolocation.getCurrentPosition(this._geoloc_success, this._geoloc_error);
    }
    constructor() {
        this.MQlayer = null;
        this.start = {};
        this.end = {};
        this.key = '3BMQH8k3qhg4GuGpuplGJDvsZDYkOfyI';
        this.legal = `<hr><small><b>Powered by MapQuest </b><a href="http://hello.mapquest.com/terms-of-use/">Terms</a><p>Use of directions and maps is subject to the MapQuest Terms of Use. We make no guarantee of the accuracy of their content, road conditions or route usability. You assume all risk of use</p></small>`;
    }
    //--Internal---------------------------
    _loaded() {
        $.getScript(`https://www.mapquestapi.com/sdk/leaflet/v2.2/mq-map.js?key=${map.mapquest.key}`, function (data, textStatus, jqxhr) {
            $.getScript(`https://www.mapquestapi.com/sdk/leaflet/v2.2/mq-routing.js?key=${map.mapquest.key}`);
        });
    }
    _geoloc_success(pos) {
        map.mapquest.From(pos.coords.latitude, pos.coords.longitude);
        map.mapquest.Nav();
    }
    _geoloc_error(err) {
        console.warn(`ERROR(${err.code}): ${err.message}`);
    }
}

//Geofenced Geocoding search functionality for NM
//Documentation - https://www.npmjs.com/package/@maptiler/geocoder & https://cloud.maptiler.com/geocoding/
class Maptiler {
    constructor() {
        this.key = "s2pZVV9fpaIS2jffulN8";
        map.utils.getScript("https://cdn.maptiler.com/maptiler-geocoder/v1.1.0/maptiler-geocoder.js");
        map.utils.getStyleSheet("https://cdn.maptiler.com/maptiler-geocoder/v1.1.0/maptiler-geocoder.css");
    }
    _loaded() {

        var map_searchbar_geocoder =
            new maptiler.Geocoder
                ({
                    input: 'search',
                    key: map.maptiler.key,
                    bounds: [-109.0514539, 31.3292864, -102.9935484, 37.0039269]
                });
        map_searchbar_geocoder.on('select', function (item) {
            let bounds =
                [
                    [item.bbox[1], item.bbox[0]],
                    [item.bbox[3], item.bbox[2]]
                ];
            map.map.fitBounds(bounds);
        });
    }
}