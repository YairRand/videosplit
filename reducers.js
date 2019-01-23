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
  
  // switch( action.baseType ) {
  //   case 'VIDEO_END': {
  //     var { dir } = action,
  //       otherDir = dir === 'out' ? 'in' : 'out';
  // 
  //     return modItem( state, dir === 'out' ? action.toUser : action.fromUser, state => {
  //       var [ , ...recordingsQueue ] = state[ otherDir ].recordingsQueue;
  //       return { [ otherDir ]: { ...state[ otherDir ], useLive: recordingsQueue.length === 0, recordingsQueue } };
  //     } );
  //   }
  // }
  
  switch( action.type ) {
    case 'START_DATA':
      return action.users.map( user => ( { ...newUser(), ...user } ) );
    case 'USER_CONNECT':
      return [ ...state, { ...newUser(), ...action.user } ];
    case 'USER_DISCONNECT':
      return state.filter( user => user.userId !== action.userId );
    // case 'RECEIVE_STREAM':
    //   // TODO: Don't store stream in store.
    //   // return modItem( state, action.fromUser, state => ( { src: action.newSrc, streamSrc: action.newSrc } ) );
    //   break;
    case 'IN_SEND_REC': {
      // TODO: Remove sequenceId after splitting off sequences.
      let { src, length, transcript, sequenceId } = action.videoData;
      
      return modItem( state, action.fromUser, state => ( {
        in: {
          ...state.in,
          useLive: false,
          recordingsQueue: [ ...state.in.recordingsQueue, {
            src, length, transcript,
            sequenceId,
            // Time to start playing from. (Used in case video is paused and later started again from point left off.)
            // Should this be renamed "time"?
            last_rec_time: 0
          } ]
        },
        src,
        // ??
        // This appears to be used somewhere.
        time: 0
      } ) );
    }
    case 'OUT_SEND_REC': {
      // Assume sending to all participants.
      // Eventually, allow for sending to only particular participants.
      // toUsers: [], perhaps. (Actually, that could be confused with for none?)
      let { src, length, transcript, sequenceId } = action.videoData;
      return state.map( state => ( { ...state, out: { ...state.out, useLive: false, recordingsQueue: [ ...state.out.recordingsQueue, {
        src, length, transcript, last_rec_time: 0,
        sequenceId,
        // TODO: Get rid of the 'startTime' stuff.
        startTime: action.time, time: 0
      } ] } } ) );
    }
    case 'IN_EXTEND_SEQ': {
      let { length, transcript, sequenceId } = action.videoData;
      return modItem( state, action.fromUser, state => ( {
        in: {
          ...state.in,
          recordingsQueue: state.in.recordingsQueue.map( rec => {
            if ( rec.sequenceId === sequenceId ) {
              return { ...rec, length: rec.length + length, transcript };
            } else {
              return rec;
            }
          } )
        }
      } ) );
    }
    case 'OUT_EXTEND_SEQ': {
      let { length, transcript, sequenceId } = action.videoData;
      return state.map( state => ( { ...state, out: {
        ...state.out,
        recordingsQueue: state.out.recordingsQueue.map( rec => {
          if ( rec.sequenceId === sequenceId ) {
            return { ...rec, length: rec.length + length, transcript };
          } else {
            return rec;
          }
        } )
      } } ) );
    }
    
    // TODO: Remove duplication.
    case 'OUT_VIDEO_END':
      return modItem( state, action.toUser, state => {
        var [ , ...recordingsQueue ] = state.in.recordingsQueue;
        return { in: { ...state.in, useLive: recordingsQueue.length === 0, recordingsQueue } };
      } );
    case 'IN_VIDEO_END':
      return modItem( state, action.fromUser, state => {
        var [ , ...recordingsQueue ] = state.out.recordingsQueue;
        return { out: { ...state.out, useLive: recordingsQueue.length === 0, recordingsQueue } };
      } );
    case 'IN_INTERRUPT_WITH_LIVE':
      // getVideoCurrentTime is filled in by videoPlayerMiddleware.
      
      return modItem( state, action.fromUser, state => {
        var oldQueue = state.in.recordingsQueue,
          last_rec_time = action.getVideoCurrentTime,
          recordingsQueue = oldQueue.length ? [ { ...oldQueue[ 0 ], last_rec_time }, ...oldQueue.slice( 1 ) ] : [];
        
        return { in: { ...state.in, useLive: true, recordingsQueue } };
      } );
    case 'OUT_INTERRUPT_WITH_LIVE':
      return modItem( state, action.toUser, state => {
        // console.log( 5550, recording, state.out.recordingsQueue );
        // This breaks if recordingsQueue is empty. TODO.
        var oldQueue = state.out.recordingsQueue,
          last_rec_time = oldQueue.length && ( action.time - oldQueue[ 0 ].startTime ) / 1000,
          recordingsQueue = oldQueue.length ? [ { ...oldQueue[ 0 ], last_rec_time }, ...oldQueue.slice( 1 ) ] : [];
        // / 1000 because video players use seconds instead of milliseconds.
        return { out: { ...state.out, useLive: true, recordingsQueue }, interrupting: true };
      } );
    case 'IN_RESUME_REC':
      return modItem( state, action.fromUser, state => ( { in: { ...state.in, useLive: false }, time: state.in.recordingsQueue[ 0 ].last_rec_time } ) );
    case 'OUT_RESUME_REC':
      return modItem( state, action.toUser, state => ( { out: { ...state.out, useLive: false }, interrupting: false, hand: false } ) );
    case 'IN_CHAT':
      return modItem( state, action.fromUser, state => ( { chats: [ ...state.chats, action.chat ] } ) );
    case 'IN_HAND':
      return modItem( state, action.fromUser, state => ( { hand: action.raised } ) );
    case 'IN_APPLY_EFFECT':
      // Apply visual effect, like blur.
      // Need separate things for live effects and recordings' effects.
      return modItem( state, action.fromUser, state => {
        // Mostly just an idea.
        var currentEffects = [ ...state.in.effects ];
        action.effects.forEach( effect => {
          let { type, enable, ...otherProps } = effect;
          currentEffects = currentEffects.filter( cEffect => cEffect.type === type );
          if ( effect.enable === true ) {
            if ( enable ) {
              currentEffects.push( { type, ...otherProps } );
            }
          }
        } );
        return { in: { ...state.in, effects: currentEffects } };
      } );
    
    default:
      return state;
  }
}

function newUser() {
  return {
    chats: [],
    hand: false,
    in: { useLive: true, recordingsQueue: [], effects: [] },
    out: { useLive: true, recordingsQueue: [] }
    // recordingsQueue: [ { last_rec_time, length, src, transcript, time?: 0 } ]
    // Need to store time in each video, as we can splice in videos before others, eg to answer a question.
    
    // userId
    // src, // Deprecating
    // last_rec // Deprecating
    // streamSrc, // Deprecating
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

function intMods( state = [], action ) {
  switch ( action.type ) {
    case 'ADD_INTMOD':
      return [ ...state, { type: action.modtype, id: action.id } ];
    case 'REMOVE_INTMOD':
      break;
    case 'IN_INTMOD_EVT':
      // Keep it simple for now. Just overwrite the whole thing each time.
      // ...I don't like this.
      return state.map( intmod => intmod.id === action.id ? action.state : state );
    default:
      return state;
  }
}

export default combineReducers( {
  userId,
  users,
  hand,
  intMods
} );
