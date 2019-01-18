import React, { Component, useState, useRef, useEffect, useReducer } from 'react';
import { connect } from 'react-redux';

import mousetracker from './mousetracker';

var intModTypes = { mousetracker };

export default connect( state => ( { intMods: state.intMods } ) )( function IntMods( { intMods, dispatch } ) {
  return intMods.map( ( { type: intModType, id } ) => {
    console.log( intModType, intModTypes, intMods );
    var IntModComponent = intModTypes[ intModType ];
    
    // TODO: Send particular 'local dispatch' down, that automatically sends to other
    // users. Recieve other user props from here? Or recieve actions and use useReducer?
    // Need to separate handling of other users with own.
    
    // Also maybe send down useful functions like 'remove' and something to start
    // the next recording?
    
    return <IntModComponent
      dispatch={ dispatch }
      key={ id }
    />;
  } );
} );
