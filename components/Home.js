import React, { Component, useState, useRef, useEffect, useReducer } from 'react';
import './Home.css';
import { connect } from 'react-redux';
import transcription from '../transcription';

// TODO:
// * Start subtitles.
// * Self-view.
// * Show timer or live icon or what.
// * Other interrupt ways. (dedicated button, chat)
// * Stop feed button.
// * Module-ize some stuff.
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
      console.log( 3333 );
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
          return <ExtVideoBlock { ...user } selfId={ props.userId } selfStream={ state.stream } dispatch={ props.dispatch } key={ 100 + user.userId } />;
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
const UserVideoBlock = connect( state => state )( class extends Component {
  
  state = {
    recording: false,
    recordingStart: null,
    recordedVideos: []
  };
  
  constructor( props ) {
    super();
    this.ref = React.createRef();
    this.ref2 = React.createRef();
    this.chunks = [];
  }
  
  componentWillUnmount() {
    this.recorder && this.stopRecording();
  }
  
  recordStream() {
    this.chunks = [];
    this.recorder = new MediaRecorder( this.props.stream, { video: true, audio: true } );
    this.recorder.ondataavailable = ( e ) => {
      // NOTE: Only the first chunk, or the collection of all chunks until .stop() will work.
      // Eventually, push these to the server immediately, and out from there.
      this.chunks.push( e.data );
    };
    
    transcription.start();
    
    // Send out chunks every X amount of time so that there's less loading time
    // when we need to switch to a just-finished recording.
    this.recorder.start( 500 );
    
    this.setState( { recording: true, recordingStart: Date.now() } );
  }
  
  stopRecording() {
    
    var type = this.chunks[ 0 ].type,
      newBlob = new Blob( this.chunks, { type } ),
      videoData = {
        type,
        ts: Date.now().toString(),
        src: URL.createObjectURL( newBlob ),
        // Hope this is accurate...
        // If not, maybe set a video to the url and read .duration.
        length: Date.now() - this.state.recordingStart,
        transcript: transcription.getWords(),
        id: Math.random()
      },
      recordedVideo = {
        blob: newBlob,
        ...videoData
      };
    
    this.setState( {
      recordedVideos: this.state.recordedVideos.concat( recordedVideo ),
      recording: false,
      recordingStart: null
    } );
  
    // this.sendRecording( recordedVideo );
    
    // Currently unused. TODO.
    this.props.dispatch( { type: 'NEW_RECORDING', video: videoData } );
    
    this.showRecording( recordedVideo );
    
    this.recorder.stop();
    
    return recordedVideo;
  }
  
  showRecording( { url } ) {
    console.log( 'q', this.chunks.length, url, this.chunks );
    
    this.setState( { recorded: url } );
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
              onClick={ () => {
                this.sendRecording( this.stopRecording() );
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
                return <div onClick={ () => this.sendRecording( recordedVideo ) } key={ recordedVideo.ts }>Send recording</div>;
              } )
            }</Box>
          )
        }
        <video height={100} width={100} src={ this.state.recorded } key={1} autoPlay loop ref={ this.ref2 } onClick={ () => { this.setState( { recorded: this.firstUrl } ); } } />
        <SendBox />
      </div>
    );
  }
} );


