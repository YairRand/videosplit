import React, { Component, useState, useRef, useEffect } from 'react';
import './Home.css';
import io from 'socket.io-client';
import { Provider, connect } from 'react-redux';

// TODO:
// * Start subtitles.
// * Self-view.
// * Show timer or live icon or what.
// * Other interrupt ways. (dedicated button, chat)
// * RESUME_REC should go back to time.
// * Stop feed button.
// * Module-ize some stuff.
// * Git init

// if ( typeof document !== 'undefined' ) {
//   document.body.onclick = e => socket.emit( 'spa', 'blah' );
// }

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

// There is actually an explicit warning in the docs not to use connect like this
// on the outer component... TODO: Fix.
const VideoGroup = connect( state => state )( class extends Component {
// const VideoGroup = connect( 
//   state => ( { streamIds: state.streams.map( stream => stream.userId ) } )
// )( class extends Component {
  
  constructor() {
    super();
  }
  
  componentDidMount() {
    
    var socket = window.socket;
    console.log(5454, this.props );
    this.socket = socket;
    
    console.log( 'didmount' );
  }
  
  componentWillUnmount() {
    this.socket.close();
  }
  
  sendFeed( vStream ) {
    this.props.streams.forEach( stream => {
      var pc = stream.pc;
      
      vStream.getTracks().forEach( track => pc.addTrack( track, vStream ) );
      
      console.log( 'sendFeed', pc, vStream );
    } );
  }
  
  receiveFeed() {
    
  }
  
  render() {
    console.log( 'render', this.state, this.props );
    
    // Should the user block always be at the top? For explicit student views, maybe not...
    // Also, student views shouldn't have all the extra buttons.
    // And instr views don't need hand buttons.
    
    return <div>
      <UserVideoBlock
        sendFeed={ stream => this.sendFeed( stream ) }
      />
      {
        this.props.streams.map( stream => {
          return <ExtVideoBlock { ...stream } dispatch={ this.props.dispatch } key={ 100 + stream.userId } />;
        } )
        // this.props.streamIds.map( streamId => {
        //   return <ExtVideoBlock userId={ streamId } key={ 100 + streamId } />;
        // } )
      }
    </div>;
  }
} );

// connect()( VideoGroup );

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
    webcam: 'OFF', // [ 'OFF', 'WAIT', 'ON' ]
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

  componentDidMount() {
    // this.getUserVideoStream();
  }
  
  componentWillUnmount() {
    console.log( 'unmount' );
    this.stopStream();
    this.recorder && this.stopRecording();
  }

  getUserVideoStream() {
    this.setState( { webcam: 'WAIT' } );
    console.log(91);
    navigator.mediaDevices.getUserMedia( { video: true } ).then( stream => {
      console.log( 'Begin video stream' );
      
      this.stream = stream;
      
      this.setState( { src: stream, webcam: 'ON' } );
    } );
  }
  
  stopStream() {
    console.log( 44, this.stream, this.stream.stop );
    this.stream && this.stream.getTracks().forEach( track => track.stop() );
    this.setState( { webcam: 'OFF' } );
  }
  
  recordStream() {
    this.chunks = [];
    this.recorder = new MediaRecorder( this.stream, { video: true } );
    this.recorder.ondataavailable = ( e ) => {
      console.log( 'new data', e.data, this.chunks.length );
      // NOTE: Only the first chunk, or the collection of all chunks until .stop() will work.
      this.chunks.push( e.data );
    };
    
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
        url: URL.createObjectURL( newBlob ),
        // Hope this is accurate...
        // If not, maybe set a video to the url and read .duration.
        length: Date.now() - this.state.recordingStart
      },
      recordedVideo = {
        blob: newBlob,
        ...videoData
      };
    
    this.sendRecording( recordedVideo );
    
    this.setState( {
      recordedVideos: this.state.recordedVideos.concat( recordedVideo ),
      recording: false,
      recordingStart: null
    } );
    
    this.props.dispatch( { type: 'NEW_RECORDING', video: videoData } )
    
    this.showRecording( recordedVideo );
    
    this.recorder.stop();
  }
  
  showRecording( { url } ) {
    console.log( 'q', this.chunks.length, url, this.chunks );
    
    this.setState( { recorded: url } );
  }
  
  sendFeed() {
    this.props.sendFeed( this.stream );
  }
  
  sendRecording( recordedVideo ) {
    
    // This is the complicated one. The blob currently doesn't make it to the store,
    // but does need to be emitted at some point.
    // The local store does need to know other data on the rec, however, but on
    // recording (or receiving), not on sending.
    
    // Other than for emitting, the blob never needs to be used. The URL is enough.
    
    this.props.dispatch( { type: 'EMIT', payload: { type: 'rec', rec: recordedVideo } } );
    
    
  }
  
  render() {
    var { webcam } = this.state;
    
    return (
      <div>
      
        <VideoBlock userId={ this.props.userId } src={ this.state.src } onEnded={ e => {
          // Would this ever even have an end?
        } } />
        <Box>
          <button
            onClick={ () => webcam === 'OFF' ? this.getUserVideoStream() : this.stopStream() }
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
          <br />
          <button onClick={ () => this.sendFeed() } disabled={ webcam !== 'ON' }>Send feed</button>
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
        <video height={100} width={100} src={ this.state.recorded } key={1} autoPlay loop ref={ this.ref2 } onClick={ () => { this.setState( { recorded: this.firstUrl } ) } } />
        <SendBox />
      </div>
    )
  }
} );

