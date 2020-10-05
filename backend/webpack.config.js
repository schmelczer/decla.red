const path = require('path');
const TerserJSPlugin = require('terser-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const PATHS = {
  entryPoint: path.resolve(__dirname, 'src/main.ts'),
  bundles: path.resolve(__dirname, 'dist'),
};

module.exports = {
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
  devtool: 'source-map',
  watchOptions: {
    aggregateTimeout: 600,
    ignored: /node_modules/,
  },
  optimization: {
    minimize: true,
    usedExports: true,
    minimizer: [
      new TerserJSPlugin({
        sourceMap: true,
        cache: true,
        test: /\.ts$/i,
        terserOptions: {
          ecma: 5,
          warnings: true,
          parse: {},
          compress: { defaults: true },
          mangle: true,
          module: false,
          output: null,
          toplevel: true,
          nameCache: null,
          ie8: false,
          keep_classnames: false,
          keep_fnames: false,
          safari10: false,
        },
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.html$/i,
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
};
