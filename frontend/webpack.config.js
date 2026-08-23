const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default;
const Sass = require('sass');

module.exports = (env, argv) => {
  const isProduction = argv.mode !== 'development';

  return {
    entry: {
      main: path.resolve(__dirname, 'src/index.ts'),
    },
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
      host: '0.0.0.0',
      allowedHosts: 'all',
    },
    watchOptions: {
      poll: true,
    },
    plugins: [
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin(),
      new HtmlWebpackPlugin({
        template: './src/index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: 'static/*.svg', to: 'static/[name][ext]' }],
      }),
      ...(isProduction ? [new HTMLInlineCSSWebpackPlugin()] : []),
    ],
    optimization: {
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
    module: {
      rules: [
        {
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
        },
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
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
          // svg-url-loader emits a CJS module that css-loader 7 writes out verbatim.
          test: /\.svg$/,
          type: 'asset/inline',
        },
        {
          // No leading slash in `name`: with publicPath 'auto' it doubles the slash.
          oneOf: [
            {
              test: /og-image\.png$/,
              use: {
                loader: 'file-loader',
                options: {
                  name: '[name].[ext]',
                },
              },
            },
            {
              test: /\.ico$/,
              use: {
                loader: 'file-loader',
                options: {
                  name: '[name].[ext]',
                },
              },
            },
            {
              test: /\.(mp3|png)$/,
              use: {
                loader: 'file-loader',
                options: {
                  name: 'static/[name].[ext]',
                },
              },
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
    },
  };
};
