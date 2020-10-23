const CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsConfigWebpackPlugin = require('ts-config-webpack-plugin');
const HtmlWebpackInlineSVGPlugin = require('html-webpack-inline-svg-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');
const Sass = require('sass');

//const FaviconsWebpackPlugin = require('favicons-webpack-plugin');

module.exports = {
  devServer: {
    host: '0.0.0.0',
    disableHostCheck: true,
    watchOptions: {
      poll: true,
    },
  },
  plugins: [
    // Cleans the dist folder before the build starts
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inlineSource: '.(css)$',
    }),
    new HtmlWebpackInlineSourcePlugin(HtmlWebpackPlugin),
    new HtmlWebpackInlineSVGPlugin({
      inlineAll: true,
      svgoConfig: [
        {
          removeViewBox: false,
        },
      ],
    }),

    //new FaviconsWebpackPlugin('static/logo.svg'),
    // Multi threading typescript loader configuration with caching for .ts and .tsx files
    // see https://github.com/namics/webpack-config-plugins/tree/master/packages/ts-config-webpack-plugin/config
    new TsConfigWebpackPlugin(),
  ],
  optimization: {
    minimizer: [
      new TerserJSPlugin({
        test: /\.js$/,
        exclude: /node_modules/,
        terserOptions: {
          keep_classnames: true,
        },
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        use: ['source-map-loader'],
      },
      {
        test: /\.scss$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
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
        test: /\.svg/,
        use: {
          loader: 'svg-url-loader',
          options: {},
        },
      },
      {
        test: /\.(png)$/,
        use: {
          loader: 'file-loader',
        },
      },
    ],
  },
};
