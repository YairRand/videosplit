// To avoid sending or recieving the same video twice, cache previously recieved
// videos (in recordingsIn) and keep a list of videos previously sent (recordingsOut).
// The server will fill in the blanks when necessary on the sending end, and
// the recordingsIn object will fill in from the cache on this end.

// var recordings = {
// };

var recordingsOut = {
    // [ id ]: true
  },
  recordingsIn = {
    // [ id ]: {
      // Each recording should have:
      // * An ID (Math.random() I think)
      // * The Video blob, if recorded locally.
      // * A URL.
      // * Length
      // * Subtitles, and timestamps.
      // * Type?
      // * ...?
    // }
  },
  sequences = {
    
  };

// Currently blobs are stored as local state of UserVideoBlock.
// That might actually be workable, if the store only holds everything but the blob?

// How about this: We store blobs here and on the server, but when we have the
// id but not the corresponding URL, automatically request it from the server.
// The server can store who already has which videos, and send them along with
// any relevant messages.
// Any dispatches requiring an unavailable video would delay the dispatch until
// the server gets back.


// For the video time problem: How about 'SET_VIDEO', which would store a ref to
// the video element ( { getCurrentTime: () => ref.current.currentTime } ) in
// middleware, and having a { getVideoTime: key } prop would fill in the time?
// ^ Implemented as 'REGISTER_VIDEO_PLAYER'. TODO: Maybe move here.

// ALso DOCUMENT at the top of each file and in main.js.


// (This would mean merging this mw with the socket mw.

// Idea: Make this a prop. If we've already sent the video, don't pass it to the server.
// If we recieve a video with a familiar blob in the set property, add the video from cache.


export default function ( store ) {
  return next => action => {
    
    // This needs to run before socket to modify before it gets there, which it does.
    
    if ( action.videoData ) {
      
      let videoData = action.videoData,
        { id, sequenceId } = videoData,
        dir = action.meta && action.meta.dir;
      
      
      if ( sequenceId ) {
        // Sequences.
        
        // These are sequences of bits of video which are being added shortly
        // after being produced.
        // As each of these chunks are recieved, they're added to the sequences
        // MediaSource, which extends the video associated with the src that it
        // produced.
        
        // TODO: Notice when the delayed group is over. This should theoretically
        // be mediaSource.endOfStream(); (after updateEnd?), I think. That should allow onEnd to fire.
        // Need to change recorder.js to notice when ending.
        
        let sequence = sequences[ sequenceId ] || ( sequences[ sequenceId ] = ( () => {
            
            /**
             * Append any available buffers to the mediaSource's sourceBuffer.
             */
            function appendNext() {
              if ( mediaSource.sourceBuffers.length === 0 ) {
                // We don't have a sourceBuffer available. Create one.
                sourceBuffer = mediaSource.addSourceBuffer( videoData.type );
                
                sourceBuffer.onupdateend = () => {
                  // (If there are any buffers left after we're done the current
                  // one, keep going.)
                  if ( buffersToBeAppended.length ) {
                    appendNext();
                  }
                };
              }
              
              if ( !sourceBuffer.updating ) {
                sourceBuffer.appendBuffer( buffersToBeAppended.shift() );
              }
            }
            
            async function appendData( blob ) {
              // Get started on processing the blob right away, even if it can't
              // be added immediately.
              var buffer = new Response( blob ).arrayBuffer();
              // var buffer = new Promise( resolve => {
              //   let fr = new FileReader();
              //   fr.onload = e => resolve( e.target.result );
              //   fr.readAsArrayBuffer( blob );
              // } );
              
              // Keep things in order. Even if one promise takes longer, don't shuffle.
              queue = queue.then( async () => {
                
                await mediaSourceReady;
                
                buffersToBeAppended.push( await buffer );
                
                appendNext();
                
              } );
            }
            
            var mediaSource = new MediaSource(),
              src = URL.createObjectURL( mediaSource ),
              mediaSourceReady = new Promise( resolve => {
                // Resolve once the mediaSource is ready to use.
                if ( mediaSource.readyState === 'open' ) {
                  resolve();
                } else {
                  mediaSource.addEventListener( 'sourceopen', e => {
                    resolve();
                  }, { once: true } );
                }
              } ),
              sourceBuffer, // Can't create sourceBuffer until sourceopen has fired.
              buffersToBeAppended = [],
              queue = Promise.resolve();
            
            if ( !MediaSource.isTypeSupported( videoData.type ) ) {
              throw Error( 'Type not supported: ' + videoData.type );
            }
            
            return {
              src,
              appendData
            };
          } )() ),
          { src, appendData } = sequence,
          chunks = [].concat( ...videoData.chunks ),
          blob = new Blob( chunks, { type: videoData.type } );
        
        appendData( blob );
        
        if ( dir === 'in' ) {
          // Don't send chunks to redux store.
          ( { chunks: {}, ...videoData } = videoData );
        }
        videoData.src = src; // TODO: Don't modify the action object here.
        
        
      } else {
        // Regular videos.
        // TODO: Merge some with above.
        if ( dir === 'in' ) {
          if ( recordingsIn[ id ] ) {
            // We've already been sent this video. Use the cached version.
            videoData = recordingsIn[ id ];
          } else {
            if ( videoData.blob ) {
              // Turn the blob into a url, and cache for future uses.
              
              videoData.src = URL.createObjectURL( new Blob( [ videoData.blob ], { type: videoData.type } ) );
              
              ( { blob: {}, ...videoData } = videoData );
              recordingsIn[ id ] = videoData;
            }
          }
        } else {
          // Sending out a video.
          if ( recordingsOut[ id ] ) {
            // The server already has the data available. Don't re-send.
            ( { blob: {}, ...videoData } = videoData );
          } else {
            // Record that this video has been sent.
            recordingsOut[ id ] = true;
          }
        }
      }
      
      action = { ...action, videoData };
    }
    
    return next( action );
  };
}
