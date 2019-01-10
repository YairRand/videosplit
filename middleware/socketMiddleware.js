import socketHandler from './socketHandler.js';

export default store => {
  var socket = socketHandler( store );
  
  return next => action => {
    
    // Any 'X_ACTION' is dispatched here as 'OUT_ACTION' and by other user(s)
    // as 'IN_ACTION' via the socket.
    if ( action.type.startsWith( 'X_' ) ) {
      
      var type = action.type.substr( 2 );
      
      socket.emit(
        action.toUser ? 'toUser' : 'out',
        // They'll receive it as 'IN', so...
        { ...action, type: 'IN_' + type, baseType: type }
      );
      
      // baseType should be in meta, theoretically.
      return next( { ...action, type: 'OUT_' + type, baseType: type, meta: { ...action.meta, dir: 'out' } } );
    } else if ( action.type === 'EMIT' ) {
      // Currently unused.
      return socket.emit( 'out', action.payload );
    } else {
      return next( action ); 
    }
  };
};
