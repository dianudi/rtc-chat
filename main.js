const ws = new WebSocket("/ws");
let myUsername = "";
let targetUsername = "";
let peerConnection;
let dataChannel;
let iceCandidateQueue = [];

const loginView = document.getElementById("login-view");
const userListView = document.getElementById("user-list-view");
const chatView = document.getElementById("chat-view");

const userList = document.getElementById("user-list");
const chatMessages = document.getElementById("chat-messages");
const chatWithUsername = document.getElementById("chat-with-username");
const loggedInUsernameSpan = document.getElementById("loggedInUsername");

const loginBtn = document.getElementById("loginBtn");
const backBtn = document.getElementById("backBtn");
const sendBtn = document.getElementById("sendBtn");
const messageForm = document.getElementById("message-form");
const usernameInput = document.getElementById("username");
const chatMessageInput = document.getElementById("chatMessage");
const imageInput = document.getElementById("imageInput");
const fileInput = document.getElementById("fileInput");
const videoInput = document.getElementById("videoInput");
const logoutBtn = document.getElementById("logoutBtn");
const recordAudioBtn = document.getElementById("recordAudioBtn");
const stopRecordAudioBtn = document.getElementById("stopRecordAudioBtn");
const darkModeToggle = document.getElementById("darkModeToggle");
const darkModeIcon = document.getElementById("darkModeIcon");

