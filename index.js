/*
mapbox-to-ol-style - Create OpenLayers style functions from Mapbox Style objects
Copyright 2016-present Boundless Spatial, Inc.
License: https://raw.githubusercontent.com/boundlessgeo/mapbox-to-ol-style/master/LICENSE.md
*/

import Style from 'ol/style/style';
import Fill from 'ol/style/fill';
import Stroke from 'ol/style/stroke';
import Circle from 'ol/style/circle';
import glfunc from '@mapbox/mapbox-gl-style-spec/function';
import createFilter from '@mapbox/mapbox-gl-style-spec/feature_filter';
import mb2css from 'mapbox-to-css-font';
import labelgun from 'labelgun/src/labelgun';

const functions = {
  interpolated: [
    'line-miter-limit',
    'fill-opacity',
    'line-opacity',
    'line-width',
    'text-halo-width',
    'text-max-width',
    'text-offset',
    'text-opacity',
    'text-rotate',
    'text-size',
    'icon-opacity',
    'icon-rotate',
    'icon-size',
    'circle-radius'
  ],
  'piecewise-constant': [
    'fill-color',
    'fill-outline-color',
    'icon-image',
    'line-cap',
    'line-color',
    'line-join',
    'line-dasharray',
    'text-anchor',
    'text-color',
    'text-field',
    'text-font',
    'text-halo-color',
    'circle-color',
    'circle-stroke-color'
  ]
};

const defaults = {
  'fill-opacity': 1,
  'line-cap': 'butt',
  'line-join': 'miter',
  'line-miter-limit': 2,
  'line-opacity': 1,
  'line-width': 1,
  'text-anchor': 'center',
  'text-color': '#000000',
  'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
  'text-halo-color': 'rgba(0, 0, 0, 0)',
  'text-halo-width': 0,
  'text-max-width': 10,
  'text-offset': [0, 0],
  'text-opacity': 1,
  'text-rotate': 0,
  'text-size': 16,
  'icon-opacity': 1,
  'icon-rotate': 0,
  'icon-size': 1,
  'circle-color': '#000000',
  'circle-stroke-color': '#000000'
};

const types = {
  'Point': 1,
  'MultiPoint': 1,
  'LineString': 2,
  'MultiLineString': 2,
  'Polygon': 3,
  'MultiPolygon': 3
};

function voidFn() {}

function applyDefaults(properties) {
  for (let property in defaults) {
    if (!(property in properties)) {
      properties[property] = defaults[property];
    }
  }
}

function applyLayoutToPaint(layer) {
  for (let property in layer.layout) {
    if (!layer.paint[property]) {
      layer.paint[property] = layer.layout[property];
    }
  }
}

function convertToFunctions(properties, type) {
  const propertySpec = {
    function: type
  };
  for (let i = 0, ii = functions[type].length; i < ii; ++i) {
    let property = functions[type][i];
    if (property in properties) {
      properties[property] = glfunc(properties[property], propertySpec);
    }
  }
}

const fontMap = {};

function chooseFont(fonts, availableFonts) {
  if (availableFonts) {
    let font, i, ii;
    if (!Array.isArray(fonts)) {
      let stops = fonts.stops;
      if (stops) {
        for (i = 0, ii = stops.length; i < ii; ++i) {
          chooseFont(stops[i][1], availableFonts);
        }
      }
      return;
    }
    if (!fontMap[fonts]) {
      for (i = 0, ii = fonts.length; i < ii; ++i) {
        font = fonts[i];
        if (availableFonts.indexOf(font) >= -1) {
          fontMap[fonts] = font;
          break;
        }
      }
    }
  } else {
    fontMap[fonts] = fonts[0];
  }
}

function preprocess(layer, fonts) {
  if (!layer.paint) {
    layer.paint = {};
  }
  if (!layer.ref) {
    applyLayoutToPaint(layer);
  }
  applyDefaults(layer.paint);
  if (layer.paint['text-field']) {
    chooseFont(layer.paint['text-font'], fonts);
  }
  if (Array.isArray(layer.filter)) {
    layer.filter = createFilter(layer.filter);
  }
  convertToFunctions(layer.paint, 'interpolated');
  convertToFunctions(layer.paint, 'piecewise-constant');
}

