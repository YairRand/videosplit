import React, { Component, useState, useRef, useEffect, useReducer } from 'react';
import './Home.css';
import { connect } from 'react-redux';
import recorder from '../recorder';

// TODO:
// * Show timer (done) or live icon or what.
// * Other interrupt ways. (dedicated button, chat)
// * Stop feed button.
// * Module-ize some stuff.
// * When sending feed, connect to new users who show up after pressing button.
// * HMR.

console.log( 'START' );

class Home extends Component {
  render() {
    return (
      <div className="Home">
        <p className="Home-intro">
          The stuff's in <code>Home.js</code>. Init with <code>node server.js</code> .
        </p>
        <Outer />
      </div>
    );
  }
}

class Outer extends Component {
  render() {
    return (
      <div className="App">
        <VideoGroup />
      </div>
    );
  }
}

const VideoGroup = ( () => {
  var reducer = ( state, action ) => {
    // Is a reducer actually necessary here?
    switch ( action.type ) {
      case 'GET_WEBCAM':
        return { ...state, webcam: 'WAIT' };
      case 'LOADED_WEBCAM':
        return { ...state, webcam: 'ON', stream: action.stream };
      case 'DISABLE_WEBCAM':
        return { ...state, webcam: 'OFF' }; // delete .stream?
    }
  };
  
  return connect(
    // There is actually an explicit warning in the docs not to use connect like this
    // on the outer component... TODO: Fix.
    state => state
    // Before changing this, need to:
    // * Rework where feeds are stored, fix sendFeed.
    // * Connect ExtVideoBlock.
    // state => ( { streamIds: state.users.map( stream => stream.userId ) } )
  )( function VideoGroup( props ) {
    var [ state, localDispatch ] = useReducer( reducer, {
      webcam: 'OFF', // [ 'OFF', 'WAIT', 'ON' ]
      stream: undefined
    } );
    
    function getWebcam() {
      localDispatch( { type: 'GET_WEBCAM' } );
      navigator.mediaDevices.getUserMedia( {
        video: true,
        audio: true
      } ).then( stream => {
        console.log( 'Begin video stream' );
        localDispatch( { type: 'LOADED_WEBCAM', stream } );
      } ).catch( error => {
        // Either no hardware available, or user rejected. 
        // Error names are inconsistent?
      } );
    }
    
    function stopWebcam() {
      state.stream && state.stream.getTracks().forEach( track => track.stop() );
      localDispatch( { type: 'DISABLE_WEBCAM' } );
    }
    
    function sendFeed() {
      props.users.forEach( user => {
        var pc = user.pc,
          { stream } = state;
        
        stream.getTracks().forEach( track => pc.addTrack( track, stream ) );
        
        console.log( 'sendFeed', pc, stream );
      } );
    }
    
    // Should the user block always be at the top? For explicit student views, maybe not...
    // Also, student views shouldn't have all the extra buttons.
    // And instr views don't need hand buttons.
    
    return <div>
      <UserVideoBlock
        getWebcam={ getWebcam }
        stopWebcam={ stopWebcam }
        sendFeed={ sendFeed }
        stream={ state.stream }
        webcam={ state.webcam }
      />
      <Buttons />
      {
        props.users.map( user => {
          return <ExtVideoBlock
            { ...user }
            selfId={ props.userId }
            selfStream={ state.stream /* Unused? */ }
            dispatch={ props.dispatch }
            key={ 100 + user.userId }
          />;
        } )
      }
    </div>;
    
  } );
} )();

function Buttons( props ) {
  return <span></span>;
}