// Dark Mode Toggle
const getPreferredTheme = () => {
  const storedTheme = localStorage.getItem('theme')
  if (storedTheme) {
    return storedTheme
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const setTheme = (theme) => {
  document.documentElement.setAttribute('data-bs-theme', theme)
  localStorage.setItem('theme', theme)
  updateIcon(theme);
}

const updateIcon = (theme) => {
  if (theme === 'dark') {
    darkModeIcon.classList.remove('bi-moon-stars-fill');
    darkModeIcon.classList.add('bi-sun-fill');
  } else {
    darkModeIcon.classList.remove('bi-sun-fill');
    darkModeIcon.classList.add('bi-moon-stars-fill');
  }
}

setTheme(getPreferredTheme())

darkModeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute('data-bs-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
});
const audioPlayer = document.getElementById("audioPlayer");

// Image chunking variables
const CHUNK_SIZE = 16 * 1024; // 16KB
let receivedImageChunks = {};
let receivedFileChunks = {};
let receivedVideoChunks = {};

// Voice note variables
let mediaRecorder;
let audioChunks = [];
let audioStream;
let receivedAudioChunks = {};

function showView(view) {
  loginView.style.display = "none";
  userListView.style.display = "none";
  chatView.style.display = "none";

  view.style.display = "flex"; // Use flex for views that are flex containers
}

function createChatBubbleElement(content, type = "received", isImage = false, isAudio = false, isFile = false, isVideo = false) {
  const bubble = document.createElement("div");
  if (type === "system") {
    bubble.classList.add("text-center", "text-muted", "small", "my-2");
    bubble.textContent = content;
  } else {
    bubble.classList.add("message", type === "sent" ? "sent" : "received");
    if (isImage) {
      const img = document.createElement("img");
      img.src = content;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "0.75rem";
      bubble.appendChild(img);
    } else if (isAudio) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = content;
      bubble.appendChild(audio);
    } else if (isFile) {
      const link = document.createElement("a");
      link.href = content;
      link.textContent = content;
      link.download = content;
      bubble.appendChild(link);
    } else if (isVideo) {
      const video = document.createElement("video");
      video.controls = true;
      video.src = content;
      video.style.maxWidth = "100%";
      video.style.borderRadius = "0.75rem";
      bubble.appendChild(video);
    } else {
      bubble.textContent = content;
    }
  }
  return bubble;
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log(`Data channel open with ${targetUsername}`);
    chatMessageInput.disabled = false;
    sendBtn.disabled = false;
    imageInput.disabled = false;
    recordAudioBtn.disabled = false;
    // dataChannel.send(JSON.stringify({ type: "text", data: `👋 Hello from ${myUsername}!` }));
    // chatMessages.appendChild(createChatBubbleElement(`👋 Hello from ${myUsername}!`, "sent"));
  };

  dataChannel.onmessage = ({ data }) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "image") {
        chatMessages.appendChild(createChatBubbleElement(msg.data, "received", true));
      } else if (msg.type === "text") {
        chatMessages.appendChild(createChatBubbleElement(msg.data, "received", false));
      } else if (msg.type === "audio") {
        chatMessages.appendChild(createChatBubbleElement(msg.data, "received", false, true));
      } else if (msg.type === "image_chunk") {
        if (!receivedImageChunks[msg.fileId]) {
          receivedImageChunks[msg.fileId] = {
            chunks: [],
            receivedCount: 0,
            totalChunks: msg.totalChunks,
            mimeType: msg.mimeType,
          };
        }
        receivedImageChunks[msg.fileId].chunks[msg.chunkIndex] = msg.data;
        receivedImageChunks[msg.fileId].receivedCount++;

        if (receivedImageChunks[msg.fileId].receivedCount === receivedImageChunks[msg.fileId].totalChunks) {
          const fullImageData = receivedImageChunks[msg.fileId].chunks.join("");
          const dataUrl = `data:${receivedImageChunks[msg.fileId].mimeType};base64,${fullImageData}`;
          chatMessages.appendChild(createChatBubbleElement(dataUrl, "received", true));
          delete receivedImageChunks[msg.fileId]; // Clean up
        }
      } else if (msg.type === "audio_chunk") {
        if (!receivedAudioChunks[msg.fileId]) {
          receivedAudioChunks[msg.fileId] = {
            chunks: [],
            receivedCount: 0,
            totalChunks: msg.totalChunks,
            mimeType: msg.mimeType,
          };
        }
        receivedAudioChunks[msg.fileId].chunks[msg.chunkIndex] = msg.data;
        receivedAudioChunks[msg.fileId].receivedCount++;

        if (receivedAudioChunks[msg.fileId].receivedCount === receivedAudioChunks[msg.fileId].totalChunks) {
          const fullAudioData = receivedAudioChunks[msg.fileId].chunks.join("");
          const audioUrl = `data:${receivedAudioChunks[msg.fileId].mimeType};base64,${fullAudioData}`;
          chatMessages.appendChild(createChatBubbleElement(audioUrl, "received", false, true));
          delete receivedAudioChunks[msg.fileId]; // Clean up
        }
      } else if (msg.type === "file") {
        chatMessages.appendChild(createChatBubbleElement(msg.data, "received", false, false, true));
      } else if (msg.type === "file_chunk") {
        if (!receivedFileChunks[msg.fileId]) {
          receivedFileChunks[msg.fileId] = {
            chunks: [],
            receivedCount: 0,
            totalChunks: msg.totalChunks,
            mimeType: msg.mimeType,
            fileName: msg.fileName,
          };
        }
        receivedFileChunks[msg.fileId].chunks[msg.chunkIndex] = msg.data;
        receivedFileChunks[msg.fileId].receivedCount++;

        if (receivedFileChunks[msg.fileId].receivedCount === receivedFileChunks[msg.fileId].totalChunks) {
          const fullFileData = receivedFileChunks[msg.fileId].chunks.join("");
          const dataUrl = `data:${receivedFileChunks[msg.fileId].mimeType};base64,${fullFileData}`;
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = receivedFileChunks[msg.fileId].fileName;
          link.textContent = receivedFileChunks[msg.fileId].fileName;
          const bubble = createChatBubbleElement("", "received", false, false, true);
          bubble.appendChild(link);
          chatMessages.appendChild(bubble);
          delete receivedFileChunks[msg.fileId]; // Clean up
        }
      } else if (msg.type === "video") {
        chatMessages.appendChild(createChatBubbleElement(msg.data, "received", false, false, false, true));
      } else if (msg.type === "video_chunk") {
        if (!receivedVideoChunks[msg.fileId]) {
          receivedVideoChunks[msg.fileId] = {
            chunks: [],
            receivedCount: 0,
            totalChunks: msg.totalChunks,
            mimeType: msg.mimeType,
          };
        }
        receivedVideoChunks[msg.fileId].chunks[msg.chunkIndex] = msg.data;
        receivedVideoChunks[msg.fileId].receivedCount++;

        if (receivedVideoChunks[msg.fileId].receivedCount === receivedVideoChunks[msg.fileId].totalChunks) {
          const fullVideoData = receivedVideoChunks[msg.fileId].chunks.join("");
          const dataUrl = `data:${receivedVideoChunks[msg.fileId].mimeType};base64,${fullVideoData}`;
          chatMessages.appendChild(createChatBubbleElement(dataUrl, "received", false, false, false, true));
          delete receivedVideoChunks[msg.fileId]; // Clean up
        }
      } else {
        console.warn("Received unknown message type:", msg);
      }
    } catch (e) {
      console.error("Failed to parse data channel message as JSON:", data, e);
      chatMessages.appendChild(createChatBubbleElement(data, "received", false));
    }
  };

  dataChannel.onclose = () => {
    console.log(`Data channel closed with ${targetUsername}`);
  };
}

