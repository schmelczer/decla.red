const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const Sass = require('sass');
const TerserJSPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const PATHS = {
  entryPoint: path.resolve(__dirname, 'src/index.ts'),
  bundles: path.resolve(__dirname, 'dist'),
};

module.exports = (env, argv) => ({
  entry: {
    index: PATHS.entryPoint,
  },
  target: 'web',
  output: {
    filename: '[name].js',
    path: PATHS.bundles,
  },
  devtool: argv.mode === 'development' ? 'source-map' : false,
  devServer: {
    host: '0.0.0.0',
    disableHostCheck: true,
    watchOptions: {
      poll: true,
    },
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
      new OptimizeCSSAssetsPlugin({}),
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      xhtml: true,
      template: './src/index.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
      },
      inlineSource: '.(js|css)$',
    }),
    new HtmlWebpackInlineSourcePlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[id].css',
    }),
    new CleanWebpackPlugin({
      protectWebpackAssets: false,
      cleanAfterEveryBuildPatterns: ['*.js', '*.css'],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ico$/,
        use: {
          loader: 'file-loader',
          query: {
            outputPath: '/',
            name: '[name].[ext]',
          },
        },
      },
      {
        test: /\.svg$/,
        use: {
          loader: 'file-loader',
          query: {
            outputPath: '/static',
            name: '[name].[ext]',
          },
        },
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
          {
            loader: 'resolve-url-loader',
            options: {
              keepQuery: true,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              implementation: Sass,
            },
          },
        ],
      },
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
        },
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