// Three kinds of video feeds:
// * From own webcam.
// * Cached videos, which may be extended live.
// * Live streams.
// One must be able to switch seamlessly between the latter two, but both are necessary.
// TODO: Figure out transitions from recording to live.
// (Does this actually need to be a full component?)
// TODO: Move a lot of this to UserVideoBlock.
const UserVideoBlock = connect( state => state )( class UserVideoBlock extends Component {
  
  state = {
    recording: false,
    recordingStart: null,
    recordedVideos: []
  };
  
  constructor( props ) {
    super();
    this.showRecRef = React.createRef();
  }
  
  componentWillUnmount() {
    this.recorder && this.stopRecording();
  }
  
  recordStream() {
    this.recorder = recorder( this.props.stream );
    
    this.setState( { recording: true } );
  }
  
  async stopRecording() {
    
    this.setState( {
      recording: false // TODO: Set to 'WAIT'
    } );
    
    var recordedVideo = await this.recorder(),
      { blob: newBlob, ...videoData } = recordedVideo;
    
    this.setState( {
      recordedVideos: [ ...this.state.recordedVideos, recordedVideo ]
    } );
    
    // Currently unused. TODO.
    this.props.dispatch( { type: 'NEW_RECORDING', video: videoData } );
    
    return recordedVideo;
  }
  
  showRecording( { src } ) {
    this.setState( { showRecording: src } );
  }
  
  sendRecording( recordedVideo ) {
    
    // This is the complicated one. The blob currently doesn't make it to the store,
    // but does need to be emitted at some point.
    // The local store does need to know other data on the rec, however, but on
    // recording (or receiving), not on sending.
    
    // Other than for emitting, the blob never needs to be used. The URL is enough.
    
    // TODO: url should be dispatched, but not sent.
    // var { url, ...sendVideoData } = recordedVideo;
    var { ...sendVideoData } = recordedVideo;
    
    this.props.dispatch( { type: 'X_SEND_REC', rec: sendVideoData, time: Date.now() } );
    
  }
  
  render() {
    var { webcam, getWebcam, stopWebcam, sendFeed, stream } = this.props;
    
    return (
      <div>
      
        <VideoBlock userId={ this.props.userId } src={ stream } onEnded={ e => {
          // Would this ever even have an end?
        } } />
        <Box>
          <button
            onClick={ webcam === 'OFF' ? getWebcam : stopWebcam }
            disabled={ webcam === 'WAIT' }
          >
            { { 'ON': 'Stop video', 'OFF': 'Show video', 'WAIT': '(Loading...)' }[ webcam ] }
          </button>
          <br />
          <button
            onClick={ () => !this.state.recording ? this.recordStream() : this.stopRecording() }
            disabled={ webcam !== 'ON' }
          >
            { this.state.recording ? 'Stop recording' : 'Record'}
          </button>
          {
            this.state.recording && <button
              onClick={ async () => {
                this.sendRecording( await this.stopRecording() );
              } }
            >Stop and send</button>
          }
          <br />
          <button onClick={ sendFeed } disabled={ webcam !== 'ON' }>Send feed</button>
        </Box>
        {
          !!this.state.recordedVideos.length && (
            <Box>{
              this.state.recordedVideos.map( recordedVideo => {
                // return <div onClick={ () => this.sendRecording( recordedVideo ) } key={ recordedVideo.ts }>Send recording</div>;
                return <RecordingOptionsBox
                  key={ recordedVideo.id }
                  recordedVideo={ recordedVideo }
                  play={ () => this.showRecording( recordedVideo ) }
                  send={ () => this.sendRecording( recordedVideo ) }
                  delete={ () => this.setState( { recordedVideos: this.state.recordedVideos.filter( vid => vid !== recordedVideo ) } ) }
                />;
              } )
            }</Box>
          )
        }
        {
          this.state.showRecording && <>
            <video height={100} width={100} src={ this.state.showRecording } key={1} autoPlay ref={ this.showRecRef } onClick={ () => {
              // Pause maybe?
            } } onEnded={ () => { this.setState( { showRecording: false } ); } } />
            <br />
          </>
        }
        <SendBox />
      </div>
    );
  }
} );

