const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const TerserJSPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

const PATHS = {
  entryPoint: path.resolve(__dirname, 'src/main.ts'),
  bundles: path.resolve(__dirname, 'dist'),
};

module.exports = (env, argv) => ({
  entry: {
    main: [PATHS.entryPoint],
  },

  externals: [
    nodeExternals({
      allowlist: [/(^shared)/],
    }),
  ],
  target: 'node',
  output: {
    filename: '[name].js',
    path: PATHS.bundles,
  },
  devtool: argv.mode === 'development' ? 'source-map' : false,
  watchOptions: {
    poll: true,
  },
  optimization: {
    minimize: argv.mode !== 'development',
    minimizer: [
      new TerserJSPlugin({
        exclude: /node_modules/,
        // The serialization protocol keys on class names.
        terserOptions: {
          keep_classnames: true,
        },
      }),
    ],
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
    new CleanWebpackPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
