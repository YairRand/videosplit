// Separate folder for backend? Maybe later.

var socketIO = require( 'socket.io' ),
  // Temporary stuff for testing.
  startData = {
    intMods: [ { type: 'mousetracker', id: Math.random() } ]
  };

module.exports = {

  start( server ) {
    var ioServer = socketIO( server ),
      clicked = 0,
      latestUser = 0,
      users = [],
      allRecordings = {};
    
    
    // If recordings aren't available in local recordings, retrieve from
    // allRecordings, add to local, and send.
    // local only needs to consider ins, not outs. Outs are handled client-side.
    // When sending a rec to all, every local recordings object needs updating.
    // Locals only need ids, I think.
    
    // All three functions currently unused.
    function addRecording( action ) {
      if ( action.rec && action.rec.blob ) {
        allRecordings.push( action.rec );
      }
    }
    
    function getRecording() {
      if ( action.rec ) {
        var { id } = action.rec;
        return recordings.find( recording => recording.id === id );
        
        // respond( recordings.find( recording => recording.id === id ) );
        
        // respond( recordings[ id ] );
      }
    }
    
    function processRecordings( msg, to ) {
      ( to || users.map( user => user.userId ) ).forEach( userId => {
        
      } );
    }

    ioServer.on( 'connection', function ( socket ) {
      var userId = latestUser++,
        recordings = {},
        selfData = { userId, socket, recordings };
      
      function sendToUsers( msg, toUsers ) {
        msg.fromUser = userId;
        
        // This is ugly. TODO: Cleaner.
        var videoData = msg.videoData,
          id = videoData && videoData.id;
        if ( id && !allRecordings[ id ] ) {
          allRecordings[ id ] = videoData;
        }
        
        toUsers.forEach( toUser => {
          var localMsg = { ...msg };
          
          // Process for blobs.
          // 2 things: Process to store outside of per-user, process to send in per-user.
          if ( id ) {
            // TODO: Process videos.
            if ( toUser.recordings[ id ] ) {
              localMsg.videoData = { id };
            } else {
              localMsg.videoData = { ...allRecordings[ id ] };
              toUser.recordings[ id ] = { ...allRecordings[ id ] };
            }
          }
          // Send.
          if ( toUser.socket ) {
            toUser.socket.emit( 'in', localMsg );
          } else {
            console.error( 'Socket unavailable. id = ', toUser.id, 'from = ', userId );
          }
        } );
      }
      
      // For testing.
      socket.emit( 'spoo', 'successfully connected. userId = ' + userId );
      socket.broadcast.emit( 'spoo', 'Other user connected: User' + userId );
      socket.on( 'test', msg => {
        console.log( 'test message received by server', clicked, msg );
        clicked++;
        socket.emit( 'test2', 'User' + userId + ': ' + msg + clicked );
      } );
      
      socket.emit( 'in', {
        type: 'startData',
        startData: {
          userId,
          users: users.map( user => ( { userId: user.userId } ) ),
          ...startData
        }
      } );
      
      users.push( selfData );
      
      socket.broadcast.emit( 'in', {
        type: 'userConnect',
        userData: {},
        fromUser: userId
      } );
      
      socket.on( 'toUser', msg => {
        // msg.fromUser = userId;
        
        var toUsers = Array.isArray( msg.toUser ) ? msg.toUser : [ msg.toUser ];
        
        sendToUsers(
          msg,
          toUsers
            .map( toUser => users.find( user => user.userId === toUser ) )
            // In case a user disconnected since the msg was sent.
            .filter( toUser => toUser )
        );
        
        // users.forEach( target => {
        //   if ( toUsers.includes( target.userId ) && target.socket ) {
        //     target.socket.emit( 'in', msg );
        //   }
        // } );
      } );
      
      socket.on( 'out', msg => {
        // TODO: Merge with above, somehow.
        
        // This needs to be split up. Broadcast can't work if some users need
        // slightly different messages, eg whether to recieve a rec.
        
        sendToUsers(
          msg,
          users.filter( user => user !== selfData )
        );
        
        console.log( 'outthing' );
        // msg.fromUser = userId;
        
        // socket.broadcast.emit( 'in', msg );
      } );
      
      // I don't like this system. It requires extra calls.
      socket.on( 'register_video', ( msg ) => {
        recordings.push( msg.videoData );
        
        // recordings[ msg.videoData.id ] = msg.videoData;
      } );
      
      socket.on( 'request_video', ( { id }, respond ) => {
        respond( recordings.find( recording => recording.id === id ) );
        
        // respond( recordings[ id ] );
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
  }

};
