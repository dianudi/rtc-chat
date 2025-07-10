# RTC Chat

A real-time chat application using WebRTC for peer-to-peer data channels and WebSockets for signaling. This allows users to chat directly with each other, supporting text messages, image sharing, and voice notes.

## Features

- User authentication (simple username login).
- List of online users.
- Peer-to-peer chat sessions.
- Text messaging.
- Image sharing (with chunking for large files).
- Voice note recording and sharing.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript (Vite for development)
- **Signaling Server:** Node.js with `ws` (WebSocket) library
- **P2P Communication:** WebRTC (`RTCPeerConnection`, `RTCDataChannel`)

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/dianudi/rtc-chat.git
    cd rtc-chat
    ```

2.  **Install dependencies:**
    This project uses Yarn for package management.
    ```bash
    yarn install
    ```

## Usage

To run the application, you need to start both the signaling server and the frontend development server.

1.  **Start the Signaling Server:**
    This server handles user registration and WebRTC signaling.

    ```bash
    yarn run start:server
    ```

    The server will be running on `http://localhost:3000`.

2.  **Start the Frontend Dev Server:**
    In a new terminal, run the Vite development server.

    ```bash
    yarn dev
    ```

    Vite will provide a URL to open in your browser, typically `http://localhost:5173`.

3.  **Open the application:**
    Open two browser tabs/windows to the URL provided by Vite to simulate a chat between two users.

## Build

To create a production build of the frontend assets:

```bash
yarn build
```

This command will generate a `dist` directory with the optimized and bundled static files. You can then serve these files with a static file server. The included Node.js server is also configured to serve the `dist` directory.
