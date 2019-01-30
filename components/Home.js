import React, { Component, useState, useRef, useEffect, useReducer } from 'react';
import './Home.css';
import { connect } from 'react-redux';
import recorder from '../recorder';
import VideoBlock from './VideoBlock';
import SendBox from './SendBox';
import IntMods from '../interaction_modules/main';


// TODO:
// * Show timer (done) or live icon or what.
// * Other interrupt ways. (dedicated button, chat)
// * Stop feed button.
// * Module-ize some stuff.
// * Allow stream to show on a delay.
// ** Sort-of done?
// * Fix autoplay issues.
// * Fix bug where everything explodes on unclicking ext's hand when no recording.
// * Look into PiP API, see if it's usable.
// ** Looks useful, but it's unofficial and not widely supported.
// *** document.body.onblur = async e => { await ( vidElem ).requestPictureInPicture(); };
//     document.body.onfocus = async e => { await document.exitPictureInPicture(); };
// *** https://developers.google.com/web/updates/2018/10/watch-video-using-picture-in-picture
// * Set up tests outline. Use jest. Have a server- and browser-in-a-box, with sockets.
//   Dunno how to deal with hardware, or webrtc. Hold off on them for now, not important.
// * Set up concatenating consecutive videos without losing transcripts or smoothness.
// * Fix time indicator after interrupt.
// * HMR.

// * Timers mechanism. (use array, clearTimeout and restart when time changes.)
// ** Chats need time param, and to hook into the timers system. When on delay,
//    chats should be sent relating to time.
// *** Should that be handled server-side? Seems simpler than sending the server
//     a different chat msg for each user.
// *** Similar for intmods.
// * Need a way to manage catch-up, in cases where subscription-to-anwser happens
//   moments after stream starts. Requires either gradual speedup or slowdown on
//   the other end. (General: Good idea to keep tracks in clusters.)
// ** Speedup: A/V can theoretically be captured using MediaStreamAudioSourceNode
//    (using DelayNode/playbackRate, probably) and canvas (paint from element).
//    Requires muting video element, perhaps.
// * 'User is typing'. Might not use, but write the code to have it available.
// * Change regular timer display to also show time until end?
// * Visual indicator of audio source.

// * Fix Chrome->FF sendFeed breaking.
// ** FF gives error message "ICE failed, add a STUN server and see about:webrtc for more details".
//    Dunno if that's accurate. Looks like it gets successful addTrack events.
//    Also, it works after a FF-side refresh?
//    Also works after show->stop video on FF-side.

// * Fix FF MediaSource issues, incl outgoing (uses webm which is unsupported by
//   Chrome) and incoming (breaks up and/or freezes after short time, when receiving from Chrome).
//   (Chrome->Chrome works fine, FF->FF works fine. FF->Chrome breaks, Chrome->FF eventually freezes.)

// * Stop the feed to those viewing recordings or delays, until shortly before 
//   it ends. (Make sure there's no delay before starting up again.)

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
        <IntMods />
        <VideoGroup />
      </div>
    );
  }
}

