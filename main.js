import React from 'react';
import Home from './components/Home';
import reducer from './reducers.js';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider, connect } from 'react-redux';
import recordingsMiddleware from './middleware/recordingsMiddleware';
import socketMiddleware from './middleware/socketMiddleware';
import videoPlayerMiddleware from './middleware/videoPlayerMiddleware';

var middleware = applyMiddleware(
    recordingsMiddleware,
    // Should RTC connections be stored in middleware?
    
    // Can we store videos as ids in store, and store the actual videos somewhere else?
    
    // Or maybe, the video block itself could access things by id via dispatch( 'GET_BY_ID' ) using mapStateToProps?
    // Would require waiting for the video to load, dispatch would return a promise...
    
    
    // Handles type 'EMIT' and transforms all 'X_ACTION' into 'OUT_ACTION' locally
    // and 'IN_ACTION' for all other users.
    socketMiddleware,
    
    // Handles types 'REGISTER_VIDEO_PLAYER', 'UNREGISTER_VIDEO_PLAYER', and transforms prop 'getVideoCurrentTime'.
    videoPlayerMiddleware,
    
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
