const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

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
    ignored: /node_modules/
  },
  optimization: {
    minimize: false,
  },
  plugins: [
    new CleanWebpackPlugin({
      protectWebpackAssets: false,
      cleanAfterEveryBuildPatterns: [],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
        exclude: /node_modules/,
      }
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
