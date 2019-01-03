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
        { ...action, type: 'IN_' + type }
      );
      
      return next( { ...action, type: 'OUT_' + type } );
    }
    
    if ( action.type === 'EMIT' ) {
      return socket.emit( 'out', action.payload );
    } else {
      return next( action ); 
    }
  };
};
