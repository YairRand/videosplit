import displayVideo from './tests/testing_utils.js';
// TODO: Figure out how to divide recordings at the ends of words where possible.

const transcription = ( function init() {
  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  
  if ( SpeechRecognition ) {
    const SR = new SpeechRecognition(),
      words = [],
      uncertainWords = [];
    
    let startTime,
      wordsStartTime,
      isFinished;
    
    SR.continuous = true;
    SR.interimResults = true;
    SR.lang = 'en-US';
    SR.onresult = e => {
      console.log( 'SR', [ ...e.results ].map( r => r[ 0 ].transcript ).join( '|' ), e, e.result );
      
      // Interim results means we get guesses. If they turn out right later, we can
      // assume that the words were finished prior to the timestamp of the guess.
      var i = 0;
      [ ...e.results ].slice( e.resultIndex ).forEach( updatedWords => {
        var { [ 0 ]: { transcript }, isFinal } = updatedWords;
        
        transcript.split( ' ' ).filter( word => word ).forEach( word => {
          if ( uncertainWords[ i ] && uncertainWords[ i ].word !== word ) {
            uncertainWords.splice( i );
          }
          if ( !uncertainWords[ i ] ) {
            uncertainWords.push( { end: Date.now() - startTime, word } );
          }
          
          if ( isFinal ) {
            // TODO: Lump remaining words into one unit?
            words.push( uncertainWords.shift() );
          } else {
            i++;
          }
        } );
        
      } );
    };
    [ 'start', 'end', 'error', 'soundstart', 'soundend', 'audiostart', 'audioend', 'speechstart', 'speechend' ].forEach( et => {
      // SR[ 'on' + et ] = e => console.log( 'SR', et, e );
      SR.addEventListener( et, e => console.log( 'SR', et, e ) );
    } );
    SR.onstart = e => {
      console.log( 'begin speech recognition' );
      // Currently unused?
      wordsStartTime = Date.now();
    };
    SR.onspeechend = e => {
      // Assume that any later words started at least after here.
      // Also need to restart the SR.
      console.log( 'speechend, starting' );
    };
    
    // If there's no sound for more than a few seconds, SR triggers 'no-speech'
    // error and ends. Restart when that happens.
    SR.onend = e => {
      console.log( 'SR onend', isFinished ? 'done' : 'restarting' );
      if ( isFinished === false ) {
        SR.start();
      }
    };
    
    return {
      start() {
        SR.start();
        isFinished = false;
        startTime = Date.now();
        words.splice( 0 );
        uncertainWords.splice( 0 );
      },
      getWords() {
        return [ ...words, ...uncertainWords ];
      },
      stop() {
        return new Promise( ( resolve ) => {
          isFinished = true;
          SR.addEventListener( 'end', resolve, { once: true } );
          SR.stop();
        } );
      }
    };
  } else {
    console.log( 'SpeechRecognition not supported' );
    
    return {
      start(){},
      getWords() {
        return [];
      },
      async stop(){
      }
    };
  }
} )();

export default function record( stream, dispatchChunk ) {
  
  // Don't overlap dataavailable events. TODO.
  function sliceChunks() {
    var p = onNextDataAvailable;
    
    recorder.requestData();
    
    return p;
  }
  
  async function finishingChunks() {
    recorder.stop();
    
    const [ finalChunks ] = await Promise.all( [
      onNextDataAvailable,
      transcription.stop()
    ] );
    console.log( '_beh3', finalChunks );
    return finalChunks;
  }
  
  
  // Two methods: .slice() and .stop()
  // Can do without isSequence for either? ...maybe. Maybe shouldn't anyway.
  async function _beh( isFinalSlice = false, isSequence ) {
    // TODO: Clean this up.
    slicing = true;
    console.log( '_beh1' );
    var sentChunks = [ ...await ( isFinalSlice ? finishingChunks() : sliceChunks() ) ],
      mimeType = sentChunks[ 0 ].type,
      now = Date.now(),
      recordedVideo = {
        mimeType,
        ts: now.toString(),
        // TODO:
        length: now - recordingStart,
        transcript: transcription.getWords(),
        videoId,
        sliceIndex: sliceIndex++,
        chunks: sentChunks,
        isSequence,
        isFinalSlice
      };
    
    // Testing: (TODO: Remove.)
    displayVideo( sentChunks );
    
    
    
    // For easier merging...
    if ( isSequence ) {
      // Is firstInSequence necessary?
      recordedVideo.firstInSequence = !sendingInProgress;
      sendingInProgress = true;
      runningAsSequence = true;
    }
    
    recordedVideo.isSequence = runningAsSequence;
    
    console.log( '_beh', sentChunks, slicing, recordedVideo );
    
    slicing = false;
    
    return recordedVideo;
  }
  
  var chunks = [],
    recorder = new MediaRecorder( stream, {
      // Are these actually the kind of options MR uses?
      // Looks like not. MDN lists mimeType and [video|audio|]BitsPerSecond. TODO.
      video: true, audio: true
      // Might have to make this mandatory.
      // Can test with MediaRecorder.isTypeSupported().
      // mimeType: 'video/webm;codecs=vp8,opus'
    } ),
    recordingStart = Date.now(),
    // Only use if sequence.
    sendingInProgress = false,
    runningAsSequence = false,
    videoId = Math.random(),
    sliceIndex = 0,
    slicing = false,
    onNextDataAvailable;
  
  
  // Try this.
  recorder.ondataavailable = ( () => {
    var resolve;
    
    function setPromise() {
      onNextDataAvailable = new Promise( r => {
        resolve = r;
      } );
    }
    
    setPromise();
    
    // The "slice" or "stop" should be bundled with the data sent.
    
    return ( e ) => {
      // NOTE: Only the first chunk, or the collection of all chunks until
      // .stop() will work as a video. Stopping in the middle works for streams, though.
      // Eventually, push these to the server immediately, and out from there.
      // NOTE: This might be a to-be-delayed stream. Don't break it if so.
      chunks.push( e.data );
      console.log( 'pushchunks', e.data, slicing );
      
      if ( slicing ) {
        
      } else {
        // dispatchChunk(
        //   // Fill something in. Currently expects "videoData"...
        //   chunks
        // );
      }
      
      resolve( chunks );
      if ( slicing ) {
        // Shouldn't actually be dependent on slicing. This is temporary until
        // dispatchChunk actually works.
        chunks = [];
      }
      setPromise();
    };
  } )();
  
  // recorder.ondataavailable = ( e ) => {
  //   // NOTE: Only the first chunk, or the collection of all chunks until
  //   // .stop() will work as a video. Stopping in the middle works for streams, though.
  //   // Eventually, push these to the server immediately, and out from there.
  //   // NOTE: This might be a to-be-delayed stream. Don't break it if so.
  //   chunks.push( e.data );
  //   console.log( 'pushchunks' );
  // 
  //   if ( slicing ) {
  //     slicing = false;
  //   }
  // };
  
  transcription.start();
  
  // TODO: Send out chunks every X amount of time so that there's less loading
  // time when we need to switch to a just-finished recording.
  // For now, just split into chunks.
  // recorder.start( 3000 );
  recorder.start();
  
  return {
    /**
     * @return {Promise.<Object>} videoData
     */
    stop( isSequence ) {
      return _beh( true, isSequence );
    },
    slice( isSequence ) {
      return _beh( false, isSequence );
    }
  };
}