function resolveRef(layer, glStyleObj) {
  if (layer.ref) {
    let layers = glStyleObj.layers;
    for (let i = 0, ii = layers.length; i < ii; ++i) {
      let refLayer = layers[i];
      if (refLayer.id == layer.ref) {
        layer.type = refLayer.type;
        layer.source = refLayer.source;
        layer['source-layer'] = refLayer['source-layer'];
        layer.minzoom = refLayer.minzoom;
        layer.maxzoom = refLayer.maxzoom;
        layer.filter = refLayer.filter;
        layer.layout = refLayer.layout;
        return;
      }
    }
  }
}

function getZoomForResolution(resolution, resolutions) {
  let candidate;
  let i = 0, ii = resolutions.length;
  for (; i < ii; ++i) {
    candidate = resolutions[i];
    if (candidate < resolution && i + 1 < ii) {
      let zoomFactor = resolutions[i] / resolutions[i + 1];
      return i + Math.log(resolutions[i] / resolution) / Math.log(zoomFactor);
    }
  }
  return ii - 1;
}

const colorElement = document.createElement('div');
const colorRegEx = /^rgba?\((.*)\)$/;
const colorCache = {};

function colorWithOpacity(color, opacity) {
  if (color && opacity !== undefined) {
    let colorData = colorCache[color];
    if (!colorData) {
      colorElement.style.color = color;
      document.body.appendChild(colorElement);
      let colorString = getComputedStyle(colorElement).getPropertyValue('color');
      document.body.removeChild(colorElement);
      let colorArray = colorString.match(colorRegEx)[1].split(',').map(Number);
      if (colorArray.length == 3) {
        colorArray.push(1);
      }
      colorCache[color] = colorData = {
        color: colorArray,
        opacity: colorArray[3]
      };
    }
    color = colorData.color;
    color[3] = colorData.opacity * opacity;
    if (color[3] === 0) {
      color = undefined;
    }
  }
  return color;
}

function deg2rad(degrees) {
  return degrees * Math.PI / 180;
}

const templateRegEx = /^(.*)\{(.*)\}(.*)$/;

function fromTemplate(text, properties) {
  const parts = text.match(templateRegEx);
  if (parts) {
    let value = properties[parts[2]] || '';
    return parts[1] + value + parts[3];
  } else {
    return text;
  }
}

function sortByWidth(a, b) {
  const extentA = a.getExtent();
  const extentB = b.getExtent();
  return (extentB[2] - extentB[0]) - (extentA[2] - extentA[0]);
}


/**
 * Creates a style function from the `glStyle` object for all layers that use
 * the specified `source`, which needs to be a `"type": "vector"` or
 * `"type": "geojson"` source and applies it to the specified OpenLayers layer.
 *
 * @param {ol.layer.Vector|ol.layer.VectorTile} olLayer OpenLayers layer.
 * @param {string|Object} glStyle Mapbox Style object.
 * @param {string|Array<string>} source `source` key or an array of layer `id`s
 * from the Mapbox Style object. When a `source` key is provided, all layers for
 * the specified source will be included in the style function. When layer `id`s
 * are provided, they must be from layers that use the same source.
 * @param {Array<number>} [resolutions=[156543.03392804097,
 * 78271.51696402048, 39135.75848201024, 19567.87924100512, 9783.93962050256,
 * 4891.96981025128, 2445.98490512564, 1222.99245256282, 611.49622628141,
 * 305.748113140705, 152.8740565703525, 76.43702828517625, 38.21851414258813,
 * 19.109257071294063, 9.554628535647032, 4.777314267823516, 2.388657133911758,
 * 1.194328566955879, 0.5971642834779395, 0.29858214173896974,
 * 0.14929107086948487, 0.07464553543474244]]
 * Resolutions for mapping resolution to zoom level.
 * @param {Object} [spriteData=undefined] Sprite data from the url specified in
 * the Mapbox Style object's `sprite` property. Only required if a `sprite`
 * property is specified in the Mapbox Style object.
 * @param {Object} [spriteImageUrl=undefined] Sprite image url for the sprite
 * specified in the Mapbox Style object's `sprite` property. Only required if a
 * `sprite` property is specified in the Mapbox Style object.
 * @param {Array<string>} [fonts=undefined] Array of available fonts, using the
 * same font names as the Mapbox Style object. If not provided, the style
 * function will always use the first font from the font array.
 * @return {ol.style.StyleFunction} Style function for use in
 * `ol.layer.Vector` or `ol.layer.VectorTile`.
 */
