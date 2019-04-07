const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const GitRevisionPlugin = require('git-revision-webpack-plugin')
const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: './src/cli/index.ts',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'awesome-typescript-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  output: {
    filename: 'cals-cli.js',
    path: path.resolve(__dirname, 'build'),
    libraryTarget: 'commonjs2',
  },
  target: 'node',
  externals: [nodeExternals()],
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DefinePlugin({
      __GIT_COMMIT__: JSON.stringify(new GitRevisionPlugin().commithash()),
      __BUILD_TIME__: JSON.stringify(new Date()),
    }),
  ],
}
