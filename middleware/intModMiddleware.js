var intModDispatcher = {};

// Pass IntMod actions from local dispatchers to local reducers on the other clients.

export default function ( store ) {
  return next => action => {
    
    if ( action.type === 'REGISTER_INTMOD_DISPATCHER' ) {
      intModDispatcher[ action.intModType ] = action.dispatcher;
      return;
    }
      
    if ( action.type === 'UNREGISTER_INTMOD_DISPATCHER' ) {
      delete intModDispatcher[ action.intModType ];
      return;
    }
    
    if ( action.type === 'IN_INTMOD_ACTION' ) {
      // This is sometimes called before initial registration...
      let dispatcher = intModDispatcher[ action.intModType ];
      if ( dispatcher ) {
        dispatcher( { ...action.localAction, fromUser: action.fromUser } );
      }
      return;
    }
    
    if ( action.type === 'OUT_INTMOD_ACTION' ) {
      // Should this use .meta instead of .fromSelf, for consistency?
      intModDispatcher[ action.intModType ]( { ...action.localAction, fromSelf: true } );
      return;
    }
    
    return next( action );
  };
}
