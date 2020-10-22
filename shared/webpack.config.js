const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsConfigWebpackPlugin = require('ts-config-webpack-plugin');

const PATHS = {
  entryPoint: path.resolve(__dirname, 'src/main.ts'),
  bundles: path.resolve(__dirname, 'lib'),
};

module.exports = (env, argv) => ({
  entry: {
    main: PATHS.entryPoint,
  },
  target: 'node',
  output: {
    filename: '[name].js',
    path: PATHS.bundles,
    libraryTarget: 'umd',
    umdNamedDefine: true,
  },
  devtool: argv.mode === 'development' ? 'source-map' : false,
  watchOptions: {
    poll: true,
    ignored: /node_modules/,
  },
  externals: {
    'gl-matrix': 'gl-matrix',
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    // Cleans the dist folder before the build starts
    new CleanWebpackPlugin(),
    // Generate a base html file and injects all generated css and js files
    new HtmlWebpackPlugin(),
    // Multi threading typescript loader configuration with caching for .ts and .tsx files
    // see https://github.com/namics/webpack-config-plugins/tree/master/packages/ts-config-webpack-plugin/config
    new TsConfigWebpackPlugin(),
  ],
  resolve: {
    extensions: ['.ts'],
  },
});
