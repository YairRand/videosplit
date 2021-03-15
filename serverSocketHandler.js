// Separate folder for backend? Maybe later.

var socketIO = require( 'socket.io' ),
  // Temporary stuff for testing.
  startData = {
    intMods: [ { type: 'mousetracker', id: Math.random() } ]
  },
  dontSendTypes = [ 'SERVER_SAVE_VIDEO' ];

module.exports = {

  start( server ) {
    var ioServer = socketIO( server ),
      clicked = 0,
      latestUser = 0,
      users = [],
      allRecordings = {},
      initRecordings = [];
    
    
    // If recordings aren't available in local recordings, retrieve from
    // allRecordings, add to local, and send.
    // local only needs to consider ins, not outs. Outs are handled client-side.
    // When sending a rec to all, every local recordings object needs updating.
    // Locals only need ids, I think.
    
    ioServer.on( 'connection', function ( socket ) {
      var userId = latestUser++,
        // Recordings that have been sent to the user
        recordings = {},
        selfData = { userId, socket, recordings };
      
      function sendToUsers( msg, toUsers, ack ) {
        msg.fromUser = userId;
        
        // This is ugly. TODO: Cleaner.
        var videoId = registerVideo( msg.videoData );
        console.log( 'videoid=', videoId );
        toUsers.forEach( toUser => {
          var localMsg = { ...msg };
          
          // Process for blobs.
          // 2 things: Process to store outside of per-user, process to send in per-user.
          if ( videoId ) {
            // TODO: Process videos.
            // if ( toUser.recordings[ videoId ] ) {
            //   localMsg.videoData = { id: videoId };
            // } else {
            //   localMsg.videoData = { ...allRecordings[ videoId ] };
            //   toUser.recordings[ videoId ] = { ...allRecordings[ videoId ] };
            // }
            localMsg.videoData = videoCaching( videoId, toUser );
          }
          // Send.
          if ( toUser.socket ) {
            toUser.socket.emit( 'in', localMsg );
          } else {
            console.error( 'Socket unavailable. id = ', toUser.id, 'from = ', userId );
          }
        } );
        
        if ( msg.awaitingCallback ) {
          ack();
        }
      }
      
      function _registerVideo( videoData ) {
        // TODO: Manage videos and slices (videoId and sliceId)
        if ( videoData ) {
          // var id = videoData.id;
          var { id, videoId, sliceId } = videoData;
          if ( id && !allRecordings[ id ] ) {
            allRecordings[ id ] = videoData;
          }
          return id;
        }
      }
      
      // Can't this be outside local?
      function registerVideo( videoData ) {
        // A lot of this doesn't make any sense. We won't ever recieve the same
        // data block twice, because rMW restructures it to only include an id.
        // The server shouldn't send the same thing twice either.
        
        // This deals with the server receiving video.
        
        if ( videoData ) {
          console.log( 'REGISTER', videoData.videoId );
          var { videoId, sliceIndex, chunks, ...otherData } = videoData;
          
          if ( chunks ) {
            // If there's chunks, there's something new.
            var video = allRecordings[ videoId ];
            
            // Issue: cached expects video.slices.
            
            if ( !video ) {
              allRecordings[ videoId ] = {
                sliceIndex,
                slices: [ chunks ],
                data: { sliceIndex, ...otherData }
              };
            } else if ( video.sliceIndex < sliceIndex ) {  
              video.sliceIndex = sliceIndex;
              video.slices.push( chunks );
              video.data = { sliceIndex, ...otherData };
            }
            
            // if ( video.slices.every( slice => slice.sliceId !== sliceId ) ) {
            //   video.slices.push( { sliceId, chunks: videoData.chunks } );
            //   // No wait, don't dump in everything, just the chunks and ids.
            //   // Only add everything once.
            //   video.data = { videoId, sliceId, ...otherData };
            // }
          }
          
          return videoId;
        }
      }
      
      // Get from cache, for sending.
      function videoCaching( videoId, toUser ) {
        console.log( 'videoCaching', videoId );
        // There are only three options:
        // * We haven't started loading the video yet. (Came in late, whatever.)
        // * We have started, and we haven't recieved the most recent slice.
        // * The video has been fully loaded, this is a re-send. (Nothing to send.)
        //   (Register might know this?)
        var recordings = toUser.recordings,
          cached = recordings[ videoId ],
          slicesSent = cached ? cached.slicesSent : 0,
          { slices, sliceIndex, data: video } = allRecordings[ videoId ],
          sliceCount = slices.length; // slices.length?
        
        recordings[ videoId ] = { slicesSent: slices.length };
        
        // Should this use slices.length instead of sliceIndex?
        if ( slicesSent < sliceCount ) {
          return {
            ...video,
            videoId,
            // chunks: slices.slice( cached.slicesSent )
            //   .flatMap( slice => slice.chunks )
            chunks: [].concat( ...slices.slice( slicesSent ) )
          };
        } else {
          // The client already has the full video.
          console.log( video );
          return { videoId, ...video };
        }
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
          initRecordings: initRecordings.map( recId => allRecordings[ recId ] ),
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
      
      socket.on( 'toUser', ( msg, ack ) => {
        // msg.fromUser = userId;
        
        var toUsers = Array.isArray( msg.toUser ) ? msg.toUser : [ msg.toUser ];
        
        sendToUsers(
          msg,
          toUsers
            .map( toUser => users.find( user => user.userId === toUser ) )
            // In case a user disconnected since the msg was sent.
            .filter( toUser => toUser ),
          ack
        );
        
        // users.forEach( target => {
        //   if ( toUsers.includes( target.userId ) && target.socket ) {
        //     target.socket.emit( 'in', msg );
        //   }
        // } );
      } );
      
      socket.on( 'out', ( msg, ack ) => {
        // TODO: Merge with above, somehow.
        
        // This needs to be split up. Broadcast can't work if some users need
        // slightly different messages, eg whether to receive a rec.
        
        if ( dontSendTypes.includes( msg.type ) ) {
          if ( msg.type === 'SERVER_SAVE_VIDEO' ) {
            registerVideo( msg.videoData );
            initRecordings.push( msg.videoData.id );
            console.log( 'SERVER_SAVE_VIDEO', msg.videoData.id );
          }
        } else {
          sendToUsers(
            msg,
            users.filter( user => user !== selfData ),
            ack
          );
        }
        
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
      console.log('server is listening... (serverSocketHandler.js)');
    });
  }

};