// (Not sure how rewinding and such would work here...)
const VideoBlock = function VideoBlock( props ) {
  var { userId, subBox, leftIcon } = props,
    // src, time, onEnded, dispatch
    baseHeight = 200,
    baseWidth = 200;
  
  // Note: Self-views don't need the canvas, I think? Also student views.
  
  return <div className='VideoBlock'>
    <BasicVideoBlock { ...props } videoId={ props.userId } size={ 1 } />
    <div className='VideoBlock-cornerBox'>
      { props.cornerBox && <BasicVideoBlock size={ 0.5 } { ...props.cornerBox } /> }
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
  size === 0.5 && console.log( 442221, arguments );
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

class ExtVideoBlock extends Component {
// const ExtVideoBlock = connect( ( state, ownProps ) => state.users[ ownProps.userId ] )( class extends Component {
  render() {
    console.log( 442, this.props );
    return <>
      <VideoBlock
        userId={ this.props.userId }
        src={ this.props.src }
        time={ this.props.time }
        dispatch={ this.props.dispatch }
        onEnded={ e=>{
          console.log( 4422, e, this.props );
          // Issue: onEnded might be called when video is cut off due to disconnect.
          // TODO: This should emit, I think.
          this.props.dispatch( { type: 'X_VIDEO_END', toUser: this.props.userId } );
        } }
        cornerBox={ this.props.out.useLive === false && { ...this.props.out.recordingsQueue[ 0 ], time: this.props.out.recordingsQueue[ 0 ].last_rec_time || 0 } }
        leftIcon={ this.props.hand && <div style={{ position: 'absolute', boxShadow: this.props.interrupting ? '0 0 2px inset #000000' : '' }} onClick={ e => {
          // React to hand. Probably interrupt any recorded with live.
          // Same thing for reacting to chat.
          
          // TODO: Only interrupt when st is viewing rec.
          // this.props.dispatch( { type: !this.props.interrupting ? 'X_INTERRUPT_WITH_LIVE' : 'X_RESUME_REC', toUser: this.props.userId } );
          
          this.props.dispatch( this.props.interrupting ?
            { type: 'X_RESUME_REC', toUser: this.props.userId } :
            // TODO: Eventually, get the time from the receiving client, don't guess here with .time.
            { type: 'X_INTERRUPT_WITH_LIVE', time: Date.now(), toUser: this.props.userId, getVideoCurrentTime: this.props.selfId }
          );
        } }>(HAND)</div> }
        subBox={ 
          ( this.props.hand || this.props.chats.length > 0 ) && <div style={{ borderTop: '1px dashed #AAAAAA' }}>
            
            { this.props.chats.map( ( chat, i ) => {
              // TODO: Fade out after some time, allow scrolling back into view somehow,
              // clicking should perform interrupt, have semi-transparent background,
              // place over video at the bottom? Show greyed timestamp?
              return <div key={ i }>{ chat.text }</div>;
            } ) }
          </div>
        }
      />
    </>;
  }
}

const _ExtVideoBlock = connect( ( state, ownProps ) => {
  // TODO: Maybe be more specific about which properties?
  return state.users[ ownProps.userId ];
} )( function ExtVideoBlock( props ) {
  const [ stream, setStream ] = useState();
  
  useEffect( () => {
    // TODO.
    // props.dispatch( { type: 'GET_STREAM', id: props.userId } ).then( stream => {
    //   setStream( stream );
    // } );
  }, [
    // props.connected?
  ] );
  
  return <>
    <VideoBlock
      userId={ props.userId }
      src={ props.showLive ? stream : props.recordingsQueue[ 0 ].src }
      time={ props.time }
      onEnded={ e => {
        console.log( 4422, e, this.props );
        // Issue: onEnded might be called when video is cut off due to disconnect.
        // TODO: This should emit, I think.
        this.props.dispatch( { type: 'X_VIDEO_END', fromUser: props.userId } );
      } }
    />
    <div>
      { props.hand && <div style={{ boxShadow: props.interrupting ? '0 0 2px inset #000000' : '' }} onClick={ e => {
        // React to hand. Probably interrupt any recorded with live.
        // Same thing for reacting to chat.
        
        // TODO: Only interrupt when st is viewing rec.
        // this.props.dispatch( { type: !this.props.interrupting ? 'X_INTERRUPT_WITH_LIVE' : 'X_RESUME_REC', toUser: this.props.userId } );
        
        props.dispatch( props.interrupting ?
          { type: 'X_RESUME_REC', toUser: this.props.userId } :
          { type: 'X_INTERRUPT_WITH_LIVE', toUser: this.props.userId, getVideoCurrentTime: props.selfId }
        );
      } }>(HAND)</div> }
      { props.chats.map( ( chat, i ) => {
        // TODO: Fade out after some time, allow scrolling back into view somehow,
        // clicking should perform interrupt, have semi-transparent background,
        // place over video at the bottom? Show greyed timestamp?
        return <div key={ i }>{ chat.text }</div>;
      } ) }
    </div>
  </>;
} );

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
  return <div style={{display:'inline-block'}}>{ props.children }</div>;
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
