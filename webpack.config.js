'use strict';

const webpack = require('webpack');

module.exports = function(env) {

  var plugins = [];
  var outputFile = './dist/mb2olstyle.js';

  if (env && env.test) {
    outputFile = "./test/mb2olstyle.js";
  }

  var config = {
    context: __dirname,
    // entry is the 'main' source file we want to include/import
    entry: './index.js',
    // output tells webpack where to put the bundle it creates
    output: {
      // in the case of a 'plain global browser library', this
      // will be used as the reference to our module that is
      // hung off of the window object.
      library: 'mb2olstyle',
      // We want webpack to build a UMD wrapper for our module
      libraryTarget: 'umd',
      // the destination file name
      filename: outputFile
    },
    plugins: plugins,
    // externals let you tell webpack about external dependencies
    // that shouldn't be resolved by webpack.
    externals: [
      {
        '@mapbos/mapbox-gl-style-spec' : '@mapbox/mapbox-gl-style-spec',
        'ol' : 'ol',
        'mapbox-to-css-font' : 'mapbox-to-css-font',
        'labelgun' : 'labelgun'
      }
    ],
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['babili']
          }
        }
      ]
    }
  }; // End of config

  return config;

};
