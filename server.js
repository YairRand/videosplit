var express = require( 'express' ),
  app = express(),
  http = require( 'http' ),
  server = http.Server( app ),
  webpack = require( 'webpack' ),
  wpConfig = require( './webpack.config' ),
  compiler = webpack( wpConfig ),
  sockets = require( './serverSocketHandler' );
  
app.use( require( 'webpack-dev-middleware' )( compiler, {
  publicPath: '/'
} ) );

// app.use( require( 'webpack-hot-middleware' )( compiler ) );

// If there needs to be public resources at some point.
// app.use( express.static( 'public' ) );

app.get( '/', ( req, res ) => {
  console.log( req.params.name );
  res.sendFile( __dirname + '/index.html', {
  } );
} );

app.get( '/split', ( req, res ) => {
  console.log( req.params.name );
  res.sendFile( __dirname + '/split.html', {
  } );
} );

sockets.start( server );
