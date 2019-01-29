import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useTrackVolume } from '../audioProcessor';

// (Not sure how rewinding and such would work here...)
// Does this really need to be aware of userId? Seems like it should be separate.
const VideoBlock = function VideoBlock( props ) {
  var { userId, subBox, muted, leftIcon } = props;
    // src, time, onEnded, dispatch
    
  // Note: Self-views don't need the canvas, I think? Also student views.
  // Don't spread props so much.
  
  return <div className='VideoBlock'>
    <BasicVideoBlock { ...props } videoId={ props.userId } size={ 1 } />
    <div className='VideoBlock-cornerBox'>
      { props.cornerBox && <>
        <BasicVideoBlock
          size={ 0.5 }
          time={ props.cornerBox.time }
          muted={ true }
          { ...props.cornerBox }
        />
        <TimeTicker startTime={ props.cornerBox.time } />
      </> }
    </div>
    <span style={{ float: 'left' }} >
      { leftIcon }
    </span>
    <span className='VideoBlock-username'>
      { userId !== null ? 'Person' + userId : 'Loading...' }
    </span>
    { subBox }
  </div>;
};

// This is the real 'raw' VideoBlock, with just src and such.
/**
 * @param {String|MediaStream} props.src
 * @param {Number} props.time Number of seconds since start of video.
 */
function BasicVideoBlock( { src, time, onEnded, videoId, size = 1, muted = false, dispatch, transcript } ) {
  // To make this a "presentational" component, videoId and dispatch could be
  // replaced with a ref, and the registration could be handled by VideoBlock.
  
  var ref = useRef(),
    canvasRef = useRef(),
    baseHeight = 200 * size,
    baseWidth = 200 * size;
  
  // Should this use useLayoutEffect instead to avoid waiting?
  // false && 
  useLayoutEffect( () => {
    let elem = ref.current,
      canvas = canvasRef.current,
      timer;
    
    // Avoid a white flash when switching videos by having a canvas behind the
    // video to show the last frame until the new source is loaded.
    var { videoWidth, videoHeight } = elem,
      dVideoWidth = Math.min( videoWidth / videoHeight, 1 ) * baseWidth,
      dVideoHeight = Math.min( videoHeight / videoWidth, 1 ) * baseHeight,
      left = ( baseWidth - dVideoWidth ) / 2,
      top = ( baseHeight - dVideoHeight ) / 2;
    
    if ( src ) {
      let ctx = canvasRef.current.getContext( '2d' );
      
      ctx.drawImage( elem, left, top, dVideoWidth, dVideoHeight );
      
      // For testing.
      // ctx.fillStyle = 'rgba( 0, 255, 255, 0.5 )';
      // ctx.fillRect( 0, 0, dVideoWidth, dVideoHeight );
    }
    
    function playVideo() {
      var onclick;
      
      function tryPlayAgain() {
        console.log( 'play didn\'t work, trying again' );
        timer = setTimeout( () => {
          elem.play()
            .then( () => {
              // Success.
              document.body.removeEventListener( 'click', onclick );
              console.log( 'successful play' );
            } )
            .catch( e => {
              tryPlayAgain();
            } );
        }, 400 );
      }
      
      elem.play()
        .catch( e => {
          // TODO: Show visual indicator to click.
          // TODO: Remove this event handler early if src changes. Also if
          // one of the tryPlayAgain's work.
          
          // Retry playing, and set a listener to try again.
          // (Some browsers only allow first play in direct reaction to click.)
          document.body.addEventListener( 'click', onclick = () => {
            elem.play();
            clearTimeout( timer );
          }, { once: true } );
          
          tryPlayAgain();
          // I think there was supposed to be a dedicated thing for checking "is active" or something?
        } );
    }
    
    if ( typeof src === 'object' ) {
      
      // Presumably a stream.
      elem.pause();
      elem.currentTime = 0; // Make sure we start at the beginning.
      elem.removeAttribute( 'src' );
      // elem.src = undefined;
      elem.srcObject = src;
      playVideo();
    } else {
      elem.srcObject = undefined;
      if ( typeof src === 'string' ) {
        // Presumably a recording, or a mediasource-url (delayed stream of recordings).
        console.log( 'setting src and time', src, time, elem );
        // TODO: Set .currentTime when resuming.
        // Setting time could be difficult for other situations. We don't know
        // how to tell set-0 -> (stay) from set-0 -> set-back-to-0 again...
        // Can only check this on src change.
        elem.src = src;
        elem.currentTime = time;
        playVideo();
      } else {
        console.log( 'removing src' );
        // Undefined src. (Probably on init.)
        // removeAttribute?
        elem.removeAttribute( 'src' );
      }
    }
    
    // if ( src ) {
    //   elem.addEventListener( 'canplaythrough', e => {
    //     elem.play();
    //   }, { once: true } );
    // }
    
    return () => {
      timer && clearTimeout( timer );
    };
  }, [ src ] );
  
  useEffect( () => {
    // TODO: Move this upward.
    // Maybe forwardRef or something to pass from above.
    if ( dispatch ) {
      var data = {
        getCurrentTime: () => ref.current.currentTime
      };
      
      dispatch( { type: 'REGISTER_VIDEO_PLAYER', data, videoId } );
      
      return () => dispatch( { type: 'UNREGISTER_VIDEO_PLAYER', videoId } );
    }
  }, [ videoId ] );
  
  // Should this allow multiple overlapping videos, to do things with clips or
  // translucency?
  
  // Note: Self-views don't need the canvas, I think? Also student views.
  // autoPlay
  // TODO: Add poster={ loading image thing }, I think? Or maybe just put a spinner over it.
  return <>
    <canvas width={ baseWidth } height={ baseHeight } ref={ canvasRef } style={{ position: 'absolute', left: 0 }} />
    <video
      width={ baseWidth } height={ baseHeight }
      ref={ ref }
      style={{
        position: 'relative',
        zIndex: 1
      }}
      onEnded={ onEnded }
      autoPlay={ true }
      muted={ muted }
    />
    <VolumeMeter vRef={ref} muted={muted} src={src} />
    { transcript && <SubtitlesBox transcript={ transcript.length ? transcript : [ 
      // Temporary, for testing.
      { word: 'blah', end: 1000 },
      { word: 'blah', end: 2000 },
      { word: 'blah', end: 3000 },
      { word: 'blah', end: 4000 },
      { word: 'blah', end: 5000 },
      { word: 'test', end: 6000 }
    ] } startTime={ time } />}
  </>;
}

