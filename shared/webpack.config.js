const path = require('path');

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
  plugins: [],
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
    extensions: ['.ts'],
  },
});
