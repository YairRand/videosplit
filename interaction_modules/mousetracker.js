import React, { Component, useState, useRef, useEffect } from 'react';

var sending = false,
  lastMousePosition = {},
  otherUsers = [];


export default function LiveCursor( props ) {
  var ref = useRef();
    // No use using state unless the dom should reflect own cursor somehow.
    // [ lastMousePosition, setMousePosition ] = useState( {} );
  
  
  
  useEffect( () => {
    var elem = ref.current;
    // Why not use useCallback and attach directly in react?
    // <div onMousemove={}>
    elem.onmousemove = ( position ) => {
      let { clientX, clientY } = position;
      if ( !sending && ( clientX !== lastMousePosition.clientY || clientY !== lastMousePosition.clientY ) ) {
        sending = true;
        Object.assign( lastMousePosition, { clientX, clientY } );
        socket.emit( 'out', { type: 'INTMOD', position }, () => {
          sending = false;
        } );
      }
    };
    
    return () => {
      // Kill handlers when unmounting?
    }
  }, [] );
  
  return <div ref={ ref }>
    {
      otherUsers.map( user => {
        
        return <div style={{ position: 'absolute', top: 1, left: 1 }} key={ user.userId } />;
        
      } )
    }
  </div>;
}