const RecordingOptionsBox = function RecordingOptionsBox( props ) {
  var { recordedVideo } = props,
    lengthInSeconds = recordedVideo.length / 1000,
    timeDisplay = lengthInSeconds < 60 ?
      lengthInSeconds.toFixed( 2 ) :
      Math.floor( lengthInSeconds / 60 ) + ':' + Math.floor( lengthInSeconds % 60 ).toString().padStart( 2, 0 );
  return <div className="RecordingOptionsBox">
    <span className="ROB-titleBox">Video</span>
    <span className="ROB-time">{ timeDisplay }</span>
    <span className="ROB-button" onClick={ props.play }>Play</span>
    <span className="ROB-button" onClick={ props.send }>Send</span>
    <span className="ROB-button" onClick={ props.delete }>X</span>
  </div>;
};

// (Not sure how rewinding and such would work here...)
const VideoBlock = function VideoBlock( props ) {
  var { userId, subBox, leftIcon } = props,
    // src, time, onEnded, dispatch
    baseHeight = 200,
    baseWidth = 200;
  
  // Note: Self-views don't need the canvas, I think? Also student views.
  // Don't spread props so much.
  
  return <div className='VideoBlock'>
    <BasicVideoBlock { ...props } videoId={ props.userId } size={ 1 } />
    <div className='VideoBlock-cornerBox'>
      { props.cornerBox && <>
        <BasicVideoBlock size={ 0.5 } time={ props.cornerBox.last_rec_time } { ...props.cornerBox } />
        <TimeTicker startTime={ props.cornerBox.last_rec_time } />
      </> }
    </div>
    <span>
      { userId !== null ? 'Person' + userId : 'Loading...' }
    </span>
    <span style={{ float: 'left' }} >
      { leftIcon }
    </span>
    { subBox }
  </div>;
};

// This is the real 'raw' VideoBlock, with just src and such.
/**
 * @param {String|MediaStream} props.src
 * @param {Number} props.time Number of seconds since start of video.
 */
function BasicVideoBlock( { src, time, onEnded, videoId, size = 1, dispatch, transcript } ) {
  var ref = useRef(),
    canvasRef = useRef(),
    baseHeight = 200 * size,
    baseWidth = 200 * size;
  
  // Should this use useLayoutEffect instead to avoid waiting?
  useEffect( () => {
    let elem = ref.current,
      canvas = canvasRef.current;
    
    // Avoid a white flash when switching videos by having a canvas behind the
    // video to show the last frame until the new source is loaded.
    var { videoWidth, videoHeight } = elem,
      dVideoWidth = Math.min( videoWidth / videoHeight, 1 ) * baseWidth,
      dVideoHeight = Math.min( videoHeight / videoWidth, 1 ) * baseHeight,
      left = ( baseWidth - dVideoWidth ) / 2,
      top = ( baseHeight - dVideoHeight ) / 2;
    
    if ( src ) {
      canvasRef.current.getContext( '2d' ).drawImage( elem, left, top, dVideoWidth, dVideoHeight );
    }
    
    if ( typeof src === 'object' ) {
      
      // Presumably a stream.
      elem.pause();
      elem.currentTime = 0; // Make sure we start at the beginning.
      elem.src = undefined;
      elem.srcObject = src;
      elem.play();
    } else {
      elem.srcObject = undefined;
      if ( typeof src === 'string' ) {
        // Presumably a recording.
        console.log( 'setting src and time', src, time, elem );
        // TODO: Set .currentTime when resuming.
        // Setting time could be difficult for other situations. We don't know
        // how to tell set-0 -> (stay) from set-0 -> set-back-to-0 again...
        // Can only check this on src change.
        elem.src = src;
        elem.currentTime = time;
      } else {
        // Undefined src. (Probably on init.)
        // removeAttribute?
        elem.removeAttribute( 'src' );
      }
    }
    
    // if ( src ) {
    //   elem.addEventListener( 'canplaythrough', e => {
    //     elem.play();
    //   }, { once: true } );
    // }
  }, [ src ] );
  
  // useEffect( () => {
  //   var ctx = canvasRef.current.width = ref.current.width;
  // }, [] );
  
  useEffect( () => {
    if ( dispatch ) {
      var data = {
        getCurrentTime: () => ref.current.currentTime
      };
      
      dispatch( { type: 'REGISTER_VIDEO_PLAYER', data, videoId } );
      
      return () => dispatch( { type: 'UNREGISTER_VIDEO_PLAYER', videoId } );
    }
  }, [ videoId ] );
  
  // Note: Self-views don't need the canvas, I think? Also student views.
  return <>
    <canvas width={ baseWidth } height={ baseHeight } ref={ canvasRef } style={{ position: 'absolute', left: 0 }} />
    <video
      width={ baseWidth } height={ baseHeight } autoPlay
      ref={ ref }
      style={{ position: 'relative', zIndex: 1 }}
      onEnded={ onEnded }
    />
    { transcript && <SubtitlesBox transcript={ transcript.length ? transcript : [ 
      // Temporary, for testing.
      { word: 'blah', end: 1000 },
      { word: 'blah', end: 2000 },
      { word: 'blah', end: 3000 },
      { word: 'blah', end: 4000 },
      { word: 'blah', end: 5000 },
      { word: 'test', end: 6000 }
    ] } startTime={ time } />}
  </>;
}