function initializePeerConnection() {
  peerConnection = new RTCPeerConnection();
  iceCandidateQueue = [];

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      ws.send(JSON.stringify({ type: "iceCandidate", candidate, to: targetUsername }));
    }
  };

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };

  peerConnection.ontrack = (event) => {
    audioPlayer.srcObject = event.streams[0];
    audioPlayer.play();
  };

  // Add logging for connection state changes
  peerConnection.oniceconnectionstatechange = () => {
    console.log(`ICE connection state: ${peerConnection.iceConnectionState}`);
  };
  peerConnection.onconnectionstatechange = () => {
    console.log(`Peer connection state: ${peerConnection.connectionState}`);
  };
}

function processIceCandidateQueue() {
  while (iceCandidateQueue.length > 0) {
    const candidate = iceCandidateQueue.shift();
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
}

function getColorForUsername(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
}

function updateUserListUI(onlineUsers) {
  userList.innerHTML = "";
  const usersToDisplay = Array.isArray(onlineUsers) ? onlineUsers : [];
  const otherUsers = usersToDisplay.filter((user) => user !== myUsername);

  if (otherUsers.length === 0) {
    const item = document.createElement("div");
    item.classList.add("list-group-item", "text-center", "text-muted");
    item.textContent = "No other users online.";
    userList.appendChild(item);
  } else {
    otherUsers.forEach((user) => {
      const item = document.createElement("a");
      item.href = "#";
      item.classList.add("list-group-item", "list-group-item-action", "d-flex", "align-items-center");

      const icon = document.createElement("i");
      icon.classList.add("bi", "bi-person-fill", "me-3");
      icon.style.color = getColorForUsername(user);
      icon.style.fontSize = "1.5rem";

      item.appendChild(icon);
      item.append(user);

      item.onclick = () => {
        targetUsername = user;
        chatWithUsername.textContent = targetUsername;
        showView(chatView);

        initializePeerConnection();
        dataChannel = peerConnection.createDataChannel("dataChannel");
        setupDataChannel();

        peerConnection.createOffer().then((offer) => {
          peerConnection.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", offer, to_username: targetUsername }));
        });
      };
      userList.appendChild(item);
    });
  }
}

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  switch (msg.type) {
    case "userList":
      updateUserListUI(msg.users);

      if (chatView.style.display === "flex" && !msg.users.includes(targetUsername)) {
        chatMessages.appendChild(createChatBubbleElement(`${targetUsername} has left the chat.`, "system"));
        chatMessageInput.disabled = true;
        sendBtn.disabled = true;
        imageInput.disabled = true;
        recordAudioBtn.disabled = true;
      }
      break;

    case "offer":
      targetUsername = msg.from;
      chatWithUsername.textContent = targetUsername;
      showView(chatView);

      initializePeerConnection();
      peerConnection
        .setRemoteDescription(new RTCSessionDescription(msg.offer))
        .then(() => {
          processIceCandidateQueue();
          return peerConnection.createAnswer();
        })
        .then((answer) => {
          peerConnection.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", answer, to: msg.from }));
        });
      break;

    case "answer":
      peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer)).then(() => {
        processIceCandidateQueue();
      });
      break;

    case "iceCandidate":
      if (peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } else {
        iceCandidateQueue.push(msg.candidate);
      }
      break;
  }
};

