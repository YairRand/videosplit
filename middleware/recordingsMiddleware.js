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
  };

// Currently blobs are stored as local state of UserVideoBlock.
// That might actually be workable, if the store only holds everything but the blob?

// Might dump this file. Could/should the system work for streams, though?

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
        { id } = videoData,
        dir = action.meta && action.meta.dir;
      
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
      
      action = { ...action, videoData };
    }
    
    return next( action );
  };
}