function ExtVideoBlock( props ) {
// const ExtVideoBlock = connect( ( state, ownProps ) => {
//   // Or maybe be more specific about which properties?
//   state.users[ ownProps.userId ]
// )( class extends Component {
  console.log( 442, props );
  
  var src = props.in.useLive === false ? props.in.recordingsQueue[ 0 ].src : props.streamSrc,
    cornerBox;
  
  if ( props.out.useLive ) {
    // No box for live stream out.
  } else {
    let currentRecording = props.out.recordingsQueue[ 0 ];
    cornerBox = { ...currentRecording, time: currentRecording.last_rec_time };
  }
  
  return <VideoBlock
    userId={ props.userId }
    src={ src }
    time={ props.time }
    dispatch={ props.dispatch }
    onEnded={ e => {
      console.log( 4422, e, props );
      // Issue: onEnded might be called when video is cut off due to disconnect.
      props.dispatch( { type: 'X_VIDEO_END', toUser: props.userId } );
    } }
    cornerBox={ cornerBox }
    leftIcon={ props.hand && <div className='leftIcon' style={{ position: 'absolute', boxShadow: props.interrupting ? '0 0 2px inset #000000' : '' }} onClick={ e => {
      // React to hand. Interrupt any recorded with live.
      // Same thing for reacting to chat.
      
      // TODO: Only interrupt when st is viewing rec.
      
      props.dispatch( props.interrupting ?
        { type: 'X_RESUME_REC', toUser: props.userId } :
        // TODO: Eventually, get the time from the receiving client, don't guess here with .time.
        { type: 'X_INTERRUPT_WITH_LIVE', time: Date.now(), toUser: props.userId, getVideoCurrentTime: props.selfId }
      );
    } }>(HAND)</div> }
    subBox={ 
      ( props.hand || props.chats.length > 0 ) && <div style={{ borderTop: '1px dashed #AAAAAA' }}>
        
        { props.chats.map( ( chat, i ) => {
          // TODO: Fade out after some time, allow scrolling back into view somehow,
          // clicking should perform interrupt, have semi-transparent background,
          // place over video at the bottom? Show greyed timestamp?
          return <div key={ i }>{ chat.text }</div>;
        } ) }
      </div>
    }
  />;
}

const SendBox = connect(
  null,
  dispatch => ( { sendChat( text ) {
    dispatch( { type: 'X_CHAT', chat: { text } } );
  } } )
)( function SendBox( { sendChat } ) {
  var inputRef = useRef();
  
  return <div>
    <HandButton />
    <form
      onSubmit={ e => {
        e.preventDefault();
        
        var text = inputRef.current.value;
        if ( text && text.trim() ) {
          sendChat( text );
          
          inputRef.current.value = '';
        }
      } }
      style={{display: 'inline-block'}}
    >
      <input ref={ inputRef } placeholder='' />
    </form>
  </div>;
} );

