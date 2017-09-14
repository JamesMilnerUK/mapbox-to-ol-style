'use strict';

const webpack = require('webpack');
const path = require('path');

module.exports = function(env) {

  var plugins = [];
  var outputFile = './test/bundle.js';

  var config = {
    context: path.resolve(__dirname, '../'),
    // entry is the 'main' source file we want to include/import
    entry: './test/test.js',
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
    externals: [],
    module: {
      loaders: [
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {
            presets: ['es2015']
          }
        }
      ]
    }
  }; // End of config

  return config;

};
