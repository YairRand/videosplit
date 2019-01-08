const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;

export default ( function init() {
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
      SR[ et ] = e => console.log( et, e );
    } );
    SR.onstart = e => {
      console.log( 'begin speech recognition' );
      wordsStartTime = Date.now();
    };
    SR.onspeechend = e => {
      // Assume that any later words started at least after here.
      // Also need to restart the SR.
      console.log( 'speechend, starting' );
    };
    SR.onend = e => {
      // SR.start();
    };
    
    return {
      start() {
        SR.start();
        startTime = Date.now();
        words.splice( 0 );
        uncertainWords.splice( 0 );
      },
      getWords() {
        SR.stop();
        return [ ...words, ...uncertainWords ];
      }
    };
  } else {
    console.log( 'SpeechRecognition not supported' );
    
    return {
      start(){},
      reset(){},
      stop(){}
    };
  }
} )();
