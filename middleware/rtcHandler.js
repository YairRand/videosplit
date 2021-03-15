export default function createRTCConnection( toUser, socket ) {
  
  // This is going to be a self-contained thing, return a promise with a stream.
  
  // Eventually move this to a separate module.
  
  // Does this need a thing for adding streams going outward? If so, might need
  // to restructure as not a promise.
  // Yeah, this needs a addTrack system. Maybe return { addTrack, stream: Promise() }?
  
  var pc = new RTCPeerConnection(),
    emit = socket.emit.bind( socket ),
    tracks = [];
  
  socket.on( 'in', async msg => {
    // We're interested in messages typed RTC_LD, RTC_RELD, and RTC_IC, but only
    // when sent from connection's partner.
    if ( msg.fromUser === toUser ) {
      switch( msg.type ) {
        // Called by partner's negotiationneeded event.
        case 'RTC_LD': {
          // INCOMING FEEEEED
          let rsd = new RTCSessionDescription( msg.ld );
          
          await pc.setRemoteDescription( rsd );
          // Theoretically, there should be an answer sent here, with outgoing video feed.
          
          var answer = await pc.createAnswer();
          await pc.setLocalDescription( answer );
          
          emit( 'toUser', { toUser, type: 'RTC_RELD', reLd: pc.localDescription } );
          console.log( '[RTCPeerConnection] handled incoming feed. sending reLd back.' );
          break;
        }
        // Called as response to RTC_LD, above.
        case 'RTC_RELD': {
          // Received response. Now what?
          let rsd = new RTCSessionDescription( msg.reLd );
          pc.setRemoteDescription( rsd );
          console.log( '[RTCPeerConnection] reLd complete' );
          
          break;
        }
        // Called by partner's icecandidate event.
        case 'RTC_IC':
          pc.addIceCandidate( new RTCIceCandidate( msg.ic ) );
          break;
      }
    }
  } );
  
  var connected = new Promise( resolve => {
    console.log( '[RTCPeerConnection] createRTCConnection' );
    // Set handlers.
    Object.entries( {
      // Step 1: Send out offer.
      // (This is triggered by addTrack.)
      negotiationneeded: async e => {
        var offer = await pc.createOffer();
        await pc.setLocalDescription( offer );
        
        // await pc.setLocalDescription( await pc.createOffer() );
        
        // Send pc.localDescription to other users.
        emit( 'toUser', { toUser, type: 'RTC_LD', ld: pc.localDescription } );
        
        // Can one sending get responses from multiple users?
        // No. Currently, this breaks if there are more than 2 users on.
        // TODO: Rework to only send one pc offer per user, to that user only.
      },
      
      // Step 2: Agree on a method.
      icecandidate: e => {
        e.candidate && emit( 'toUser', { toUser, type: 'RTC_IC', 'ic': e.candidate } );
      },
      
      // Step 3: Yay, we got a feed!
      track: e => {
        // SUCCESS!
        console.log( '[RTCPeerConnection - SUCCESS]', e );
        if ( e.streams ) {
          
          resolve( e.streams[ 0 ] );
          // dispatch( { type: 'RECEIVE_STREAM', fromUser: toUser, newSrc: e.streams[ 0 ] } );
        }
      }
    } ).forEach( ( [ evt, handler ] ) => pc.addEventListener( evt, e => {
      console.log( '[RTCPeerConnection - event]', evt, e );
      handler( e );
    } ) );
  } );
  
  return {
    pc,
    connected,
    addStream( stream ) {
      stream.getTracks().forEach( track => {
        tracks.push( track );
        pc.addTrack( track, stream );
      } );
    },
    removeStream() {
      pc.removeTrack( tracks.shift() );
    }
  };
}
