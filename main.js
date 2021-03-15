import React from 'react';
import Home from './components/Home';
import reducer from './reducers.js';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider, connect } from 'react-redux';
import recordingsMiddleware from './middleware/recordingsMiddleware';
import socketMiddleware from './middleware/socketMiddleware';
import videoPlayerMiddleware from './middleware/videoPlayerMiddleware';
import intModMiddleware from './middleware/intModMiddleware';

var middleware = applyMiddleware(
    
    // Handles video caching between client and server.
    recordingsMiddleware,
    
    // Should RTC connections be stored in middleware?
    
    // Can we store videos as ids in store, and store the actual videos somewhere else?
    
    // Or maybe, the video block itself could access things by id via dispatch( 'GET_BY_ID' ) using mapStateToProps?
    // Would require waiting for the video to load, dispatch would return a promise...
    
    
    // Handles type 'EMIT' and transforms all 'X_ACTION' into 'OUT_ACTION' locally
    // and 'IN_ACTION' for all other users.
    // Also handles 'GET_STREAM', 'SEND_STREAM', and 'STOP_STREAM', which deal with webrtc connections.
    socketMiddleware,
    
    // Handles types 'REGISTER_VIDEO_PLAYER', 'UNREGISTER_VIDEO_PLAYER', and transforms prop 'getVideoCurrentTime'.
    videoPlayerMiddleware,
    
    // Handles '[UN]REGISTER_INTMOD_DISPATCHER', and 'INTMOD_ACTION' by sending
    // the actions to (previously registered) local dispatchers.
    intModMiddleware,
    
    // Log actions.
    store => next => action => {
      console.log( 'ACTION:', action.type, action );
      return next( action );
    }
  ),
  store = createStore(
    reducer,
    ( window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose )(
      middleware
    )
  );

ReactDOM.render( <Provider store={ store }>
  {/* <Provider socket={ socket }> */}
  <Home />
  {/* </Provider> */}
</Provider>, document.getElementById( 'app' ) );
