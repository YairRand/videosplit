import io from 'socket.io-client';
import createRTCConnection from './rtcHandler';

const socket = io();

// TODO: Standardize type name style.

export default ( store => {
  
  const { dispatch, getState } = store,
    connections = {},
    streams = {};
  
  let outStream;
  
  function sendStreamTo( connection ) {
    outStream.getTracks().forEach( track => connection.addTrack( track, outStream ) );
  }
  
  // TODO: Self-initialize.
  function init() {
    
    socket.emit( 'test', 'blah' );

    socket.on( 'test2', msg => console.log( 'test message received by client ' + msg ) );
    socket.on( 'in', async ( msg, type ) => {
      
      var { fromUser } = msg,
        props = getState(),
        userStream = fromUser && props.users.find( stream => stream.userId === fromUser );
        
      console.log( 'in', msg, type, fromUser, userStream );
      
      switch ( msg.type ) {
      
        case 'startData': {
          // Starting up. Step on.
          let users = msg.startData.users.map( user => {
            return newUser( user.userId );
          } );
          console.log( 'START_DATA', msg );
          
          // TODO: Initial recordings available from earlier?
          
          dispatch( { type: 'START_DATA', userId: msg.startData.userId, users } );
          
          msg.startData.intMods && msg.startData.intMods.forEach( intMod => {
            dispatch( { type: 'ADD_INTMOD', modtype: intMod.type, id: intMod.id } );
          } );
          break;
        }
        case 'userConnect': {
          let user = newUser( fromUser );
          dispatch( { type: 'USER_CONNECT', user } );
          break;
        }
        case 'userDisconnect':
          dispatch( { type: 'USER_DISCONNECT', userId: fromUser } );
          break;
        
        // Unused, deprecated.
        case 'RECEIVE_REC':
          console.log( 'got rec', msg, new Blob( [ msg.rec.blob ], { type: msg.rec.type } ) );
          
          // TODO: This should be a more general thing.
          // Certain properties should have blobs replaced with urls, but not
          // before sending. (Inward conversion is in socketMiddleware, replacing .blob with .src.)
          // IN_SEND_REC and OUT_SEND_REC, or something. (Done.)
          
          var { blob, ...videoData } = msg.rec,
            src = URL.createObjectURL( new Blob( [ blob ], { type: msg.rec.type } ) );
          
          dispatch( { ...videoData, type: 'RECEIVE_REC', fromUser, src } );
          
          break;
          
          case 'INTMOD_EVT':
            // Local dispatch, somehow.
            msg.id;
            break;
      }
      
      if ( msg.type && msg.type.startsWith( 'IN_' ) ) {
        // Should .blob be in .meta? TODO: Look into .meta standards.
        
        dispatch( { ...msg, meta: { ...msg.meta, dir: 'in' } } );
      }
      
    } );
    
  }
  
  function newUser( from ) {
    var rtcConnection = createRTCConnection( from, socket ),
      pc = rtcConnection.pc;
    
    streams[ from ] = rtcConnection.connected;
    connections[ from ] = pc;
    
    if ( outStream ) {
      sendStreamTo( pc );
    }
    
    rtcConnection.connected.then( ( newSrc ) => {
      dispatch( { type: 'RECEIVE_STREAM', fromUser: from, newSrc } );
    } );
    
    // [ 'icecandidate', 'removestream', 'iceconnectionstatechange', 'icegatheringstatechange', 'signalingstatechange', 'negotiationneeded', 'track' ].forEach( onX => {
    //   pc.addEventListener( onX, e => {
    //     console.log( onX, e );
    //   } );
    // } );
    
    return {
      userId: from
      // TODO: Remove.
      // pc
    };
  }
  
  init();
  
  return {
    emit: socket.emit.bind( socket ),
    /**
     * @returns {Promise.<MediaStream>}
     */
    getStream( userId ) {
      return streams[ userId ];
    },
    /**
     * @param {MediaStream} stream
     */
    sendStream( stream ) {
      if ( !outStream ) {
        outStream = stream;
        
        Object.values( connections ).forEach( sendStreamTo );
      }
    },
    stopStream( userId ) {
      // TODO.
      // Need two different functions:
      // * Emit a signal to stop the incoming stream.
      // * Stop sending current stream, either to particular user or in general. (Actually, the former might not be necessary.)
      Object.values( streams ).forEach( outStream => {
        // TODO.
      } );
    },
    stopStreamFrom( userId ) {
      // Emit.
      socket.emit;
    },
    stopStreamTo( userId ) {
      // No wait, not necessary. Handle from socket handler.
    },
    stopSendingFeed() {
      // Stop to all users.
      streams;
    }
  };
} );
