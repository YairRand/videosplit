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
        userStream = fromUser && props.streams.find( stream => stream.userId === fromUser );
        
      console.log( 'in', msg, type, fromUser, userStream );
      
      switch ( msg.type ) {
      
        case 'startData':
          // Starting up. Step on.
          let streams = msg.startData.users.map( user => {
            return newStream( user.userId );
          } );
          console.log( 'START_DATA', msg );
          
          dispatch( { type: 'START_DATA', userId: msg.startData.userId, streams } );
        break;
        
        case 'userConnect':
          let stream = newStream( fromUser );
          dispatch( { type: 'USER_CONNECT', stream } );
          break;
        
        case 'userDisconnect':
          dispatch( { type: 'USER_DISCONNECT', userId: fromUser } );
          break;
        
        case 'rec':
          console.log( 'got rec', msg, new Blob( [ msg.rec.blob ], { type: msg.rec.type } ) );
          
          var newSrc = URL.createObjectURL( new Blob( [ msg.rec.blob ], { type: msg.rec.type } ) );
          
          dispatch( { type: 'RECEIVE_REC', fromUser, newSrc } )
          
          // userStream.vRef.current.onended = () => {
          //   // How to access the stream itself?
          //   userStream.vRef.current.srcObject = userStream.srcObject;
          // };
          break;
      }
      
      if ( msg.type && msg.type.startsWith( 'IN_' ) ) {
        dispatch( { ...msg } );
      }
      
    } );
    
  }
  
  function createPeerConnection( toUser ) {
    var rtcStream = createRTCStream( toUser, socket );
    rtcStream.connected.then( ( newSrc ) => {
      dispatch( { type: 'RECEIVE_STREAM', fromUser: toUser, newSrc } );
    } );
    return rtcStream.pc;
    
    [ 'icecandidate', 'removestream', 'iceconnectionstatechange', 'icegatheringstatechange', 'signalingstatechange', 'negotiationneeded', 'track' ].forEach( onX => {
      pc.addEventListener( onX, e => {
        console.log( onX, e );
      } );
    } );
    
    return pc;
  }
  
  function newStream( from ) {
    return {
      userId: from,
      pc: createPeerConnection( from )
    };
  }
  
  init();
  
  // Maybe add a wrapper.
  return socket;
} );
