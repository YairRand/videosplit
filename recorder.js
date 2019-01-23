// TODO: Figure out how to divide recordings at the ends of words where possible.

const transcription = ( function init() {
  const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  
  if ( SpeechRecognition ) {
    const SR = new SpeechRecognition(),
      words = [],
      uncertainWords = [];
    
    let startTime,
      wordsStartTime;
    
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
    [ 'onstart', 'onend', 'onerror', 'onsoundstart', 'onsoundend', 'onaudiostart', 'onaudioend', 'onspeechstart', 'onspeechend' ].forEach( et => {
      SR[ et ] = e => console.log( 'SR', et, e );
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
    // SR.onend = e => {
    //   // SR.start();
    // };
    
    return {
      start() {
        SR.start();
        startTime = Date.now();
        words.splice( 0 );
        uncertainWords.splice( 0 );
      },
      getWords() {
        return [ ...words, ...uncertainWords ];
      },
      stop() {
        SR.stop();
      }
    };
  } else {
    console.log( 'SpeechRecognition not supported' );
    
    return {
      start(){},
      getWords() {
        return [];
      },
      stop(){
      }
    };
  }
} )();

export default function record( stream ) {
  var chunks = [],
    recorder = new MediaRecorder( stream, {
      // Are these actually the kind of options MR uses? TODO.
      video: true, audio: true
      // Might have to make this mandatory.
      // mimeType: 'video/webm;codecs=vp8,opus'
    } ),
    recordingStart = Date.now(),
    // Only use if sequence.
    sequenceId;
  
  recorder.ondataavailable = ( e ) => {
    // NOTE: Only the first chunk, or the collection of all chunks until .stop() will work.
    // Eventually, push these to the server immediately, and out from there.
    chunks.push( e.data );
  };
  
  transcription.start();
  
  // TODO: Send out chunks every X amount of time so that there's less loading
  // time when we need to switch to a just-finished recording.
  // For now, just split into chunks.
  recorder.start( 3000 );
  
  return {
    stop: function stopRecording() {
      return new Promise( resolve => {
        recorder.addEventListener( 'stop', () => {
          var type = chunks[ 0 ].type,
            now = Date.now(),
            newBlob = new Blob( chunks, { type } ),
            recordedVideo = {
              type,
              ts: now.toString(),
              // Why is this here?
              src: URL.createObjectURL( newBlob ),
              // Hope this is accurate...
              // If not, maybe set a video to the url and read .duration.
              length: now - recordingStart,
              transcript: transcription.getWords(),
              id: Math.random(),
              blob: newBlob
            };
          
          resolve( recordedVideo );
        }, { once: true } );
        
        transcription.stop();
        recorder.stop();
      } );
    },
    slice() {
      // TODO: Reduce duplication with above.
      return new Promise( resolve => {
        recorder.requestData();
        recorder.addEventListener( 'dataavailable', e => {
          var // chunks = [ e.data ],
            type = chunks[ 0 ].type,
            sentChunks = [ ...chunks ],
            now = Date.now(),
            firstInSequence = sequenceId === undefined,
            recordedVideo = {
              type,
              ts: now.toString(),
              // TODO:
              length: now - recordingStart,
              transcript: transcription.getWords(),
              id: Math.random(),
              sequenceId: sequenceId || ( sequenceId = Math.random() ),
              chunks: sentChunks,
              firstInSequence
            };
          
          recordingStart = now;
          chunks = [];
          
          resolve( recordedVideo );
        }, { once: true } );
      } );
    }
  };
}
