import React, { useState, useLayoutEffect } from 'react';
// Things to do with audio:
// * Set up a way to measure incoming volume. (useTrackVolume, done)
// ** Also should be able to take simple on/off handlers/callbacks.
// *** ...while not requiring multiple trackvolumes to be created.
// * Delay/speedup incoming stream and play it.

// * Keep track of when volume goes below or above certain level, record time,
//   to notice any extended silences, which can be more easily sped through in
//   recordings/delayeds. Probably as array [ [start,end], [start,end] ], etc
//   and managed through setTimeouts and elem.currentTime

// Relevant tests:
// * Check whether sound is detected in live streams, recordings, and delayed streams.
// * Check whether sound is blocked from being audible on any of the above.
// * Check whether sound comes in double anywhere, with an echo.
// * Check whether this all works across browsers.

/**
 * This is a React Hook that returns the volume being outputted at the moment
 * from an element or stream.
 * @return {Number}
 */
function useTrackVolume( ref, muted, src ) {
  var [ volume, setVolume ] = useState( 0 ),
    // This will be run once, and set up the context for setOpenStatus which
    // will be preserved for future runs.
    [ { setOpenStatus } ] = useState( () => {
      
      // Local variables will persist.
      
      const audioContext = new AudioContext(),
        analyser = audioContext.createAnalyser(),
        // Cache MediaStream => MediaStreamAudioSourceNode
        streams = new Map();
      
      var
        /** @type {(MediaElementAudioSourceNode|MediaStreamAudioSourceNode)} */
        source,
        /** @type {MediaElementAudioSourceNode} */
        elemSource,
        // Timer, generated from requestAnimationFrame
        animFrame,
        // Whether there is currently a source of sound hooked up.
        isOpen = false;
      
      function getData() {
        var data = new Uint8Array( analyser.frequencyBinCount );
        
        analyser.getByteFrequencyData( data );
        
        var newVolume = data.reduce( ( x, y ) => x + y );
        
        return newVolume;
      }
      
      /**
       *
       */
      function showChanges() {
        animFrame = requestAnimationFrame( () => {
          var newVolume = getData();
          
          if ( newVolume !== volume ) {
            // The local setter (=) is necessary because the local context persists,
            // and setState can't update that by itself.
            // The setState is necessary so that the return statement outside
            // the local context returns the right result.
            setVolume( volume = newVolume );
          }
          showChanges();
        } );
      }
      
      function open() {
        showChanges();
      }
      
      function close() {
        cancelAnimationFrame( animFrame );
      }
      
      return {
        setOpenStatus( toOpen, src ) {
          // This is only called when open or src has changed, after rendering
          // the element.
          console.log( '[audioProcessor] setstream - openstatus', { toOpen, src, streams, source }, ref.current );
          
          if ( isOpen ) {
            // Disconnect the old source.
            source.disconnect();
          }
          
          if ( toOpen && src ) {
            
            if ( typeof src === 'object' ) {
              // Live stream. Cache MediaStreamSource.
              source = streams.get( src );
              if( !source ) {
                // For some reason, Chrome doesn't accept MediaStreams that come
                // via a video element using createMediaElementSource.
                // Work around it using createMediaStreamSource.
                source = audioContext.createMediaStreamSource( src );
                streams.set( src, source );
              }
              // Allow getting the data from the stream, but keep analyser
              // disconnected, so that we don't get an echo from the duplicate.
              // The source is not working through the element, so it's not
              // normally audible by itself. The element will still be audible.
              source.connect( analyser );
              analyser.disconnect();
            } else {
              // Cache.
              source = elemSource ||
                ( elemSource = audioContext.createMediaElementSource( ref.current ) );
              // Keep this connected to the destination, so that the source
              // element doesn't get muted.
              source.connect( analyser ).connect( audioContext.destination );
            }
            
            if ( audioContext.state === 'suspended' ) {
              // The audioContext gets muted randomly. Need to make sure it's
              // working.
              audioContext.resume();
            }
          }
          
          if ( toOpen !== isOpen ) {
            toOpen ? open() : close();
            isOpen = toOpen;
          }
          
          console.log( '[audioProcessor] setstream - g', audioContext.state, source, audioContext, analyser, source && source.numberOfOutputs );
        }
      };
    } );
  
  useLayoutEffect( () => {
    setOpenStatus( !muted && !!src, src );
  }, [ muted, typeof src === 'string' ? 'rec' : src ] );
  
  return ( muted || !src ) ? 0 : volume;
  
}

// TODO.
function catchup( elem ) {
  // Should this be the stream directly? Probably would be necessary...
  // If the video is muted, I don't think we'd have access to it.
  // dispatch( { type: 'GET_STREAM' } );
  const audioContext = new AudioContext(),
    source = audioContext.createMediaElementSource( elem );
}

export { useTrackVolume, catchup };