const VideoGroup = ( () => {
  var reducer = ( state, action ) => {
    // Is a reducer actually necessary here?
    // VideoGroup might get more complicated, I suppose.
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
    // mapStateToProps
    state => ( { userId: state.userId, userIds: state.users.map( user => user.userId ) } )
  )( function VideoGroup( props ) {
    var [ state, localDispatch ] = useReducer( reducer, {
      webcam: 'OFF', // [ 'OFF', 'WAIT', 'ON' ]
      stream: undefined
    } );
    
    function getWebcam() {
      localDispatch( { type: 'GET_WEBCAM' } );
      navigator.mediaDevices.getUserMedia( {
        // video: { aspectRatio: 4 / 3 },
        // video: { aspectRatio: 3 / 2 },
        // Mine is 4/3, other common ones include 3/2.
        // Not all browsers support setting aspectRatio.
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
      props.dispatch( { type: 'SEND_STREAM', stream: state.stream } );
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
        props.userIds.map( extUserId => {
          return <ExtVideoBlock
            userId={ extUserId }
            selfId={ props.userId }
            selfStream={ state.stream /* Unused? Might be used in the future. */ }
            key={ 100 + extUserId }
          />;
        } )
      }
    </div>;
    
  } );
} )();

function Buttons( props ) {
  // TODO: Move stuff from UserVideoBlock here.
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
    
    var recordedVideo = await this.recorder.stop(),
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
    
    // TODO: When on delay, first cut off the slice, end it, and send it.
    // After dispatching SEND_REC, re-start the delay.
    
    var { ...sendVideoData } = recordedVideo;
    
    this.props.dispatch( { type: 'X_SEND_REC', videoData: sendVideoData, time: Date.now() } );
    
  }
  
  async sliceRecording() {
    var slice = await this.recorder.slice();
    this.sendSlice( slice );
    return slice;
  }
  
  sendSlice( recordedVideo ) {
    console.log( 'sendSlice', recordedVideo );
    this.props.dispatch( {
      type: recordedVideo.firstInSequence ? 'X_SEND_REC' : 'X_EXTEND_SEQ',
      videoData: { ...recordedVideo },
      time: Date.now()
    } );
  }
  
  render() {
    var { webcam, getWebcam, stopWebcam, sendFeed, stream } = this.props;
    
    return (
      <div style={{ marginBottom: '1em' }}>
      
        <VideoBlock
          userId={ this.props.userId }
          src={ stream } onEnded={ e => {
            // Would this ever even have an end?
          } }
          muted={ true /* Avoid echos of one's own voice */ }
          subBox={
            // Should the SendBox be always below the instructor, or one's own video?
            // (Probably partly depends on whether the corner is always the instr. Probably should be.)
            <SendBox />
          }
        />
        <Box>
          {/*
            Buttons.
            In practice, probably use icons. Also maybe merge Show/Send video.
            Webcam icon for show/send, circle for record, square for stop, dunno
            what for stop/send.
          */}
          <button
            onClick={ webcam === 'OFF' ? getWebcam : stopWebcam }
            disabled={ webcam === 'WAIT' }
          >
            { { 'ON': 'Stop video', 'OFF': 'Show video', 'WAIT': '(Loading...)' }[ webcam ] }
          </button>
          <button
            onClick={ () => !this.state.recording ? this.recordStream() : this.stopRecording() }
            disabled={ webcam !== 'ON' }
          >
            { this.state.recording ? 'Stop recording' : 'Record'}
          </button>
          {
            this.state.recording && <>
              <button
                onClick={ async () => {
                  this.sendRecording( await this.stopRecording() );
                } }
              >Stop and send</button>
              <button onClick={ async () => {
                // Should delay be handled on the server side? We can have different
                // delays for different users.
                
                var slice = () => this.sliceRecording(),
                  firstSlice = await slice(),
                  timer = setInterval( slice, Math.max( firstSlice.length / 2, 1000 ) || 1000 );
                
              }}>Delayed</button>
            </>
          }
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

/**
 * Other participant's video block.
 */
const ExtVideoBlock = connect( ( state, ownProps ) => {
  // Or maybe be more specific about which properties?
  var user = state.users.find( ( { userId } ) => userId === ownProps.userId );
  return user;
} )( function ExtVideoBlock( props ) {
  console.log( 442, props );
  
  var [ stream, setStream ] = useState();
  
  useEffect( () => {
    props.dispatch( { type: 'GET_STREAM', userId: props.userId } ).then( stream => {
      setStream( stream );
    } );
    return () => {
      // Emit signal to stop streaming?
    };
  }, [ props.userId ] );
  
  // TODO: Style with filter: blur( 5px ) when in.useLive === true && in.effects.includes( { type: 'BLUR' } );
  
  var src = props.in.useLive === false ? props.in.recordingsQueue[ 0 ].src : stream,
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
    time={ props.time /* ? */ }
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
      ( /* props.hand || */ props.chats.length > 0 ) && <div style={{ borderTop: '1px dashed #AAAAAA' }}>
        
        { props.chats.map( ( chat, i ) => {
          // TODO: Fade out after some time, allow scrolling back into view somehow,
          // clicking should perform interrupt, have semi-transparent background,
          // place over video at the bottom? Show greyed timestamp?
          
          // Show some kind of icon at the right to indicate that clicking initiates
          // an interrupt.
          // Idea: When clicking during live, splits off.
          // For non-instr view, should others' chats appear different when answered/interrupted?
          return <div key={ i }>
            { chat.text }
            { /* props.in.recordingsQueue.length */ }
          </div>;
        } ) }
      </div>
    }
  />;
} );

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

export default Home;