function performLogin() {
  myUsername = usernameInput.value;
  if (myUsername) {
    localStorage.setItem("username", myUsername); // Save username
    // Ensure WebSocket is open before sending the join message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "join", username: myUsername }));
      showView(userListView);
    } else {
      // If WS is not open yet, the ws.onopen event will handle the join message
      console.warn("WebSocket not open yet. Login will proceed when WS opens.");
      showView(loginView); // Stay on login view until WS is open and joined
    }
  }
}

loginBtn.onclick = performLogin;

// Auto-login on page load
window.onload = () => {
  const storedUsername = localStorage.getItem("username");
  if (storedUsername) {
    usernameInput.value = storedUsername;
    // The actual login (ws.send) will be triggered by ws.onopen
  } else {
    showView(loginView); // Show login view if no stored username
  }
};

ws.addEventListener("open", () => {
  console.log("ws open");
  // If a username is in the input field (from localStorage or manual entry)
  // and we haven't logged in yet (myUsername is empty), then perform login.
  if (usernameInput.value && myUsername === "") {
    performLogin(); // This will now send the join message
  }
});

backBtn.onclick = () => {
  showView(userListView);
  chatMessages.innerHTML = "";
  chatMessageInput.disabled = true;
  sendBtn.disabled = true;
  imageInput.disabled = true;
  recordAudioBtn.disabled = true;
  stopRecordAudioBtn.classList.add("d-none");
  recordAudioBtn.classList.remove("d-none");
};

logoutBtn.onclick = () => {
  localStorage.removeItem("username"); // Clear username from localStorage
  if (peerConnection) {
    peerConnection.close();
  }
  ws.close(); // Close WebSocket connection
  location.reload(); // Reload page to reset application state
};

messageForm.onsubmit = (e) => {
  e.preventDefault();
  const message = chatMessageInput.value;
  if (message && dataChannel && dataChannel.readyState === "open") {
    dataChannel.send(JSON.stringify({ type: "text", data: message }));
    chatMessages.appendChild(createChatBubbleElement(message, "sent", false));
    chatMessageInput.value = "";
  } else if (!dataChannel || dataChannel.readyState !== "open") {
    alert("Data channel not open. Please wait for connection or select a user.");
  }
};

imageInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file && dataChannel && dataChannel.readyState === "open") {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target.result.split(",")[1]; // Get base64 data without prefix
      const mimeType = file.type;
      const fileId = Date.now().toString(); // Unique ID for this file transfer

      if (imageData.length > CHUNK_SIZE) {
        const totalChunks = Math.ceil(imageData.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = imageData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          dataChannel.send(
            JSON.stringify({
              type: "image_chunk",
              fileId: fileId,
              chunkIndex: i,
              totalChunks: totalChunks,
              mimeType: mimeType,
              data: chunk,
            })
          );
        }
      } else {
        // Send as a single message if small enough
        dataChannel.send(JSON.stringify({ type: "image", data: `data:${mimeType};base64,${imageData}` }));
      }
      chatMessages.appendChild(createChatBubbleElement(`data:${mimeType};base64,${imageData}`, "sent", true));
    };
    reader.readAsDataURL(file);
  } else if (!dataChannel || dataChannel.readyState !== "open") {
    alert("Data channel not open. Please wait for connection or select a user.");
  }
  imageInput.value = ""; // Clear the input so the same file can be selected again
};

fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file && dataChannel && dataChannel.readyState === "open") {
    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = event.target.result.split(",")[1]; // Get base64 data without prefix
      const mimeType = file.type;
      const fileName = file.name;
      const fileId = Date.now().toString(); // Unique ID for this file transfer

      if (fileData.length > CHUNK_SIZE) {
        const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = fileData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          dataChannel.send(
            JSON.stringify({
              type: "file_chunk",
              fileId: fileId,
              fileName: fileName,
              chunkIndex: i,
              totalChunks: totalChunks,
              mimeType: mimeType,
              data: chunk,
            })
          );
        }
      } else {
        // Send as a single message if small enough
        dataChannel.send(JSON.stringify({ type: "file", data: `data:${mimeType};base64,${fileData}`, fileName: fileName }));
      }
      chatMessages.appendChild(createChatBubbleElement(file.name, "sent", false, false, true));
    };
    reader.readAsDataURL(file);
  } else if (!dataChannel || dataChannel.readyState !== "open") {
    alert("Data channel not open. Please wait for connection or select a user.");
  }
  fileInput.value = ""; // Clear the input so the same file can be selected again
};

videoInput.onchange = (e) => {
  const file = e.target.files[0];
  if (file && dataChannel && dataChannel.readyState === "open") {
    const reader = new FileReader();
    reader.onload = (event) => {
      const videoData = event.target.result.split(",")[1]; // Get base64 data without prefix
      const mimeType = file.type;
      const fileId = Date.now().toString(); // Unique ID for this file transfer

      if (videoData.length > CHUNK_SIZE) {
        const totalChunks = Math.ceil(videoData.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = videoData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          dataChannel.send(
            JSON.stringify({
              type: "video_chunk",
              fileId: fileId,
              chunkIndex: i,
              totalChunks: totalChunks,
              mimeType: mimeType,
              data: chunk,
            })
          );
        }
      } else {
        // Send as a single message if small enough
        dataChannel.send(JSON.stringify({ type: "video", data: `data:${mimeType};base64,${videoData}` }));
      }
      chatMessages.appendChild(createChatBubbleElement(`data:${mimeType};base64,${videoData}`, "sent", false, false, false, true));
    };
    reader.readAsDataURL(file);
  } else if (!dataChannel || dataChannel.readyState !== "open") {
    alert("Data channel not open. Please wait for connection or select a user.");
  }
  videoInput.value = ""; // Clear the input so the same file can be selected again
};

recordAudioBtn.onclick = async () => {
  if (!dataChannel || dataChannel.readyState !== "open") {
    alert("Data channel not open. Please wait for connection or select a user.");
    return;
  }

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(audioStream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = (event) => {
        const audioData = event.target.result.split(",")[1]; // Get base64 data without prefix
        const mimeType = audioBlob.type;
        const fileId = Date.now().toString();

        if (audioData.length > CHUNK_SIZE) {
          const totalChunks = Math.ceil(audioData.length / CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            const chunk = audioData.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            dataChannel.send(
              JSON.stringify({
                type: "audio_chunk",
                fileId: fileId,
                chunkIndex: i,
                totalChunks: totalChunks,
                mimeType: mimeType,
                data: chunk,
              })
            );
          }
        } else {
          dataChannel.send(JSON.stringify({ type: "audio", data: `data:${mimeType};base64,${audioData}` }));
        }
        chatMessages.appendChild(createChatBubbleElement(`data:${mimeType};base64,${audioData}`, "sent", false, true));
      };
      reader.readAsDataURL(audioBlob);

      // Stop all tracks in the stream
      audioStream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    recordAudioBtn.classList.add("d-none");
    stopRecordAudioBtn.classList.remove("d-none");
    chatMessageInput.disabled = true;
    sendBtn.disabled = true;
    imageInput.disabled = true;
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("Could not access microphone. Please ensure it's connected and permissions are granted.");
  }
};

stopRecordAudioBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordAudioBtn.classList.remove("d-none");
    stopRecordAudioBtn.classList.add("d-none");
    chatMessageInput.disabled = false;
    sendBtn.disabled = false;
    imageInput.disabled = false;
  }
};
