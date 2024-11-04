// Original: https://github.com/arnaugarcia/Leaflet.Canvas-Markers
// Changes:
//   * Firing click/mouseover/mouseout events on the layer
//   * Redraw deferred for 150ms after changes (necessary for big marker sets)

function layerFactory(L) {

    const CanvasIconLayer = (L.LayerGroup ? L.LayerGroup : L.Class).extend({

        //Add event listeners to initialized section.
        initialize: function (options) {
            L.LayerGroup.prototype.initialize.call(this, [], options);

            //L.setOptions(this, options);
            this._onClickListeners = [];
            this._onHoverListeners = [];
            this._onMouseOverListeners = [];
            this._onMouseOutListeners = [];
        },

        setOptions: function (options) {

            L.setOptions(this, options);
            return this.redraw();
        },

        //Multiple layers at a time for rBush performance
        addMarkers: function (markers) {

            var self = this;
            var tmpMark = [];
            var tmpLatLng = [];

            markers.forEach(function (marker) {

                if (!((marker.options.pane == 'markerPane') && marker.options.icon)) {
                    console.error('Layer isn\'t a marker');
                    return;
                }

                var latlng = marker.getLatLng();
                var isDisplaying = self._map.getBounds().contains(latlng);
                var s = self._addMarker(marker, latlng, isDisplaying);

                //Only add to Point Lookup if we are on map
                if (isDisplaying === true) tmpMark.push(s[0]);

                tmpLatLng.push(s[1]);
            });

            self._markers.load(tmpMark);
            self._latlngMarkers.load(tmpLatLng);
        },

        //Adds single layer at a time. Less efficient for rBush
        addMarker: function (marker) {
            const coordinate = marker.getLatLng();
            const isDisplaying = this._map.getBounds().contains(coordinate);
            const dat = this._addMarker(marker, coordinate, isDisplaying);

            //Only add to Point Lookup if we are on map
            if (isDisplaying === true) this._markers.insert(dat[0]);

            this._latlngMarkers.insert(dat[1]);
        },

        addLayer: function (layer) {
            if ((layer.options.pane !== 'markerPane')) {
                console.log(layer);
            }
            if ((layer.options.pane === 'markerPane') && layer.options.icon) this.addMarker(layer);
            else console.error('Layer isn\'t a marker');
        },

        addLayers: function (layers) {
            this.addMarkers(layers);
        },

        removeLayer: function (layer) {
            this.removeMarker(layer, true);
        },

  	layerGroupRemoveLayer: function (layer) {
            // overriding function of L.LayerGroup.prototype.removeMarker
            // (we do not want to remove the layer from the map here)
            var id = layer in this._layers ? layer : this.getLayerId(layer);
            delete this._layers[id];
            return this;
        },

        removeMarker: function (marker, redraw) {
            this.layerGroupRemoveLayer(marker);

            //If we are removed point
            if (marker["minX"]) marker = marker.data;

            var latlng = marker.getLatLng();
            var isDisplaying = this._map.getBounds().contains(latlng);

            var markerData = {

                minX: latlng.lng,
                minY: latlng.lat,
                maxX: latlng.lng,
                maxY: latlng.lat,
                data: marker
            };

            this._latlngMarkers.remove(markerData, function (a, b) {

                return a.data._leaflet_id === b.data._leaflet_id;
            });

            this._latlngMarkers.total--;
            this._latlngMarkers.dirty++;

            if (isDisplaying === true && redraw === true) {
                this._redraw(true);
            }
        },

        onAdd: function (map) {

            this._map = map;

            if (!this._canvas) this._initCanvas();

            if (this.options.pane) this.getPane().appendChild(this._canvas);
            else map._panes.overlayPane.appendChild(this._canvas);

            map.on('moveend', this._reset, this);
            map.on('resize', this._reset, this);

            map.on('click', this._executeListeners, this);
            map.on('mousemove', this._executeListeners, this);
        },

        onRemove: function (map) {

            if (this.options.pane) this.getPane().removeChild(this._canvas);
            else map.getPanes().overlayPane.removeChild(this._canvas);

            map.off('click', this._executeListeners, this);
            map.off('mousemove', this._executeListeners, this);

            map.off('moveend', this._reset, this);
            map.off('resize', this._reset, this);
        },

        addTo: function (map) {

            map.addLayer(this);
            return this;
        },

        clearLayers: function (redraw= true) {
            this._layers = {}; // faster then LayerGroup.clearLayers() in L.LayerGroup;
            this._latlngMarkers = null;
            this._markers = null;
            this._redraw(redraw);
        },

        _closePopup: function (marker) {
            marker.closePopup();
        },

        addListener: function (event, func) {
            (this.listeners[event] != null ? this.listeners[event] : (this.listeners[event] = [])).push(func);
            return this;  // return self, for chaining
        },

  	layerGroupAddLayer: function (layer) {
            // overriding function of L.LayerGroup.prototype.addLayer\
            // (we do not want to add layer to map here)
            var id = this.getLayerId(layer);
            this._layers[id] = layer;
            return this;
  	},

        _addMarker: function (marker, latlng, isDisplaying) {
            this.layerGroupAddLayer(marker);

            var self = this;

            //Needed for pop-up & tooltip to work.
            marker._map = self._map;

            // move is fired on setLatLng (e.g. when un/spiderfying markers)
            marker.on('move', function () {
              self._redraw(true);
            });

            // when new is icon set, delete cached image
            marker.on('icon-set', function () {
              marker.canvas_img = null;
              self._redraw(true);
            });

            //_markers contains Points of markers currently displaying on map
            if (!self._markers) self._markers = new rbush();

            //_latlngMarkers contains Lat\Long coordinates of all markers in layer.
            if (!self._latlngMarkers) {
                self._latlngMarkers = new rbush();
                self._latlngMarkers.dirty = 0;
                self._latlngMarkers.total = 0;
            }

            L.Util.stamp(marker);

            var pointPos = self._map.latLngToContainerPoint(latlng);
            var iconSize = marker.options.icon.options.iconSize;

            var adj_x = iconSize[0] / 2;
            var adj_y = iconSize[1] / 2;
            var ret = [({
                minX: (pointPos.x - adj_x),
                minY: (pointPos.y - adj_y),
                maxX: (pointPos.x + adj_x),
                maxY: (pointPos.y + adj_y),
                data: marker
            }), ({
                minX: latlng.lng,
                minY: latlng.lat,
                maxX: latlng.lng,
                maxY: latlng.lat,
                data: marker
            })];

            self._latlngMarkers.dirty++;
            self._latlngMarkers.total++;

            //Only draw if we are on map
            if (isDisplaying === true) self._drawMarker(marker, pointPos);

            return ret;
        },

        _drawMarker: function (marker, pointPos) {

            var self = this;

            if (!this._imageLookup) this._imageLookup = {};
            if (!pointPos) {

                pointPos = self._map.latLngToContainerPoint(marker.getLatLng());
            }

            if (marker.canvas_img) {

                self._drawImage(marker, pointPos);
            } else {

                 var iconUrl = marker.options.icon.options.iconUrl;

                if (self._imageLookup[iconUrl]) {

                    marker.canvas_img = self._imageLookup[iconUrl][0];

                    if (self._imageLookup[iconUrl][1] === false) {

                        self._imageLookup[iconUrl][2].push([marker, pointPos]);
                    } else {

                        self._drawImage(marker, pointPos);
                    }
                } else {

                    var i = new Image();
                    i.src = iconUrl;
                    marker.canvas_img = i;

                    //Image,isLoaded,marker\pointPos ref
                    self._imageLookup[iconUrl] = [i, false, [[marker, pointPos]]];

                    i.onload = function () {

                        self._imageLookup[iconUrl][1] = true;
                        self._imageLookup[iconUrl][2].forEach(function (e) {

                            self._drawImage(e[0], e[1]);
                        });
                    }
                }
            }
        },

        _drawImage: function (marker, pointPos) {

            const options = marker.options.icon.options;

            this._context.drawImage(
                marker.canvas_img,
                pointPos.x - options.iconAnchor[0],
                pointPos.y - options.iconAnchor[1],
                options.iconSize[0],
                options.iconSize[1]
            );
        },

        _reset: function () {

            var topLeft = this._map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(this._canvas, topLeft);

            var size = this._map.getSize();

            this._canvas.width = size.x;
            this._canvas.height = size.y;

            this._redraw();
        },

        _redraw: function (clear) {
            var self = this;
            // only redraw after some period - for perfomance reasons, when
            // adding/removing many markers in a bunch
            if (!self.redraw_postponed) {
              self.redraw_postponed = true;
              self.redraw_clear = false;
              setTimeout(() => {
                  self.redraw_postponed = false;
                  self._redraw_worker(self.redraw_clear);
              }, 150);
            }
            // if there was some request to clear, then obey it
            self.redraw_clear |= clear;
        },

        _redraw_worker: function (clear) {

            var self = this;

            if (clear) {
              this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
              //console.log("canvas cleared");
            }

            if (!this._map || !this._latlngMarkers)
              return;

            var tmp = [];

            //If we are 10% individual inserts\removals, reconstruct lookup for efficiency
            if (self._latlngMarkers.dirty / self._latlngMarkers.total >= .1) {

                self._latlngMarkers.all().forEach(function (e) {

                    tmp.push(e);
                });

                self._latlngMarkers.clear();
                self._latlngMarkers.load(tmp);
                self._latlngMarkers.dirty = 0;
                tmp = [];
            }

            var mapBounds = self._map.getBounds();

            //Only re-draw what we are showing on the map.

            var mapBoxCoords = {
                minX: mapBounds.getWest(),
                minY: mapBounds.getSouth(),
                maxX: mapBounds.getEast(),
                maxY: mapBounds.getNorth(),
            };

            self._latlngMarkers.search(mapBoxCoords).forEach(function (e) {

                //Readjust Point Map
                var pointPos = self._map.latLngToContainerPoint(e.data.getLatLng());

                var iconSize = e.data.options.icon.options.iconSize;
                var adj_x = iconSize[0] / 2;
                var adj_y = iconSize[1] / 2;

                var newCoords = {
                    minX: (pointPos.x - adj_x),
                    minY: (pointPos.y - adj_y),
                    maxX: (pointPos.x + adj_x),
                    maxY: (pointPos.y + adj_y),
                    data: e.data
                }

                tmp.push(newCoords);

                //Redraw points
                self._drawMarker(e.data, pointPos);
            });

            //Clear rBush & Bulk Load for performance
            this._markers.clear();
            this._markers.load(tmp);
        },

        _initCanvas: function () {

            this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-icon-layer leaflet-layer');
            var originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
            this._canvas.style[originProp] = '50% 50%';

            var size = this._map.getSize();
            this._canvas.width = size.x;
            this._canvas.height = size.y;

            this._context = this._canvas.getContext('2d');

            var animated = this._map.options.zoomAnimation && L.Browser.any3d;
            L.DomUtil.addClass(this._canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
        },

        addOnClickListener: function (listener) {
            this._onClickListeners.push(listener);
        },

        addOnHoverListener: function (listener) {
            this._onHoverListeners.push(listener);
        },

        addOnMouseOverListener: function (listener) {
            this._onMouseOverListeners.push(listener);
        },

        addOnMouseOutListener: function (listener) {
            this._onMouseOutListeners.push(listener);
        },

        _executeListeners: function (event) {

            if (!this._markers) return;

            var me = this;
            var x = event.containerPoint.x;
            var y = event.containerPoint.y;

            var ret = this._markers.search({minX: x, minY: y, maxX: x, maxY: y});

            if (ret && ret.length == 0) {
              ret = null;
            }

            if (ret) {

                me._map._container.style.cursor = "pointer";
                //~ L.DomUtil.addClass(this._container, "leaflet-interactive"); // change cursor

                if (event.type === "click") {

                    const hasPopup = ret[0].data.getPopup();
                    if (hasPopup) ret[0].data.openPopup();

                    me._onClickListeners.forEach(function (listener) {
                        listener(event, ret);
                    });

                    const fakeStop =
                        L.DomEvent.fakeStop ||
                        L.DomEvent._fakeStop ||
                        L.DomEvent.stop;
                    fakeStop && fakeStop(event);
                    this._fireEvent([ret[0].data], event, "click");
                }
              } else {

                  me._map._container.style.cursor = "";
              }

              if (event.type === "mousemove") {

                  if ((me._lastRet == null && ret != null) ||
                      (me._lastRet != null && ret == null) ||
                      (me._lastRet != null && ret != null &&
                       me._lastRet[0].data._leaflet_id != ret[0].data._leaflet_id
                      )
                     ) {
                     //console.log("last: ", me._lastRet);
                     //console.log("ret: ", ret);

                    if (me._lastRet != null) {

                        if (me._openToolTip) {
                            me._openToolTip.closeTooltip();
                            delete me._openToolTip;
                        }
                        this._fireEvent([me._lastRet[0].data], event, "mouseout");
                        me._onMouseOutListeners.forEach(function (listener) { listener(event, me._lastRet); });
                    }
                    if (ret != null) {

                        var hasTooltip = ret[0].data.getTooltip();
                        if (hasTooltip) {
                            me._openToolTip = ret[0].data;
                            ret[0].data.openTooltip();
                        }

                        this._fireEvent([ret[0].data], event, "mouseover");
                        me._onMouseOverListeners.forEach(function (listener) { listener(event, ret); });
                        me._lastRet = ret;
                    }
                    me._lastRet = ret;
                  }

                  me._onHoverListeners.forEach(function (listener) {
                      listener(event, ret);
                  });
              }
        },

        _fireEvent: function (layers, e, type) {
            if (e.layerPoint && layers.length > 0) {
                layers[0].fire(type || e.type, e, true);
                return;
            }
            L.Canvas.prototype._fireEvent.call(this, layers, e, type);
        },

    });

    L.canvasIconLayer = function (options) {
        return new CanvasIconLayer(options);
    };
}

window.L.CanvasIconLayer = layerFactory(L);
