window.onload = () => {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('./sw.js');
  }
    camStart();
}

// Override the function with all the posibilities
    navigator.getUserMedia ||
        (navigator.getUserMedia = navigator.mozGetUserMedia ||
        navigator.webkitGetUserMedia || navigator.msGetUserMedia);
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext;
var audioInput = null,
    realAudioInput = null,
    inputPoint = null;
var rafID = null;
var analyserContext = null;
var canvasWidth, canvasHeight;
var recIndex = 0;

var canvas;
var tempCanvas;
var tempCtx;
var index = 0;
var clearDisplay = 1;

function convertToMono( input ) {
    var splitter = audioContext.createChannelSplitter(2);
    var merger = audioContext.createChannelMerger(2);

    input.connect( splitter );
    splitter.connect( merger, 0, 0 );
    splitter.connect( merger, 0, 1 );
    return merger;
}

function cancelAnalyserUpdates() {
    window.cancelAnimationFrame( rafID );
    rafID = null;
}

var scale;
var update = 0;
var volumeList = [];
var colorScale = new chroma.scale(['black', 'red', 'yellow', 'white']).out('hex');
var hScale;

function updateAnalysers(time) {
    if (!analyserContext) {
      canvas = document.getElementById("analyser");
      canvasWidth = canvas.width;
      canvasHeight = canvas.height;
      analyserContext = canvas.getContext('2d');
      scale = analyserNode.context.sampleRate/(2.7*44100);
      if (scale < .1)
      		scale = .5;
      		// create a temp canvas we use for copying and scrolling
       tempCanvas = document.createElement("canvas"),
       tempCtx = tempCanvas.getContext("2d");
       tempCanvas.width=canvasWidth;
       tempCanvas.height=canvasHeight;
       hScale = canvasHeight/256;
    }

    var SPACING = 3;
    var BAR_WIDTH = 1;
    var numBars = Math.round(canvasWidth / SPACING);
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
    var smoothMag = 0;
    switch (index) {
      case 1 : // frequencies
        analyserNode.getByteFrequencyData(freqByteData); // frequency data
        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.fillStyle = 'rgba(0,0,0,0)'; //'#F6D565';
        analyserContext.lineCap = 'round';
        var multiplier = analyserNode.frequencyBinCount / numBars;

        // Draw rectangle for each frequency bin.
        for (var i = 0; i < numBars*scale; ++i) {
            var magnitude = 0;
            var offset = Math.floor( i * multiplier );
            // gotta sum/average the block, or we miss narrow-bandwidth spikes
            for (var j = 0; j< multiplier; j++)
                magnitude += freqByteData[offset + j];
            magnitude = magnitude / multiplier;
            smoothMag = (smoothMag+magnitude)/2;
            analyserContext.fillStyle = "hsl( " + Math.round((i*360)/numBars) + ", 100%, 50%)";
            analyserContext.fillRect(i * SPACING / scale, canvasHeight, BAR_WIDTH / scale, -smoothMag);
        }
        break;
      case 2 : // waveform
        update++;
        if (update > 4) { // update less frequently than other modes
          analyserNode.getByteTimeDomainData(freqByteData); //waveform data
          analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
          analyserContext.lineWidth = 2;
          analyserContext.strokeStyle = '#ff0000';
          analyserContext.beginPath();
          SPACING = canvasWidth/freqByteData.length;
          analyserContext.moveTo(0,canvasHeight/2);
          for (var i = 1; i < freqByteData.length; ++i) {
              magnitude = freqByteData[i]-127;
              analyserContext.lineTo(i * SPACING, magnitude+(canvasHeight/2) );
          }
          analyserContext.stroke();
          update = 0;
        }
        break;
      case 3 : // spectrogram
        analyserNode.getByteFrequencyData(freqByteData); // frequency data
	     // copy the current canvas onto the temp canvas
        if (clearDisplay == 1) {
        	analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
         	tempCtx.clearRect(0, 0, canvasWidth, canvasHeight);
         }

     		tempCtx.drawImage(canvas, 0, 0, canvasWidth, canvasHeight);

     // iterate over the elements from the array
     for (var i = 0; i < freqByteData.length; i++) {
         // draw each pixel with the specific color
         //var value = freqByteData[i];
         analyserContext.fillStyle = colorScale(freqByteData[i] / 256.0);

         // draw the line at the right side of the canvas
         analyserContext.fillRect(canvasWidth - 1, canvasHeight - i*hScale, 1, hScale);
     }

     // set translate on the canvas
     analyserContext.translate(-1, 0);
     // draw the copied image
     analyserContext.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);

     // reset the transformation matrix
     analyserContext.setTransform(1, 0, 0, 1, 0, 0);

        break;
      case 4 : // volume history
        analyserNode.getByteTimeDomainData(freqByteData); //waveform data
        analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
        analyserContext.strokeStyle = '#ff0000';
        analyserContext.lineCap = 'round';
        analyserContext.beginPath();
        analyserContext.moveTo(0,canvasHeight);
        var max = 0;
        for (var i = 0; i < freqByteData.length; ++i) {
            if (freqByteData[i]-127 > max)
              max = freqByteData[i]-127;
        }
        if (volumeList.length > canvasWidth/3)
          volumeList.shift();
        volumeList[volumeList.length] = max;
        for (var i = 0; i < canvasWidth/3; ++i) {
        //  analyserContext.lineTo(i, canvasHeight-(volumeList[i]*canvasHeight/128));
          analyserContext.fillStyle = "hsl( " + Math.round((i*360)/canvasWidth) + ", 100%, 50%)";
          analyserContext.fillRect(i*3, canvasHeight, 2, -(volumeList[i]*canvasHeight/128));
        }
        analyserContext.stroke();
        break;
    }
    clearDisplay = 0;
    rafID = window.requestAnimationFrame( updateAnalysers );
}


