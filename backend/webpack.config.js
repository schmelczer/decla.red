const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const { ESBuildPlugin } = require('esbuild-loader');
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
        sourceMap: false,
        test: /\.js$/,
        exclude: /node_modules/,
        terserOptions: {
          keep_classnames: true,
        },
      }),
    ],
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
    new ESBuildPlugin(),
    new CleanWebpackPlugin({
      protectWebpackAssets: false,
      cleanAfterEveryBuildPatterns: [],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.html$/,
        use: {
          loader: 'file-loader',
          query: {
            outputPath: '/',
            name: '[name].[ext]',
          },
        },
      },
      {
        test: /\.ts$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'ts',
          target: 'es2015',
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
