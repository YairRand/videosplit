function displayVideo( chunks ) {
  var x = document.body.appendChild( document.createElement('video') );
  x.src = URL.createObjectURL( new Blob( chunks ) );
  x.play();
}

export default displayVideo;