function gotStream(stream) {
    inputPoint = audioContext.createGain();

    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);

//    audioInput = convertToMono( input );

    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 512; //2048;
    inputPoint.connect( analyserNode );

//    audioRecorder = new Recorder( inputPoint );

//    zeroGain = audioContext.createGain();
//    zeroGain.gain.value = 0.0;
//    inputPoint.connect( zeroGain );
//    zeroGain.connect( audioContext.destination );
    updateAnalysers();
}

function initAudio() {
        if (!navigator.getUserMedia)
            navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!navigator.cancelAnimationFrame)
            navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
        if (!navigator.requestAnimationFrame)
            navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

    navigator.getUserMedia({audio:true}, gotStream, function(e) {
            alert('Error getting audio');
            console.log(e);
        });
}
    function MonitorKeyUp(e) {
      if (!e) e=window.event;
        if (e.keyCode == 32 || e.keyCode == 49)
            Action(4);
        if (e.keyCode == 50)
				Action(2);
        if (e.keyCode == 51  || e.keyCode == 13)
				Action(3);
        if (e.keyCode == 52)
				Action(1);
       return false;
    }

var mouseState = 0;
     function MonitorMouseDown(e) {
      if (!e) e=window.event;
        if (e.button == 0) {
            mouseState = 1;
            	mouseX =e.clientX/canvas.scrollWidth;
	   			mouseY =1.0 - e.clientY/canvas.scrollHeight;
         }
      return false;
    }

    function MonitorMouseUp(e) {
      if (!e) e=window.event;
        if (e.button == 0) {
            mouseState = 0;
         }
      return false;
    }

  var splash;
  var button;
  var button1;
  var button2;
  var button3;
  var btnBack;

    function camStart() {
        splash  = document.querySelector('splash');
        button = document.querySelector('button');
        button1 = document.querySelector('button1');
        button2 = document.querySelector('button2');
        button3 = document.querySelector('button3');
        btnBack = document.querySelector('back');
        canvas = document.getElementById("analyser");
//        canvas.style.background='rgba(0,0,0,0)';
//        canvas.style.zIndex = 800;
//        analyserContext = canvas.getContext('2d');

		    btnBack.onclick = function(e) {
		      splash.hidden = false;
 	         button.hidden = false;
   		      button1.hidden = false;
          	button2.hidden = false;
          	button3.hidden = false;
          	btnBack.hidden = true;
		    }

 		 button.onmousedown = function(e) {
       	Action(1);
       }
       button1.onmousedown = function(e) {
       	Action(2);
       }
       button2.onmousedown = function(e) {
       	Action(3);
       }
       button3.onmousedown = function(e) {
       	Action(4);
        }
        canvas.onkeyup = MonitorKeyUp;
        canvas.onmousedown = MonitorMouseDown;
        canvas.onmouseup = MonitorMouseUp;
    }

function startAudio()
{
    if (audioContext == null) {
    audioContext = new AudioContext();
    initAudio();
    }
}

    function Action(i){
      startAudio();
      index = i;
      splash.hidden = true;
      button.hidden = true;
      button1.hidden = true;
      button2.hidden = true;
      button3.hidden = true;
      btnBack.hidden = false;
      	clearDisplay = 1;
    }
