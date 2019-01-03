import React from 'react';
import Home from './components/Home';
import reducer from './reducers.js';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware } from 'redux';
import { Provider, connect } from 'react-redux';
import recordingsMiddleware from './middleware/recordingsMiddleware';
import socketMiddleware from './middleware/socketMiddleware';

console.log(<div />);

var store = createStore( reducer, applyMiddleware(
  recordingsMiddleware,
  // Should RTC connections be stored in middleware?
  
  // Can we store videos as ids in store, and store the actual videos somewhere else?
  socketMiddleware,
  
  store => next => action => {
    console.log( 'ACTION:', action.type, action );
    return next( action );
  }
) );

ReactDOM.render( <Provider store={ store }>
  {/* <Provider socket={ socket }> */}
  <Home />
  {/* </Provider> */}
</Provider>, document.getElementById( 'app' ) );
