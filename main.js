import fs from "fs";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
const app = express();
const server = createServer(app);

let allUniqueUsers = new Set();
const io = new Server(server, {
  cors: {
    origin: [
      "http://127.0.0.1:5500",
      "http://192.168.137.1",
      "http://192.168.137.130",
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("find-partner", async (data) => {
    console.log(`listening to the find-partner event  ${JSON.stringify(socket.handshake.auth)}  \n`);
    const allActiveSockets = await io.fetchSockets();

    for (const i of allActiveSockets) {
      console.log(i.handshake.auth.randomId , "randomId in loop" , socket.handshake.auth.randomId , " current random Id")
      if (i.handshake.auth.randomId !== socket.handshake.auth.randomId && socket.inRoom === undefined ) {
        const allRooms = io.sockets.adapter.rooms;
        if (!i.inRoom) {
          createRoom(socket, i);
        }
      }
    }
  });

  socket.on("video-offer" , async (msg) => {
    /*some socket is sending the sdp relay to the receiver ---task 
    
    send it to the callee...*/

    console.log(`listening to video-offer event --- ${JSON.stringify(msg)}`);

    const allActiveSockets = await io.fetchSockets();
    for ( const i of allActiveSockets) {
      console.log(`${i.handshake.auth.randomId} --- randomId in loop ${msg.randomId} -- sender's randomId`)
      if (i.handshake.auth.randomId !== msg.randomId) {
        i.emit("video-offer", msg);
      }
    }
    

  } )


  

  socket.on("new-ice-candidate", async (data) => {
    //where to send this???
    //send the delivered ice candidate information to the target ( also there in the data)
    console.log(`listening to new-ice-candidate event \n`);

    const allActiveSockets = await io.fetchSockets();

    for ( const i of allActiveSockets) {
      if (i.handshake.auth.randomId === data.target) {
           socket.emit("new-ice-candidate", data);
      }
    }
   
  });

  socket.on("video-answer", async (data) => {
    const allActiveSockets = await io.fetchSockets();
    for (const i of allActiveSockets) {
      if (i.handshake.auth.randomId === data.randomId) {
        i.emit("video-answer", data);
      }
    }
  });

  

});

function createRoom(callerSocketObject, calleeSocketObject) {
  let currentRandomId = callerSocketObject.handshake.auth.randomId;
  let randomId = calleeSocketObject.handshake.auth.randomId;

  let roomName =
    currentRandomId > randomId
      ? `${currentRandomId}:${randomId}`
      : `${randomId}:${currentRandomId}`;

  callerSocketObject.join(roomName);
  calleeSocketObject.join(roomName);
  callerSocketObject.inRoom = true;
  calleeSocketObject.inRoom = true;

  io.to(roomName).emit("room-joined", {
    roomName: roomName,
    participants: [
      {
        randomId: currentRandomId,
        type: "sender",
      },
      { randomId: randomId, type: "receiver" },
    ],
  });
}

const PORT = 5010;

server.listen(PORT, () => {
  console.log(`server listening on port ${PORT} `);
});
