import io from 'socket.io-client';
import createRTCStream from './rtcHandler';

const socket = io();

// TODO: Standardize type name style.

export default ( store => {
  
  const { dispatch, getState } = store,
    emit = socket.emit.bind( socket );
  
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
          
          dispatch( { type: 'START_DATA', userId: msg.startData.userId, users } );
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
          // before sending.
          // IN_SEND_REC and OUT_SEND_REC, or something.
          
          var { blob, ...videoData } = msg.rec,
            src = URL.createObjectURL( new Blob( [ blob ], { type: msg.rec.type } ) );
          
          dispatch( { ...videoData, type: 'RECEIVE_REC', fromUser, src } );
          
          break;
      }
      
      if ( msg.type && msg.type.startsWith( 'IN_' ) ) {
        if ( msg.rec && msg.rec.blob ) {
          msg.rec.src = URL.createObjectURL( new Blob( [ msg.rec.blob ], { type: msg.rec.type } ) );
          delete msg.rec.blob;
        }
        dispatch( { ...msg, meta: { ...msg.meta, dir: 'in' } } );
      }
      
    } );
    
  }
  
  function newUser( from ) {
    var rtcStream = createRTCStream( from, socket ),
      pc = rtcStream.pc;
    
    rtcStream.connected.then( ( newSrc ) => {
      dispatch( { type: 'RECEIVE_STREAM', fromUser: from, newSrc } );
    } );
    
    // [ 'icecandidate', 'removestream', 'iceconnectionstatechange', 'icegatheringstatechange', 'signalingstatechange', 'negotiationneeded', 'track' ].forEach( onX => {
    //   pc.addEventListener( onX, e => {
    //     console.log( onX, e );
    //   } );
    // } );
    
    return {
      userId: from,
      pc
    };
  }
  
  init();
  
  // Maybe add a wrapper.
  return socket;
} );
