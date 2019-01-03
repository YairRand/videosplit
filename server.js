var express = require( 'express' ),
  app = express(),
  socketIO = require( 'socket.io' ),
  http = require( 'http' ),
  server = http.Server( app ),
  ioServer = socketIO( server ),
  webpack = require( 'webpack' ),
  wpConfig = require( './webpack.config' ),
  compiler = webpack( wpConfig );
  
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

// Socket stuff.
var clicked = 0,
  latestUser = 0,
  users = [],
  recordings = [];

ioServer.on( 'connection', function ( socket ) {
  var userId = latestUser++;
  
  socket.emit( 'spoo', 'successfully connected. userId = ' + userId );
  socket.emit( 'in', {
    type: 'startData',
    startData: {
      userId,
      users: users.map( user => ( { userId: user.userId } ) )
    }
  } );
  
  users.push( { userId, socket } );
  
  socket.broadcast.emit( 'userconnect', userId );
  socket.broadcast.emit( 'in', {
    type: 'userConnect',
    'userConnect': {},
    fromUser: userId
  } );
  socket.broadcast.emit( 'spoo', 'Other user connected: User' + userId );
  socket.on( 'test', msg => {
    console.log( 'test message received by server', clicked, msg );
    clicked++;
    socket.emit( 'test2', 'User' + userId + ': ' + msg + clicked );
  } );
  socket.on( 'toUser', msg => {
    msg.fromUser = userId;
    
    var toUsers = Array.isArray( msg.toUser ) ? msg.toUser : [ msg.toUser ];
    
    users.forEach( target => {
      if ( toUsers.includes( target.userId ) && target.socket ) {
        target.socket.emit( 'in', msg );
      }
    } );
    //   target = users.find( user => user.userId === msg.toUser );
    // if ( target && target.socket ) {
    //   msg.fromUser = userId;
    //   target.socket.emit( 'in', msg );
    // }
  } );
  socket.on( 'out', msg => {
    console.log( 'outthing' );
    msg.fromUser = userId;
    socket.broadcast.emit( 'in', msg );
  } );
  socket.on( 'disconnect', () => {
    socket.broadcast.emit( 'in', {
      type: 'userDisconnect',
      'userDisconnect': {},
      fromUser: userId
    } );
    users = users.filter( user => user.userId !== userId );
  } );
  console.log( 939 );
} );


server.listen( 3000, function() {
  console.log('boh');
});
