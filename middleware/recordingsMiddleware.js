import displayVideo from '../tests/testing_utils.js';

// This middleware has two important roles:
// * Run a cache for videos, both incoming and outgoing.
// * Process chunks of videos (.chunks) into usable video URLs (set to .src),
//   using either MediaSource (for videos that come in a few bits at a time) or
//   simple createObjectURL (for completed videos).
// ** The .chunks prop is stripped and replaced with .src when sending to redux.


// To avoid sending or receiving the same video twice, cache previously received
// videos (in recordingsIn) and keep a list of videos previously sent (recordingsOut).
// The server will fill in the blanks when necessary on the sending end, and
// the recordingsIn object will fill in from the cache on this end.

var recordingsOut = {
    // [ id ]: src
  },
  recordingsIn = {
    // TODO: Consider how to work recordings-in-progress (not fully loaded, when
    // being transferred in chunks.)
    
    // [ id ]: {
      // Each recording should have:
      // * An ID (Math.random() I think)
      // * The Video blob, if recorded locally.
      // * A URL. (This should be filled in once complete.)
      // * An array of videodata arrays
      // ** This should always start from index-0. The server should fill in
      //    earlier data if not sent yet.
      // ** Actually, is this necessary? Maybe just store as internal prop like
      //    sequences, and expose appendData which could set src?
      //    Nah, I don't like it adding a new prop.
      // * Length
      // * Subtitles, and timestamps.
      // * Type?
      // * ...?
    // }
  },
  // Nope for both.
  // (What does this do?)
  slicesSent = {
    // [ videoId ]: [ chunks, chunks, ... ]
  },
  // Currently unused, planned for when browsers switchover to srcObject for ms, maybe?
  sequences = {
    // [ videoId ]: { src, appendData }
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


/**
 * @return return.appendData
 * @return return.getSrc
 */
function createVideo( mimeType ) {
  
  // Rule is, don't ask for the src in the middle unless it's a sequence.
  // reset is currently unused.
  function getSrc( reset ) {
    if ( src ) {
      if ( reset && allChunks.length ) {
        // I don't like this, but reusing a MediaSource URL doesn't seem to work.
        console.log( '_beh6 - reset' );
        src = URL.createObjectURL( new Blob( allChunks ) );
        allChunks = [];
      }
      return src;
    } else if ( isFinished ) {
      console.log( 'creating src', chunks, mimeType );
      src = URL.createObjectURL( getBlob( chunks ) );
      // Testing: (TODO: Remove.)
      displayVideo( chunks[ 0 ] );
      return src;
    } else {
      // The media isn't finished loading, but we have to run it anyway.
      // Use MediaSource to have an src for a partly-loaded video which can
      // start running right away, while we add on the rest of it as it comes in.
      src = URL.createObjectURL( createMediaSource() );
      return src;
    }
  }
  
  function getBlob( chunks ) {
    return new Blob( [].concat( ...chunks ), { type: mimeType } );
    // return new Blob( chunks, { type: mimeType } );
  }
  
  /**
   * Append any available buffers to the mediaSource's sourceBuffer.
   */
  function appendNext() {
    if ( mediaSource.sourceBuffers.length === 0 ) {
      // We don't have a sourceBuffer available. Create one.
      sourceBuffer = mediaSource.addSourceBuffer( mimeType );
      
      sourceBuffer.onupdateend = () => {
        // (If there are any buffers left after we're done the current
        // one, keep going.)
        if ( buffersToBeAppended.length ) {
          appendNext();
        } else if ( buffersFinished ) {
          console.log( 'endOfStream' );
          // This needs to be called after updateend, but only called once.
          mediaSource.endOfStream();
        }
      };
    }
    
    if ( !sourceBuffer.updating ) {
      sourceBuffer.appendBuffer( buffersToBeAppended.shift() );
    }
  }
  
  
  function appendData( chunk, isFinalSlice ) {
    if ( !isFinished ) {
      console.log( 'CHUNK', chunk );
      if ( chunk.length ) {
        if ( mediaSource ) {
          chunk.forEach( chunk => {
            appendDataToMediaSource( chunk, isFinalSlice );
          } );
        } else {
          chunks.push( chunk );
        }
      }
      
      if ( isFinalSlice ) {
        isFinished = true;
      }
    }
  }
  
  function appendDataToMediaSource( chunk, isFinalSlice ) {
    console.log( '_beh sb receive blob', chunk, chunk[ 0 ], isFinalSlice );
    // Get started on processing the blob right away, even if it can't
    // be added immediately.
    
    // var buffer = new Response( getBlob( chunk ) ).arrayBuffer();
    
    // TODO: There's a mess with what's plural or not here ('chunk' vs 'chunks'). Clean this up.
    // Will break things if there's ever more than one chunk in chunk here.
    // var buffer = new Blob( [ chunk ] ); //[ 0 ];
    
    // var buffer = chunk;
    
    var buffer = chunk instanceof Blob ?
      // new Promise( resolve => {
      //   let fr = new FileReader();
      //   fr.onload = e => resolve( e.target.result );
      //   fr.readAsArrayBuffer( chunk );
      // } ) :
      new Response( chunk ).arrayBuffer() :
      chunk;
    
    // Keep things in order. Even if one promise takes longer, don't shuffle.
    queue = queue.then( async () => {
      
      await mediaSourceReady;
      
      buffersToBeAppended.push( await buffer );
      // buffersToBeAppended.push( buffer );
      
      allChunks.push( await buffer );
      
      console.log( '_beh5', buffersToBeAppended, buffer, chunk, allChunks );
      
      // Inconsistent use of isFinished. This won't block slices, too late. TODO.
      // ...Fixed, but I don't like this.
      buffersFinished = isFinalSlice;
      
      appendNext();
      
    } );
  }
  
  function createMediaSource() {
    mediaSource = new MediaSource();
    mediaSourceReady = new Promise( resolve => {
      // Resolve once the mediaSource is ready to use.
      if ( mediaSource.readyState === 'open' ) {
        resolve();
      } else {
        mediaSource.addEventListener( 'sourceopen', e => {
          console.log( 'sourceopen' );
          resolve();
        }, { once: true } );
      }
    } );
    
    // Add any chunks already in the cache.
    while ( chunks.length ) {
      appendData( chunks.shift(), false );
    }
    
    return mediaSource;
  }
  
  var src,
    isFinished = false,
    buffersFinished = false,
    mediaSource = false,
    // Yet to be processed.
    chunks = [],
    // All recieved. For use in re-creating URL for mediaSource.
    allChunks = [],
    mediaSourceReady,
    sourceBuffer, // Can't create sourceBuffer until sourceopen has fired.
    buffersToBeAppended = [],
    queue = Promise.resolve();
  
  if ( !MediaSource.isTypeSupported( mimeType ) ) {
    throw Error( 'Type not supported: ' + mimeType );
  }
    
  
  // PROBLEM: If we're sent a delayed video, added on the stack, and it finishes
  // loading before it starts running, we don't need to use mediasource. But,
  // the redux will already have had the src... This might be necessary, because
  // we might need to start the mediasource at any moment.
  
  
  
  // Thing is, src is only available after finishing last appendData...
  // Also, redux shouldn't really take anything until last.
  // Doesn't seem to work...
  
  // We don't actually know whether something's a sequence or not yet.
  return { appendData, getSrc };
}


// Separate 'isFinalSlice' into separate function ('finish'?)?
// Rename 'createMediaSource'?
// Deprecated, unused. TODO: Delete.
function createSequence( mimeType ) {
  // Maybe also have equivalent for regular recordings.
  
  /**
   * Append any available buffers to the mediaSource's sourceBuffer.
   */
  function appendNext() {
    if ( mediaSource.sourceBuffers.length === 0 ) {
      // We don't have a sourceBuffer available. Create one.
      sourceBuffer = mediaSource.addSourceBuffer( mimeType );
      
      sourceBuffer.onupdateend = () => {
        // (If there are any buffers left after we're done the current
        // one, keep going.)
        if ( buffersToBeAppended.length ) {
          appendNext();
        } else if ( isFinished ) {
          console.log( 'endOfStream' );
          mediaSource.endOfStream();
        }
      };
    }
    
    if ( !sourceBuffer.updating ) {
      sourceBuffer.appendBuffer( buffersToBeAppended.shift() );
    }
  }
  
  function appendData( blob, isFinalSlice ) {
    console.log( 'sb receive blob', isFinalSlice );
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
      
      isFinished = isFinalSlice;
      
      appendNext();
      
    } );
  }
  
  var isFinished = false,
    mediaSource = new MediaSource(),
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
  
  if ( !MediaSource.isTypeSupported( mimeType ) ) {
    throw Error( 'Type not supported: ' + mimeType );
  }
  
  return {
    src,
    appendData
  };
}




