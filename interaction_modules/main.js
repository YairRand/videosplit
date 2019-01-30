import React, { useEffect, useReducer, useCallback } from 'react';
import { connect } from 'react-redux';

import mousetracker from './mousetracker';

// Ideas:
// * Mouse tracker. (started basic version)
// * Sketchpad-thing.
// * Tests/questionnaires.
// ** These should be able to affect video.
// * Interactive toy/demo thing. (Poke it and see what happens.)
// * Puzzles - students demonstrate ability with thing.
// * 
var intModTypes = { mousetracker };

export default connect(
  state => ( { intMods: state.intMods } )
)( function IntMods( { intMods, dispatch, register } ) {
  return intMods.map( ( { type: intModType, id } ) => {
    console.log( intModType, intModTypes, intMods );
    var IntModComponent = intModTypes[ intModType ];
    
    const useConnection = useCallback( ( reducer, initialState ) => {
      var [ state, localDispatch ] = useReducer( reducer, initialState );
      
      useEffect( () => {
        dispatch( { type: 'REGISTER_INTMOD_DISPATCHER', dispatcher: localDispatch, intModType } );
        
        return () => dispatch( { type: 'UNREGISTER_INTMOD_DISPATCHER', intModType } );
      }, [] );
      
      return [ state, function dispatchEmit( action ) {
        let { callback, ...localAction } = action;
        
        dispatch( { type: 'X_INTMOD_ACTION', intModType, localAction, callback } );
      } ];
    }, [ intModType ] );
    
    // Maybe also send down useful functions like 'remove' and something to start
    // the next recording?
    
    return <IntModComponent
      register={ register }
      dispatch={ dispatch }
      useConnection={ useConnection }
      key={ id }
    />;
  } );
} );
