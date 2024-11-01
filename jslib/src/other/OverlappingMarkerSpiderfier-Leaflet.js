/** @preserve OverlappingMarkerSpiderfier
https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet
Copyright (c) 2011 - 2012 George MacKerron
Released under the MIT licence: http://opensource.org/licenses/mit-license
Note: The Leaflet maps API must be included *before* this code
*/
(function () {
  var hasProp = {}.hasOwnProperty;
  null != this.L &&
(this['OverlappingMarkerSpiderfier'] = (function() {
  var _Class, p, twoPi;

  _Class = class {
    // Note: it's OK that this constructor comes after the properties, because of function hoisting
    constructor(map, opts = {}) {
      var e, j, k, len, ref, v;
      this.map = map;
      for (k in opts) {
        if (!hasProp.call(opts, k)) continue;
        v = opts[k];
        (this[k] = v);
      }
      this.initMarkerArrays();
      this.listeners = {};
      ref = ['click', 'zoomend'];
      for (j = 0, len = ref.length; j < len; j++) {
        e = ref[j];
        this.map.addEventListener(e, () => {
          return this['unspiderfy']();
        });
      }
    }

  };

  p = _Class.prototype; // this saves a lot of repetition of .prototype that isn't optimized away

  p['VERSION'] = '0.2.6';

  twoPi = Math.PI * 2;

  p['keepSpiderfied'] = false; // yes -> don't unspiderfy when a marker is selected

  p['nearbyDistance'] = 20; // spiderfy markers within this range of the one clicked, in px

  p['circleSpiralSwitchover'] = 9; // show spiral instead of circle from this marker count upwards

  // 0 -> always spiral; Infinity -> always circle
  p['circleFootSeparation'] = 25; // related to circumference of circle

  p['circleStartAngle'] = twoPi / 12;

  p['spiralFootSeparation'] = 28; // related to size of spiral (experiment!)

  p['spiralLengthStart'] = 11; // ditto

  p['spiralLengthFactor'] = 5; // ditto

  p['legWeight'] = 1.5;

  p['legColors'] = {
    'usual': '#222',
    'highlighted': '#f00'
  };

  p.initMarkerArrays = function() {
    this.markers = [];
    this.markerListeners = [];
  };

  p['addMarker'] = function(marker) {
    if (marker['_oms'] != null) {
      return this;
    }
    marker['_oms'] = true;
    var markerListener = () => {
      return this.spiderListener(marker);
    };
    marker.addEventListener('click', markerListener);
    this.markerListeners.push(markerListener);

    //mhl = this.makeStackedHighlightListeners(marker);
    //marker['_oms'].stackedHighlightListeners = mhl;
    //marker.addEventListener('mouseover', mhl.highlight);
    //marker.addEventListener('mouseout', mhl.unhighlight);

    this.markers.push(marker);
    return this;
  };

  p['getMarkers'] = function() {
    return this.markers.slice(0);
  };

  p['removeMarker'] = function(marker) {
    if (marker['_omsData'] != null) {
      this['unspiderfy']();
    }
    this.removeSpiderListeners(marker, null);
    delete marker['_oms'];
    this.markers.splice(i, 1);
    return this;
  };

  p['clearMarkers'] = function() {
    this['unspiderfy']();
    var ref = this.markers;
    for (var i = j = 0, len = ref.length; j < len; i = ++j) {
      var marker = ref[i];
      this.removeSpiderListeners(marker, this.markerListeners[i]);
      delete marker['_oms'];
    }
    this.initMarkerArrays();
    return this;
  };

  // available listeners: click(marker), spiderfy(markers), unspiderfy(markers)
  p['addListener'] = function(event, func) {
    var base;
    ((base = this.listeners)[event] != null ? base[event] : base[event] = []).push(func);
    return this;
  };

  p['removeListener'] = function(event, func) {
    var i;
    i = this.arrIndexOf(this.listeners[event], func);
    if (!(i < 0)) {
      this.listeners[event].splice(i, 1);
    }
    return this;
  };

  p['clearListeners'] = function(event) {
    this.listeners[event] = [];
    return this;
  };

  p.trigger = function(event, ...args) {
    var func, j, len, ref, ref1, results;
    ref1 = (ref = this.listeners[event]) != null ? ref : [];
    results = [];
    for (j = 0, len = ref1.length; j < len; j++) {
      func = ref1[j];
      results.push(func(...args));
    }
    return results;
  };

  p['removeSpiderListeners'] = function(marker, markerListener) {
    if (markerListener == null) {
      var i = this.arrIndexOf(this.markers, marker);
      if (i >= 0) {
        markerListener = this.markerListeners.splice(i, 1)[0];
      }
    }
    if (markerListener != null) {
      marker.removeEventListener('click', markerListener);
    }

    //var mhl = marker['_oms'] == null ? null : marker['_oms'].StackedHighlightListeners;
    //if (mhl != null) {
    //  marker.removeEventListener('mouseover', mhl.highlight);
    //  marker.removeEventListener('mouseout', mhl.unhighlight);
    //}
  }

  p.generatePtsCircle = function(count, centerPt) {
    var angle, angleStep, circumference, i, j, legLength, ref, results;
    circumference = this['circleFootSeparation'] * (2 + count);
    legLength = circumference / twoPi; // = radius from circumference
    angleStep = twoPi / count;
    results = [];
    for (i = j = 0, ref = count; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
      angle = this['circleStartAngle'] + i * angleStep;
      results.push(new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle)));
    }
    return results;
  };

  p.generatePtsSpiral = function(count, centerPt) {
    var angle, i, j, legLength, pt, ref, results;
    legLength = this['spiralLengthStart'];
    angle = 0;
    results = [];
    for (i = j = 0, ref = count; (0 <= ref ? j < ref : j > ref); i = 0 <= ref ? ++j : --j) {
      angle += this['spiralFootSeparation'] / legLength + i * 0.0005;
      pt = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle));
      legLength += twoPi * this['spiralLengthFactor'] / angle;
      results.push(pt);
    }
    return results;
  };

  p.findNearbyMarkers = function(marker) {
    var nearbyMarkerData = [];
    var nonNearbyMarkers = [];
    var pxSq = this['nearbyDistance'] * this['nearbyDistance'];
    var markerPt = this.map.latLngToLayerPoint(marker.getLatLng());
    var ref = this.markers;
    for (var j = 0, len = ref.length; j < len; j++) {
      var m = ref[j];
      if (!this.map.hasLayer(m)) {
        continue;
      }
      var mPt = this.map.latLngToLayerPoint(m.getLatLng());
      if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
        nearbyMarkerData.push({
          marker: m,
          markerPt: mPt
        });
      } else {
        nonNearbyMarkers.push(m);
      }
    }
    return [nearbyMarkerData, nonNearbyMarkers];
  }

  p.spiderListener = function(marker) {
    var j, len, m, mPt, markerPt, markerSpiderfied, pxSq, ref;
    markerSpiderfied = marker['_omsData'] != null;
    if (!(markerSpiderfied && this['keepSpiderfied'])) {
      this['unspiderfy']();
    }
    if (markerSpiderfied) {
      return this.trigger('click', marker);
    } else {
      const [nearbyMarkerData, nonNearbyMarkers] = this.findNearbyMarkers(marker);

      if (nearbyMarkerData.length === 1) { // 1 => the one clicked => none nearby
        return this.trigger('click', marker);
      } else {
        return this.spiderfy(nearbyMarkerData, nonNearbyMarkers);
      }
    }
  };

  //p.stackedHighlight = function(marker, highlight) {
    //console.log(marker);
    //icon = marker.getIcon();
    //if (icon !== null) {
    //  if (highlight) {
    //  } else {
    //  }
    //}
  //}

  //p.makeStackedHighlightListeners = function(marker) {
  //  return {
  //    highlight: () => {
  //      this.stackedHighlight(marker, true);
  //    },
  //    unhighlight: () => {
  //      this.stackedHighlight(marker, false);
  //    }
  //  };
  //};

  p.makeLegHighlightListeners = function(marker) {
    return {
      highlight: () => {
        return marker['_omsData'].leg.setStyle({
          color: this['legColors']['highlighted']
        });
      },
      unhighlight: () => {
        return marker['_omsData'].leg.setStyle({
          color: this['legColors']['usual']
        });
      }
    };
  };

  p.spiderfy = function(markerData, nonNearbyMarkers) {
    var bodyPt, footLl, footPt, footPts, leg, marker, md, mhl, nearestMarkerDatum, numFeet, spiderfiedMarkers;
    this.spiderfying = true;
    numFeet = markerData.length;
    bodyPt = this.ptAverage((function() {
      var j, len, results;
      results = [];
      for (j = 0, len = markerData.length; j < len; j++) {
        md = markerData[j];
        results.push(md.markerPt);
      }
      return results;
    })());
    footPts = numFeet >= this['circleSpiralSwitchover'] ? this.generatePtsSpiral(numFeet, bodyPt).reverse() : this.generatePtsCircle(numFeet, bodyPt); // match from outside in => less criss-crossing
    spiderfiedMarkers = (function() {
      var j, len, results;
      results = [];
      for (j = 0, len = footPts.length; j < len; j++) {
        footPt = footPts[j];
        footLl = this.map.layerPointToLatLng(footPt);
        nearestMarkerDatum = this.minExtract(markerData, (md) => {
          return this.ptDistanceSq(md.markerPt, footPt);
        });
        marker = nearestMarkerDatum.marker;
        leg = new L.Polyline([marker.getLatLng(), footLl], {
          color: this['legColors']['usual'],
          weight: this['legWeight'],
          clickable: false
        });
        this.map.addLayer(leg);
        marker['_omsData'] = {
          usualPosition: marker.getLatLng(),
          leg: leg
        };
        if (this['legColors']['highlighted'] !== this['legColors']['usual']) {
          mhl = this.makeLegHighlightListeners(marker);
          marker['_omsData'].legHighlightListeners = mhl;
          marker.addEventListener('mouseover', mhl.highlight);
          marker.addEventListener('mouseout', mhl.unhighlight);
        }
        marker.setLatLng(footLl);
        marker.setZIndexOffset(1000000);
        results.push(marker);
      }
      return results;
    }).call(this);
    delete this.spiderfying;
    this.spiderfied = true;
    return this.trigger('spiderfy', spiderfiedMarkers, nonNearbyMarkers);
  };

  p['unspiderfy'] = function(markerNotToMove = null) {
    var j, len, marker, mhl, nonNearbyMarkers, ref, unspiderfiedMarkers;
    if (this.spiderfied == null) {
      return this;
    }
    this.unspiderfying = true;
    unspiderfiedMarkers = [];
    nonNearbyMarkers = [];
    ref = this.markers;
    for (j = 0, len = ref.length; j < len; j++) {
      marker = ref[j];
      if (marker['_omsData'] != null) {
        this.map.removeLayer(marker['_omsData'].leg);
        if (marker !== markerNotToMove) {
          marker.setLatLng(marker['_omsData'].usualPosition);
        }
        marker.setZIndexOffset(0);
        mhl = marker['_omsData'].legHighlightListeners;
        if (mhl != null) {
          marker.removeEventListener('mouseover', mhl.highlight);
          marker.removeEventListener('mouseout', mhl.unhighlight);
        }
        delete marker['_omsData'];
        unspiderfiedMarkers.push(marker);
      } else {
        nonNearbyMarkers.push(marker);
      }
    }
    delete this.unspiderfying;
    delete this.spiderfied;
    this.trigger('unspiderfy', unspiderfiedMarkers, nonNearbyMarkers);
    return this;
  };

  p.ptDistanceSq = function(pt1, pt2) {
    var dx, dy;
    dx = pt1.x - pt2.x;
    dy = pt1.y - pt2.y;
    return dx * dx + dy * dy;
  };

  p.ptAverage = function(pts) {
    var j, len, numPts, pt, sumX, sumY;
    sumX = sumY = 0;
    for (j = 0, len = pts.length; j < len; j++) {
      pt = pts[j];
      sumX += pt.x;
      sumY += pt.y;
    }
    numPts = pts.length;
    return new L.Point(sumX / numPts, sumY / numPts);
  };

  p.minExtract = function(set, func) { // destructive! returns minimum, and also removes it from the set
    var bestIndex, bestVal, index, item, j, len, val;
    for (index = j = 0, len = set.length; j < len; index = ++j) {
      item = set[index];
      val = func(item);
      if ((typeof bestIndex === "undefined" || bestIndex === null) || val < bestVal) {
        bestVal = val;
        bestIndex = index;
      }
    }
    return set.splice(bestIndex, 1)[0];
  };

  p.arrIndexOf = function(arr, obj) {
    if (arr.indexOf != null) {
      return arr.indexOf(obj);
    }
    var a, d, g, f;
    a = g = 0;
    for (f = arr.length; g < f; a = ++g)
      if (((d = arr[a]), d === obj))
        return a;
    return -1;
  };

  return _Class;

})());
}.call(this));