var cache = {};

// Re-running mediasource doesn't work. To test:
// * Can it run in multiple <video>s at the same time?
// * Can it be re-built from the chunks and run?
// 
// Sort-of fixed this, through a means that I don't like and don't understand.

function processVideoData( { ...videoData }, dir ) {
  var { videoId, sliceIndex, isFinalSlice, mimeType } = videoData,
    cache = dir === 'in' ? recordingsIn : recordingsOut,
    sendingToServer = !dir,
    sendingToRedux = !sendingToServer;
  
  // Need to:
  // * If incomplete video:
  // ** Store slice.
  // * If completing video:
  // ** Get stored slices...
  // * Get from cache, regardless of dir
  // * Set to cache
  // ** When going out, cache src either on !dir or dir='out' (either works).
  //    It's only set to videoData on 'out', though.
  // *** What about sequences?
  // **** Set append at some point.
  // ** If dir='in', set src/append/slices
  // ** Should cache hold src in both directions?
  // *** 
  // * Delete chunks if dir (if chunks are present, absent if from cache)
  // * Set src if dir
  
  // Cache data format:
  // recordingsOut/In = {
  //   [ videoId ]: {
  //     src,
  //     append, // include slice ids when sending?
  //     finish,
  //     slices
  //   }
  // };
  console.log( 333, cache[ videoId ] );
  var { getSrc, appendData } = cache[ videoId ] || ( cache[ videoId ] = createVideo( mimeType ) ),
    chunks;
  console.log( 444, getSrc, cache, videoId, dir )
  if ( sendingToServer ) {
    if ( slicesSent[ videoId ] ) {
      // TODO: Figure out how to tell which chunks have been sent and which are new?
      // Theoretically, we should never receive or send the same chunks twice.
      // Server should handle it.
      // TODO: Check whether slice is sent.
      
      // This assumes that slices are sent in order. Does that work?
      
      // Server already has these chunks cached. Don't send again.
      
      if ( slicesSent[ videoId ] <= sliceIndex ) {
        slicesSent[ videoId ]++;
      } else {
        // Video was already finished.
        
        // Do we ever actually need to send sliceIndex? Absence of chunks should
        // make it obvious...
        videoData = { videoId, sliceIndex };
      }
    } else {
      // First slice of this video.
      slicesSent[ videoId ] = 1;
    }
  } else {
    // Sending to redux store.
    if ( videoData.chunks ) {
      
      // Don't send chunks to redux.
      ( { chunks, ...videoData } = videoData );
      console.log( 'aD', chunks );
      appendData( chunks, isFinalSlice );
      
    }
    
    // TODO: isFinalSlice is never set when getting cached.
    // Fixed?
    if ( videoData.isSequence || isFinalSlice || !chunks ) {
      videoData.src = getSrc(
        !chunks
      );
    }
  }
  
  return videoData;
}


