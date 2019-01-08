import { combineReducers } from 'redux';

function userId( state = null, action ) {
  if ( action.type === 'START_DATA' ) {
    return action.userId;
  } else {
    return state;
  }
}

// Dispatching 'X_EVT' will emit 'IN_EVT' and dispatch 'OUT_EVT'. Receiving 'IN_EVT' dispatches same.

function users( state = [], action ) {
  switch( action.type ) {
    case 'START_DATA':
      return action.users.map( stream => ( { ...newUser(), ...stream } ) );
    case 'USER_CONNECT':
      return [ ...state, { ...newUser(), ...action.stream } ];
    case 'USER_DISCONNECT':
      return state.filter( stream => stream.userId !== action.userId );
    case 'RECEIVE_STREAM':
      return modItem( state, action.fromUser, state => ( { src: action.newSrc, streamSrc: action.newSrc } ) );
    case 'IN_SEND_REC': {
      let { src, length, transcript } = action.rec;
      
      return modItem( state, action.fromUser, state => ( { in: { ...state.in, useLive: false, recordingsQueue: [ ...state.in.recordingsQueue, {
        src, length, transcript, last_rec_time: 0
      } ] }, src, time: 0 } ) );
    }
    case 'OUT_SEND_REC': {
      // Assume sending to all participants.
      // Eventually, allow for sending to only particular participants.
      // toUsers: [], perhaps.
      let { src, length, transcript } = action.rec;
      return state.map( state => ( { ...state, out: { ...state.out, useLive: false, recordingsQueue: [ ...state.out.recordingsQueue, {
        src, length, transcript, startTime: action.time, time: 0
      } ] } } ) );
    }
    case 'OUT_VIDEO_END':
      // TODO: When there are other recs waiting, switch to those instead.
      // pseudo-shift the list into src.
      return modItem( state, action.toUser, state => {
        var [ endedVideo, ...recordingsQueue ] = state.in.recordingsQueue;
        return { src: state.streamSrc, in: { ...state.in, useLive: recordingsQueue.length > 0, recordingsQueue } };
      } );
    case 'IN_VIDEO_END':
      return modItem( state, action.fromUser, state => {
        var [ endedVideo, ...recordingsQueue ] = state.out.recordingsQueue;
        return { out: { ...state.out, useLive: recordingsQueue.length === 0, recordingsQueue } };
      } );
    case 'IN_INTERRUPT_WITH_LIVE':
      // getVideoCurrentTime is filled in by videoPlayerMiddleware.
      
      return modItem( state, action.fromUser, state => {
        var oldQueue = state.in.recordingsQueue,
          recordingsQueue = oldQueue.length ? [ { ...oldQueue[ 0 ], last_rec_time: action.getVideoCurrentTime }, ...oldQueue.slice( 1 ) ] : [];
        
        return { in: { ...state.in, useLive: true, recordingsQueue }, last_rec: state.src, src: state.streamSrc };
      } );
    case 'IN_RESUME_REC':
      return modItem( state, action.fromUser, state => ( { in: { ...state.in, useLive: false }, src: state.last_rec, time: state.in.recordingsQueue[ 0 ].last_rec_time } ) );
    case 'OUT_INTERRUPT_WITH_LIVE':
      // TODO: Rewrite the mess with last_rec_time and out_last_rec_time.
      return modItem( state, action.toUser, state => {
        // console.log( 5550, action.time - state.outRecordingsQueue[ 0 ].startTime, action.time, state.outRecordingsQueue[ 0 ].startTime ),
        var recording = { ...state.out.recordingsQueue[ 0 ], last_rec_time: ( action.time - state.out.recordingsQueue[ 0 ].startTime ) / 1000 };
        // / 1000 because video players use seconds instead of milliseconds.
        return { out: { ...state.out, useLive: true, recordingsQueue: [ recording, ...state.out.recordingsQueue.slice( 1 ) ] }, interrupting: true };
      } );
    case 'OUT_RESUME_REC':
      return modItem( state, action.toUser, state => ( { out: { ...state.out, useLive: false }, interrupting: false, hand: false } ) );
    case 'IN_CHAT':
      return modItem( state, action.fromUser, state => ( { chats: [ ...state.chats, action.chat ] } ) );
    case 'IN_HAND':
      return modItem( state, action.fromUser, state => ( { hand: action.raised } ) );
    
    
    default:
      return state;
  }
}

function newUser() {
  return {
    chats: [],
    hand: false,
    in: { useLive: true, recordingsQueue: [] },
    out: { useLive: true, recordingsQueue: [] }
    // recordingsQueue: [ { last_rec_time } ]
    // Need to store time in each video, as we can splice in videos before others, eg to answer a question.
  };
}

function modItem( state, userId, fn ) {
  return state.map( user => user.userId === userId ? { ...user, ...fn( user ) } : user );
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
  users,
  hand
} );
