import React, { useRef, useState } from 'react';
import { connect } from 'react-redux';
import './SendBox.css';

/*
TODO: Split off into separate component, with its own CSS file.
*/
const SendBox = connect(
  null,
  dispatch => ( { sendChat( text ) {
    dispatch( { type: 'X_CHAT', chat: { text } } );
  } } )
)( function SendBox( { sendChat } ) {
  var inputRef = useRef(),
    [ hasEnteredText, setHasEnteredText ] = useState( false );
  
  // Still unsure whether this kind of singular chat entry box is the best way.
  
  return <div>
    <form
      onChange={ e => {
        // 'User is typing...'
        
        var enteredText = inputRef.current.value.trim() !== '';
        
        if ( enteredText !== hasEnteredText ) {
          // TODO.
        }
        
      }}
      onSubmit={ e => {
        e.preventDefault();
        
        var text = inputRef.current.value;
        if ( text && text.trim() ) {
          sendChat( text );
          
          inputRef.current.value = '';
        }
      } }
      className='SendBox-form'
    >
      <HandButton />
      <input ref={ inputRef } placeholder='Ask a question...' className='SendBox-ask' />
    </form>
  </div>;
} );

const HandButton = connect( state => ( { hand: state.hand } ) )( function HandButton( props ) {
  return <div
    onClick={ e => {
      // Toggle handraise.
      props.dispatch( { type: 'X_HAND', raised: !props.hand } );
    } }
    className={ 'HandButton' + ( props.hand ? ' active' : '' ) }
  >Hand</div>;
} );

export default SendBox;