// TODO: Remove.
function getSrc( { chunks, mimeType } ) {
  return URL.createObjectURL( new Blob( chunks, { type: mimeType } ) )
}

export default function ( store ) {
  return next => action => {
    
    
    if ( action.type === 'GET_SEQUENCE' ) {
      // Currently unused.
      // Eventually, browsers are going to switch over to using the
      // srcObject = mediaSource format instead of src = URL.createObjectURL( mediaSource );
      // VideoBlock can be modified to use this instead.
      // TODO when that happens: Add .mediaSource to sequences.
      let sequence = sequences[ action.videoId ];
      return sequence ? sequence.mediaSource : false;
    }
    
    
    // Some of these two systems will need merging.
    // Sequences need caching on both ends, videos will need appending method.
    // There doesn't need to be a 'GET_VIDEO', I think. Ordinary in/outs with
    // associated video ids can have videos filled in here, and dealt with by
    // the reducer.
    // Does each chunk need a 'chunkid'?
    // Chunks are isolated from length/transcription/etc. How to make it work?
    
    // This needs to run before socket to modify before it gets there, which it does.
    
    if ( action.videoData ) {
      action = { ...action, videoData: processVideoData( action.videoData, action.meta && action.meta.dir ) };
      return next( action );
    }
    
    return next( action );
  };
}
