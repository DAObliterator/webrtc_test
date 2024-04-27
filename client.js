let localStream;
let remoteStream;
let remoteRandomId;
let myPeerConnection;
let roomName;
let offer_;
let answer_;
let randomId;
let didIOffer = false;
const localVideoEl = document.querySelector("#local-video");
const remoteVideoEl = document.querySelector("#remote-video");
const showVideoButton = document.querySelector("#showVideo");
let remoteIceCandidate;

let mediaConstraints = {
  //audio: true,
  video: true
}




if (!window.localStorage.getItem("randomId")) {
   randomId = "randomId-" + Math.floor(Math.random() * 100000);
   window.localStorage.setItem("randomId",randomId);
}


document.querySelector("#user-name").innerHTML = localStorage.getItem("randomId")

const socket = io.connect(`http://localhost:5010`, {
  auth: {
    randomId: window.localStorage.getItem("randomId"),
  },
});

document.addEventListener("DOMContentLoaded" , () => {

    socket.emit("find-partner" , {
      randomId: randomId
    });

    

})

socket.on("room-joined" , (data) => {
  console.log(data , "data from room joined");
  remoteRandomId = data.participants[1].randomId;
  roomName = data.roomName;

  window.localStorage.setItem("roomName", roomName) 
  window.localStorage.setItem("remoteRandomId",remoteRandomId) 
  if (myPeerConnection) {
    alert("You can't start a call because you already have one open!");
  } else {
    
    createPeerConnection();

    navigator.mediaDevices
      .getUserMedia(mediaConstraints)
      .then((localStream) => {
        localVideoEl.srcObject = localStream;
        localStream
          .getTracks()
          .forEach((track) => myPeerConnection.addTrack(track, localStream));
      })
      .catch((error) => {
        console.log(`${error} --- error happened while adding tracks \n`);
      });
  }

})


function createPeerConnection() {
  myPeerConnection = new RTCPeerConnection();

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.ontrack = handleTrackEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;
  
}

function handleICECandidateEvent(e) {

  console.log("...Ice candidate found!....");
    console.log(e , " e in handleICECandidate" );
    if (e.candiate) {
      socket.emit("new-ice-candidate" , {
        target: remoteRandomId,
        candiate: e.candidate,
      }) 
    }

}

function handleTrackEvent(e) {
  if (ev.streams && ev.streams[0]) {
      remoteVideoEl.srcObject = ev.streams[0];
    } else {
      remoteStream = new MediaStream(ev.track);
      remoteVideoEl.srcObject = remoteStream;
    }

}

function handleNegotiationNeededEvent() {

  myPeerConnection
    .createOffer()
    .then((offer) => {
      offer_ = offer;
      console.log(`setting local description as offer \n`);
      myPeerConnection.setLocalDescription(offer); //sdp
    }).then(() => {

      socket.emit("video-offer" , {
        randomId: randomId,
        remoteRandomId: remoteRandomId,
        description: "offer",
        sdp: myPeerConnection.localDescription,
      })
      
    })
    .catch((error) => {
      console.log(`ran into error when creating offer - ${error}`);
    });


}

socket.on("video-offer" , (data) => {
  //in this case you are the callee....
  console.log(`${data} --- from the caller `);
  if ( data.remoteRandomId === randomId) { 
    //you are the callee

  let remoteRandomId_;
  remoteRandomId_ = msg.remoteRandomId;
  createPeerConnection();
 

  const desc = new RTCSessionDescription(msg.sdp);

  myPeerConnection
    .setRemoteDescription(desc)
    .then(() => navigator.mediaDevices.getUserMedia(mediaConstraints))
    .then((stream) => {
      localStream = stream;
      document.getElementById("local_video").srcObject = localStream;

      localStream
        .getTracks()
        .forEach((track) => myPeerConnection.addTrack(track, localStream));
    })
    .then(() => myPeerConnection.createAnswer())
    .then((answer) => myPeerConnection.setLocalDescription(answer))
    .then(() => {

       const msg = {
        randomId:randomId,
        remoteRandomId: remoteRandomId_,
        sdp: myPeerConnection.localDescription,
      };

      socket.emit("video-answer" , msg)
      
    })
    .catch((error) => console.log(`${error} ran into some error `));


 
  }
})


socket.on("video-answer" , (msg) => {
  //in this case you are the caller...
  console.log(`listening to video-answer evevnt on the client side \n`)
  myPeerConnection.setRemoteDescription(msg.sdp);
 
})


socket.on("new-ice-candidate" , (msg) => {

  console.log(`listening to new-ice-candidate event on the client`)

  handleNewICECandidateMsg(msg);
});

function handleNewICECandidateMsg(msg) {
  console.log(msg , `msg inside new-ice-candidate`)
  const candidate = new RTCIceCandidate(msg.candidate);

 myPeerConnection.addIceCandidate(candidate).catch((error) => {
  console.log(`${error} happened while adding ice candidates `)
 });
}