// This is the real 'raw' VideoBlock, with just src and such.

// (Not sure how rewinding and such would work here...)
function VideoBlock( { src, onEnded, userId } ) {
  var ref = useRef(),
    canvasRef = useRef(),
    baseHeight = 200,
    baseWidth = 200;
  
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
        
        // TODO: Set .currentTime when resuming.
        // Setting time could be difficult for other situations. We don't know
        // how to tell set-0 -> (stay) from set-0 -> set-back-to-0 again...
        // Can only check this on src change.
        elem.src = src;
      } else {
        // Undefined src. (Probably on init.)
        // removeAttribute?
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
  
  // Note: Self-views don't need the canvas, I think? Also student views.
  return <div className='VideoBlock'>
    <canvas width={baseWidth} height={baseHeight} ref={ canvasRef } style={{ position: 'absolute', left: 0 }} />
    <video
      width={baseWidth} height={baseHeight} autoPlay
      ref={ ref }
      style={{ position: 'relative', zIndex: 1 }}
      onEnded={ onEnded }
    />
    { 'Person' + userId }
  </div>;
}

// TODO: Move a lot of stuff here.
// Make this a 'user area'?
// Unused.
const _UserVideoBlock = connect( state => ( { userId: state.userId } ) )( class extends Component {
  render() {
    console.log( 44422, this.props );
    return <>
      <VideoBlock { ...this.props } />
      <SendBox />
    </>;
  }
} );

class ExtVideoBlock extends Component {
// const ExtVideoBlock = connect( ( state, ownProps ) => state.streams[ ownProps.userId ] )( class extends Component {
  componentDidMount() {
    
  }
  
  render() {
    console.log( 442, this.props )
    return <>
      <VideoBlock
        userId={ this.props.userId }
        src={ this.props.src }
        onEnded={ e=>{
          console.log( 4422, e, this.props );
          // Issue: onEnded might be called when video is cut off due to disconnect.
          // TODO: This should emit, I think.
          this.props.dispatch( { type: 'VIDEO_END', fromUser: this.props.userId } );
        } }
      />
      <div>
        { this.props.hand && <div style={{ boxShadow: this.props.interrupting ? '0 0 2px inset #000000' : '' }} onClick={ e => {
          // React to hand. Probably interrupt any recorded with live.
          // Same thing for reacting to chat.
          
          // TODO: Only interrupt when st is viewing rec.
          this.props.dispatch( { type: !this.props.interrupting ? 'X_INTERRUPT_WITH_LIVE' : 'X_RESUME_REC', toUser: this.props.userId } );
        } }>(HAND)</div> }
        { this.props.chats.map( ( chat, i ) => {
          // TODO: Fade out after some time, allow scrolling back into view somehow,
          // clicking should perform interrupt, have semi-transparent background,
          // place over video at the bottom? Show greyed timestamp?
          return <div key={ i }>{ chat.text }</div>;
        } ) }
      </div>
    </>;
  }
};

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
  </div>
} );

const HandButton = connect( state => ( { hand: state.hand } ) )( function HandButton( props ) {
  return <div
    onClick={ e => {
      props.dispatch( { type: 'X_HAND', raised: !props.hand } );
    } }
    style={ { border: '1px solid #AAA', boxShadow: props.hand ? '0 0 2px inset #000000' : '', display: 'inline-block' } }
  >Hand</div>
} );

function Subtitles() {
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
  
  // (Don't actually store the SR stuff here. Just pass this a list of recorded words.)
  // var r = new SpeechRecognition();
  // r.continuous = true;
  // r.onresult = e => {};
  // r.start();
  
  // The native one is low quality. Google's and Amazon's are much better, but cost money. (A's is ~$1.50/hour, G's ~$3/hour.)
  
  
  // useState and useEffect?
  return <div className='subtitle-box'>
    
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
    )
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
