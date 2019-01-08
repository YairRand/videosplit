export default store => {
  var videoStore = {};
  
  return next => action => {
    if ( action.type === 'REGISTER_VIDEO_PLAYER' ) {
      videoStore[ action.videoId ] = action.data;
    } else if ( action.type === 'UNREGISTER_VIDEO_PLAYER' ) {
      delete videoStore[ action.videoId ];
    } else {
      if ( action.getVideoCurrentTime ) {
        let data = videoStore[ action.getVideoCurrentTime ];
        if ( data ) {
          action = { ...action, getVideoCurrentTime: data.getCurrentTime() };
        } else {
          console.error( 'getVideoCurrentTime failure: No registered video with videoId = ' + action.videoId, videoStore );
          // return;
        }
      }
      
      return next( action );
    }
  };
};