function SubtitlesBox( { transcript, startTime } ) {
  // This is primarily for instructor-self-views.
  // I'm thinking a semitransparent grey-black box at the bottom of the video,
  // with the time-offset on the left, and the subtitles stream maybe
  // horizontal-scrolling? White text, maybe current word bolded. Show future
  // words where available?
  // Possibly necessary: A way to show more context, in situations where one
  // continuity comes into focus. A few words on screen might not be enough to
  // tell context, if instr was not paying attention.
  // Something to show more words...
  // 
  
  // First, follow the stream.
  
  // Maybe position: absolute to bottom.
  
  // The native one is low quality. Google's and Amazon's are much better, but cost money. (A's is ~$1.50/hour, G's ~$3/hour.)
  
  // We only know when a word ends, not when it begins. Assume that words start
  // right after prior word ends.
  
  // transcript.length || ( transcript = [ { word: 'blah', end: 1000 } ] );
  
  const [ time, setTime ] = useState( startTime * 1000 ),
    index = transcript.findIndex( word => word.end > time ),
    ongoing = index !== -1,
    endTime = ongoing && transcript[ index ] && transcript[ index ].end,
    past = transcript.slice( 0, ongoing ? index : undefined ),
    current = ongoing && transcript.slice( index ).filter( word => word.end === transcript[ index ].end ),
    ref = useRef();
  
  useEffect( () => {
    var timeUntilNext = endTime - time,
      timer = ongoing && setTimeout( () => {
        // Actually, shouldn't this use Date()?
        setTime( time => time + timeUntilNext );
      }, timeUntilNext );
    
    return () => {
      clearTimeout( timer );
    };
  }, [ time ] );
  
  useEffect( () => {
    var elem = ref.current;
    
    elem.style.marginLeft = '-' + Math.max( 0, elem.offsetWidth - elem.parentNode.offsetWidth ) + 'px';
  }, [ past, current ] );
  
  return <div className='SubtitlesBox'>
    <span className='SubtitlesBox-inner' ref={ ref }>
      <span>
        { past.map( item => item.word ).join( ' ' ) }
      </span>
      { ' ' }
      <span style={{ fontWeight: 'bold' }}>
        { current && current.map( item => item.word ).join( ' ' ) }
      </span>
    </span>
  </div>;
  
}

function TimeTicker( { startTime } ) {
  // TODO: When on a delay, use steady negative number.
  
  var [ time, setTime ] = useState( startTime ),
    // TODO: Remove duplication with ROB.
    lengthInSeconds = time / 1000;
  
  useEffect( () => {
    var start = Date.now(),
      timer = setInterval( () => setTime( Date.now() - start ), 1000 );
    return () => clearInterval( timer );
  }, [ startTime ] );
  
  return <span className='TimeTicker'>
    { Math.floor( lengthInSeconds / 60 ) + ':' + Math.floor( lengthInSeconds % 60 ).toString().padStart( 2, 0 ) }
  </span>;
}

function VolumeMeter( { vRef, muted, src } ) {
  var volume = useTrackVolume( vRef, muted, src );
  
  // TODO: Move CSS to stylesheet.
  return <div
    style={{
      width: 20,
      height: 10,
      position: 'absolute',
      top: 0
    }}
  >
    <div style={{
      width: Math.min( Math.sqrt( volume ), 20 ),
      height: '100%',
      backgroundColor: '#0000FF',
    }}
    >
    </div>
  </div>;
}

export default VideoBlock;