const HandButton = connect( state => ( { hand: state.hand } ) )( function HandButton( props ) {
  return <div
    onClick={ e => {
      props.dispatch( { type: 'X_HAND', raised: !props.hand } );
    } }
    style={ { border: '1px solid #AAA', boxShadow: props.hand ? '0 0 2px inset #000000' : '', display: 'inline-block' } }
  >Hand</div>;
} );

function SubtitlesBox( { transcript, startTime } ) {
  // This is primarily for instructor-self-views.
  // I'm thinking a semitransparent grey-black box at the bottom of the video,
  // with the time-offset on the left, and the subtitles stream maybe
  // horizontal-scrolling? White text, maybe current word bolded. Show future
  // words where available?
  // Possibly necessary: A way to show more context, in situations where one
  // continuity comes into focus. A few words on screen might not be enough to
  // tell context, if instr was not paying attention.
  // Something to show more words...
  // 
  
  // First, follow the stream.
  
  // Maybe position: absolute to bottom.
  
  // The native one is low quality. Google's and Amazon's are much better, but cost money. (A's is ~$1.50/hour, G's ~$3/hour.)
  
  // We only know when a word ends, not when it begins. Assume that words start
  // right after prior word ends.
  
  // transcript.length || ( transcript = [ { word: 'blah', end: 1000 } ] );
  
  const [ time, setTime ] = useState( startTime * 1000 ),
    index = transcript.findIndex( word => word.end > time ),
    ongoing = index !== -1,
    endTime = ongoing && transcript[ index ] && transcript[ index ].end,
    past = transcript.slice( 0, ongoing ? index : undefined ),
    current = ongoing && transcript.slice( index ).filter( word => word.end === transcript[ index ].end ),
    ref = useRef();
  
  useEffect( () => {
    var timeUntilNext = endTime - time,
      timer = ongoing && setTimeout( () => {
        // Actually, shouldn't this use Date()?
        setTime( time => time + timeUntilNext );
      }, timeUntilNext );
    
    return () => {
      clearTimeout( timer );
    };
  }, [ time ] );
  
  useEffect( () => {
    var elem = ref.current;
    
    elem.style.marginLeft = '-' + Math.max( 0, elem.offsetWidth - elem.parentNode.offsetWidth ) + 'px';
  }, [ past, current ] );
  
  return <div className='SubtitlesBox'>
    <span className='SubtitlesBox-inner' ref={ ref }>
      <span>
        { past.map( item => item.word ).join( ' ' ) }
      </span>
      { ' ' }
      <span style={{ fontWeight: 'bold' }}>
        { current && current.map( item => item.word ).join( ' ' ) }
      </span>
    </span>
  </div>;
  
}

function TimeTicker( { startTime } ) {
  var [ time, setTime ] = useState( startTime ),
    // TODO: Remove duplication with ROB.
    lengthInSeconds = time / 1000;
  
  useEffect( () => {
    var start = Date.now(),
      timer = setInterval( () => setTime( Date.now() - start ), 1000 );
    return () => clearInterval( timer );
  }, [ startTime ] );
  
  return <span className='TimeTicker'>
    { Math.floor( lengthInSeconds / 60 ) + ':' + Math.floor( lengthInSeconds % 60 ).toString().padStart( 2, 0 ) }
  </span>;
}

// Not sure canvas will ever be needed here. Recorded and live videos both work in video tags.
class CanvasBlock extends Component {
  componentDidMount() {
    
  }
  
  paint() {
    
  }
  
  render() {
    return (
      <canvas />
    );
  }
}

function Box( props ) {
  return <div style={{ display: 'inline-block', textAlign: 'left', verticalAlign: 'top' }}>{ props.children }</div>;
}

class ChatBox extends Component {
  render() {
    return <div></div>;
  }
}

function VolumeMeter( props ) {
  // TODO: Show how much audio is coming through the microphone.
  // (Later: Should also be a thing showing volume from other streams.)
  
  props.stream;
}

export default Home;
