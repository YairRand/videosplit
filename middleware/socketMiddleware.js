import socketHandler from './socketHandler.js';

export default store => {
  var socket = socketHandler( store );
  
  return next => action => {
    
    // Any 'X_ACTION' is dispatched here as 'OUT_ACTION' and by other user(s)
    // as 'IN_ACTION' via the socket.
    if ( action.type.startsWith( 'X_' ) ) {
      
      let { callback, ..._action } = action,
        type = action.type.substr( 2 ),
        toEmit = 
          // They'll receive it as 'IN', so...
          { ..._action, type: 'IN_' + type, baseType: type };
      
      if ( callback ) {
        toEmit.awaitingCallback = true;
      }
  
      console.log( 'emitting', toEmit, callback );
      
      socket.emit(
        action.toUser ? 'toUser' : 'out',
        toEmit,
        callback
      );
      
      // baseType should be in meta, theoretically.
      return next( { ..._action, type: 'OUT_' + type, baseType: type, meta: { ...action.meta, dir: 'out' } } );
    } else if ( action.type === 'EMIT' ) {
      // Currently unused.
      return socket.emit( 'out', action.payload );
    } else {
      switch ( action.type ) {
        case 'GET_STREAM':
          return socket.getStream( action.userId );
        case 'SEND_STREAM':
          return socket.sendStream( action.stream );
        case 'STOP_STREAM':
          return socket.stopStream( action.userId );
        default:
          return next( action );
      }
    }
  };
};