function applyStyleFunction(olLayer, glStyle, source, resolutions, spriteData, spriteImageUrl, fonts) {
  if (!resolutions) {
    resolutions = [];
    for (let res = 156543.03392804097; resolutions.length < 22; res /= 2) {
      resolutions.push(res);
    }
  }
  if (typeof glStyle == 'object') {
    // We do not want to modify the original, so we deep-clone it
    glStyle = JSON.stringify(glStyle);
  }
  glStyle = JSON.parse(glStyle);
  if (glStyle.version !== 8) {
    throw new Error('glStyle version 8 required.');
  }

  let spriteImage;
  if (spriteImageUrl) {
    let img = new Image();
    img.onload = function() {
      spriteImage = img;
      olLayer.changed();
    };
    img.src = spriteImageUrl;
  }

  const ctx = document.createElement('CANVAS').getContext('2d');
  const measureCache = {};

  function wrapText(text, font, em) {
    let key = em + ',' + font + ',' + text;
    let lines = measureCache[key];
    if (!lines) {
      ctx.font = font;
      let oneEm = ctx.measureText('M').width;
      let width = oneEm * em;
      let words = text.split(' ');
      let line = '';
      lines = [];
      for (let i = 0, ii = words.length; i < ii; ++i) {
        let word = words[i];
        if ((ctx.measureText(line + word).width <= width)) {
          line += (line ? ' ' : '') + word;
        } else {
          if (line) {
            lines.push(line);
          }
          line = word;
        }
      }
      if (line) {
        lines.push(line);
      }
      measureCache[key] = lines;
    }
    return lines;
  }

  let textCache = {};
  let labels;
  let gutter;
  const labelEngine = new labelgun(voidFn, voidFn);

  function createIconLabelCombo(iconStyle, textStyle, coord, state, weight) {
    let pixelRatio = state.pixelRatio;
    let bottomLeft = [Infinity, Infinity];
    let topRight = [-Infinity, -Infinity];
    let bounds = {
      bottomLeft: bottomLeft,
      topRight: topRight
    };
    let instructions = [];
    let iconX, iconY, img, imgData, scale, width, height;
    if (iconStyle) {
      img = iconStyle.img;
      scale = iconStyle.scale * pixelRatio;
      imgData = iconStyle.imgData;
      width = imgData.width;
      height = imgData.height;
      iconX = coord[0] - width / 2 * scale;
      iconY = coord[1] - height / 2 * scale;
      bottomLeft[0] = iconX;
      bottomLeft[1] = iconY;
      topRight[0] = coord[0] + width / 2 * scale;
      topRight[1] = coord[1] + height / 2 * scale;
    }
    let canvas, labelX, labelY, textKey;
    if (textStyle) {
      textKey = textStyle.font + ',' + textStyle.fill + ',' + textStyle.stroke + ',' +
          textStyle.lineWidth + ',' + textStyle.text;
      canvas = textCache[textKey];
      if (!canvas) {
        // Render label to a separate canvas, to be reused with ctx.drawImage
        ctx.font = textStyle.font;
        let lines = textStyle.lines;
        let lineHeight = ctx.measureText('M').width * 1.5;
        let textWidth = 0;
        let textHeight = 0;
        let i = 0, ii = lines.length;
        for (; i < ii; ++i) {
          textWidth = Math.max(textWidth, ctx.measureText(lines[i]).width);
          textHeight += lineHeight;
        }
        let lineWidth = textStyle.lineWidth;
        canvas = textCache[textKey] = document.createElement('CANVAS');
        canvas.width = Math.ceil((2 * lineWidth + textWidth) * pixelRatio);
        canvas.height = Math.ceil((2 * lineWidth + textHeight) * pixelRatio);
        let context = canvas.getContext('2d');
        context.font = textStyle.font;
        context.textBaseline = 'top';
        context.textAlign = 'center';
        context.translate(canvas.width / 2, 0);
        context.scale(pixelRatio, pixelRatio);
        for (i = 0; i < ii; ++i) {
          if (textStyle.stroke) {
            context.strokeStyle = textStyle.stroke;
            context.lineWidth = lineWidth;
            context.strokeText(lines[i], 0, lineWidth + i * lineHeight);
          }
          if (textStyle.fill) {
            context.fillStyle = textStyle.fill;
            context.fillText(lines[i], 0, lineWidth + i * lineHeight);
          }
        }
      }
      let canvasWidth = canvas.width;
      let canvasHeight = canvas.height;
      let halfWidth = canvasWidth / 2;
      let halfHeight = canvasHeight / 2;
      let textSize = textStyle.textSize * pixelRatio;
      let anchor = textStyle.anchor;
      let offset = textStyle.offset;
      labelX = coord[0] - halfWidth + offset[0] * textSize;
      labelY = coord[1] - halfHeight + offset[1] * textSize;
      if (anchor.indexOf('top') != -1) {
        labelY += halfHeight;
      } else if (anchor.indexOf('bottom') != -1) {
        labelY -= halfHeight;
      }
      if (anchor.indexOf('left') != -1) {
        labelX += halfWidth;
      } else if (anchor.indexOf('right') != -1) {
        labelX -= halfWidth;
      }
      bottomLeft[0] = Math.min(bottomLeft[0], labelX);
      bottomLeft[1] = Math.min(bottomLeft[1], labelY);
      topRight[0] = Math.max(topRight[0], labelX + canvasWidth);
      topRight[1] = Math.max(topRight[1], labelY + canvasHeight);
    }
    let target = state.context.canvas;
    if (0 <= topRight[0] && target.width >= bottomLeft[0] &&
        0 <= topRight[1] && target.height >= bottomLeft[1]) {
      let id = (iconStyle && iconStyle.icon) + ',' + textKey;
      if (id in labels) {
        let testId = id;
        let found = true;
        do {
          let previous = labels[testId][0];
          // when bbox of identical previous label and current label do not overlap,
          // consider label again by using a different id
          if (previous && (previous.bottomLeft[0] <= topRight[0] && previous.topRight[0] >= bottomLeft[0] &&
              previous.bottomLeft[1] <= topRight[1] && previous.topRight[1] >= bottomLeft[1])) {
            found = false;
          }
          testId += '_';
        } while (testId in labels);
        if (found) {
          id = testId;
        }
      }
      if (!(id in labels)) {
        if (iconStyle) {
          instructions.push({
            translate: [iconX, iconY],
            rotate: iconStyle.rotation,
            alpha: iconStyle.opacity,
            drawImage: [img, imgData.x, imgData.y, width, height, 0, 0, width * scale, height * scale]
          });
        }
        if (textStyle) {
          instructions.push({
            translate: [labelX, labelY],
            rotate: textStyle.rotation,
            alpha: textStyle.opacity,
            drawImage: [canvas, 0, 0]
          });
        }
        gutter[0] = Math.max(gutter[0], (topRight[0] - bottomLeft[0]) / 2);
        gutter[1] = Math.max(gutter[1], (topRight[1] - bottomLeft[1]) / 2);
        labels[id] = [bounds, id, weight, instructions];
      }
    }
  }

  let allLayers = glStyle.layers;
  let layersBySourceLayer = {};
  for (let i = 0, ii = allLayers.length; i < ii; ++i) {
    let layer = allLayers[i];
    if (!layer.layout) {
      layer.layout = {};
    }
    resolveRef(layer, glStyle);
    if (typeof source == 'string' && layer.source == source ||
        source.indexOf(layer.id) !== -1) {
      let sourceLayer = layer['source-layer'];
      let layers = layersBySourceLayer[sourceLayer];
      if (!layers) {
        layers = layersBySourceLayer[sourceLayer] = [];
      }
      layers.push({
        layer: layer,
        index: i
      });
      preprocess(layer, fonts);
    }
  }

  let iconImageCache = {};

  let styles = [];

  let styleFunction = function(feature, resolution) {
    let properties = feature.getProperties();
    let layers = layersBySourceLayer[properties.layer];
    if (!layers) {
      return;
    }
    let zoom = resolutions.indexOf(resolution);
    if (zoom == -1) {
      zoom = getZoomForResolution(resolution, resolutions);
    }
    let type = types[feature.getGeometry().getType()];
    let f = {
      properties: properties,
      type: type
    };
    let stylesLength = -1;
    for (let i = 0, ii = layers.length; i < ii; ++i) {
      let layerData = layers[i];
      let layer = layerData.layer;
      let paint = layer.paint;
      if (paint.visibility === 'none' || ('minzoom' in layer && zoom < layer.minzoom) ||
          ('maxzoom' in layer && zoom >= layer.maxzoom)) {
        continue;
      }
      if (!layer.filter || layer.filter(f)) {
        let color, opacity, fill, stroke, strokeColor, style;
        let index = layerData.index;
        if (type == 3) {
          if (!('fill-pattern' in paint) && 'fill-color' in paint) {
            opacity = paint['fill-opacity'](zoom, properties);
            color = colorWithOpacity(paint['fill-color'](zoom, properties), opacity);
            if (color) {
              ++stylesLength;
              style = styles[stylesLength];
              if (!style || !style.getFill() || style.getStroke() || style.getText()) {
                style = styles[stylesLength] = new Style({
                  fill: new Fill()
                });
              }
              fill = style.getFill();
              fill.setColor(color);
              style.setZIndex(index);
            }
            if ('fill-outline-color' in paint) {
              strokeColor = colorWithOpacity(paint['fill-outline-color'](zoom, properties), opacity);
            }
            if (strokeColor) {
              ++stylesLength;
              style = styles[stylesLength];
              if (!style || !style.getStroke() || style.getFill() || style.getText()) {
                style = styles[stylesLength] = new Style({
                  stroke: new Stroke()
                });
              }
              stroke = style.getStroke();
              stroke.setLineCap(defaults['line-cap']);
              stroke.setLineJoin(defaults['line-join']);
              stroke.setMiterLimit(defaults['line-miter-limit']);
              stroke.setColor(strokeColor);
              stroke.setWidth(1);
              stroke.setLineDash(null);
              style.setZIndex(index);
            }
          }
        }
        if (type != 1) {
          color = !('line-pattern' in paint) && 'line-color' in paint ?
            colorWithOpacity(paint['line-color'](zoom, properties), paint['line-opacity'](zoom, properties)) :
            undefined;
          let width = paint['line-width'](zoom, properties);
          if (color && width > 0) {
            ++stylesLength;
            style = styles[stylesLength];
            if (!style || !style.getStroke() || style.getFill() || style.getText()) {
              style = styles[stylesLength] = new Style({
                stroke: new Stroke()
              });
            }
            stroke = style.getStroke();
            stroke.setLineCap(paint['line-cap'](zoom, properties));
            stroke.setLineJoin(paint['line-join'](zoom, properties));
            stroke.setMiterLimit(paint['line-miter-limit'](zoom, properties));
            stroke.setColor(color);
            stroke.setWidth(width);
            stroke.setLineDash(paint['line-dasharray'] ?
                paint['line-dasharray'](zoom, properties).map(function(x) {
                  return x * width;
                }) : null);
            style.setZIndex(index);
          }
        }

        let iconStyle;
        if (type == 1 && 'icon-image' in paint) {
          let iconImage = paint['icon-image'](zoom, properties);
          if (iconImage) {
            let icon = fromTemplate(iconImage, properties);
            style = iconImageCache[icon];
            if (spriteData && spriteImage) {
              let spriteImageData = spriteData[icon];
              if (spriteImageData) {
                iconStyle = {
                  icon: icon,
                  img: spriteImage,
                  imgData: spriteImageData,
                  scale: paint['icon-size'](zoom, properties) / spriteImageData.pixelRatio,
                  rotation: deg2rad(paint['icon-rotate'](zoom, properties)),
                  opacity: paint['icon-opacity'](zoom, properties)
                };
              }
            }
          }
        }

        if (type == 1 && 'circle-radius' in paint) {
          // TODO Send circles through createIconLabelCombo
          ++stylesLength;
          let cache_key = paint['circle-radius'](zoom, properties) + '.' +
            paint['circle-stroke-color'](zoom, properties) + '.' +
            paint['circle-color'](zoom, properties);
          style = iconImageCache[cache_key];
          if (!style) {
            style = new Style({
              image: new Circle({
                radius: paint['circle-radius'](zoom, properties),
                stroke: new Stroke({
                  color: colorWithOpacity(paint['circle-stroke-color'](zoom, properties), opacity)
                }),
                fill: new Fill({
                  color: colorWithOpacity(paint['circle-color'](zoom, properties), opacity)
                })
              })
            });
          }
          style.setZIndex(index);
          styles[stylesLength] = style;
        }

        let label;
        if ('text-field' in paint) {
          let textField = paint['text-field'](zoom, properties);
          label = fromTemplate(textField, properties);
        }
        // TODO Add LineString handling as soon as it's supporte in OpenLayers
        let textStyle;
        if (label && type !== 2) {
          let textSize = paint['text-size'](zoom, properties);
          let font = mb2css(fontMap[paint['text-font'](zoom, properties)], textSize);
          let textTransform = paint['text-transform'];
          if (textTransform == 'uppercase') {
            label = label.toUpperCase();
          } else if (textTransform == 'lowercase') {
            label = label.toLowerCase();
          }
          let lines = wrapText(label, font, paint['text-max-width'](zoom, properties));
          textStyle = {
            text: label,
            lines: lines,
            font: font,
            textSize: textSize,
            anchor: paint['text-anchor'](zoom, properties),
            offset: paint['text-offset'](zoom, properties),
            rotation: deg2rad(paint['text-rotate'](zoom, properties)),
            opacity: paint['text-opacity'](zoom, properties)
          };
          textStyle.fill = paint['text-color'](zoom, properties);
          if (paint['text-halo-width']) {
            textStyle.lineWidth = paint['text-halo-width'](zoom, properties);
            textStyle.stroke = paint['text-halo-color'](zoom, properties);
          }
        }

        if (iconStyle || textStyle) {
          ++stylesLength;
          style = styles[stylesLength];
          if (!style || !style.getRenderer() || style.getFill() || style.getStroke()) {
            style = styles[stylesLength] = new Style();
          }
          style.setRenderer(function(coords, state) {
            let canvas = state.context.canvas;
            if (!gutter) {
              let pixelRatio = state.pixelRatio;
              gutter = [50 * pixelRatio, 20 * pixelRatio];
            }
            if (coords[0] > -gutter[0] && coords[1] > -gutter[1] && coords[0] < canvas.width + gutter[0] && coords[1] < canvas.height + gutter[1]) {
              createIconLabelCombo(iconStyle, textStyle, coords, state, index);
            }
          });
          let geometry = feature.getGeometry();
          if (geometry.getType() == 'Polygon') {
            style.setGeometry(geometry.getInteriorPoint());
          } else if (geometry.getType() == 'MultiPolygon') {
            style.setGeometry(geometry.getPolygons().sort(sortByWidth)[0].getInteriorPoint());
          }
          style.setZIndex(index);
        }
      }
    }

    if (stylesLength > -1) {
      styles.length = stylesLength + 1;
      return styles;
    }
  };

  olLayer.on('change', function() {
    textCache = {};
  });

  olLayer.on('precompose', function() {
    labelEngine.reset();
    labels = {};
  });

  function labelSort(a, b) {
    a = labels[a];
    b = labels[b];
    const weightA = a[2];
    const weightB = b[2];
    const boxA = a[0];
    const boxB = b[0];
    const distA = Math.pow(boxA.bottomLeft[0], 2) + Math.pow(boxA.bottomLeft[1], 2);
    const distB = Math.pow(boxB.bottomLeft[0], 2) + Math.pow(boxB.bottomLeft[1], 2);
    if (weightA == weightB) {
      return distA - distB;
    } else {
      return weightA - weightB;
    }
  }
  
  olLayer.on('postcompose', function(e) {

    const context = e.context;
    const keys = Object.keys(labels);
    keys.sort(labelSort);

    let i, ii;
    for (i = 0, ii = keys.length; i < ii; ++i) {
      let args = labels[keys[i]];
      args[2] = 1; // reset weight
      labelEngine.ingestLabel.apply(labelEngine, args);
    }

    labelEngine.update();
    let items = labelEngine.getShown();

    for (i = 0, ii = items.length; i < ii; ++i) {
      let item = items[i];
      let instructions = item.labelObject;
      for (let j = 0, jj = instructions.length; j < jj; ++j) {
        let instruction = instructions[j];
        let alpha = context.globalAlpha;
        context.translate.apply(context, instruction.translate);
        if (instruction.rotate) {
          context.rotate(instruction.rotate);
        }
        if (instruction.alpha != 1) {
          context.globalAlpha = alpha * instruction.alpha;
        }
        context.drawImage.apply(context, instruction.drawImage);
        if (instruction.alpha != 1) {
          context.globalAlpha = alpha;
        }
        if (instruction.rotate) {
          context.rotate(-instruction.rotate);
        }
        context.translate.apply(context, instruction.translate.map((t) => -t));
      }
    }

  });

  olLayer.setStyle(styleFunction);
  
  return styleFunction;

}

export default applyStyleFunction;
