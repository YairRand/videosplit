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
// *** Would that work for normal delays too? Would it be preferable?
//     (Probably not, many-to-many via webrtc is heavy, having the server handle
//     it is easier and doesn't come with a slowdown since we're delayed anyway.)
// * 'User is typing'. Might not use, but write the code to have it available.
// * Change regular timer display to also show time until end?
// * Visual indicator of audio source.
// ** Mostly done, need to decide styling.

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

// * Start transmitting recordedVideo chunks (to the server, at least) as soon
//   as available.

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
      case 'SEND_STREAM':
        return { ...state, isSendingFeed: true };
      case 'STOP_STREAM':
        // Unused.
        return { ...state, isSendingFeed: false };
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
      localDispatch( { type: 'SEND_STREAM' } );
    }
    
    // Should the user block always be at the top? For explicit student views, maybe not...
    // Also, student views shouldn't have all the extra buttons.
    // And instr views don't need hand buttons.
    
    return <div>
      <UserVideoBlock
        getWebcam={ getWebcam }
        stopWebcam={ stopWebcam }
        sendFeed={ sendFeed }
        isSendingFeed={ state.isSendingFeed }
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
// TODO: Figure out which state props need to be passed here.
// * Does this even need to be connected? Maybe just pass userId and dispatch via props?
const UserVideoBlock = connect( state => ( { userId: state.userId } ) )( class UserVideoBlock extends Component {
  
  state = {
    recording: false,
    recordingStart: null,
    recordedVideos: [],
    // Issue: This isn't completely binary. We could be streaming live to one
    // participant, and delayed to another.
    // TODO: Figure this out.
    // TODO: Should this be here or in redux? Redux could also hold different
    // statuses per out-stream...
    // Here for now. Fiddle with later.
    delayedStream: false
  };
  
  constructor( props ) {
    super();
    this.showRecRef = React.createRef();
  }
  
  componentWillUnmount() {
    this.recorder && this.stopRecording();
  }
  
  recordStream() {
    // Zoom out. What needs to happen here?
    // * A button is pressed. "Record".
    // * Recording starts.
    // * Time passes, during which chunks are going to the server.
    // * A button is pressed. "Stop".
    // ** - (This is needed for demoing, but isn't *really* relevant. In theory,
    //      we should almost always be recording, I think? Just sending to some
    //      on a delay. Recieving users might not need recording.)
    // * A remaining chunk is passed, along with some instructions to the server.
    // 
    // Maybe just build more stuff into the recorder.
    // Maybe do higher-level refactoring? Should this be divided into
    // component/recorder/middleware like this?
    // Write up some pseudocode.
    
    
    this.recorder = recorder(
      this.props.stream,
      // Callback to send chunks to server as they come in, for performance reasons.
      videoData => {
        console.log( '_beh2', videoData );
        this.props.dispatch( { type: 'X_VID_TODO', videoData: videoData } );
      },
      // Callback to send data to middleware (to store, process) after stopping recording.
      videoData => {
        console.log( '_beh5', videoData );
        this.props.dispatch( { type: 'VID_TODO_STORE', videoData: videoData } );
        // We can't store it here, because we might keep holding on to it after
        // it's sent, which is wasteful.
        // We can't store it in the middleware, because that doesn't know how
        // to store videos without sending them immediately.
        // We can't just send it immediately, because sometimes we need to be
        // sending data about the video at the same time.
        // It needs to wait until sending time, then disappear...
        // Sounds like a job for the middleware. Set up a dedicated temp store there.
      }
    );
    
    this.setState( { recording: true } );
  }
  
  async stopRecording() {
    console.log( 'stopRecording', this.state );
    this.setState( {
      recording: false // TODO: Set to 'WAIT'
    } );
    
    var recordedVideo = await this.recorder.stop(),
      { blob: newBlob, ...videoData } = recordedVideo;
    
    this.setState( {
      // ...It doesn't make sense to keep holding on to the blob even after it's
      // sent...
      recordedVideos: [ ...this.state.recordedVideos, recordedVideo ]
    } );
    
    // Currently unused. TODO.
    this.props.dispatch( { type: 'NEW_RECORDING', video: videoData } );
    
    return recordedVideo;
  }
  
  showRecording( { src } ) {
    this.setState( { showRecording: src } );
  }
  
  // This function, and those associated with it, are a mess. TODO: Cleanup.
  async sendRecording( recordedVideo ) {
    
    // This is the complicated one. The blob currently doesn't make it to the store,
    // but does need to be emitted at some point.
    // The local store does need to know other data on the rec, however, but on
    // recording (or receiving), not on sending.
    
    // Other than for emitting, the blob never needs to be used. The URL is enough.
    
    // TODO: url should be dispatched, but not sent.
    // var { url, ...sendVideoData } = recordedVideo;
    
    // TODO: When on delay, first cut off the slice, end it, and send it.
    // After dispatching SEND_REC, re-start the delay.
    
    // Actually, should this always interrupt? Maybe set up separate cases for
    // adding to after queue as opposed to interrupt.
    
    // Wait, how should interrupt even work? If the stream is cut off, there
    // isn't any extra time to build a delayed feed from...
    // We want to end, send, start recording, and then start a delayed stream
    // after X ms have passed. Can't start recording and send delayed after 0ms.
    
    var { ...sendVideoData } = recordedVideo,
      interruptingDelayedStream = this.state.delayedStream;
    
    if ( interruptingDelayedStream ) {
      await this.endDelayedStream();
    }
    
    this._sendRecording( recordedVideo );
    
    
    if ( interruptingDelayedStream ) {
      this.recordStream();
      this.startDelayedStream( 1000 );
    }
    
  }
  
  _sendRecording( recordedVideo ) {
    // recordingsMiddleware turns the raw data into usable blob-urls on both
    // the local and recieving ends.
    this.props.dispatch( { type: 'X_SEND_REC', videoData: recordedVideo, time: Date.now() } );
  }
  
  saveRecording( recordedVideo ) {
    this.props.dispatch( {
      // WIP on the server side.
      type: 'SERVER_SAVE_VIDEO',
      videoData: { ...recordedVideo }
    } );
  }
  
  // TODO: Consider renaming 'sliceSequence'?
  // Where should slicing normal recordings go? That's called from recorder,
  // should there be a callback?
  // Shouldn't most of this stuff be part of recorder.js?
  async sliceRecording( isFinalSlice ) {
    
    console.log( 'sb send blob1', isFinalSlice );
    isFinalSlice && console.log( 'sent last slice1' );
    var slice = await this.recorder.slice( true );
    this.sendSlice( slice );
    isFinalSlice && console.log( 'sent last slice' );
    return slice;
  }
  
  sendSlice( recordedVideo ) {
    console.log( 'sb sendSlice', recordedVideo );
    this.props.dispatch( {
      type: recordedVideo.firstInSequence ? 'X_SEND_REC' : 'X_EXTEND_SEQ',
      videoData: { ...recordedVideo },
      time: Date.now()
    } );
  }
  
  async startDelayedStream( delay ) {
    // Should delay be handled on the server side? We can have different
    // delays for different users.
    
    this.setState( {
      delayedStream: true
    } );
    
    var slice = () => this.sliceRecording(),
      firstSlice = delay || await slice(),
      sliceLength = delay || firstSlice.length,
      timer = setInterval( slice, Math.max( delay / 2, 1000 ) || 1000 );
    
    this.delayedStreamTimer = timer;
    
  }
  
  async endDelayedStream() {
    // TODO.
    
    clearInterval( this.delayedStreamTimer );
    
    this.setState( {
      delayedStream: false,
      recording: false
    } );
    
    // Final slice.
    // TODO: Make final slice system in recorder.js and recordingsMiddleware, not here.
    // await this.sliceRecording( true );
    this.sendSlice( await this.stopRecording() );
  }
  
  render() {
    var { webcam, getWebcam, stopWebcam, sendFeed, isSendingFeed, stream } = this.props;
    
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
          {
            this.state.delayedStream ?  
              <button
                onClick={ () => this.endDelayedStream() }
              >End delayed</button>
              :
              <button
                onClick={ () => !this.state.recording ? this.recordStream() : this.stopRecording() }
                disabled={ webcam !== 'ON' }
              >
                { this.state.recording ? 'Stop recording' : 'Record'}
              </button>
          }
          {
            this.state.recording && !this.state.delayedStream && <>
              <button
                onClick={ async () => {
                  this.sendRecording( await this.stopRecording() );
                } }
              >Stop and send</button>
              <button
                onClick={ () => this.startDelayedStream() }
              >Delayed</button>
              <button
                onClick={ async () => {
                  await this.stopRecording();
                  this.recordStream();
              } }
              >Test</button>
            </>
          }
          <button onClick={ sendFeed } disabled={ webcam !== 'ON' || isSendingFeed }>{ isSendingFeed ? 'Streaming...' : 'Send feed' }</button>
        </Box>
        {
          !!this.state.recordedVideos.length && (
            <Box>{
              this.state.recordedVideos.map( recordedVideo => {
                return <RecordingOptionsBox
                  key={ recordedVideo.videoId }
                  recordedVideo={ recordedVideo }
                  play={ () => this.showRecording( recordedVideo ) }
                  send={ () => this.sendRecording( recordedVideo ) }
                  save={ () => this.saveRecording( recordedVideo ) }
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
  // Something to get initial available recordings list?
  // Longer term, the server should probably have a list. Also should be
  // possible to get from local, maybe.
  // Server provides list (files held by server), button can prepare it for playing.
  
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
    <span className="ROB-button" onClick={ props.save }>Save</span>
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
  console.log( 'ExtVideoBlock - props:', props );
  
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
    registerVideo={ ( data, videoId ) => {
      props.dispatch( { type: 'REGISTER_VIDEO_PLAYER', data, videoId } );
      return () => props.dispatch( { type: 'UNREGISTER_VIDEO_PLAYER', videoId } );
    } }
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

// TODO.
class ChatBox extends Component {
  render() {
    return <div></div>;
  }
}

function OnlineIndicator() {
  var [ isOnline, setOnlineState ] = useState( navigator.onLine );
  
  useEffect( () => {
    function nowOnline() {
      setOnlineState( true );
    }
    function nowOffline() {
      setOnlineState( false );
    }
    
    addEventListener( 'online', nowOnline );
    addEventListener( 'offline', nowOffline );
    
    return () => {
      removeEventListener( 'online', nowOnline );
      removeEventListener( 'offline', nowOffline );
    }
  })
  
  return <div>{ isOnline ? 'O' : 'X' }</div>;
}

export default Home;
