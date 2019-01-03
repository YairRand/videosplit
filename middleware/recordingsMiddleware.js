var recordings = {
  // Each recording should have:
  // * An ID (Math.random() I think)
  // * The Video blob, if recorded locally.
  // * A URL.
  // * Length
  // * Subtitles, and timestamps.
  // * Type?
  // * ...?
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

// (This would mean merging this mw with the socket mw.


export default function ( store ) {
  return next => action => {
    // if ( action.type === 'STORE_RECORDING' ) {
    //   // ??
    // }
    
    return next( action );
  }
}
