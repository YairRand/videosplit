import { combineReducers } from 'redux';

function userId( state = null, action ) {
  if ( action.type === 'START_DATA' ) {
    return action.userId;
  } else {
    return state;
  }
}

// Dispatching 'X_EVT' will emit 'IN_EVT' and dispatch 'OUT_EVT'. Receiving 'IN_EVT' dispatches same.

function streams( state = [], action ) {
  switch( action.type ) {
    case 'START_DATA':
      return action.streams.map( stream => ( { ...newUser(), ...stream } ) );
    case 'USER_CONNECT':
      return [ ...state, { ...newUser(), ...action.stream } ];
    case 'USER_DISCONNECT':
      return state.filter( stream => stream.userId !== action.userId );
    
    
    case 'RECEIVE_STREAM':
      return modItem( state, action.fromUser, state => ( { src: action.newSrc, streamSrc: action.newSrc } ) );
    case 'RECEIVE_REC':
      return modItem( state, action.fromUser, state => ( { src: action.newSrc } ) );
    case 'VIDEO_END':
      // TODO: When there are other recs waiting, switch to those instead.
      // pseudo-shift the list into src.
      return modItem( state, action.fromUser, state => ( { src: state.streamSrc } ) );
    case 'IN_INTERRUPT_WITH_LIVE':
      // TODO.
      // Store location of recording, somehow.
      // Actually, is that stored automatically by the browser?
      // Nope. TODO.
      return modItem( state, action.fromUser, state => ( { last_rec: state.src, src: state.streamSrc } ) );
    case 'IN_RESUME_REC':
      return modItem( state, action.fromUser, state => ( { src: state.last_rec } ) );
    case 'OUT_INTERRUPT_WITH_LIVE':
      return modItem( state, action.toUser, state => ( { interrupting: true } ) );
    case 'OUT_RESUME_REC':
      return modItem( state, action.toUser, state => ( { interrupting: false, hand: false } ) );
    case 'IN_CHAT':
      return modItem( state, action.fromUser, state => ( { chats: [ ...state.chats, action.chat ] } ) );
    case 'IN_HAND':
      return modItem( state, action.fromUser, state => ( { hand: action.raised } ) );
    
    
    default:
      return state;
  }
}

function newUser() {
  return { chats: [], hand: false };
}

function modItem( state, userId, fn ) {
  return state.map( stream => stream.userId === userId ? { ...stream, ...fn( stream ) } : stream );
}

function hand( state = false, action ) {
  switch ( action.type ) {
    case 'OUT_HAND':
      return action.raised;
    case 'IN_RESUME_REC':
      return false;
    default:
      return state;
  }
}

export default combineReducers( {
  userId,
  streams,
  hand
} );
