module.exports = {
    entry: './main.js',
    output: {
      filename: 'bundle.js',
      publicPath: '/'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: [ 'babel-loader' ]
        },
        {
          test:/\.css$/,
          use: [ 'style-loader', 'css-loader' ]
        }
      ]
    },
    mode: 'development'
};
