const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserJSPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HTMLInlineCSSWebpackPlugin = require('html-inline-css-webpack-plugin').default;
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
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
    // webpack-dev-server 5 no longer accepts `watchOptions` under `devServer`;
    // polling is configured on the compiler instead (needed for some FS mounts).
    watchOptions: {
      poll: true,
    },
    plugins: [
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin(),
      //new BundleAnalyzerPlugin(),
      new HtmlWebpackPlugin({
        template: './src/index.html',
      }),
      // The SVG UI icons used to be inlined into the HTML by the (abandoned,
      // webpack-4-only) html-webpack-inline-svg-plugin. They are now emitted as
      // static files and referenced via `static/<name>.svg` from index.html.
      new CopyWebpackPlugin({
        patterns: [{ from: 'static/*.svg', to: 'static/[name][ext]' }],
      }),
      // Inline the extracted CSS into the HTML for production builds (replaces
      // the abandoned html-webpack-inline-source-plugin). In development the CSS
      // stays a separate, linked file for faster rebuilds.
      ...(isProduction ? [new HTMLInlineCSSWebpackPlugin()] : []),
    ],
    optimization: {
      minimizer: [
        new TerserJSPlugin({
          exclude: /node_modules/,
          // The custom serialization protocol keys on class names, so they must
          // survive minification (see shared/src/serialization).
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
          // SVGs referenced from CSS (`mask-image`/`background-image`) and JS
          // must be inlined as real `data:` URIs. svg-url-loader emits a CJS
          // module (`module.exports = "data:..."`) which webpack 5 + css-loader 7
          // write out verbatim as a `.svg` asset file, so the browser fetches JS
          // instead of an image and the mask/background silently fails. webpack 5's
          // built-in `asset/inline` produces a proper data URI instead.
          // (HTML <img> icons are unaffected: they are copied by CopyWebpackPlugin
          // and referenced by literal `static/*.svg` paths, not through this rule.)
          test: /\.svg$/,
          type: 'asset/inline',
        },
        {
          // Use oneOf so each asset matches exactly one rule (og-image.png would
          // otherwise match both the generic png rule and its own rule).
          // The directory is encoded in `name` (not `outputPath`) and has no
          // leading slash: with the default `publicPath: 'auto'` a leading slash
          // produces a doubled slash in the emitted URL (e.g. `//static/x.mp3`).
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
      alias: {
        // sdf-2d's package.json `exports` only declares an `import` condition,
        // which webpack 5 cannot resolve for the production (require) build.
        // Point straight at its entry to bypass package exports resolution.
        'sdf-2d$': path.resolve(__dirname, 'node_modules/sdf-2d/lib/main.js'),
      },
    },
  };
};
