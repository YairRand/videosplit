import React, { Component, useRef, useCallback } from 'react';

// I think using persistent outside vars might be bad practice? TODO.
var sending = false,
  lastMousePosition = {};


export default function LiveCursor( props ) {
  var ref = useRef(),
    [ state, iDispatch ] = props.useConnection( ( state, action ) => {
      
      var targetId = action.fromSelf ? 'self' : action.fromUser,
        targetUser = state.find( user => user.id === targetId );
      
      if ( !targetUser ) {
        // Add user mouse.
        targetUser = { id: targetId };
        state = [ ...state, targetUser ];
      }
      console.log( 'reducer', state );
      return state.map( user => {
        if ( user === targetUser ) {
          switch ( action.type ) {
            case 'MOVE_CURSOR':
              return { ...user, X: action.X, Y: action.Y, vis: true };
            case 'HIDDEN_CURSOR':
              // Maybe just remove it with .filter?
              return { ...user, vis: false };
          }
          
          return user;
        } else {
          return user;
        }
      } );
    }, [ { id: 'self', X: false, Y: false, vis: false } ] ),
    { X, Y } = state[ 0 ];
  
  const mouseMove = useCallback( ( position ) => {
      let { clientX, clientY } = position,
        X = clientX - ref.current.offsetLeft,
        Y = clientY - ref.current.offsetTop;
      
      if ( !sending && ( X !== lastMousePosition.X || Y !== lastMousePosition.Y ) ) {
        sending = true;
        Object.assign( lastMousePosition, { X, Y } );
        
        iDispatch( { type: 'MOVE_CURSOR', X, Y, callback() {
          sending = false;
        } } );
      }
    }, [ X, Y ] ),
    mouseHide = useCallback( () => iDispatch( { type: 'HIDDEN_CURSOR' } ), [ iDispatch ] );
  
  return <div
    ref={ ref }
    style={{ width: 100, height: 100, border: '1px solid blue', position: 'relative', overflow: 'hidden', float: 'right', clear: 'both' }}
    onMouseMove={ mouseMove }
    onMouseOut={ mouseHide }
  >
    {
      state.filter( m => m.vis ).map( user => {
        
        return <div style={{
          position: 'absolute', top: user.Y, left: user.X,
          backgroundColor: user.id === 'self' ? '#00FF00' : 'blue',
          height: 10, width: 10
        }} key={ user.id } />;
        
      } )
    }
  </div>;
}
